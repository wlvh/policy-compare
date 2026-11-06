use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
pub type V = Value;
pub type Map<K, T> = indexmap::IndexMap<K, T>;
pub type Set<T> = indexmap::IndexSet<T>;
pub fn s(v: &V) -> &str {
    v.as_str().unwrap_or("")
}
pub fn n(v: &V) -> f64 {
    v.as_f64().unwrap_or(0.)
}
pub fn canonical(v: &V) -> String {
    match v {
        V::Null => "null".into(),
        V::Bool(b) => b.to_string(),
        V::Number(x) => {
            let f = x.as_f64().unwrap();
            if f == 0. {
                "0".into()
            } else {
                ryu_js::Buffer::new().format_finite(f).into()
            }
        }
        V::String(t) => serde_json::to_string(t).unwrap(),
        V::Array(a) => format!(
            "[{}]",
            a.iter().map(canonical).collect::<Vec<_>>().join(",")
        ),
        V::Object(o) => {
            let mut keys: Vec<_> = o.keys().collect();
            keys.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            format!(
                "{{{}}}",
                keys.iter()
                    .map(|k| format!(
                        "{}:{}",
                        serde_json::to_string(k).unwrap(),
                        canonical(&o[*k])
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            )
        }
    }
}
pub fn digest(v: &V) -> String {
    format!("{:x}", Sha256::digest(canonical(v).as_bytes()))
}
#[derive(Clone, Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub id: String,
    pub text: String,
    pub raw_range: [usize; 2],
    pub origin: [f64; 2],
    pub quad: [f64; 8],
    pub size: f64,
    pub style: String,
    pub provenance: String,
    pub precision: String,
    pub source_ref: Option<V>,
    pub geometry_method: Option<String>,
    pub shared_geometry: Option<String>,
}
#[derive(Clone, Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Line {
    pub id: String,
    pub char_ids: Vec<String>,
    pub direction: [f64; 2],
    pub writing_mode: String,
    pub baseline: [f64; 2],
    pub baseline_provenance: String,
}
#[derive(Clone, Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub page_index: usize,
    pub width: f64,
    pub height: f64,
    pub transform: [f64; 6],
    pub inverse_transform: [f64; 6],
    pub chars: Vec<Character>,
    pub lines: Vec<Line>,
    pub text_items: Option<Vec<V>>,
    pub coverage_state: String,
    pub issues: Vec<V>,
}
#[derive(Default)]
pub struct Doc {
    pub meta: V,
    pub pages: Vec<Page>,
    pub hashes: Vec<String>,
    pub ids: HashSet<String>,
    pub done: bool,
}
impl Doc {
    pub fn meta(&mut self, v: V) -> Result<(), String> {
        if !self.meta.is_null() || self.done {
            return Err("Duplicate metadata".into());
        }
        if s(&v["schemaVersion"]) != "policy-compare/0.1.0"
            || s(&v["coordinateSystem"]) != "display-top-left-pt/ul-ur-ll-lr"
            || s(&v["indexUnit"]) != "unicode-scalar"
            || v["pageCount"].as_u64().is_none()
            || s(&v["contentHash"]).len() != 64
            || !s(&v["contentHash"])
                .chars()
                .all(|c| c.is_ascii_hexdigit() && !c.is_uppercase())
            || !v["extractor"].is_object()
            || !v["extractor"]["name"].is_string()
            || !v["extractor"]["version"].is_string()
            || !v["extractor"]["options"].is_object()
            || !v["diagnostics"].is_array()
        {
            return Err("Invalid document metadata".into());
        }
        if v["extractor"]["options"]
            .as_object()
            .unwrap()
            .values()
            .any(|x| !x.is_string() && !x.is_number() && !x.is_boolean())
            || v["diagnostics"]
                .as_array()
                .unwrap()
                .iter()
                .any(|x| !x.is_string())
            || v["extractor"]
                .get("adapterVersion")
                .is_some_and(|x| !x.is_string())
        {
            return Err("Invalid extractor metadata or diagnostics".into());
        }
        self.meta = v;
        Ok(())
    }
    pub fn page(&mut self, v: V) -> Result<(), String> {
        if self.meta.is_null() || self.done {
            return Err("Page outside input session".into());
        }
        let p: Page =
            serde_json::from_value(v.clone()).map_err(|e| format!("Invalid page: {e}"))?;
        if p.page_index != self.pages.len() || p.width <= 0. || p.height <= 0. {
            return Err("Non-contiguous page indexes or invalid dimensions".into());
        }
        if p.text_items.as_ref().is_some_and(|items| {
            items
                .iter()
                .any(|x| !x["id"].is_string() || !x["text"].is_string())
        }) {
            return Err("Invalid text items".into());
        }
        for c in v["chars"].as_array().ok_or("Invalid characters")? {
            if c.get("sharedGeometry").is_none() {
                return Err("Missing shared geometry declaration".into());
            }
        }
        let mut offset = 0;
        let mut ids = HashSet::new();
        for c in &p.chars {
            if c.id.is_empty()
                || c.text.is_empty()
                || c.size <= 0.
                || !["extracted", "synthetic", "inferred"].contains(&c.provenance.as_str())
                || !["glyph", "shared_glyph", "run", "line", "synthetic"]
                    .contains(&c.precision.as_str())
            {
                return Err("Invalid character".into());
            }
            if c.geometry_method
                .as_deref()
                .is_some_and(|x| !["native_glyph", "engine_run", "inferred"].contains(&x))
            {
                return Err("Invalid character geometry method".into());
            }
            if !self.ids.insert(c.id.clone()) {
                return Err("Duplicate character ID".into());
            }
            ids.insert(c.id.as_str());
            let count = c.text.chars().count();
            if c.raw_range != [offset, offset + count] {
                return Err("Invalid Unicode scalar range".into());
            }
            offset += count;
            if let Some(sr) = &c.source_ref {
                let item = p
                    .text_items
                    .as_ref()
                    .and_then(|xs| xs.iter().find(|x| x["id"] == sr["itemId"]))
                    .ok_or("Missing source item")?;
                let text = s(&item["text"]);
                let mut offsets = vec![0];
                for c in text.chars() {
                    offsets.push(offsets.last().unwrap() + c.len_utf16());
                }
                let a = sr["scalarRange"][0]
                    .as_u64()
                    .ok_or("Invalid source range")? as usize;
                let b = sr["scalarRange"][1]
                    .as_u64()
                    .ok_or("Invalid source range")? as usize;
                if a > b
                    || offsets.get(a).copied() != sr["utf16Range"][0].as_u64().map(|x| x as usize)
                    || offsets.get(b).copied() != sr["utf16Range"][1].as_u64().map(|x| x as usize)
                    || text.chars().skip(a).take(b - a).collect::<String>() != c.text
                {
                    return Err("Invalid source item Unicode/UTF-16 mapping".into());
                }
            }
        }
        let mut covered = HashSet::new();
        for l in &p.lines {
            if !["horizontal", "vertical"].contains(&l.writing_mode.as_str())
                || !["measured", "inferred", "synthetic"].contains(&l.baseline_provenance.as_str())
            {
                return Err("Invalid line metadata".into());
            }
            for id in &l.char_ids {
                if !ids.contains(id.as_str()) || !covered.insert(id.as_str()) {
                    return Err("Line character conservation violation".into());
                }
            }
        }
        if covered.len() != ids.len() {
            return Err("Unassigned extracted character".into());
        }
        if !["text", "confirmed_blank", "suspect", "failed"].contains(&p.coverage_state.as_str())
            || (["failed", "suspect"].contains(&p.coverage_state.as_str()) && p.issues.is_empty())
            || (p.coverage_state == "confirmed_blank" && !p.chars.is_empty())
        {
            return Err("Invalid coverage state".into());
        }
        for i in &p.issues {
            if i["pageIndex"].as_u64() != Some(p.page_index as u64)
                || i["defaultVisible"] != true
                || i["region"]
                    .as_array()
                    .is_none_or(|xs| xs.len() != 4 || xs.iter().any(|x| x.as_f64().is_none()))
                || s(&i["evidence"]).is_empty()
                || s(&i["message"]).is_empty()
                || ![
                    "raster_only_content",
                    "unverified_image_text_region",
                    "encoding_unknown",
                    "page_failed",
                    "body_missing",
                    "unsupported_objects",
                ]
                .contains(&s(&i["reason"]))
            {
                return Err("Invalid coverage issue".into());
            }
        }
        self.hashes.push(digest(&v));
        self.pages.push(p);
        Ok(())
    }
    pub fn finish(&mut self) -> Result<(), String> {
        if self.done
            || self.meta.is_null()
            || self.meta["pageCount"].as_u64() != Some(self.pages.len() as u64)
        {
            return Err("pageCount mismatch or duplicate done".into());
        }
        self.done = true;
        Ok(())
    }
    pub fn snapshot(&self) -> String {
        let mut v = self.meta.clone();
        v["pages"] = json!(self.hashes);
        v["snapshotHashVersion"] = json!("page-merkle/1");
        digest(&v)
    }
}
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub struct Ref {
    pub p: usize,
    pub c: usize,
    pub l: usize,
}
impl Ref {
    pub fn ch<'a>(&self, d: &'a Doc) -> &'a Character {
        &d.pages[self.p].chars[self.c]
    }
    pub fn line<'a>(&self, d: &'a Doc) -> &'a Line {
        &d.pages[self.p].lines[self.l]
    }
}
pub fn locations(refs: &[Option<Ref>], d: &Doc, side: &str, id: &str) -> Vec<V> {
    let mut groups: Vec<Vec<Ref>> = vec![];
    let mut seen = HashSet::new();
    for r in refs.iter().flatten() {
        if !seen.insert(r.ch(d).id.as_str()) {
            continue;
        }
        let same = groups
            .last()
            .map(|g| {
                g[0].p == r.p
                    && g[0].line(d).id == r.line(d).id
                    && g.last().unwrap().ch(d).raw_range[1] == r.ch(d).raw_range[0]
            })
            .unwrap_or(false);
        if same {
            groups.last_mut().unwrap().push(*r)
        } else {
            groups.push(vec![*r])
        }
    }
    groups.iter().map(|g|{
 let mut ranges:Map<String,V>=Map::new();for r in g {if let Some(sr)=&r.ch(d).source_ref {let k=s(&sr["itemId"]);if let Some(prior)=ranges.get_mut(k){prior["scalarRange"][1]=sr["scalarRange"][1].clone();prior["utf16Range"][1]=sr["utf16Range"][1].clone();}else{let mut x=sr.clone();if let Some(it)=d.pages[r.p].text_items.as_ref().and_then(|xs|xs.iter().find(|x|s(&x["id"])==k)){x["itemText"]=it["text"].clone()}ranges.insert(k.into(),x);}}}
 let mut quads=vec![];for r in g {let q=json!(r.ch(d).quad);if g[0].ch(d).precision!="run"||!quads.contains(&q){quads.push(q)}}
 json!({"side":side,"pageIndex":g[0].p,"unitId":id,"rawRange":[g[0].ch(d).raw_range[0],g.last().unwrap().ch(d).raw_range[1]],"charIds":g.iter().map(|r|r.ch(d).id.clone()).collect::<Vec<_>>(),"text":g.iter().map(|r|r.ch(d).text.as_str()).collect::<String>(),"quads":quads,"direction":g[0].line(d).direction,"precision":if g.iter().any(|r|r.ch(d).precision=="shared_glyph"){"shared_glyph"}else{&g[0].ch(d).precision},"geometryMethod":g[0].ch(d).geometry_method.as_deref().unwrap_or("native_glyph"),"sourceRanges":ranges.values().collect::<Vec<_>>()})
 }).collect()
}
