// Probe of the round-8 counterexamples: what a result says about each edit.
import { compare } from "../../../../packages/compare-core/index";
import { textDoc } from "../../../../tests/helpers";
const show = (name: string, a: any, b: any) => {
  const r: any = compare(a, b);
  console.log(JSON.stringify({ name, schemaVersion: r.schemaVersion, differences: r.differences.map((d: any) => ({
    kind: d.kind, category: d.category, facts: d.facts, oldText: d.oldText, newText: d.newText, hasTextChange: d.hasTextChange,
    edits: d.textOps.filter((o: any) => o.kind !== "equal").map((o: any) => [o.kind, o.text]) })) }));
};
const one = (name: string, x: string, y: string) => show(name, textDoc([{ text: x }]), textDoc([{ text: y }]));
const amount = "The deductible is USD 1,000,000 each and every loss";
one("unchanged amount + punctuation", amount + ".", amount + ";");
one("unchanged amount + word", amount + ".", amount.replace("every", "any") + ".");
one("10² -> 102", "Limit 10² units", "Limit 102 units");
one("full-width digits", "Limit １００ units", "Limit 100 units");
one("ligature", "Office", "Ofﬁce");
one("removed space", "Limit USD 5,000 per aircraft", "Limit USD 5,000 peraircraft");
const ps = ["The insurer covers approved operations within the territorial limits.","Separate conditions remain in force throughout the policy year.","Notice of any claim must be given within thirty days of discovery.","The insured shall maintain the aircraft in an airworthy condition."];
show("text change + move", textDoc(ps.map(text=>({text}))), textDoc([...ps.slice(1), ps[0].replace("approved","scheduled")].map(text=>({text}))));
const doc = (w: string, v: string) => textDoc([{ text: `Note: the insured confirms the declared ${w}.`, y: 150 },{ text: "Unchanged wording keeps the two edits apart.", y: 200 },{ text: `HULL LIMIT: USD ${v}`, y: 250 }]);
show("order: wording above amount", doc("operations","1,000,000"), doc("operation","2,000,000"));
