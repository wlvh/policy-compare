import sys
sys.path.insert(0, "tests")
import test_renewal_triage as t

event = t.change(
    7, "row", "Replaced",
    "123 | Alpha | USD 100",
    "123 | Alpha | USD 2000",
    [("USD 100", "USD 2000")],
)
cards = [
    t.card("a", "Replaced",
           [(1, "a-old", "123 Alpha USD 100")],
           [(1, "a-new", "123 Alpha USD 200")], row_key="123"),
    t.card("b", "Replaced",
           [(1, "b-old", "123 Alpha USD 1000")],
           [(1, "b-new", "123 Alpha USD 2000")], row_key="123"),
]
summary, events = t.run(
    [event], t.result(cards), [t.table("values", [0], event)]
)
e = events["7"]
print(e["verdict"], e["acceptedCards"],
      e["row"]["fullRowRecovered"], summary["unexplainedCards"])
assert e["verdict"] not in ("correct", "split_attributable")
