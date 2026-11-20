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


def skipped_decisions(work, states, selected=(), actions=None):
    """A decision's only uses can belong to a branch the user did not choose."""
    consumers = {}
    routes = {}
    for route in work.get("contract_routes", ()):
        routes.setdefault(route["contract"], set()).add(route["decision"])
    for key, action in work["actions"].items():
        decisions = set(action["decisions"])
        decisions.update(item["when"]["decision"] for item in (action, *action["depends_on"]) if item.get("when"))
        for contract in (*action["contracts"], *action.get("closes_contracts", ())):
            decisions.update(routes.get(contract, ()))
        for decision in decisions:
            consumers.setdefault(decision, []).append(key)
    skipped = set()
    for decision, keys in consumers.items():
        relevant = [key for key in keys if actions is None or key in actions]
        if relevant and all(states[key]["state"] == "skipped" for key in relevant):
            covered = {story for key in relevant for story in work["actions"][key]["stories"]}
            declared = set(work["decisions"][decision]["stories"])
            if (declared.intersection(selected) if selected else declared) <= covered:
                skipped.add(decision)
    return skipped
