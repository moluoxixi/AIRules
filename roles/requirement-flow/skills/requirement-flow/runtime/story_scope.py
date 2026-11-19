"""Derive withdrawn story scope from the existing, reversible scenario decisions."""


def retirement_history(work, selected=()):
    return [{**case, "event": event["id"], "revision": event["revision"]}
            for event in work["events"] if event["kind"] == "plan"
            for case in event.get("retired_scenarios", [])
            if not selected or case["story"] in selected]


def latest_retirements(work, selected=()):
    return {(case["story"], case["id"]): case for case in retirement_history(work, selected)}


def retirement_applies(work, case):
    decision = work["decisions"].get(case["decision"], {})
    answer = work["answers"].get(case["decision"], {})
    return (answer.get("choice") == case["is"]
            and case["story"] in decision.get("stories", [])
            and case["is"] in decision.get("options", {}))


def withdrawn_stories(work):
    """Empty stories are withdrawn only while all their scope decisions still apply."""
    cases = {}
    for case in latest_retirements(work).values():
        cases.setdefault(case["story"], []).append(case)
    return {key for key, story in work["stories"].items()
            if not story["examples"] and cases.get(key)
            and all(retirement_applies(work, case) for case in cases[key])}
