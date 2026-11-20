"""Project the shared demand record into a readable graph, preserving its entity IDs."""
import hashlib
import json
import re
from html import escape
from pathlib import Path

if __package__:
    from . import story_scope
else:
    import story_scope

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
        for key in set(action["contracts"]) | set(action.get("closes_contracts", [])):
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
    withdrawn = story_scope.withdrawn_stories(work)
    nodes = {}
    edges = {}

    def node(key, kind, title, caption="", label="", state="", **attributes):
        nodes[key] = dict(id=key, kind=kind, title=title, caption=caption,
                          label=label, state=state, **attributes)

    def connect(source, target, condition=None, *, inactive=False):
        if source == target:
            return
        decision, choice = (condition["decision"], condition["is"]) if condition else ("", "")
        edge_key = (source, target, decision, choice)
        if edge_key in edges:
            return
        answer = work["answers"].get(decision)
        mode = ("chosen" if answer["choice"] == choice else "skipped") if answer else "possible"
        label = decisions[decision]["options"][choice]["label"] if condition else ""
        if label and decision != source:
            label = decisions[decision]["title"] + " · " + label
        if label and decision == source:
            sample = next((r.get("example") for r in routes if r["decision"] == decision and
                           r["option"] == choice and r["contract"] == target), None)
            if sample:
                label += " · " + sample
        edges[edge_key] = dict(source=source, target=target, label=label,
                               mode="skipped" if inactive else mode if condition else "normal",
                               decision=decision, choice=choice)

    node(ROOT_ID, "request", work["title"], label="原始需求")
    for key, story in stories.items():
        cases = [case for case in scenarios if case["story"] == key]
        badge = "本期已撤出" if key in withdrawn else ""
        progress = None
        if cases:
            passed = sum(case["status"] == "passed" for case in cases)
            failed = sum(case["status"] == "failed" for case in cases)
            stale = sum(case["status"] == "stale" for case in cases)
            progress = dict(passed=passed, total=len(cases), failed=failed, stale=stale)
            parts = [f"{passed}/{len(cases)} 通过"]
            if failed:
                parts.append(f"{failed} 失败")
            if stale:
                parts.append(f"{stale} 需补验")
            badge = " · ".join(parts)
        node(key, "story", story["title"], story["flow"][0] if story.get("flow") else story["actor"],
             label="用户故事", state=badge, progress=progress)
        connect(ROOT_ID, key)

    skipped_decisions = story_scope.skipped_decisions(work, states)
    for key, decision in decisions.items():
        answer = work["answers"].get(key)
        summary = decision["options"][answer["choice"]]["label"] if answer else ""
        status = "当前分支不涉及" if key in skipped_decisions else "待你决定"
        node(key, "decision", decision["title"], summary, "业务决定",
             "已决定" if answer else status)
        for story in decision["stories"] or [ROOT_ID]:
            connect(story, key)

    aliases = {}
    researchers = {key: [] for key in contracts}
    research_users = {key: [] for key in contracts}
    for key, action in actions.items():
        if action["kind"] == "调研":
            for source in set(action["contracts"]) | set(action.get("closes_contracts", [])):
                research_users[source].append(key)
    for key, action in actions.items():
        sources = action["contracts"]
        # Folding must remain one-to-one: otherwise separate actions, their
        # dependencies or their independent conditions would become one node.
        if (action["kind"] == "调研" and not action.get("review_for") and len(sources) == 1
                and len(research_users[sources[0]]) == 1
                and set(action.get("closes_contracts", [])).issubset(sources)):
            aliases[key] = sources[0]
            researchers[sources[0]].append(key)

    for key, contract in contracts.items():
        endpoints = contract.get("endpoints", [])
        has_endpoint = not endpoints and re.match(r"^(GET|POST|PUT|DELETE|PATCH|HEAD)\s+\S+", contract["operation"], re.I)
        caption = " · ".join(e["purpose"] for e in endpoints[:2]) if endpoints else " · ".join(
            field["name"] for field in contract["fields"][-2:])
        label = "调研 · 接口" if researchers[key] else "接口与字段"
        state = "待核对" if contract["state"] == "open" else contract["status"]
        if researchers[key]:
            research_state = states[researchers[key][0]]["state"]
            state = {"active":"调研中", "ready":"可调研", "blocked":"等待前置", "dormant":"按条件启用",
                     "skipped":"本次跳过", "done":"已梳理", "stale":"需复核"}[research_state]
        node(key, "contract", contract["operation"] if has_endpoint else contract["title"],
             caption, label, state, mono=bool(has_endpoint),
             research=researchers[key])

    kind_of = {"开发":"develop", "验证":"verify", "调研":"research"}
    state_names = {"ready":"可推进","active":"进行中","blocked":"等待前置","dormant":"按条件启用",
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
        before = []
        for dep in action["depends_on"]:
            pred = aliases.get(dep["id"], dep["id"])
            before.append(pred)
            inactive_review = bool(actions[dep["id"]].get("review_for") and states[dep["id"]]["state"] == "skipped")
            connect(pred, target, dep.get("when"), inactive=inactive_review)
        inputs = list(dict.fromkeys([*action["contracts"], *action.get("closes_contracts", [])]))
        if key in aliases and not before:
            for story in action["stories"] or [ROOT_ID]:
                via_choice = any(r["contract"] == target and story in decisions[r["decision"]]["stories"]
                                 for r in routes)
                if not via_choice:
                    connect(story, target)
        if action["kind"] != "验证" or not before:
            for contract in inputs:
                if contract not in before:
                    connect(contract, target)
        required_decisions = dict.fromkeys([*action["decisions"],
            *(dep["when"]["decision"] for dep in action["depends_on"] if dep.get("when"))])
        for decision in required_decisions:
            via_contract = any(r["decision"] == decision and r["contract"] in set(before + inputs)
                               for r in routes)
            if not via_contract:
                cond = action.get("when")
                connect(decision, target, cond if cond and cond["decision"] == decision else None)
        if not before and not inputs and not action["decisions"]:
            for story in action["stories"] or [ROOT_ID]:
                connect(story, target)
        if action.get("when"):
            cond = action["when"]
            connect(cond["decision"], target, cond)

    # Isolated contracts and independent actions still appear as navigable facts.
    for key in list(nodes):
        if key != ROOT_ID and not any(e["target"] == key for e in edges.values()):
            users = [a for a in actions.values() if key in set(a["contracts"]) | set(a.get("closes_contracts", []))]
            owners = list(dict.fromkeys(s for a in users for s in a["stories"]))
            for owner in owners or [ROOT_ID]:
                connect(owner, key)

    research = work.get("outcome") == "research"
    check_kind = "调研" if research else "验证"
    checks = [key for key,a in actions.items() if a["kind"] == check_kind and states[key]["state"] != "skipped"]
    proven = sum(states[key]["state"] == "done" for key in checks)
    if stories and len(withdrawn) == len(stories):
        caption = "全部功能已按业务决定移出本期范围"
    elif research and not scenarios:
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


def lesson_source_page(card, source, download_url, home_href=None):
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
    home_link = f'<a href="{escape(home_href, quote=True)}" aria-label="首页">首页</a>' if home_href else ""
    historical = ('<p class="historical" role="status">历史依据：原始回执与附件完整，但不能证明当前输入，需重新验收。</p>'
                  if not source.get("valid", True) else "")
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
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>经验来源 · {escape(source["scenario"])}</title>
<style>
{Path(__file__).with_name("theme.css").read_text("utf-8")}
* {{ box-sizing:border-box }}
:root {{
  color-scheme:dark;
  --paper:#151024;
  --surface:#21192f;
  --surface-hover:#302344;
  --line:#423451;
  --ink:#f5efff;
  --text:#e3dcf0;
  --muted:#b9accb;
  --accent:#dac9ff;
  --focus-ring:#dac9ff;
  --mint:#a1e5cc;
  --amber:#f4c393;
  background:var(--paper);
}}
body {{
  margin:0;
  min-height:100vh;
  color:var(--ink);
  font:14px/1.58 var(--ui);
}}
.reading-wrap {{ width:min(calc(100% - clamp(32px,8vw,112px)),1060px); margin-inline:auto }}
.masthead {{ background:var(--surface); border-bottom:1px solid var(--line) }}
.masthead nav {{ min-height:49px; display:flex; align-items:center; gap:5px; flex-wrap:wrap }}
.reader-label {{ color:var(--ink); font-weight:650; margin-inline-end:auto }}
a {{ color:var(--accent); text-decoration:none }}
a:focus-visible {{ outline:2px solid var(--focus-ring); outline-offset:3px }}
nav a,.download {{
  display:inline-flex;
  align-items:center;
  gap:7px;
  min-height:32px;
  padding:4px 9px;
  border-radius:6px;
  font-size:.92rem;
  font-weight:600;
}}
nav a {{ color:var(--muted) }}
nav a:hover {{ color:var(--ink); background:var(--surface-hover) }}
main {{ padding-block:22px 44px }}
h1 {{
  margin:0 0 16px;
  font:650 clamp(1.2rem,2.4vw,1.55rem)/1.34 var(--display,var(--ui));
  letter-spacing:-.025em;
  overflow-wrap:anywhere;
}}
.historical {{
  margin:0 0 18px;
  padding:10px 13px;
  border:1px solid var(--line);
  border-inline-start:2px solid var(--amber);
  border-radius:8px;
  color:var(--amber);
  background:#2d2130;
}}
.reading-grid {{ display:grid; gap:16px }}
.reading-card {{
  min-width:0;
  align-self:start;
  padding:clamp(12px,2vw,18px);
  border:1px solid var(--line);
  border-radius:9px;
  background:var(--surface);
  box-shadow:0 1px 3px #0b061f4a,inset 0 1px #fcf6ff08;
}}
h2 {{ margin:0 0 10px; color:var(--ink); font-size:1rem; line-height:1.35; font-weight:650 }}
.evidence h2 {{ color:var(--mint) }}
dl {{
  display:grid;
  grid-template-columns:minmax(4.8em,auto) minmax(0,1fr);
  gap:0 12px;
  margin:0;
  font-size:.9rem;
}}
dt,dd {{ margin:0; padding-block:7px; border-top:1px solid var(--line) }}
dt {{ color:var(--muted) }}
dd {{ overflow-wrap:anywhere; color:var(--text) }}
pre {{
  margin:16px 0 12px;
  padding:14px 16px;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  background:#1a1329;
  border:1px solid var(--line);
  border-radius:6px;
  color:var(--text);
  font:.86rem/1.65 var(--mono);
}}
.download {{ color:var(--accent); background:#312448; border:1px solid #574470 }}
.download::after {{ content:""; width:6px; height:6px; border:solid currentColor; border-width:0 2px 2px 0; transform:rotate(45deg); margin-top:-3px }}
.download:hover {{ background:#3e2c5a; border-color:#745b97 }}
@media (min-width:960px) {{
  .reading-grid {{ grid-template-columns:minmax(0,5fr) minmax(0,7fr); grid-template-rows:auto 1fr; align-items:start }}
  .evidence {{ grid-area:1 / 2 / span 2 }}
}}
@media (max-width:480px) {{
  main {{ padding-top:16px }}
  dl {{ font-size:.85rem; gap:0 8px }}
}}
@media (prefers-reduced-motion:no-preference) {{
  .reading-grid {{ animation:reader-enter .2s ease-out }}
  nav a,.download {{ transition:background .15s ease,color .15s ease,border-color .15s ease }}
  @keyframes reader-enter {{ from {{ opacity:.72; transform:translateY(3px) }} }}
}}
</style>
</head>
<body>
<header class="masthead"><nav class="reading-wrap" aria-label="导航"><span class="reader-label">经验来源</span>{home_link}<a id="return-map" href="./">← 返回需求详情</a></nav></header>
<main class="reading-wrap">
  <h1>{escape(card["observation"])}</h1>
  {historical}
  <div class="reading-grid">
    <section class="reading-card"><h2>来源场景</h2><dl>{context}</dl></section>
    <section class="reading-card evidence"><h2>实际证据</h2><dl>{receipt}</dl><pre>{escape(proof["actual"])}</pre>
      <a class="download" href="{escape(download_url, quote=True)}" download>下载验收附件</a>
    </section>
    <section class="reading-card"><h2>经验与审查</h2><dl>{review_info}</dl></section>
  </div>
</main>
{return_script}
</body>
</html>"""


def render(model, states, impacts, token, checksum, template, *, queue, source_labels=None, read_only=False, home_href=None):
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
    if __package__:
        from . import catalog_server
    else:
        import catalog_server
    card = catalog_server.task_card(work, queue)
    card.pop("href", None)
    payload["catalog_card"] = dict(card, bucket="archive" if read_only else "active")
    payload["home_href"] = home_href
    if read_only:
        payload["read_only"] = True
    if source_labels:
        payload["source_labels"] = source_labels
    safe_json = json.dumps(payload, ensure_ascii=False, separators=(",",":")).replace("&","\\u0026").replace("<","\\u003c").replace(">","\\u003e")
    here = Path(template).parent
    substitutions = {
        "TITLE": escape(work["title"],quote=True),
        "DIGEST":checksum, "DATA":safe_json,
        "TOOLTIP":(here/"tooltip.js").read_text("utf-8"),
        "THEME":(here/"theme.css").read_text("utf-8"),
        "DAGRE":(here/"dagre.min.js").read_text("utf-8"),
        "SCRIPT":(here/"map.js").read_text("utf-8"),
    }
    return re.sub(r"@@(TITLE|DIGEST|DATA|THEME|TOOLTIP|DAGRE|SCRIPT)@@",
                  lambda match: substitutions[match.group(1)], Path(template).read_text("utf-8"))
