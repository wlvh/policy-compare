mod comparison;
mod edits;
mod model;
mod structure;
mod text;
use model::*;
use serde_json::json;
use std::cell::RefCell;
pub const CORE_VERSION: &str = "policy-compare-rust/0.1.0+row-identity.36+facts.6+repeat.9+ops.4+messages.en.1";
#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "host")]
unsafe extern "C" {
    fn phase(code: u32);
    fn check();
}
pub fn checkpoint() {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        check()
    }
}
pub fn notify(n: u32) {
    #[cfg(target_arch = "wasm32")]
    unsafe {
        phase(n)
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = n;
}
#[derive(Default)]
struct Session {
    docs: [Doc; 2],
    profile: V,
    budget: V,
    compared: bool,
}
thread_local! {static SESSION:RefCell<Session>=RefCell::new(Session::default());static INPUT:RefCell<Vec<u8>>=const{RefCell::new(Vec::new())};static OUTPUT:RefCell<Vec<u8>>=const{RefCell::new(Vec::new())};}
fn execute(v: V) -> Result<V, String> {
    SESSION.with(|cell| {
        let mut x = cell.borrow_mut();
        let side = v["side"].as_u64().unwrap_or(2) as usize;
        match s(&v["op"]) {
            "version" => Ok(json!({"abi":"policy-core-session/1","input":"policy-compare/0.1.0","result":"policy-compare-result/2","coreVersion":CORE_VERSION})),
            "reset" => {
                validate_configuration(&v["profile"], &v["budget"])?;
                *x = Session::default();
                x.profile = v["profile"].clone();
                x.budget = v["budget"].clone();
                Ok(V::Null)
            }
            "meta" if side < 2 => { x.docs[side].meta(v["meta"].clone())?; Ok(V::Null) }
            "page" if side < 2 => { x.docs[side].page(v["page"].clone())?; Ok(V::Null) }
            "done" if side < 2 => { x.docs[side].finish()?; Ok(V::Null) }
            "compare" => {
                if !x.docs.iter().all(|d|d.done) { return Err("Both documents must be complete".into()); }
                if x.compared { return Err("Comparison already completed".into()); }
                let r = comparison::compare(&x.docs[0], &x.docs[1], &x.profile, &x.budget)?;
                x.compared = true;
                Ok(r)
            }
            "search" => {
                let needle: Vec<_> = text::nfkc(s(&v["query"])).chars().collect();
                let mut hits = vec![];
                if needle.is_empty() { return Ok(json!([])); }
                for side in 0..2 {
                    if s(&v["side"]) == if side == 0 {"right"} else {"left"} { continue; }
                    let doc = &x.docs[side];
                    if !doc.done { continue; }
                    for u in structure::structure(doc, &x.profile, &[])? {
                        let hay: Vec<_> = u.m.text.chars().collect();
                        for i in 0..=hay.len().saturating_sub(needle.len()) {
                            if hay.get(i..i+needle.len()) == Some(needle.as_slice()) {
                                let refs: Vec<_> = u.m.mapping[i..i+needle.len()].iter().flatten().map(|i|u.m.refs[*i]).collect();
                                hits.push(locations(&refs, doc, if side == 0 {"left"} else {"right"}, &u.id));
                            }
                        }
                    }
                }
                Ok(json!(hits))
            }
            "dispose" => { *x = Session::default(); Ok(V::Null) }
            _ => Err("Unknown operation or side".into())
        }
    })
}
fn validate_configuration(profile: &V, budget: &V) -> Result<(), String> {
    let valid_budget = ["candidates", "tokenProducts", "diffProducts"]
        .iter()
        .all(|k| {
            budget[k]
                .as_f64()
                .is_some_and(|n| n.is_finite() && n >= 0. && n.fract() == 0.)
        });
    let valid_thresholds = ["local", "global"].iter().all(|k| {
        profile["thresholds"][k]
            .as_f64()
            .is_some_and(|n| (0.0..=1.0).contains(&n))
    });
    if !valid_budget
        || !valid_thresholds
        || !profile["version"].is_string()
        || !profile["fields"].is_object()
        || !profile["subjects"].is_object()
        || !profile["subjectFields"].is_array()
        || !profile["table"]["headers"].is_array()
        || !profile["table"]["columns"].is_array()
        || !profile["table"]["name"].is_string()
        || profile["table"]["headers"].as_array().unwrap().len()
            != profile["table"]["columns"].as_array().unwrap().len()
    {
        return Err("Invalid core configuration or budget".into());
    }
    if profile["table"]["headers"].as_array().unwrap().is_empty()
        || ["headers", "columns"].iter().any(|k| {
            profile["table"][k]
                .as_array()
                .unwrap()
                .iter()
                .any(|x| !x.is_string())
        })
        || ["fields", "subjects"].iter().any(|k| {
            profile[k]
                .as_object()
                .unwrap()
                .values()
                .any(|x| !x.is_string())
        })
        || profile["subjectFields"]
            .as_array()
            .unwrap()
            .iter()
            .any(|x| !x.is_string())
        || profile["thresholds"]["globalMinTokens"].as_u64().is_none()
    {
        return Err("Invalid core profile values".into());
    }
    Ok(())
}
// ABI owns both buffers. Host may only write the range returned by input_ptr,
// and must copy the output before the next call. No host-provided pointers.
#[unsafe(no_mangle)]
pub extern "C" fn input_ptr(len: usize) -> *mut u8 {
    INPUT.with(|x| {
        let mut b = x.borrow_mut();
        b.resize(len, 0);
        b.as_mut_ptr()
    })
}
#[unsafe(no_mangle)]
pub extern "C" fn call() {
    let r = INPUT.with(|b| {
        serde_json::from_slice::<V>(&b.borrow())
            .map_err(|e| e.to_string())
            .and_then(execute)
    });
    let out = match r {
        Ok(v) => json!({"ok":v}),
        Err(e) => json!({"error":e}),
    };
    OUTPUT.with(|b| *b.borrow_mut() = serde_json::to_vec(&out).unwrap());
    INPUT.with(|b| *b.borrow_mut() = Vec::new());
}
#[unsafe(no_mangle)]
pub extern "C" fn output_ptr() -> *const u8 {
    OUTPUT.with(|b| b.borrow().as_ptr())
}
#[unsafe(no_mangle)]
pub extern "C" fn output_len() -> usize {
    OUTPUT.with(|b| b.borrow().len())
}
#[unsafe(no_mangle)]
pub extern "C" fn clear_output() {
    OUTPUT.with(|b| *b.borrow_mut() = Vec::new())
}
