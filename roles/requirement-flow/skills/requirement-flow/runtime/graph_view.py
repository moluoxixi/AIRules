"""Project the shared demand record into a readable graph, preserving its entity IDs."""
import hashlib
import json
import re
from html import escape
from pathlib import Path

ROOT_ID = "@request"
DELIVERY_ID = "@delivery"


def feature_scope(work, stories):
    """Include each selected story's work and required inputs, including conditional paths."""
    actions = work["actions"]
    included = {key for key, action in actions.items() if not stories or stories.intersection(action["stories"])}
    pending = list(included)
    while pending:
        for dependency in actions[pending.pop()]["depends_on"]:
            key = dependency["id"]
            if key not in included:
                included.add(key)
                pending.append(key)
    decisions = {key for key, d in work["decisions"].items() if not stories or stories.intersection(d["stories"])}
    contracts = set() if stories else set(work["contracts"])
    for key in included:
        action = actions[key]
        contracts.update(action["contracts"])
        contracts.update(action.get("closes_contracts", []))
        decisions.update(action["decisions"])
        for entry in [action, *action["depends_on"]]:
            if entry.get("when"):
                decisions.add(entry["when"]["decision"])
    contracts.update(r["contract"] for r in work.get("contract_routes", []) if r["decision"] in decisions)
    return included, decisions, contracts


def contract_users(work):
    users = {key:set() for key in work["contracts"]}
    for action in work["actions"].values():
        for key in action["contracts"]:
            users[key].update(action["stories"])
    for route in work.get("contract_routes", []):
        users[route["contract"]].update(work["decisions"][route["decision"]]["stories"])
    return {key:[story for story in work["stories"] if story in members] for key, members in users.items()}


def make_graph(work, states, scenarios):
    stories = work["stories"]
    actions = work["actions"]
    decisions = work["decisions"]
    contracts = work["contracts"]
    routes = work.get("contract_routes", [])
    nodes = {}
    edges = {}

    def node(key, kind, title, caption="", label="", state="", **attributes):
        nodes[key] = dict(id=key, kind=kind, title=title, caption=caption,
                          label=label, state=state, **attributes)

    def connect(source, target, condition=None):
        if source == target:
            return
        decision, choice = (condition["decision"], condition["is"]) if condition else ("", "")
        edge_key = (source, target, decision, choice)
        if edge_key in edges:
            return
        answer = work["answers"].get(decision)
        mode = ("chosen" if answer["choice"] == choice else "skipped") if answer else "possible"
        label = decisions[decision]["options"][choice]["label"] if decision == source else ""
        if label:
            sample = next((r.get("example") for r in routes if r["decision"] == decision and
                           r["option"] == choice and r["contract"] == target), None)
            if sample:
                label += " · " + sample
        edges[edge_key] = dict(source=source, target=target, label=label,
                               mode=mode if condition else "normal",
                               decision=decision, choice=choice)

    node(ROOT_ID, "request", work["title"], label="原始需求")
    for key, story in stories.items():
        cases = [case for case in scenarios if case["story"] == key]
        badge = ""
        if cases:
            passed = sum(case["status"] == "passed" for case in cases)
            badge = f"{passed}/{len(cases)} 已验"
        node(key, "story", story["title"], story["flow"][0] if story.get("flow") else story["actor"],
             label="用户故事", state=badge)
        connect(ROOT_ID, key)

    for key, decision in decisions.items():
        answer = work["answers"].get(key)
        summary = decision["options"][answer["choice"]]["label"] if answer else ""
        node(key, "decision", decision["title"], summary, "业务决定",
             "已决定" if answer else "待你决定")
        for story in decision["stories"] or [ROOT_ID]:
            connect(story, key)

    aliases = {}
    researchers = {key: [] for key in contracts}
    for key, action in actions.items():
        sources = action["contracts"]
        if action["kind"] == "调研" and len(sources) == 1:
            aliases[key] = sources[0]
            researchers[sources[0]].append(key)

    for key, contract in contracts.items():
        endpoints = contract.get("endpoints", [])
        has_endpoint = not endpoints and re.match(r"^(GET|POST|PUT|DELETE|PATCH|HEAD)\s+\S+", contract["operation"], re.I)
        caption = " · ".join(e["purpose"] for e in endpoints[:2]) if endpoints else " · ".join(
            field["name"] for field in contract["fields"][-2:])
        label = "调研 · 接口" if researchers[key] else "接口与字段"
        state = "待核对" if contract["state"] == "open" else contract["status"]
        research_states = [states[i]["state"] for i in researchers[key]]
        if "active" in research_states:
            state = "AI 调研中"
        elif research_states and all(st == "skipped" for st in research_states):
            state = "本次跳过"
        elif research_states and all(st == "done" for st in research_states):
            state = "已梳理"
        node(key, "contract", contract["operation"] if has_endpoint else contract["title"],
             caption, label, state, mono=bool(has_endpoint),
             research=researchers[key])

    kind_of = {"开发":"develop", "验证":"verify", "调研":"research"}
    state_names = {"ready":"可推进","active":"AI 进行中","blocked":"等待前置","dormant":"按条件启用",
                   "skipped":"本次跳过","done":"已完成","stale":"需复核"}
    for key, action in actions.items():
        if key in aliases:
            continue
        state = states[key]["state"]
        caption = action["done"]
        if len(action["stories"]) == 1:
            story = stories[action["stories"][0]]
            if action["kind"] == "开发" and story.get("flow"):
                caption = story["flow"][-1]
            elif action["kind"] == "验证" and story.get("examples"):
                amounts = [r["example"] for r in routes if r["decision"] in action["decisions"] and r.get("example")]
                covered = set(action.get("covers", []))
                example = next((case for case in story["examples"] if case.get("id") in covered), None)
                if example:
                    caption = example["given"]
                elif amounts or not covered:
                    caption = " / ".join(amounts) if amounts else story["examples"][0]["given"]
        node(key, kind_of[action["kind"]], action["title"], caption, action["kind"],
             "待验" if action["kind"] == "验证" and state == "blocked" else state_names[state],
             activity=state)

    for route in routes:
        connect(route["decision"], route["contract"], {"decision":route["decision"],"is":route["option"]})

    # A story's choice can already lead to an interface. Keep its ordinary story
    # link for other stories that use the very same interface independently.
    for key, action in actions.items():
        target = aliases.get(key, key)
        if key in aliases:
            for story in action["stories"] or [ROOT_ID]:
                via_choice = any(r["contract"] == target and story in decisions[r["decision"]]["stories"]
                                 for r in routes)
                if not via_choice:
                    connect(story, target)
            if action.get("when"):
                cond = action["when"]
                connect(cond["decision"], target, cond)
            continue
        before = []
        for dep in action["depends_on"]:
            pred = aliases.get(dep["id"], dep["id"])
            before.append(pred)
            connect(pred, target, dep.get("when"))
        if action["kind"] != "验证" or not before:
            for contract in action["contracts"]:
                if contract not in before:
                    connect(contract, target)
        for decision in action["decisions"]:
            via_contract = any(r["decision"] == decision and r["contract"] in set(before + action["contracts"])
                               for r in routes)
            if not via_contract and not any(decision in actions[d["id"]]["decisions"] for d in action["depends_on"]):
                cond = action.get("when")
                connect(decision, target, cond if cond and cond["decision"] == decision else None)
        if not before and not action["contracts"] and not action["decisions"]:
            for story in action["stories"] or [ROOT_ID]:
                connect(story, target)
        if action.get("when"):
            cond = action["when"]
            connect(cond["decision"], target, cond)

    # Isolated contracts and independent actions still appear as navigable facts.
    for key in list(nodes):
        if key != ROOT_ID and not any(e["target"] == key for e in edges.values()):
            users = [a for a in actions.values() if key in a["contracts"]]
            owners = list(dict.fromkeys(s for a in users for s in a["stories"]))
            for owner in owners or [ROOT_ID]:
                connect(owner, key)

    research = work.get("outcome") == "research"
    check_kind = "调研" if research else "验证"
    checks = [key for key,a in actions.items() if a["kind"] == check_kind and states[key]["state"] != "skipped"]
    proven = sum(states[key]["state"] == "done" for key in checks)
    if research and not scenarios:
        caption = f"{proven} / {len(checks)} 项调研有证据" if checks else "查看已有产出与待办"
    else:
        passed = sum(case["status"] == "passed" for case in scenarios)
        caption = f"{passed} / {len(scenarios)} 个场景通过" if scenarios else "待梳理验收场景"
    node(DELIVERY_ID,"delivery","调研结论" if research else "交付与经验",caption,"调研依据" if research else "交付依据")
    terminal = [k for k in nodes if k != DELIVERY_ID and not any(e["source"] == k for e in edges.values())]
    for key in terminal:
        connect(key, DELIVERY_ID)

    features = {}
    for story in stories:
        included, choices, sources = feature_scope(work, {story})
        visible = {ROOT_ID, DELIVERY_ID, story} | choices | sources | {aliases.get(k, k) for k in included}
        features[story] = {"nodes":[key for key in nodes if key in visible],
                           "actions":[key for key in actions if key in included]}
    for key, users in contract_users(work).items():
        nodes[key]["users"] = users
    return {"nodes":list(nodes.values()), "edges":list(edges.values()), "aliases":aliases, "features":features}


def lesson_version(queue):
    cards = [queue.get("lesson_cards", []), queue.get("related_lessons", [])]
    # An empty adoption ledger hashes exactly as pre-0.8 snapshots did.
    if queue.get("adopted_lessons"):
        cards.append(queue["adopted_lessons"])
    return hashlib.sha256(json.dumps(cards, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def lesson_source_page(card, source, download_url):
    proof = source["proof"]
    review = card.get("approval") or card.get("review") or {}
    def rows(pairs):
        return "".join("<dt>" + escape(label) + "</dt><dd>" + escape(str(value)) + "</dd>"
                       for label, value in pairs if value is not None and value != "")
    context = rows([("来源需求", card["task_title"] + " · " + card["task"]),
                    ("功能", source["story_title"] + " · " + source["story"]),
                    ("场景", source["scenario"]), ("给定", source["given"]),
                    ("当", source["when"]), ("应当", source["then"]), ("当前功能依据", source.get("current_basis"))])
    receipt = rows([("验证动作", source["action_title"] + " · " + source["action"]),
                    ("回执", source["receipt"]), ("证据类型", proof["level"]),
                    ("环境", proof["environment"]), ("记录人", proof["actor"]),
                    ("命令参数", json.dumps(proof["argv"], ensure_ascii=False) if proof.get("argv") else None),
                    ("退出码", proof.get("exit_code")), ("文件", proof["artifact"]["path"]),
                    ("SHA-256", proof["artifact"]["sha256"])])
    review_info = rows([("经验版本", f"{card['id']} · v{card['version']}"),
                        ("适用条件", card["when"]), ("做法", card["practice"]), ("边界", card["boundary"]),
                        ("审查人", review.get("actor")), ("审查意见", review.get("reason"))])
    return_script = """<script>
const back = document.getElementById('return-map')
const from = new URLSearchParams(location.hash.slice(1))
const drawer = from.get('drawer')
if (drawer && drawer.startsWith('#node=')) {
  const url = new URL('./', location.href)
  url.search = from.get('view') || ''
  url.hash = drawer
  back.href = url.href
  if (document.referrer) {
    const previous = new URL(document.referrer)
    if (previous.origin === url.origin && previous.pathname === url.pathname && previous.search === url.search) {
      back.addEventListener('click', event => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && history.length > 1) {
          event.preventDefault()
          history.back()
        }
      })
    }
  }
}
</script>"""
    return f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>经验来源 · {escape(source["scenario"])}</title>
<style>{Path(__file__).with_name("theme.css").read_text("utf-8")}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 var(--ui)}}
main{{max-width:780px;margin:auto;padding:32px clamp(16px,4vw,32px) 60px}}
h1{{font-size:clamp(1.35rem,3.5vw,2rem);line-height:1.4;margin:20px 0 24px}}
section{{padding:clamp(15px,3vw,24px);background:var(--surface);border:1px solid var(--line);border-radius:12px;margin:16px 0}}
h2{{font-size:1.1rem;margin:0 0 14px}}dl{{display:grid;grid-template-columns:minmax(4.7em,auto) minmax(0,1fr);gap:8px 16px;margin:0}}
dt{{color:var(--muted)}}dd{{margin:0;overflow-wrap:anywhere;color:var(--text)}}
pre{{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--paper);padding:12px;border-radius:6px;font:.86rem/1.65 var(--mono)}}
a{{color:var(--accent);text-underline-offset:3px}}a:focus-visible{{outline:2px solid var(--focus-ring);outline-offset:3px}}
.download{{display:inline-block;margin-top:10px}}</style><main>
<a id="return-map" href="./">← 返回需求详情</a><h1>{escape(card["observation"])}</h1>
<section><h2>来源场景</h2><dl>{context}</dl></section>
<section><h2>实际证据</h2><dl>{receipt}</dl><pre>{escape(proof["actual"])}</pre>
<a class="download" href="{escape(download_url, quote=True)}" download>下载原始证据</a></section>
<section><h2>经验与审查</h2><dl>{review_info}</dl></section></main>{return_script}</html>"""


def render(model, states, impacts, token, checksum, template, *, queue, source_labels=None, read_only=False):
    work = model["work"]
    graph = make_graph(work, states, queue.get("scenarios", []))
    for node in graph["nodes"]:
        if node["kind"] == "story":
            count = sum(node["id"] in card["matched_stories"] for card in queue.get("related_lessons", []))
            adopted = sum(node["id"] == card["adoption"]["story"] for card in queue.get("adopted_lessons", []))
            if adopted:
                node["sharedNote"] = f"已采用 {adopted} 条经验"
            elif count:
                node["sharedNote"] = f"推荐 {count} 条经验"
    payload = dict(model=model, states=states, impacts=impacts, graph=graph, csrf=token, queue=queue,
                   lesson_version=lesson_version(queue))
    if read_only:
        payload["read_only"] = True
    if source_labels:
        payload["source_labels"] = source_labels
    safe_json = json.dumps(payload, ensure_ascii=False, separators=(",",":")).replace("&","\\u0026").replace("<","\\u003c").replace(">","\\u003e")
    here = Path(template).parent
    substitutions = {
        "TITLE": escape(work["title"],quote=True), "KIND":escape(work["kind"],quote=True),
        "VERSION": str(work["revision"]), "DIGEST":checksum, "DATA":safe_json,
        "THEME":(here/"theme.css").read_text("utf-8"),
        "DAGRE":(here/"dagre.min.js").read_text("utf-8"),
        "SCRIPT":(here/"map.js").read_text("utf-8"),
    }
    return re.sub(r"@@(TITLE|KIND|VERSION|DIGEST|DATA|THEME|DAGRE|SCRIPT)@@",
                  lambda match: substitutions[match.group(1)], Path(template).read_text("utf-8"))
