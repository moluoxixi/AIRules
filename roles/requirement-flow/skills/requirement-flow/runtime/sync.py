#!/usr/bin/env python3
"""Local, file-based collaboration protocol. All mutable facts live in model.json."""
import argparse
import copy
import hashlib
import json
import os
import re
import secrets
import shutil
import sys
import tempfile
import unicodedata
if __package__:
    from . import evidence, graph_view, knowledge, source_paths, story_scope
else:
    import evidence
    import graph_view
    import knowledge
    import source_paths
    import story_scope
from datetime import datetime, timezone
from contextlib import contextmanager
from contextvars import ContextVar
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
SKILLS = ("flow-requirements","flow-contracts","flow-implement","flow-verify","flow-review")
STATES = {"ready":"可推进","active":"进行中","blocked":"等待输入","dormant":"按条件启用",
          "skipped":"本次跳过","done":"已完成","stale":"需复核"}
_render_input_cache = ContextVar("requirement_flow_render_inputs", default=None)


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


def scenario_definitions(w):
    result = {}
    for story_id, story in w["stories"].items():
        occurrences = {}
        for example in story["examples"]:
            content = {field: example.get(field) for field in ("given","when","then")}
            key = example.get("id")
            if "id" not in example:
                # Existing tasks can expose stable, addressable cases without rewriting any event.
                base = "legacy-" + story_id + "-" + digest(content)[:12]
                occurrences[base] = occurrences.get(base,0) + 1
                key = base if occurrences[base] == 1 else base + "-" + str(occurrences[base])
            expect(isinstance(key,str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*",key),
                   "验收场景需要有效的 ID")
            expect(key not in result, "需求内的场景 ID 重复：" + key)
            result[key] = {"id":key, "story":story_id, **content}
    return result


def story_context(w, keys):
    result = {key:{**w["stories"][key],"examples":[]} for key in keys}
    for scenario in scenario_definitions(w).values():
        story = scenario["story"]
        if story in result:
            examples = result[story]["examples"]
            original = w["stories"][story]["examples"][len(examples)]
            examples.append({**original,"id":scenario["id"]})
    return result


def validate_endpoints(contract_id, endpoints):
    def has_text(value):
        return isinstance(value, str) and bool(value.strip())

    expect(isinstance(endpoints, list), contract_id + " 的 endpoints 应为接口列表")
    seen = set()
    for i, endpoint in enumerate(endpoints):
        label = f"{contract_id} 的第 {i + 1} 个接口"
        expect(isinstance(endpoint, dict), label + " 应为对象")
        method, path = endpoint.get("method"), endpoint.get("path")
        expect(has_text(method) and re.fullmatch(r"[A-Z][A-Z0-9-]*", method), label + " 需要大写 HTTP 方法")
        expect(has_text(path) and re.fullmatch(r"(?:/|https?://[^/\s]+)\S*", path),
               label + " 需要请求路径或完整 HTTP 地址")
        label = f"{contract_id} 的 {method} {path}"
        expect((method, path) not in seen, label + " 重复")
        seen.add((method, path))
        expect(has_text(endpoint.get("purpose")) and has_text(endpoint.get("source")), label + " 缺少业务用途或来源")
        for side, title in (("request", "请求"), ("response", "响应")):
            fields = endpoint.get(side)
            expect(isinstance(fields, list), label + " 的" + title + "字段应为列表")
            note_key = side + "Note"
            expect(note_key not in endpoint or has_text(endpoint[note_key]), label + " 的" + title + "说明应为非空文字")
            names = set()
            for field in fields:
                expect(isinstance(field, dict) and all(has_text(field.get(k)) for k in ("name", "type", "constraint", "use")),
                       label + " 的" + title + "字段缺少名称、类型、口径或用途")
                name = field["name"].strip()
                expect(name not in names, f"{label} 的{title}字段 {name} 重复")
                names.add(name)


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
    retired_owners = {case["story"] for case in retirement_history(w, set())}
    for key, story in w["stories"].items():
        expect(story["actor"] and story["goal"] and isinstance(story["examples"], list)
               and (story["examples"] or key in retired_owners), "故事缺少角色、目标或验收例子")
        for ex in story["examples"]:
            expect(all(ex.get(k) for k in ("given","when","then")), "验收例子缺少前提、操作或预期")
    scenarios = scenario_definitions(w)
    for contract_id, c in w["contracts"].items():
        expect(c["state"] in ("open","confirmed","fixture") and c["source"] and isinstance(c["fields"], list), "契约缺少已知状态或来源")
        if c["state"] == "fixture":
            expect(w["kind"] == "合成推演", "真实需求需要真实来源")
        for field in c["fields"]:
            expect(all(field.get(k) for k in ("name","type","constraint","use")), "字段缺少口径或用途")
        if "endpoints" in c:
            validate_endpoints(contract_id, c["endpoints"])
    for key, action in w["actions"].items():
        expect(not action.get("skill") or action["skill"] in SKILLS, "未知专项 skill：" + key)
        expect(action["kind"] in ("调研","开发","验证") and action["done"].strip(), "动作类型或完成条件无效 " + key)
        if "code_paths" in action:
            expect(action["kind"] == "验证", "只有验证动作可指定代码输入：" + key)
            evidence.code_inputs.normalize_paths(action["code_paths"])
        for prop, group in (("stories","stories"),("read_stories","stories"),("contracts","contracts"),("decisions","decisions")):
            check_refs(action[prop], group)
        check_refs(action.get("closes_contracts", []), "contracts")
        covers = action.get("covers", [])
        expect(isinstance(covers,list) and all(isinstance(x,str) for x in covers) and len(covers)==len(set(covers)),
               "covers 应为不重复的场景 ID 列表：" + key)
        expect(not covers or action["kind"] == "验证", "只有验证动作可登记场景验收：" + key)
        expect(all(s in scenarios and scenarios[s]["story"] in action["stories"] for s in covers),
               "covers 必须引用本动作所关联故事中的场景：" + key)
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
    knowledge.validate_adoptions(w, sys.modules[__name__])
    return knowledge.validate_cards(w, sys.modules[__name__])


def condition_value(w, condition):
    if not condition:
        return True
    answer = w["answers"].get(condition["decision"])
    return answer["choice"] == condition["is"] if answer else None


def proof_stamp(action_stamp, scenario_stamp, event_id, revision):
    return digest({"action":action_stamp, "scenario":scenario_stamp, "event":event_id, "revision":revision})


def case_stamp(scenario, latest_retired):
    retired = latest_retired.get((scenario["story"],scenario["id"]))
    if retired:
        return digest({"scenario":scenario,"last_retirement":retired["event"],"revision":retired["revision"]})
    return digest(scenario)


def verified_receipt(workspace, event, stamp):
    manifest = evidence.validate(workspace,event["receipt"],action=event["action"],scenario=event["scenario"],stamp=stamp)
    expect(event.get("actor") == manifest["actor"], "证据事件的执行人与签名回执不符")
    expect(event.get("output") == manifest["actual"], "证据事件的结果与签名回执不符")
    return manifest


def inspect_proof(workspace, event, action_id, scenario, action_stamp, scenario_stamp, accepts, replays,
                  code_paths=None, input_cache=None):
    if not event:
        return {"status":"pending", "reason":"尚未采集本场景的验收凭据", "receipt":None}
    stored = event.get("receipt")
    if not isinstance(stored,dict):
        return {"status":"stale","invalid_receipt":True,"reason":"凭据记录结构无效：" + event["id"],"receipt":None}
    summary = {"id":event["id"],"action":action_id,"scenario":scenario["id"],"actor":None,
               "level":None,"environment":None,"actual":None,
               "passed":False,"artifact":None}
    if event["id"] in replays:
        return {"status":"stale","invalid_receipt":True,"reason":"同一凭据已用于此前的采集事件，不能重放","receipt":summary}
    stamp = proof_stamp(action_stamp,scenario_stamp,event["id"],event["revision"])
    if event.get("stamp") != action_stamp or event.get("scenario_stamp") != scenario_stamp:
        return {"status":"stale", "reason":"场景、输入或前置产出已改变，需要重新采集", "receipt":summary}
    try:
        manifest = verified_receipt(workspace,event,stamp)
    except (KeyError, OSError, TypeError, ValueError) as error:
        return {"status":"stale", "invalid_receipt":True, "reason":"凭据产物核验失败：" + str(error), "receipt":summary}
    summary.update({key:manifest[key] for key in ("kind","actor","level","environment","passed","artifact")})
    summary["actual"] = manifest["actual"][:500]
    if manifest["kind"] == "run":
        summary["argv"] = manifest["argv"]
        summary["exit_code"] = manifest["exit_code"]
    store = Path(workspace).parent.parent
    project = store.parent if store.name == ".requirements" else Path.cwd()
    try:
        evidence.validate_current_inputs(manifest, project, code_paths, cache=input_cache)
    except (OSError, ValueError) as error:
        return {"status":"stale", "reason":str(error), "receipt":summary}
    if accepts and manifest["level"] not in accepts:
        return {"status":"stale","invalid_receipt":True,"reason":"凭据类型不符合本动作的验收要求","receipt":summary}
    if not manifest["passed"]:
        return {"status":"failed","reason":"实际运行或观察未通过","receipt":summary}
    return {"status":"captured","reason":"已取得有效凭据，等待完成验证动作","receipt":summary}


def evaluate(w, workspace=None):
    workspace = TASK_DIR if workspace is None else Path(workspace)
    input_cache = _render_input_cache.get()
    if input_cache is None:
        input_cache = {}
    definitions = scenario_definitions(w)
    retired = latest_retirements(w,set())
    withdrawn = story_scope.withdrawn_stories(w)
    latest = {}
    finishes = {}
    reopened = {}
    proof_events = {}
    seen_receipts, replays = set(), set()
    for event in w["events"]:
        if event["kind"] in ("start","finish","fail"):
            latest[event["action"]] = event
        if event["kind"] == "finish":
            finishes[event["action"]] = event
        if event.get("reopen"):
            reopened[event["reopen"]] = event["id"]
        if event["kind"] == "evidence":
            stored = event.get("receipt")
            rid = stored.get("id") if isinstance(stored,dict) else None
            if isinstance(rid,str):
                if rid in seen_receipts:
                    replays.add(event["id"])
                seen_receipts.add(rid)
            proof_events[event["action"],event["scenario"]] = event

    @lru_cache(maxsize=None)
    def visit(key):
        action = w["actions"][key]
        if action["stories"] and set(action["stories"]) <= withdrawn:
            return {"state":"skipped", "reasons":["关联功能已按业务决定移出本期范围"],
                    "stamp":None, "proof":None, "blockers":[], "actor":None, "cases":{}}
        last = latest.get(key, {})
        condition = action.get("when")
        gate = condition_value(w, condition)
        if gate is not True:
            state = "dormant" if gate is None else "skipped"
            name = w["decisions"][condition["decision"]]["options"][condition["is"]]["label"]
            blockers = [{"kind":"decision","id":condition["decision"]}] if gate is None else []
            return {"state":state,"reasons":["在选择「" + name + "」时启用"],"stamp":None,"proof":None,
                    "blockers":blockers,"actor":None,"cases":{}}
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
        verify = action["kind"] == "验证"
        if verify and not action.get("covers"):
            blockers.append({"kind":"coverage","id":key})
        inputs = {}
        for dep in deps:
            status = visit(dep)
            if status["state"] != "done":
                blockers.append({"kind":"dependency","id":dep})
            inputs[dep] = status["proof"]
        labels = {"decision":("待决定 · ", "decisions"),"contract":("待契约 · ", "contracts"),
                  "dependency":("等待 · ", "actions"),"coverage":("待关联验收场景 · ","actions")}
        reasons = [labels[b["kind"]][0] + w[labels[b["kind"]][1]][b["id"]]["title"] for b in blockers]
        stories = {i:w["stories"][i] for i in action["read_stories"]}
        if verify:
            # Evidence binds the particular covered example separately from shared story inputs.
            stories = {i:{k:v for k,v in story.items() if k != "examples"} for i,story in stories.items()}
        definition = {k:v for k,v in action.items() if k != "covers"} if verify else action
        stamp = digest({
            "action":definition, "dependency_outputs":inputs, "reopen":reopened.get(key),
            "stories":stories,
            "contracts":{i:w["contracts"][i] for i in action["contracts"]},
            "decisions":{i:{"definition":w["decisions"][i],"answer":w["answers"].get(i)} for i in sorted(decisions)}
        })
        cases = {s:inspect_proof(workspace, proof_events.get((key,s)), key, definitions[s], stamp,
                                 case_stamp(definitions[s],retired),action.get("accepts"),replays,
                                 action.get("code_paths"), input_cache)
                 for s in action.get("covers", [])}
        last_finish = finishes.get(key,{})
        for s,c in cases.items():
            c["accepted"] = (c["status"] == "captured" and not blockers and last_finish.get("stamp") == stamp
                             and last_finish.get("receipts",{}).get(s) == c["receipt"]["id"])
        if last and (last["kind"] == "fail" or last["stamp"] != stamp):
            state = "stale"
            if last["kind"] == "fail":
                reasons.append("上次验证失败 · " + last["output"])
            elif not reasons:
                reasons.append("决定、依赖产出或所读输入已修订")
        elif reasons:
            state = "blocked"
        elif last.get("kind") == "finish":
            if verify and any(c["status"] != "captured" or last.get("receipts",{}).get(s) != c["receipt"]["id"]
                              for s,c in cases.items()):
                state = "stale"
                reasons.extend(c["reason"] for c in cases.values() if c["status"] != "captured")
                if not reasons:
                    reasons.append("已有新凭据，需要重新确认验证结果")
            else:
                state = "done"
        elif last.get("kind") == "start":
            state = "active"
        else:
            state = "ready"
        return {"state":state,"reasons":reasons,"stamp":stamp,"proof":last.get("id") if state == "done" else None,
                "blockers":blockers,"actor":last.get("actor") if state == "active" else None,"cases":cases}

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


def retirements(w, patch):
    requested = patch.get("retire_scenarios", {})
    expect(isinstance(requested,dict), "retire_scenarios 应按撤下的场景 ID 填写")
    edits = patch.get("stories", {})
    expect(isinstance(edits,dict), "故事修改应按 ID 填写")
    if not edits and not requested:
        return []
    previous = scenario_definitions(w)
    remaining = scenario_definitions({"stories":{**w["stories"], **edits}})
    removed = {k:v for k,v in previous.items() if k not in remaining or remaining[k]["story"] != v["story"]}
    missing = set(removed) - requested.keys()
    extra = requested.keys() - set(removed)
    expect(not missing,"撤下或更换场景 ID 须在 retire_scenarios 引用已确认的范围决定：" + "、".join(sorted(missing)))
    expect(not extra,"retire_scenarios 包含本次未撤下的场景：" + "、".join(sorted(extra)))
    snapshots = []
    for key, scenario in removed.items():
        ref = requested[key]
        expect(isinstance(ref,dict) and set(ref)=={"decision","is"} and isinstance(ref["decision"],str),
               "撤下场景须提供 decision 和已选选项 is：" + key)
        decision_id, option = ref["decision"], ref["is"]
        if type(option) is bool:
            option = "true" if option else "false"
        decision = w["decisions"].get(decision_id)
        answer = w["answers"].get(decision_id)
        expect(decision and scenario["story"] in decision["stories"] and answer and
               isinstance(option,str) and answer["choice"] == option and option in decision["options"],
               "撤下场景须匹配本故事已作出的业务决定和选项：" + key)
        snapshots.append({**scenario,"decision":decision_id,"decision_title":decision["title"],"is":option,
                          "option":copy.deepcopy(decision["options"][option]),"answer":copy.deepcopy(answer)})
    return snapshots


def retirement_history(w, selected):
    return story_scope.retirement_history(w, selected)


def latest_retirements(w, selected):
    return story_scope.latest_retirements(w, selected)


def apply_plan(w, patch, actor, reason):
    expect(isinstance(patch,dict) and patch and set(patch) <= set(PLANNABLE) | {"goal","scope","lessons","contract_routes","retire_scenarios"}, "计划修改包含不支持的栏目")
    expect(reason.strip(), "请写明调整计划的原因")
    retired = retirements(w,patch)
    changed = []
    for group,val in patch.items():
        if group == "retire_scenarios":
            continue
        if group in PLANNABLE:
            expect(isinstance(val,dict), "按 ID 提交局部记录")
            for key,obj in val.items():
                if w[group].get(key) != obj:
                    if group == "stories":
                        previous = list(w[group].get(key,{}).get("examples",[]))
                        for example in obj["examples"]:
                            if "id" not in example:
                                expect(example in previous, "新增或改写验收场景需要显式 id：" + key)
                                previous.remove(example)
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
    append_event(w,"plan",actor,output=reason,changed=changed,**({"retired_scenarios":retired} if retired else {}))
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
    proof_fields = {}
    if mode == "start":
        if state == "active":
            return False
        expect(output.strip(), "开始动作时记录本次要做什么")
    else:
        expect(output.strip(), "请填写实际产出")
        if action["kind"] == "验证" and mode == "finish":
            expect(level != "推演" or w["kind"] == "合成推演", "真实需求不能用推演证据作验收结论")
            cases = status["cases"]
            gaps = [s + " · " + c["reason"] for s,c in cases.items() if c["status"] != "captured"]
            expect(cases and not gaps, "验证缺少有效的成功凭据：" + " / ".join(gaps))
            receipts = {s:c["receipt"] for s,c in cases.items()}
            proof_fields = {"receipts":{s:r["id"] for s,r in receipts.items()}}
            if evidence.strip():
                proof_fields["note"] = evidence
            evidence = "、".join(f"{s} ({r['id']})" for s,r in receipts.items())
            level = "、".join(dict.fromkeys(r["level"] for r in receipts.values()))
            environment = "、".join(dict.fromkeys(r["environment"] for r in receipts.values()))
            definitions = scenario_definitions(w)
            expected = " / ".join(definitions[s]["then"] for s in receipts)
        else:
            expect(evidence.strip(), "动作结论需要产出与可复核依据")
        if mode == "finish":
            for contract in action.get("closes_contracts", []):
                expect(w["contracts"][contract]["state"] != "open", "先补齐契约及来源，再结束调研：" + contract)
        if action["kind"] == "验证" and mode != "finish":
            expect(level and environment.strip() and expected.strip(), "验证须记录证据类型、环境与预期")
            expect(level != "推演" or w["kind"] == "合成推演", "真实需求不能用推演证据作验收结论")
        if mode == "fail":
            expect(action["kind"] == "验证" and reopen in active_ancestors(w,key), "失败时指定当前验证或本分支的实际前置动作")
    w["revision"] += 1
    append_event(w,mode,actor,action=key,stamp=status["stamp"],output=output,evidence=evidence,
                 level=level,environment=environment,expected=expected,reopen=reopen,**proof_fields)
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
    default_skill = {"调研":"flow-contracts" if contracts else "flow-requirements", "开发":"flow-implement", "验证":"flow-verify"}
    return {"id":key, "title":action["title"], "kind":action["kind"], "mode":mode, "stories":action["stories"],
            "skill":action.get("skill") or default_skill[action["kind"]], "covers":action.get("covers",[]),
            "goal":w["goal"], "scope":w["scope"], "done":action["done"], "accepts":action.get("accepts", []),
            "closes_contracts":action.get("closes_contracts", []), "prior_result":previous,
            "inputs":{"stories":story_context(w,stories), "contracts":{i:w["contracts"][i] for i in contracts},
                      "decisions":{i:{**w["decisions"][i],"answer":w["answers"].get(i)} for i in decisions},
                      "dependencies":dependencies}}


def scenario_report(w, states, selected):
    rows = []
    active = set()
    for key, case in scenario_definitions(w).items():
        if selected and case["story"] not in selected:
            continue
        active.add((case["story"],key))
        actions = [i for i,a in w["actions"].items() if key in a.get("covers",[]) and states[i]["state"] != "skipped"]
        receipts, issues = [], []
        for action_id in actions:
            state = states[action_id]
            result = state["cases"].get(key)
            if result and result["receipt"]:
                receipts.append({**result["receipt"],"status":result["status"],"reason":result["reason"]})
            if not result:
                issues.append(("pending", " / ".join(state["reasons"])))
            elif not result["accepted"]:
                status = "pending" if result["status"] == "captured" else result["status"]
                issues.append((status, result["reason"]))
        if not actions:
            status, reason = "uncovered", "尚未关联适用的验证动作"
        elif not issues:
            status, reason = "passed", "所有适用验证均已凭有效回执完成"
        else:
            priority = {"failed":0,"stale":1,"pending":2}
            status = min((s for s,_ in issues),key=priority.get)
            reason = " / ".join(dict.fromkeys(r for _,r in issues))
        rows.append({**case,"status":status,"reason":reason,"actions":actions,"receipts":receipts})
    for identity, case in latest_retirements(w,selected).items():
        if identity in active:
            continue
        if not story_scope.retirement_applies(w, case):
            rows.append({**{k:case[k] for k in ("id","story","given","when","then")},
                         "status":"uncovered","reason":"撤下场景的范围决定已变更，请补回场景或重新确认原选项",
                         "actions":[],"receipts":[],"retirement":case["event"],"decision":case["decision"]})
    return rows


def verification_followups(work, scenarios):
    """Surface unresolved real failures and repeated results to the actor taking the next step."""
    followups = []
    failures = {(case["id"],proof["action"]):proof for case in scenarios for proof in case["receipts"]
                if proof.get("status") == "failed"}
    if not failures:
        return followups
    history = {}
    for event in work["events"]:
        key = (event.get("scenario"), event.get("action"))
        if event["kind"] == "evidence" and key in failures:
            history.setdefault(key, []).append(event)
    for (scenario, action), proof in failures.items():
        attempts = history.get((scenario,action), [])
        if not attempts or attempts[-1]["id"] != proof["id"]:
            continue
        def fingerprint(event):
            receipt = event.get("receipt") or {}
            if not isinstance(receipt,dict) or not isinstance(receipt.get("artifact"),dict):
                return None
            # Logs retain their integrity hash, but elapsed times and timestamps are
            # not new inputs. Repeated failures on unchanged inputs need review.
            return (event.get("stamp"),event.get("scenario_stamp"),receipt.get("code_inputs"),
                    receipt.get("passed"),receipt.get("environment"),receipt.get("kind"),
                    receipt.get("argv"),receipt.get("exit_code"))
        current = fingerprint(attempts[-1])
        repeated = []
        for attempt in reversed(attempts):
            if fingerprint(attempt) != current:
                break
            repeated.append(attempt["id"])
        followups.append({"action":action,"scenario":scenario,"actor":proof.get("actor"),
                          "receipts":list(reversed(repeated)),
                          "step":"independent_review" if len(repeated)>1 else "diagnose",
                          "skill":"flow-review" if len(repeated)>1 else "flow-verify"})
    return followups


def lesson_context(work, workspace, stories, packet=None, *, for_map=False):
    events = knowledge.adoption_events(work, stories)
    hits = knowledge.memory_hits(workspace, knowledge.query_contexts(work, stories, None))
    keys = set(hits) | {knowledge.card_key(event["origin"]) for event in events}
    cards = knowledge.project_cards(workspace, sys.modules[__name__], current_work=work, relevant_to=work,
                                    stories=stories, include_keys=keys)
    adopted = knowledge.adopted_cards(events, cards)
    own_cards = [card for card in cards if card["task"] == work["id"]
                 and (not stories or any(s["story"] in stories for s in card["sources"]))]
    if packet is not None:
        packet["related_lessons"] = knowledge.match_cards(work, cards, stories=stories, action=packet["id"], hits=hits)
        owners = {sid for sid, *_ in knowledge.query_contexts(work, stories, packet["id"])}
        packet["adopted_lessons"] = [card for card in adopted if card["adoption"]["story"] in owners]
    reviews = [{"id":card["id"], "version":card["version"], "author":card["author"], "skill":"flow-review",
                "sources":[{k:s[k] for k in ("story","scenario","action","receipt")} for s in card["sources"]]}
               for card in own_cards if card["state"] == "pending"]
    return {"related_lessons": knowledge.match_cards(work, cards, stories=stories, hits=hits, limit=None if for_map else 5),
            "lesson_cards": own_cards, "lesson_reviews": reviews, "adopted_lessons": adopted}


def dispatch(w, actor="AI", story=None, *, workspace=None, include_lessons=True, for_map=False):
    expect(isinstance(actor,str) and actor.strip(), "执行人不能为空")
    expect(story is None or story in w["stories"], "故事不存在")
    selected = {story} if story is not None else set()
    withdrawn = story_scope.withdrawn_stories(w)
    chosen = {key for key, action in w["actions"].items() if not selected or selected.intersection(action["stories"])}
    to_visit = list(chosen)
    while to_visit:
        action = w["actions"][to_visit.pop()]
        if action["stories"] and set(action["stories"]) <= withdrawn:
            continue
        if condition_value(w, action.get("when")) is not True:
            continue
        for edge in action["depends_on"]:
            if edge["id"] not in chosen and condition_value(w, edge.get("when")) is True:
                chosen.add(edge["id"])
                to_visit.append(edge["id"])
    states = evaluate(w, workspace)
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
               (not definition["stories"] or not set(definition["stories"]) <= withdrawn
                or ("decision",key) in blocked_by) and
               (not selected or selected.intersection(definition["stories"]) or ("decision",key) in blocked_by)]
    technical = [{"kind":kind,"id":key,"title":w["contracts" if kind=="contract" else "actions"][key]["title"],"actions":actions}
                 for (kind,key), actions in blocked_by.items() if kind != "decision"]
    own = next((item["id"] for item in running if item["actor"] == actor), None)
    next_key = own or next(iter(ready),None)
    packet = action_packet(w, states, next_key, "resume" if own else "start") if next_key else None
    if packet is not None and include_lessons:
        packet = source_paths.SourcePaths.for_task(workspace or TASK_DIR).reading_context(packet)
    scenarios = scenario_report(w, states, selected)
    verified = {row["story"] for row in scenarios}
    verified.difference_update(row["story"] for row in scenarios if row["status"] != "passed")
    for i in chosen:
        if w["actions"][i]["kind"] == "验证" and states[i]["state"] not in ("done","skipped"):
            verified.difference_update(w["actions"][i]["stories"])
    withdrawn = withdrawn & selected if selected else withdrawn
    missing = [s for s in w["stories"] if (not selected or s in selected) and s not in verified | withdrawn]
    research = w.get("outcome") == "research"
    research_proved = any(w["actions"][r["id"]]["kind"] == "调研" for r in completed)
    if next_key:
        state = "resume" if own else "ready"
    elif waiting or running or pending:
        state = "waiting"
    elif ((research and (research_proved or withdrawn) and not missing)
          or (not research and (completed or withdrawn) and (verified or withdrawn) and not missing)):
        state = "complete"
    else:
        state = "unplanned"
    lessons = lesson_context(w, workspace or TASK_DIR, selected, packet, for_map=for_map) if include_lessons else {}
    followups = verification_followups(w,scenarios)
    if packet is not None:
        packet["verification_followups"] = [f for f in followups if f["action"] == packet["id"]]
        repeats = [f for f in packet["verification_followups"] if f["step"] == "independent_review"]
        if repeats:
            packet["skill"] = "flow-review"
            packet["handoff"] = {"reason":"相同输入重复得到相同失败，请独立诊断原因后再重测",
                                 "scenarios":[f["scenario"] for f in repeats],
                                 "receipts":[rid for f in repeats for rid in f["receipts"]],
                                 "verification_actors":list(dict.fromkeys(f["actor"] for f in repeats))}
    return {**lessons, "revision":w["revision"],"actor":actor,"story":story,"outcome_type":w.get("outcome","delivery"),
            "state":state,"next":packet,"ready":ready,
            "running":running,"pending_decisions":pending,"technical_blockers":technical,"waiting":waiting,"scenarios":scenarios,
            "retired_scenarios":retirement_history(w,selected), "verification_followups":followups,
            "review_skill":"flow-review" if lessons.get("lesson_reviews") or (
                (scenarios or not research) and not packet and (missing or state in ("unplanned","complete"))) else None,
            "progress":{"completed":completed,"verified_stories":[s for s in w["stories"] if s in verified and (not selected or s in selected)],
                        "withdrawn_stories":[s for s in w["stories"] if s in withdrawn],
                        "unverified_stories":missing}}


def claim(revision, actor="AI", story=None):
    result = {}
    def reserve(w):
        queue = dispatch(w, actor, story, include_lessons=False)
        packet = queue["next"]
        if packet and packet.get("handoff"):
            result.update(claimed=None, outcome="review_requested")
            return False
        result["claimed"] = packet["id"] if packet else None
        if not packet or packet["mode"] == "resume":
            result["outcome"] = "resumed" if packet else queue["state"]
            return False
        result["outcome"] = "claimed"
        return progress(w, "start", packet["id"], actor, packet["title"])
    model = commit(revision, reserve)
    return {**dispatch(model["work"], actor, story), **result}


def capture(mode, key, scenario_id, revision, actor, environment, *, argv=None, artifact=None,
            actual=None, level=None, passed=True):
    expect(actor.strip() and environment.strip(), "采集需要执行人和环境")
    level = "自动化" if mode == "verify-run" else level

    def inputs(w):
        action = w["actions"].get(key)
        expect(action and action["kind"] == "验证" and scenario_id in action.get("covers",[]),
               "指定验证动作未关联此场景")
        expect(not action.get("accepts") or level in action["accepts"],"该证据类型不满足验收条件")
        state = evaluate(w)[key]
        expect(executable(state) or state["state"] == "done","前置条件或当前分支不允许采集")
        expect(state["state"] != "active" or state["actor"] == actor, "该动作已由其他执行人领取")
        case = scenario_definitions(w)[scenario_id]
        return state["stamp"], case_stamp(case,latest_retirements(w,set())), "E" + str(len(w["events"])+1)

    with task_lock(shared=True):
        model = load()
        validate(model)
        if model["work"]["revision"] != revision:
            raise Conflict("版本已更新，请读取最新记录再采集。")
        action_stamp, scenario_stamp, event_id = inputs(model["work"])
        combined = proof_stamp(action_stamp,scenario_stamp,event_id,revision+1)

    # Project commands run outside the model lock, from the task's owning project.
    store = TASK_DIR.parent.parent
    project = store.parent if store.name == ".requirements" else Path.cwd()
    binding = dict(action=key,scenario=scenario_id,stamp=combined,actor=actor,environment=environment,
                   code_paths=model["work"]["actions"][key].get("code_paths"))
    if mode == "verify-run":
        receipt = evidence.run(TASK_DIR, project, argv, **binding)
    else:
        receipt = evidence.observe(TASK_DIR, project, artifact, actual=actual, level=level, passed=passed, **binding)

    def record(w):
        expect(inputs(w) == (action_stamp,scenario_stamp,event_id), "采集期间输入变化，请重新采集")
        evidence.validate(TASK_DIR, receipt, action=key, scenario=scenario_id, stamp=combined)
        w["revision"] += 1
        append_event(w,"evidence",actor,action=key,scenario=scenario_id,stamp=action_stamp,
                     scenario_stamp=scenario_stamp,receipt=receipt,output=receipt["actual"])
        return True

    try:
        saved = commit(revision, record)
    except Exception:
        evidence.discard(TASK_DIR,receipt)
        raise
    event = saved["work"]["events"][-1]
    return {"id":event["id"],"revision":saved["work"]["revision"],"action":key,"scenario":scenario_id,
            "passed":receipt["passed"],"actor":actor,"level":level,"environment":environment,
            "actual":receipt["actual"],"artifact":receipt["artifact"]}


def context(m, story=None, *, workspace=None):
    workspace = workspace or TASK_DIR
    w = m["work"]
    stories = {story} if isinstance(story, str) and story else set(story or ())
    expect(stories <= w["stories"].keys(), "故事不存在")
    status = evaluate(w, workspace)
    chosen, decisions, contracts = graph_view.feature_scope(w, stories)
    routes = [r for r in w.get("contract_routes", []) if r["decision"] in decisions]
    all_events = [e for e in w["events"] if not stories or e.get("action") in chosen or
                  e.get("decision") in decisions or e.get("story") in stories or set(e.get("changed",[])) & (chosen|decisions|contracts|stories)]
    effective_ids = {status[k]["proof"] for k in chosen if status[k]["proof"]}
    usage = graph_view.contract_users(w)
    scenarios = scenario_report(w,status,stories)
    withdrawn = story_scope.withdrawn_stories(w)
    result = {
        "protocol_version":m["protocol"]["version"],"revision":w["revision"],"mode":w["kind"],"outcome_type":w.get("outcome","delivery"),
        "raw_request":w["raw_request"],"goal":w["goal"],"scope":w["scope"],"contract_routes":routes,
        "scenarios":scenarios, "verification_followups":verification_followups(w,scenarios),
        "retired_scenarios":retirement_history(w,stories),
        "withdrawn_stories":[k for k in w["stories"] if k in withdrawn and (not stories or k in stories)],
        "stories":story_context(w,[k for k in w["stories"] if not stories or k in stories]),
        "decisions":{k:{**w["decisions"][k],"answer":w["answers"].get(k)} for k in w["decisions"] if k in decisions},
        "contracts":{k:v for k,v in w["contracts"].items() if k in contracts},
        "contract_usage":{k:{s:w["stories"][s]["title"] for s in usage[k]} for k in w["contracts"] if k in contracts},
        "actions":{k:{**v, **{x:status[k][x] for x in ("state","reasons","proof")}} for k,v in w["actions"].items() if k in chosen},
        "currently_running":[k for k in w["actions"] if k in chosen and status[k]["state"]=="active"],
        "ready":[k for k in w["actions"] if k in chosen and status[k]["state"] != "active" and executable(status[k])],
        "effective_outputs":[e for e in w["events"] if e["id"] in effective_ids],
        "recent_events":all_events[-12:], "lessons":w["lessons"], **lesson_context(w,workspace,stories)
    }
    return source_paths.SourcePaths.for_task(workspace).reading_context(result)


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
def task_lock(shared=False, *, workspace=None):
    path = workspace / ".workflow.lock" if workspace is not None else LOCK
    with path.open("a+b") as stream:
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


def commit(revision, operation, *, workspace=None):
    root = workspace or TASK_DIR
    model_path, book = root / "model.json", root / "handbook.html"
    with task_lock(workspace=root):
        model = load(model_path)
        validate(model)
        if revision != model["work"]["revision"]:
            raise Conflict("版本已更新，请读取最新记录再提交。")
        if operation(model["work"]):
            validate(model)
            html = render(model,workspace=root).encode()
            previous_page = book.read_bytes() if book.exists() else None
            atomic(book, html)
            try:
                atomic(model_path, encoded(model))
            except OSError:
                if previous_page is None:
                    book.unlink(missing_ok=True)
                else:
                    atomic(book, previous_page)
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


def impact(w, decision, choice, workspace=None):
    simulated=copy.deepcopy(w)
    before=evaluate(w,workspace)
    decide(simulated,decision,choice,"比较选项","推演")
    after=evaluate(simulated,workspace)
    return [(a["title"],STATES[before[k]["state"]],STATES[after[k]["state"]]) for k,a in w["actions"].items()
            if before[k]["state"]!=after[k]["state"] or before[k]["reasons"]!=after[k]["reasons"]]


def offline_home_href(workspace):
    workspace = Path(workspace)
    store = workspace.parent.parent
    if store.name != ".requirements" or workspace.parent.name not in ("active", "archive"):
        return None
    index = store / "index.html"
    if any(evidence.linked(path) for path in (store, workspace.parent, workspace, index)) or not index.is_file():
        return None
    return "../../index.html"


def render(model, token=None, *, workspace=None, read_only=False, home_href=None):
    # One render includes branch previews and lesson lookups. Reuse code reads
    # only within this request; ContextVar keeps concurrent HTTP requests isolated.
    token_cache = _render_input_cache.set({}) if _render_input_cache.get() is None else None
    try:
        work = model["work"]
        impacts = {key: {code: impact(work, key, code, workspace) for code in d["options"]}
                   for key, d in work["decisions"].items()}
        return graph_view.render(model, evaluate(work,workspace), impacts, token, digest(model), LAYOUT,
                                 queue=dispatch(work,workspace=workspace,for_map=True), read_only=read_only,
                                 home_href=home_href if token else offline_home_href(workspace or TASK_DIR),
                                 source_labels=source_paths.SourcePaths.for_task(workspace or TASK_DIR).graph_labels(work))
    finally:
        if token_cache is not None:
            _render_input_cache.reset(token_cache)


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
        (staging/"handbook.html").write_bytes(render(model,workspace=dest).encode("utf-8"))
        expect(not dest.exists(),"目标目录已由其他流程创建")
        staging.rename(dest)
    return dest


def new_workspace(path, raw):
    return initialize_task(path, raw, key=Path(path).resolve().name)


class TaskHandler(BaseHTTPRequestHandler):
    """A request is bound to one workspace before any model or evidence is read."""
    task_prefix = "/"
    home_href = None
    task_id = None
    read_only = False

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
    def download_evidence(self, model, event_id, *, workspace=None, source=None):
        event = next((e for e in model["work"]["events"] if e["id"]==event_id and e["kind"]=="evidence"),None)
        if not event:
            self.send_error(404)
            return
        try:
            root = self.workspace if workspace is None else workspace
            stamp = proof_stamp(event["stamp"],event["scenario_stamp"],event["id"],event["revision"])
            receipt = verified_receipt(root,event,stamp)
            if source is not None:
                expect(receipt["action"] == source["action"] and receipt["scenario"] == source["scenario"]
                       and receipt["artifact"] == source["proof"]["artifact"], "经验引用的回执已改变")
            path = evidence.artifact_path(root,receipt)
            snapshot = tempfile.SpooledTemporaryFile(max_size=512*1024)
            try:
                checksum = hashlib.sha256()
                with path.open("rb") as stream:
                    for chunk in iter(lambda: stream.read(256*1024), b""):
                        checksum.update(chunk)
                        snapshot.write(chunk)
                expect(checksum.hexdigest() == receipt["artifact"]["sha256"], "读取中的证据已改变")
                snapshot.seek(0)
            except BaseException:
                snapshot.close()
                raise
        except (OSError,ValueError,KeyError,TypeError) as error:
            self.send_content(409,"凭据产物核验失败：" + str(error),"text/plain")
            return
        with snapshot:
            self.send_response(200)
            self.send_header("Content-Type","application/octet-stream")
            self.send_header("Content-Disposition",'attachment; filename="' + path.name + '"')
            self.send_header("Content-Length",str(receipt["artifact"]["size"]))
            self.send_header("Cache-Control","no-store")
            self.send_header("X-Content-Type-Options","nosniff")
            self.end_headers()
            shutil.copyfileobj(snapshot,self.wfile)
    def lesson_source(self, model, path):
        try:
            query = parse_qs(urlsplit(self.path).query, max_num_fields=5, strict_parsing=True, keep_blank_values=True)
            if set(query) - {"version", "approval"} != {"task","lesson","receipt"} or any(len(values) != 1 for values in query.values()):
                raise ValueError
            task, lesson, rid = (query[name][0] for name in ("task","lesson","receipt"))
            task = unicodedata.normalize("NFC", task)
            version = query.get("version",[None])[0]
            approval = query.get("approval", [None])[0]
            if approval is not None and not re.fullmatch(r"[0-9a-f]{64}", approval):
                raise ValueError
            if not re.fullmatch(r"E[0-9]+",rid) or (version is not None and not re.fullmatch(r"[1-9][0-9]*",version)):
                raise ValueError
        except ValueError:
            self.send_error(400)
            return
        queue = dispatch(model["work"],workspace=self.workspace,for_map=True)
        if task == model["work"]["id"]:
            cards = queue["lesson_cards"]
        else:
            # The same signed version can be recommended and adopted by multiple stories.
            cards = {knowledge.card_key(card): card for card in (*queue["related_lessons"], *queue["adopted_lessons"])
                     if any(s.get("readable", s["valid"]) for s in card["sources"])}.values()
        matches = [(card, source) for card in cards if (card["task"],card["id"]) == (task,lesson)
                   and (version is None or str(card["version"]) == version)
                   and (approval is None or card.get("approval_digest") == approval)
                   for source in card["sources"] if source["receipt"] == rid and source.get("readable", source["valid"])]
        if len(matches) != 1:
            self.send_content(404,"该场景来源已失效或未关联到当前需求。","text/plain")
            return
        card, source = matches[0]
        if path == "/lesson-source":
            reference = {"task": task, "lesson": lesson, "version": card["version"], "receipt": rid}
            if card.get("approval_digest"):
                reference["approval"] = card["approval_digest"]
            params = urlencode(reference)
            page = graph_view.lesson_source_page(card, source, "lesson-evidence?" + params, home_href=self.home_href)
            self.send_content(200, page, "text/html")
            return
        try:
            store = evidence.directory(self.workspace.parent.parent)
            expect(store.name == ".requirements" and card["bucket"] in ("active","archive")
                   and task not in (".","..") and Path(task).name == task, "来源位置无效")
            bucket = evidence.directory(store / card["bucket"])
            root = evidence.directory(bucket / task)
            origin = load(evidence.regular(root / "model.json"))
            expect(origin["work"]["id"] == task, "来源需求与目录不一致")
        except (OSError,ValueError,KeyError,TypeError):
            self.send_content(409,"来源已变化，请重新打开证据。","text/plain")
            return
        self.download_evidence(origin,rid,workspace=root,source=source)
    def do_GET(self):
        if self.headers.get("Host") != self.host():
            self.send_error(403); return
        path=urlsplit(self.path).path
        model=load(self.workspace / "model.json")
        if self.task_id is not None:
            validate(model)
            expect(model["work"]["id"] == self.task_id, "需求 ID 与目录不一致")
        origin = "http://" + self.host()
        same_origin = (self.headers.get("Origin", origin) == origin
                       and self.headers.get("Sec-Fetch-Site") != "cross-site")
        session = self.headers.get("X-Requirement-Flow", "")
        stale_session = bool(session) and not secrets.compare_digest(session.encode(), self.token.encode())
        if path in ("/","/handbook.html"):
            page = render(model, self.token, workspace=self.workspace, read_only=self.read_only, home_href=self.home_href)
            self.send_content(200, page, "text/html")
        elif path == "/source-location":
            if not same_origin or not session:
                self.send_error(403)
                return
            if stale_session:
                self.send_content(409, "图服务已重启，请重新连接。", "text/plain")
                return
            try:
                query = parse_qs(urlsplit(self.path).query, strict_parsing=True, max_num_fields=1)
                if set(query) != {"ref"} or len(query["ref"]) != 1 or len(query["ref"][0]) > 4096:
                    raise ValueError
            except ValueError:
                self.send_error(400)
                return
            try:
                aliases = source_paths.SourcePaths.for_task(self.workspace)
                location = source_paths.source_location(model["work"], aliases, self.checkout, query["ref"][0])
            except (OSError, ValueError):
                self.send_content(503, "暂时无法读取工作区来源，请重试。", "text/plain")
                return
            if location is None:
                self.send_content(404, "当前检出中无法定位这条来源。", "text/plain")
            else:
                self.send_content(200, encoded(location), "application/json")
        elif path=="/model.json":
            self.send_content(200,encoded(model),"application/json")
        elif re.fullmatch(r"/evidence/E[0-9]+",path):
            self.download_evidence(model,path.split("/")[-1])
        elif path in ("/lesson-source","/lesson-evidence"):
            self.lesson_source(model,path)
        elif path=="/version":
            work = model["work"]
            queue = dispatch(work,workspace=self.workspace,for_map=True)
            version = {"revision":work["revision"],"lesson_version":graph_view.lesson_version(queue),
                       "case_states":[[c["id"],c["status"]] for c in queue["scenarios"]]}
            if same_origin and stale_session:
                version["session_changed"] = True
            self.send_content(200,encoded(version),"application/json")
        elif path in ("/context","/dispatch"):
            try:
                query=parse_qs(urlsplit(self.path).query,keep_blank_values=True)
                if path == "/dispatch":
                    expect(all(len(query.get(name,[])) <= 1 for name in ("story","actor")), "每次调度传一个故事与执行人")
                    data=dispatch(model["work"],query.get("actor",["AI"])[0],query.get("story",[None])[0],workspace=self.workspace)
                else:
                    data=context(model,query.get("story"),workspace=self.workspace)
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
        if self.read_only:
            self.send_content(405, "已归档需求仅供查阅。", "text/plain")
            return
        try:
            size=int(self.headers.get("Content-Length") or 0)
            expect(0<size<=8192 and self.headers.get_content_type()=="application/x-www-form-urlencoded","表单格式无效")
            form=parse_qs(self.rfile.read(size).decode(),max_num_fields=6)
            if not secrets.compare_digest(form.get("csrf",[""])[0].encode(),self.token.encode()):
                self.send_error(403); return
            rev=int(form["revision"][0])
            key,choice=form["decision"][0],form["choice"][0]
            reason=form.get("reason",["需求发起人在本地页选择此口径。"])[0].strip() or "需求发起人在本地页选择此口径。"
            def save_decision(work):
                expect(self.task_id is None or work["id"] == self.task_id, "需求 ID 与目录不一致")
                return decide(work,key,choice,reason,"本地需求发起人")
            updated = commit(rev,save_decision,workspace=self.workspace)
        except (KeyError,ValueError,IndexError) as err:
            code=409 if isinstance(err,Conflict) else 400
            self.send_content(code,"<!doctype html><meta charset='utf-8'><p>"+h(err)+"</p><a href='./#work'>返回最新需求</a>","text/html"); return
        self.send_response(303)
        previous = parse_qs(request_url.query)
        picked = set(previous.get("features", [""])[0].split(","))
        known = [key for key in updated["work"]["stories"] if key in picked]
        query = {}
        if known:
            query["features"] = ",".join(known)
        if previous.get("q"):
            query["q"] = previous["q"][0][:80]
        self.send_header("Location", self.task_prefix + ("?" + urlencode(query) if query else "") + "#work")
        self.end_headers()


def run_server(port, handler):
    server=ThreadingHTTPServer(("127.0.0.1",port),handler)
    print("http://127.0.0.1:"+str(server.server_port)+"/",flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


def serve(port, source_root=None):
    class Handler(TaskHandler):
        workspace = TASK_DIR
        checkout = source_paths.select_source_root(source_paths.SourcePaths.for_task(TASK_DIR).root, source_root)
        token = secrets.token_urlsafe(32)

    run_server(port, Handler)


def main(argv=None, *, serve_project=None):
    arguments = list(sys.argv[1:] if argv is None else argv)
    command_args = []
    if "verify-run" in arguments and "--" in arguments:
        separator = arguments.index("--")
        arguments, command_args = arguments[:separator], arguments[separator + 1:]
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
    q.add_argument("--source-root", type=Path, help="从当前项目的指定 Git 工作树定位来源文件")
    for name in ("lesson-propose", "lesson-review"):
        q = sub.add_parser(name)
        q.add_argument("--rev", type=int, required=True)
        q.add_argument("--actor", required=True)
        if name == "lesson-propose":
            q.add_argument("file", type=Path, help="包含经验做法、边界、主题词和场景回执的 JSON 文件")
        else:
            q.add_argument("id")
            q.add_argument("verdict", choices=("approve","reject","retire"))
            q.add_argument("--version", type=int, help="审查者实际查阅的经验版本")
            q.add_argument("--why", required=True, help="对照来源与适用边界后的审查结论")
    q = sub.add_parser("lesson-adopt", help="记录一个故事采用的项目经验版本、原始依据与理由")
    q.add_argument("source", help="经验来源需求 ID")
    q.add_argument("lesson", help="经验 ID")
    q.add_argument("--version", required=True, type=int)
    q.add_argument("--story", required=True)
    q.add_argument("--why", required=True)
    q.add_argument("--rev", required=True, type=int)
    q.add_argument("--actor", required=True)
    for name in ("verify-run","verify-observe"):
        q=sub.add_parser(name)
        q.add_argument("id")
        q.add_argument("--scenario",required=True)
        q.add_argument("--rev",required=True,type=int)
        q.add_argument("--actor",default="AI")
        q.add_argument("--environment",required=True)
        if name == "verify-observe":
            q.add_argument("--artifact",required=True)
            q.add_argument("--actual",required=True)
            q.add_argument("--level",choices=("真实环境","人工核对"),default="人工核对")
            q.add_argument("--failed",action="store_true")
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
                q.add_argument("--evidence",required=name=="fail",default="")
                q.add_argument("--level",choices=("自动化","真实环境","人工核对","推演"),default="")
                q.add_argument("--environment",default=""); q.add_argument("--expected",default="")
            if name=="fail":
                q.add_argument("--reopen",required=True)
    a=parser.parse_args(arguments)
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
    elif a.cmd in ("verify-run","verify-observe"):
        result = capture(a.cmd,a.id,a.scenario,a.rev,a.actor,a.environment,argv=command_args,
                         artifact=getattr(a,"artifact",None),actual=getattr(a,"actual",None),
                         level=getattr(a,"level",None),passed=not getattr(a,"failed",False))
        print(json.dumps(result,ensure_ascii=False,indent=2))
        if not result["passed"]:
            raise SystemExit(1)
    elif a.cmd=="serve":
        sync()
        if serve_project:
            serve_project(a)
        else:
            serve(a.port, a.source_root)
    else:
        actor=a.actor or "AI"
        if a.cmd=="decision":
            op=lambda w:decide(w,a.id,a.choice,a.why,actor)
        elif a.cmd=="plan":
            patch=load(Path(a.file))
            op=lambda w:apply_plan(w,patch,actor,a.why)
        elif a.cmd == "lesson-propose":
            card = load(a.file)
            op = lambda w: knowledge.propose(w, TASK_DIR, card, actor, sys.modules[__name__])
        elif a.cmd == "lesson-adopt":
            op = lambda w: knowledge.adopt(w, TASK_DIR, a.story, a.source, a.lesson, a.version, a.why,
                                          a.actor, sys.modules[__name__])
        elif a.cmd == "lesson-review":
            op = lambda w: knowledge.review(w, TASK_DIR, a.id, a.verdict, actor, a.why, sys.modules[__name__], version=a.version)
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
