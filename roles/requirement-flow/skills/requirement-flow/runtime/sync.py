#!/usr/bin/env python3
"""Local, file-based collaboration protocol. All mutable facts live in model.json."""
import argparse
import copy
import hashlib
import json
import os
import re
import secrets
import sys
import tempfile
if __package__:
    from . import graph_view
else:
    import graph_view
from datetime import datetime, timezone
from contextlib import contextmanager
from functools import lru_cache
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlsplit

RUNTIME = Path(__file__).resolve().parent
LAYOUT = RUNTIME / "layout.html"
PROTOCOL = RUNTIME / "protocol.json"
TASK_DIR = Path.cwd()
MODEL = TASK_DIR / "model.json"
BOOK = TASK_DIR / "handbook.html"
LOCK = TASK_DIR / ".workflow.lock"
PLANNABLE = ("stories", "contracts", "decisions", "actions")
STATES = {"ready":"可推进","active":"进行中","blocked":"等待输入","dormant":"按条件启用",
          "skipped":"本次跳过","done":"已完成","stale":"需复核"}


class Invalid(ValueError):
    pass


class Conflict(Invalid):
    pass


def expect(condition, message):
    if not condition:
        raise Invalid(message)


def unique(pairs):
    result = {}
    for key, val in pairs:
        expect(key not in result, "重复的 JSON 键 " + key)
        result[key] = val
    return result


def bind_workspace(path):
    """Select the data directory for this CLI invocation or HTTP server."""
    global TASK_DIR, MODEL, BOOK, LOCK
    TASK_DIR = Path(path).resolve()
    MODEL = TASK_DIR / "model.json"
    BOOK = TASK_DIR / "handbook.html"
    LOCK = TASK_DIR / ".workflow.lock"
    return TASK_DIR


def load(path=None):
    path = Path(path) if path is not None else MODEL
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)


def encoded(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode()


def digest(obj):
    raw = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def validate(m):
    w = m["work"]
    expect(m["protocol"]["version"] == "2.0", "不支持的协议版本")
    expect(w.get("outcome","delivery") in ("research","delivery"), "需求目标类型无效")
    expect(isinstance(w["revision"], int) and w["revision"] > 0 and w["raw_request"], "缺少有效原话或版次")
    ids = set()
    for group in PLANNABLE:
        expect(isinstance(w[group], dict), group + " 应按 ID 索引")
        for key, item in w[group].items():
            expect(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", key) and key not in ids, "记录 ID 无效或重复 " + key)
            expect(item["title"].strip(), "缺少标题 " + key)
            ids.add(key)

    def check_refs(refs, group):
        expect(isinstance(refs, list) and all(s in w[group] for s in refs), group + " 有失效引用 " + str(refs))

    def check_condition(condition):
        if condition is not None:
            expect(condition["decision"] in w["decisions"] and
                   condition["is"] in w["decisions"][condition["decision"]]["options"], "分支条件无效")

    for d, decision in w["decisions"].items():
        check_refs(decision["stories"], "stories")
        expect(decision["owner"] and decision["why"] and len(decision["options"]) >= 2, "决定缺少负责人、缘由或选项 " + d)
        for option in decision["options"].values():
            expect(option["label"] and option["consequence"], "决定选项不完整 " + d)
    routes = w.get("contract_routes", [])
    expect(isinstance(routes, list), "选项与接口关系应为列表")
    pairs = set()
    for route in routes:
        d, o, c = route["decision"], route["option"], route["contract"]
        expect(d in w["decisions"] and o in w["decisions"][d]["options"] and c in w["contracts"], "选项与接口关系引用无效")
        expect(isinstance(route.get("example", ""), str), "分支例子应为文字")
        expect((d,o,c) not in pairs, "选项与接口关系重复")
        pairs.add((d,o,c))
    for d, ans in w["answers"].items():
        expect(d in w["decisions"] and ans["choice"] in w["decisions"][d]["options"] and ans["version"] > 0, "答案失效 " + d)
    for story in w["stories"].values():
        expect(story["actor"] and story["goal"] and story["examples"], "故事缺少角色、目标或验收例子")
        for ex in story["examples"]:
            expect(all(ex.get(k) for k in ("given","when","then")), "验收例子缺少前提、操作或预期")
    for c in w["contracts"].values():
        expect(c["state"] in ("open","confirmed","fixture") and c["source"] and isinstance(c["fields"], list), "契约缺少已知状态或来源")
        if c["state"] == "fixture":
            expect(w["kind"] == "合成推演", "真实需求需要真实来源")
        for field in c["fields"]:
            expect(all(field.get(k) for k in ("name","type","constraint","use")), "字段缺少口径或用途")
    for key, action in w["actions"].items():
        expect(action["kind"] in ("调研","开发","验证") and action["done"].strip(), "动作类型或完成条件无效 " + key)
        for prop, group in (("stories","stories"),("read_stories","stories"),("contracts","contracts"),("decisions","decisions")):
            check_refs(action[prop], group)
        check_refs(action.get("closes_contracts", []), "contracts")
        if action["kind"] == "验证" and action.get("accepts"):
            expect(all(x in ("推演","自动化","真实环境","人工核对") for x in action["accepts"]), "不支持的验证方式")
        check_condition(action.get("when"))
        dep_ids = [dep["id"] for dep in action["depends_on"]]
        check_refs(dep_ids, "actions")
        expect(len(dep_ids) == len(set(dep_ids)), "重复动作依赖 " + key)
        for edge in action["depends_on"]:
            check_condition(edge.get("when"))
    remaining = set(w["actions"])
    while remaining:
        free = {k for k in remaining if not any(dep["id"] in remaining for dep in w["actions"][k]["depends_on"])}
        expect(free, "动作依赖存在循环")
        remaining -= free
    event_ids = set()
    previous_revision = 0
    for e in w["events"]:
        expect(e["id"] not in event_ids and previous_revision <= e["revision"] <= w["revision"], "事件 ID 或版次无效")
        event_ids.add(e["id"])
        previous_revision = e["revision"]
        if "action" in e:
            check_refs([e["action"]], "actions")
        if e.get("reopen"):
            check_refs([e["reopen"]], "actions")
    for lesson in w["lessons"]:
        expect(all(lesson.get(k) for k in ("observation","when","practice","boundary","evidence","review")), "经验缺少使用条件或依据")


def condition_value(w, condition):
    if not condition:
        return True
    answer = w["answers"].get(condition["decision"])
    return answer["choice"] == condition["is"] if answer else None


def evaluate(w):
    latest = {}
    reopened = {}
    for event in w["events"]:
        if event["kind"] in ("start","finish","fail"):
            latest[event["action"]] = event
        if event.get("reopen"):
            reopened[event["reopen"]] = event["id"]

    @lru_cache(maxsize=None)
    def visit(key):
        action = w["actions"][key]
        last = latest.get(key, {})
        condition = action.get("when")
        gate = condition_value(w, condition)
        if gate is not True:
            state = "dormant" if gate is None else "skipped"
            name = w["decisions"][condition["decision"]]["options"][condition["is"]]["label"]
            blockers = [{"kind":"decision","id":condition["decision"]}] if gate is None else []
            return {"state":state,"reasons":["在选择「" + name + "」时启用"],"stamp":None,"proof":None,
                    "blockers":blockers,"actor":None}
        decisions = set(action["decisions"])
        if condition:
            decisions.add(condition["decision"])
        deps = []
        for edge in action["depends_on"]:
            if edge.get("when"):
                decisions.add(edge["when"]["decision"])
            if condition_value(w, edge.get("when")) is True:
                deps.append(edge["id"])
        blockers = [{"kind":"decision","id":d} for d in sorted(decisions) if d not in w["answers"]]
        if action["kind"] != "调研":
            blockers.extend({"kind":"contract","id":i} for i in action["contracts"] if w["contracts"][i]["state"] == "open")
        inputs = {}
        for dep in deps:
            status = visit(dep)
            if status["state"] != "done":
                blockers.append({"kind":"dependency","id":dep})
            inputs[dep] = status["proof"]
        labels = {"decision":("待决定 · ", "decisions"),"contract":("待契约 · ", "contracts"),"dependency":("等待 · ", "actions")}
        reasons = [labels[b["kind"]][0] + w[labels[b["kind"]][1]][b["id"]]["title"] for b in blockers]
        stamp = digest({
            "action":action, "dependency_outputs":inputs, "reopen":reopened.get(key),
            "stories":{i:w["stories"][i] for i in action["read_stories"]},
            "contracts":{i:w["contracts"][i] for i in action["contracts"]},
            "decisions":{i:{"definition":w["decisions"][i],"answer":w["answers"].get(i)} for i in sorted(decisions)}
        })
        if last and (last["kind"] == "fail" or last["stamp"] != stamp):
            state = "stale"
            if last["kind"] == "fail":
                reasons.append("上次验证失败 · " + last["output"])
            elif not reasons:
                reasons.append("决定、依赖产出或所读输入已修订")
        elif reasons:
            state = "blocked"
        elif last.get("kind") == "finish":
            state = "done"
        elif last.get("kind") == "start":
            state = "active"
        else:
            state = "ready"
        return {"state":state,"reasons":reasons,"stamp":stamp,"proof":last.get("id") if state == "done" else None,
                "blockers":blockers,"actor":last.get("actor") if state == "active" else None}

    return {key:visit(key) for key in w["actions"]}


def append_event(w, kind, actor, **fields):
    event = {"id":"E"+str(len(w["events"])+1), "revision":w["revision"], "kind":kind, "actor":actor,
             "time":datetime.now(timezone.utc).isoformat(timespec="seconds"), **fields}
    w["events"].append(event)
    return event


def decide(w, key, choice, reason, actor):
    definition = w["decisions"].get(key)
    expect(definition and choice in definition["options"] and reason.strip() and actor.strip(), "决定、选项、理由或决定人缺失")
    earlier = w["answers"].get(key)
    if earlier and earlier["choice"] == choice:
        return False
    w["revision"] += 1
    version = earlier["version"]+1 if earlier else 1
    w["answers"][key] = {"choice":choice, "version":version, "reason":reason, "actor":actor}
    append_event(w,"decision",actor,decision=key,choice=choice,version=version,
                 previous=earlier["choice"] if earlier else None, output=reason)
    return True


def apply_plan(w, patch, actor, reason):
    expect(isinstance(patch,dict) and patch and set(patch) <= set(PLANNABLE) | {"goal","scope","lessons","contract_routes"}, "计划修改包含不支持的栏目")
    expect(reason.strip(), "请写明调整计划的原因")
    changed = []
    for group,val in patch.items():
        if group in PLANNABLE:
            expect(isinstance(val,dict), "按 ID 提交局部记录")
            for key,obj in val.items():
                if w[group].get(key) != obj:
                    if group == "decisions" and key in w["answers"]:
                        expect(obj.get("options") == w[group][key]["options"] and obj.get("title") == w[group][key]["title"],
                               "已作出的决定须保留原题与选项。新业务问题请使用新决定 ID。")
                    w[group][key] = obj
                    changed.append(key)
        elif w.get(group) != val:
            if group == "goal":
                expect(isinstance(val,str) and val.strip(), "目标不能为空")
            else:
                expect(isinstance(val,list), group+" 应为列表")
            w[group] = val
            changed.append(group)
    if not changed:
        return False
    w["revision"] += 1
    append_event(w,"plan",actor,output=reason,changed=changed)
    return True


def active_ancestors(w, key):
    result = set()
    todo = [key]
    while todo:
        item = todo.pop()
        if item not in result:
            result.add(item)
            todo.extend(edge["id"] for edge in w["actions"][item]["depends_on"] if condition_value(w,edge.get("when")) is True)
    return result


def executable(status):
    return status["state"] in ("ready","stale","active") and not status["blockers"]


def progress(w, mode, key, actor, output="", evidence="", level="", environment="", expected="", reopen=None):
    expect(key in w["actions"] and actor.strip(), "动作或记录人无效")
    action = w["actions"][key]
    status = evaluate(w)[key]
    state = status["state"]
    expect(executable(status), "当前动作不可执行：" + " / ".join(status["reasons"] or [STATES[state]]))
    expect(state != "active" or actor == status["actor"], "该动作已由 " + str(status["actor"]) + " 领取")
    if mode == "start":
        if state == "active":
            return False
        expect(output.strip(), "开始动作时记录本次要做什么")
    else:
        expect(output.strip() and evidence.strip(), "动作结论需要产出与可复核依据")
        if mode == "finish":
            for contract in action.get("closes_contracts", []):
                expect(w["contracts"][contract]["state"] != "open", "先补齐契约及来源，再结束调研：" + contract)
        if action["kind"] == "验证":
            expect(level and environment.strip() and expected.strip(), "验证须记录证据类型、环境与预期")
            if mode == "finish" and action.get("accepts"):
                expect(level in action["accepts"], "该证据类型不满足本动作的验收条件")
            expect(level != "推演" or w["kind"] == "合成推演", "真实需求不能用推演证据作验收结论")
        if mode == "fail":
            expect(action["kind"] == "验证" and reopen in active_ancestors(w,key), "失败时指定当前验证或本分支的实际前置动作")
    w["revision"] += 1
    append_event(w,mode,actor,action=key,stamp=status["stamp"],output=output,evidence=evidence,
                 level=level,environment=environment,expected=expected,reopen=reopen)
    return True


def action_packet(w, states, key, mode):
    action = w["actions"][key]
    stories = dict.fromkeys([*action["stories"], *action["read_stories"]])
    decisions = dict.fromkeys(action["decisions"])
    for entry in (action, *action["depends_on"]):
        if entry.get("when"):
            decisions[entry["when"]["decision"]] = None
    contracts = dict.fromkeys([*action["contracts"], *action.get("closes_contracts", [])])
    receipts = {event["id"]:event for event in w["events"]}
    previous = next((event for event in reversed(w["events"]) if event["kind"] in ("finish","fail") and
                     (event.get("action")==key or event.get("reopen")==key)), None)
    dependencies = {}
    for edge in action["depends_on"]:
        if condition_value(w, edge.get("when")) is True:
            dep = edge["id"]
            dependencies[dep] = {"title":w["actions"][dep]["title"], "proof":receipts.get(states[dep]["proof"])}
    return {"id":key, "title":action["title"], "kind":action["kind"], "mode":mode, "stories":action["stories"],
            "goal":w["goal"], "scope":w["scope"], "done":action["done"], "accepts":action.get("accepts", []),
            "closes_contracts":action.get("closes_contracts", []), "prior_result":previous,
            "inputs":{"stories":{i:w["stories"][i] for i in stories}, "contracts":{i:w["contracts"][i] for i in contracts},
                      "decisions":{i:{**w["decisions"][i],"answer":w["answers"].get(i)} for i in decisions},
                      "dependencies":dependencies}}


def dispatch(w, actor="AI", story=None):
    expect(isinstance(actor,str) and actor.strip(), "执行人不能为空")
    expect(story is None or story in w["stories"], "故事不存在")
    selected = {story} if story is not None else set()
    chosen = {key for key, action in w["actions"].items() if not selected or selected.intersection(action["stories"])}
    to_visit = list(chosen)
    while to_visit:
        action = w["actions"][to_visit.pop()]
        if condition_value(w, action.get("when")) is not True:
            continue
        for edge in action["depends_on"]:
            if edge["id"] not in chosen and condition_value(w, edge.get("when")) is True:
                chosen.add(edge["id"])
                to_visit.append(edge["id"])
    states = evaluate(w)
    ready, running, waiting, completed = [], [], [], []
    blocked_by = {}
    for key, action in w["actions"].items():
        if key not in chosen:
            continue
        status = states[key]
        state = status["state"]
        if state == "done":
            completed.append({"id":key,"proof":status["proof"]})
        elif state == "active":
            running.append({"id":key,"title":action["title"],"actor":status["actor"]})
        elif executable(status):
            ready.append(key)
        elif status["blockers"]:
            waiting.append({"id":key,"title":action["title"],"state":state,"blockers":status["blockers"]})
            for block in status["blockers"]:
                blocked_by.setdefault((block["kind"],block["id"]),[]).append(key)

    pending = [{"id":key,**definition,"actions":blocked_by.get(("decision",key),[])}
               for key, definition in w["decisions"].items() if key not in w["answers"] and
               (not selected or selected.intersection(definition["stories"]) or ("decision",key) in blocked_by)]
    technical = [{"kind":kind,"id":key,"title":w["contracts" if kind=="contract" else "actions"][key]["title"],"actions":actions}
                 for (kind,key), actions in blocked_by.items() if kind != "decision"]
    own = next((item["id"] for item in running if item["actor"] == actor), None)
    next_key = own or next(iter(ready),None)
    packet = action_packet(w, states, next_key, "resume" if own else "start") if next_key else None
    # A finished investigation alone cannot stand in for acceptance of an unplanned story.
    checks = {s:[] for s in w["stories"] if not selected or s in selected}
    for key in chosen:
        action = w["actions"][key]
        if action["kind"] == "验证" and states[key]["state"] != "skipped":
            for s in action["stories"]:
                if s in checks:
                    checks[s].append(states[key]["proof"])
    verified = {s for s, receipts in checks.items() if receipts and all(receipts)}
    missing = [s for s in w["stories"] if (not selected or s in selected) and s not in verified]
    research = w.get("outcome") == "research"
    research_proved = any(w["actions"][r["id"]]["kind"] == "调研" for r in completed)
    if next_key:
        state = "resume" if own else "ready"
    elif waiting or running or pending:
        state = "waiting"
    elif (research and research_proved) or (not research and completed and verified and not missing):
        state = "complete"
    else:
        state = "unplanned"
    return {"revision":w["revision"],"actor":actor,"story":story,"outcome_type":w.get("outcome","delivery"),
            "state":state,"next":packet,"ready":ready,
            "running":running,"pending_decisions":pending,"technical_blockers":technical,"waiting":waiting,
            "progress":{"completed":completed,"verified_stories":[s for s in w["stories"] if s in verified and (not selected or s in selected)],
                        "unverified_stories":missing}}


def claim(revision, actor="AI", story=None):
    result = {}
    def reserve(w):
        queue = dispatch(w, actor, story)
        packet = queue["next"]
        result["claimed"] = packet["id"] if packet else None
        if not packet or packet["mode"] == "resume":
            result["outcome"] = "resumed" if packet else queue["state"]
            return False
        result["outcome"] = "claimed"
        return progress(w, "start", packet["id"], actor, packet["title"])
    model = commit(revision, reserve)
    return {**dispatch(model["work"], actor, story), **result}


def context(m, story=None):
    w = m["work"]
    stories = {story} if isinstance(story, str) and story else set(story or ())
    expect(stories <= w["stories"].keys(), "故事不存在")
    status = evaluate(w)
    chosen, decisions, contracts = graph_view.feature_scope(w, stories)
    routes = [r for r in w.get("contract_routes", []) if r["decision"] in decisions]
    all_events = [e for e in w["events"] if not stories or e.get("action") in chosen or
                  e.get("decision") in decisions or set(e.get("changed",[])) & (chosen|decisions|contracts|stories)]
    effective_ids = {status[k]["proof"] for k in chosen if status[k]["proof"]}
    usage = graph_view.contract_users(w)
    return {
        "protocol_version":m["protocol"]["version"],"revision":w["revision"],"mode":w["kind"],"outcome_type":w.get("outcome","delivery"),
        "raw_request":w["raw_request"],"goal":w["goal"],"scope":w["scope"],"contract_routes":routes,
        "stories":{k:s for k,s in w["stories"].items() if not stories or k in stories},
        "decisions":{k:{**w["decisions"][k],"answer":w["answers"].get(k)} for k in w["decisions"] if k in decisions},
        "contracts":{k:v for k,v in w["contracts"].items() if k in contracts},
        "contract_usage":{k:{s:w["stories"][s]["title"] for s in usage[k]} for k in w["contracts"] if k in contracts},
        "actions":{k:{**v, **{x:status[k][x] for x in ("state","reasons","proof")}} for k,v in w["actions"].items() if k in chosen},
        "currently_running":[k for k in w["actions"] if k in chosen and status[k]["state"]=="active"],
        "ready":[k for k in w["actions"] if k in chosen and status[k]["state"] != "active" and executable(status[k])],
        "effective_outputs":[e for e in w["events"] if e["id"] in effective_ids],
        "recent_events":all_events[-12:], "lessons":w["lessons"]
    }


def atomic(path, content):
    fd,tmp = tempfile.mkstemp(prefix="."+path.name+".", dir=path.parent)
    try:
        with os.fdopen(fd,"wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp,path)
    finally:
        Path(tmp).unlink(missing_ok=True)


@contextmanager
def task_lock(shared=False):
    with LOCK.open("a+b") as stream:
        if os.fstat(stream.fileno()).st_size == 0:
            stream.write(b"\0")
            stream.flush()
        stream.seek(0)
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(), fcntl.LOCK_SH if shared else fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def commit(revision, operation):
    with task_lock():
        model = load()
        validate(model)
        if revision != model["work"]["revision"]:
            raise Conflict("版本已更新，请读取最新记录再提交。")
        if operation(model["work"]):
            validate(model)
            html = render(model).encode()
            previous_page = BOOK.read_bytes() if BOOK.exists() else None
            atomic(BOOK, html)
            try:
                atomic(MODEL, encoded(model))
            except OSError:
                if previous_page is None:
                    BOOK.unlink(missing_ok=True)
                else:
                    atomic(BOOK, previous_page)
                raise
        return model


def sync(check=False):
    with task_lock(shared=check):
        model=load()
        validate(model)
        html=render(model).encode()
        if check:
            expect(BOOK.exists() and BOOK.read_bytes()==html,"人读页需要从当前 model.json 重新生成。")
        else:
            atomic(BOOK,html)
        return model


def h(value):
    return escape(str(value),quote=True)


def impact(w, decision, choice):
    simulated=copy.deepcopy(w)
    before=evaluate(w)
    decide(simulated,decision,choice,"比较选项","推演")
    after=evaluate(simulated)
    return [(a["title"],STATES[before[k]["state"]],STATES[after[k]["state"]]) for k,a in w["actions"].items()
            if before[k]["state"]!=after[k]["state"] or before[k]["reasons"]!=after[k]["reasons"]]


def render(model, token=None):
    work = model["work"]
    impacts = {key: {code: impact(work, key, code) for code in d["options"]}
               for key, d in work["decisions"].items()}
    return graph_view.render(model, evaluate(work), impacts, token, digest(model), LAYOUT, queue=dispatch(work))


def initialize_task(path, raw, *, key, title=None, outcome="delivery"):
    expect(isinstance(raw,str) and raw.strip(),"请提供需求原话")
    expect(isinstance(key,str) and key.strip() and key not in (".","..") and Path(key).name == key,
           "无效的需求 ID")
    expect(title is None or isinstance(title,str) and title.strip(), "需求标题不能为空")
    expect(outcome in ("research","delivery"),"需求目标应为 research 或 delivery")
    dest=Path(path).resolve()
    expect(not dest.exists(),"目标目录已存在，请选一个新目录")
    research = outcome == "research"
    action_title = "调研问题并整理结论" if research else "澄清目标、范围与故事"
    done = ("给出回应原问题的结论、来源、适用范围和仍待核实的事项。" if research else
            "给出已有依据、受影响故事、正常与异常例子，以及仅阻塞相关分支的具体问题。")
    model={"protocol":load(PROTOCOL),"work":{
        "id":key,"kind":"实际需求","outcome":outcome,"title":title or raw.strip()[:48],"raw_request":raw,
        "goal":raw.strip(),"scope":[],
        "revision":1,"stories":{},"contracts":{},"contract_routes":[],"decisions":{},"answers":{},"events":[],"lessons":[],
        "actions":{"A-intake":{"title":action_title,"kind":"调研","stories":[],"read_stories":[],
                               "contracts":[],"decisions":[],"depends_on":[],
                               "done":done}}}}
    validate(model)
    dest.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=dest.parent) as temp:
        staging=Path(temp)/"new"
        staging.mkdir()
        (staging/"model.json").write_bytes(encoded(model))
        (staging/"handbook.html").write_bytes(render(model).encode("utf-8"))
        expect(not dest.exists(),"目标目录已由其他流程创建")
        staging.rename(dest)
    return dest


def new_workspace(path, raw):
    return initialize_task(path, raw, key=Path(path).resolve().name)


def serve(port):
    token=secrets.token_urlsafe(32)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):
            pass
        def send_content(self, status, content, mime):
            data=content.encode() if isinstance(content,str) else content
            self.send_response(status)
            self.send_header("Content-Type",mime+"; charset=utf-8")
            self.send_header("Content-Length",str(len(data)))
            self.send_header("Cache-Control","no-store")
            self.send_header("X-Content-Type-Options","nosniff")
            self.send_header("Content-Security-Policy","default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(data)
        def host(self):
            return "127.0.0.1:"+str(self.server.server_port)
        def do_GET(self):
            if self.headers.get("Host") != self.host():
                self.send_error(403); return
            path=urlsplit(self.path).path
            model=load()
            if path in ("/","/handbook.html"):
                self.send_content(200,render(model,token),"text/html")
            elif path=="/model.json":
                self.send_content(200,encoded(model),"application/json")
            elif path=="/version":
                self.send_content(200,encoded({"revision":model["work"]["revision"]}),"application/json")
            elif path in ("/context","/dispatch"):
                try:
                    query=parse_qs(urlsplit(self.path).query,keep_blank_values=True)
                    if path == "/dispatch":
                        expect(all(len(query.get(name,[])) <= 1 for name in ("story","actor")), "每次调度传一个故事与执行人")
                        data=dispatch(model["work"],query.get("actor",["AI"])[0],query.get("story",[None])[0])
                    else:
                        data=context(model,query.get("story"))
                    self.send_content(200,encoded(data),"application/json")
                except Invalid as err:
                    self.send_content(400,str(err),"text/plain")
            else:
                self.send_error(404)
        def do_POST(self):
            request_url = urlsplit(self.path)
            if request_url.path!="/decision":
                self.send_error(404); return
            if self.headers.get("Host") != self.host() or self.headers.get("Origin") not in (None,"http://"+self.host()):
                self.send_error(403); return
            try:
                size=int(self.headers.get("Content-Length") or 0)
                expect(0<size<=8192 and self.headers.get_content_type()=="application/x-www-form-urlencoded","表单格式无效")
                form=parse_qs(self.rfile.read(size).decode(),max_num_fields=6)
                if not secrets.compare_digest(form.get("csrf",[""])[0],token):
                    self.send_error(403); return
                rev=int(form["revision"][0])
                key,choice=form["decision"][0],form["choice"][0]
                reason=form.get("reason",["需求发起人在本地页选择此口径。"])[0].strip() or "需求发起人在本地页选择此口径。"
                updated = commit(rev,lambda w:decide(w,key,choice,reason,"本地需求发起人"))
            except (KeyError,ValueError,IndexError) as err:
                code=409 if isinstance(err,Conflict) else 400
                self.send_content(code,"<!doctype html><meta charset='utf-8'><p>"+h(err)+"</p><a href='/#work'>返回最新需求</a>","text/html"); return
            self.send_response(303)
            previous = parse_qs(request_url.query)
            picked = set(previous.get("features", [""])[0].split(","))
            known = [key for key in updated["work"]["stories"] if key in picked]
            query = {}
            if known:
                query["features"] = ",".join(known)
            if previous.get("q"):
                query["q"] = previous["q"][0][:80]
            self.send_header("Location", "/" + ("?" + urlencode(query) if query else "") + "#work")
            self.end_headers()
    server=ThreadingHTTPServer(("127.0.0.1",port),Handler)
    print("http://127.0.0.1:"+str(server.server_port)+"/",flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace",help="需求的数据目录，默认使用当前选定的目录")
    parser.add_argument("--check",action="store_true",help="核验双份记录与依赖")
    sub=parser.add_subparsers(dest="cmd")
    q=sub.add_parser("context"); q.add_argument("story",nargs="?")
    for name in ("next","claim"):
        q=sub.add_parser(name)
        q.add_argument("--actor",default="AI")
        q.add_argument("--story",help="限定故事和所需的前置动作")
        if name == "claim":
            q.add_argument("--rev",type=int,required=True,help="执行前读到的 work.revision")
    q=sub.add_parser("new"); q.add_argument("directory"); q.add_argument("--request",required=True)
    q.add_argument("--key"); q.add_argument("--title")
    q.add_argument("--outcome",choices=("delivery","research"),default="delivery")
    q=sub.add_parser("serve"); q.add_argument("--port",type=int,default=0)
    for name in ("decision","plan","start","finish","fail"):
        q=sub.add_parser(name)
        q.add_argument("--rev",type=int,required=True,help="执行前读到的 work.revision")
        q.add_argument("--actor",required=name=="decision",default=None)
        if name=="plan":
            q.add_argument("file")
            q.add_argument("--why",required=True)
        elif name=="decision":
            q.add_argument("id"); q.add_argument("choice"); q.add_argument("--why",required=True)
        else:
            q.add_argument("id"); q.add_argument("--output",required=True)
            if name!="start":
                q.add_argument("--evidence",required=True)
                q.add_argument("--level",choices=("自动化","真实环境","人工核对","推演"),default="")
                q.add_argument("--environment",default=""); q.add_argument("--expected",default="")
            if name=="fail":
                q.add_argument("--reopen",required=True)
    a=parser.parse_args(argv)
    if a.workspace:
        bind_workspace(a.workspace)
    expect(not (a.cmd and a.check),"--check 单独使用")
    if not a.cmd:
        model=sync(a.check)
        print(("两份一致" if a.check else "人读页已更新")+" · v"+str(model["work"]["revision"]))
    elif a.cmd=="new":
        print(initialize_task(a.directory, a.request, key=a.key or Path(a.directory).resolve().name,
                              title=a.title, outcome=a.outcome))
    elif a.cmd=="context":
        model=load(); validate(model)
        print(json.dumps(context(model,a.story),ensure_ascii=False,indent=2))
    elif a.cmd=="next":
        model=load(); validate(model)
        print(json.dumps(dispatch(model["work"],a.actor,a.story),ensure_ascii=False,indent=2))
    elif a.cmd=="claim":
        print(json.dumps(claim(a.rev,a.actor,a.story),ensure_ascii=False,indent=2))
    elif a.cmd=="serve":
        sync()
        serve(a.port)
    else:
        actor=a.actor or "AI"
        if a.cmd=="decision":
            op=lambda w:decide(w,a.id,a.choice,a.why,actor)
        elif a.cmd=="plan":
            patch=load(Path(a.file))
            op=lambda w:apply_plan(w,patch,actor,a.why)
        else:
            op=lambda w:progress(w,a.cmd,a.id,actor,a.output,getattr(a,"evidence",""),
                                 getattr(a,"level",""),getattr(a,"environment",""),getattr(a,"expected",""),getattr(a,"reopen",None))
        model=commit(a.rev,op)
        print("共同记录 v"+str(model["work"]["revision"]))


if __name__=="__main__":
    try:
        main()
    except (OSError,KeyError,ValueError,TypeError) as exc:
        print(str(exc),file=sys.stderr)
        sys.exit(1)
