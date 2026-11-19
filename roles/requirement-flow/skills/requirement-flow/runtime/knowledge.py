"""Reviewed project lessons, derived from task records and their live evidence."""
import copy
from collections import OrderedDict
from functools import lru_cache
from pathlib import Path
import re
from threading import Lock
import unicodedata

if __package__:
    from . import basic_memory
    from .evidence import linked
    from .source_paths import SourcePaths
    from .lesson_retirement import read_retirement
else:
    import basic_memory
    from evidence import linked
    from source_paths import SourcePaths
    from lesson_retirement import read_retirement


FIELDS = ("observation", "when", "practice", "boundary")
REF = ("story", "scenario", "action", "receipt")
VERDICTS = {"approve": "approved", "reject": "rejected", "retire": "retired"}
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*")
COMMON = set("""测试 验证 需求 功能 接口 数据 页面 业务 正常 开发 用户 系统 处理 实现 字段 调研 操作 检查 结果
    test verify api data system feature page user get post put delete id name type status code success result
    value message title pageindex pagesize pageno pagenum""".split())

# Polling a graph repeatedly should only parse tasks that contain lesson cards.
# Each public write replaces model.json atomically. Also include timestamps/size for in-place edits.
_empty_models = OrderedDict()
_cache_lock = Lock()


def fingerprint(path):
    info = path.stat()
    return (info.st_dev, info.st_ino, info.st_mtime_ns, info.st_ctime_ns, info.st_size)


def known_empty(path, stamp):
    with _cache_lock:
        if _empty_models.get(path) == stamp:
            _empty_models.move_to_end(path)
            return True
    return False


def remember_empty(path, stamp):
    with _cache_lock:
        _empty_models[path] = stamp
        _empty_models.move_to_end(path)
        if len(_empty_models) > 768:
            _empty_models.popitem(last=False)


def text(value):
    return isinstance(value, str) and bool(value.strip())


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def usable_tag(tag):
    return text(tag) and len(normalized(tag)) > 1 and normalized(tag) not in COMMON


def card_input(card, engine):
    allowed = {"id", *FIELDS, "sources", "tags", "supersedes"}
    engine.expect(isinstance(card, dict) and card.keys() <= allowed, "经验卡字段无效")
    engine.expect(isinstance(card.get("id"), str) and ID.fullmatch(card["id"]), "经验卡需要有效 ID")
    engine.expect(all(text(card.get(k)) for k in FIELDS), "填写发现、触发条件、做法和适用边界")
    tags = card.get("tags")
    engine.expect(isinstance(tags, list) and tags and all(text(t) for t in tags) and any(usable_tag(t) for t in tags),
                  "经验标签至少包含一个具体功能、契约或字段")
    sources = card.get("sources")
    engine.expect(isinstance(sources, list) and sources, "经验至少关联一条真实场景回执")
    identities = set()
    for source in sources:
        engine.expect(isinstance(source, dict) and set(source) == set(REF) and all(text(source[k]) for k in REF),
                      "来源需要故事、场景、验证动作和回执 ID")
        identity = tuple(source[k] for k in REF)
        engine.expect(identity not in identities, "经验来源重复")
        identities.add(identity)
    predecessor = card.get("supersedes")
    if predecessor is not None:
        engine.expect(isinstance(predecessor, dict) and set(predecessor) == {"task", "id", "version"}
                      and all(text(predecessor[k]) for k in ("id", "task")) and
                      type(predecessor["version"]) is int and predecessor["version"] > 0,
                      "替代的经验需要原需求 ID、经验 ID 和版本")
    result = {"id": card["id"], **{k: card[k].strip() for k in FIELDS},
              "tags": list(dict.fromkeys(tag.strip() for tag in tags)), "sources": copy.deepcopy(sources)}
    if predecessor:
        result["supersedes"] = dict(predecessor)
    return result


def case_index(work, workspace, engine):
    states = engine.evaluate(work, workspace=workspace)
    return {case["id"]: case for case in engine.scenario_report(work, states, set())}


def source_result(ref, cases, work):
    """Only a passed case with this exact, still-effective signed receipt can be approved."""
    case = cases.get(ref["scenario"])
    if not case or case["story"] != ref["story"]:
        return None, "来源场景已移出或不属于该故事"
    proof = next((p for p in case["receipts"] if p["action"] == ref["action"] and p["id"] == ref["receipt"]), None)
    if not proof or not proof["passed"] or proof["status"] != "captured":
        return None, "来源回执已失效或被替换"
    # A recorded failure can reopen an otherwise intact earlier verification receipt.
    last = next((e for e in reversed(work["events"]) if e.get("action") == ref["action"] and
                 e["kind"] in ("fail", "start", "finish")), {})
    issue = "" if case["status"] == "passed" and last.get("kind") == "finish" else "来源场景尚未通过当前验收"
    summary = {k: v for k, v in proof.items() if k not in ("reason", "status")}
    return {**{k: ref[k] for k in REF}, "story_title": work["stories"][ref["story"]]["title"],
            "action_title": work["actions"][ref["action"]]["title"],
            **{k: case[k] for k in ("given", "when", "then")}, "proof": summary}, issue


def validate_cards(work, engine):
    """Replay lesson events so mutable card text cannot inherit an unrelated approval."""
    rows, versions = {}, {}
    for event in work["events"]:
        if event["kind"] == "lesson-propose":
            row = event["card"]
            key = row["id"]
            engine.expect(text(event["actor"]) and row["state"] == "pending" and row["author"] == event["actor"] and row["review"] is None
                          and row["version"] == rows.get(key, {}).get("version", 0) + 1,
                          "经验提案的作者、版本或状态不一致")
            inputs = {k: row[k] for k in ("id", *FIELDS, "tags")}
            inputs["sources"] = [{k: ref[k] for k in REF} for ref in row["sources"]]
            if "supersedes" in row:
                inputs["supersedes"] = row["supersedes"]
            card_input(inputs, engine)
            prior = rows.get(key)
            if prior and prior["state"] == "pending":
                versions[key, prior["version"]] = {**prior, "state": "revised"}
            rows[key] = row
            versions[key, row["version"]] = row
        elif event["kind"] == "lesson-review":
            key, verdict = event["lesson"], event["verdict"]
            row = rows.get(key)
            engine.expect(row and row["version"] == event["version"] and event.get("proposal_digest") == engine.digest(row)
                          and verdict in VERDICTS and
                          text(event.get("reason")) and text(event.get("actor")) and
                          normalized(event["actor"]) != normalized(row["author"]) and
                          (row["state"] == "pending" or verdict == "retire" and row["state"] == "approved"),
                          "经验审查与提案版本、审查人或当前状态不一致")
            rows[key] = reviewed(row, event)
            versions[key, row["version"]] = rows[key]
    engine.expect(isinstance(work.get("lesson_cards", {}), dict) and rows == work.get("lesson_cards", {}),
                  "经验卡内容与提案、审查记录不一致")
    return versions


def reviewed(row, event):
    review_info = {"event": event["id"], **{k: event[k] for k in ("verdict", "actor", "reason", "revision")}}
    return {**row, "state": VERDICTS[event["verdict"]], "review": review_info}


def propose(work, workspace, card, actor, engine):
    engine.expect(text(actor), "经验提案需要记录人")
    row = card_input(card, engine)
    prior = work.get("lesson_cards", {}).get(row["id"])
    cases = case_index(work, workspace, engine)
    references = []
    for ref in row["sources"]:
        resolved, issue = source_result(ref, cases, work)
        engine.expect(resolved is not None, f"{ref['scenario']}/{ref['receipt']}：{issue}")
        ancestors = engine.active_ancestors(work, ref["action"])
        ops, fields = contract_keys(work, [work["actions"][a] for a in ancestors])
        resolved.update(operations=sorted(ops), fields=sorted(fields))
        references.append(resolved)
    row["sources"] = references
    if prior and all(prior.get(k) == row.get(k) for k in ("id", *FIELDS, "tags", "sources", "supersedes")):
        if prior["state"] == "pending":
            return False
        engine.expect(prior["state"] in ("retired", "rejected"), "这份经验已通过审查，修订请更新内容或来源")
    engine.expect(row.get("supersedes", {}).get("task") != work["id"] or
                  row["supersedes"]["id"] != row["id"], "同一经验用版本修订，无需引用自身为替代对象")
    row.update(version=(prior["version"] + 1 if prior else 1), state="pending", author=actor.strip(), review=None)
    work["revision"] += 1
    work.setdefault("lesson_cards", {})[row["id"]] = row
    engine.append_event(work, "lesson-propose", actor.strip(), lesson=row["id"], card=copy.deepcopy(row))
    return True


def historical_source(original, work, workspace, engine):
    """Read an immutable source without treating old inputs as current acceptance."""
    event = next((event for event in work["events"] if event["kind"] == "evidence"
                  and event["id"] == original["receipt"]), None)
    try:
        engine.expect(event and event["action"] == original["action"]
                      and event["scenario"] == original["scenario"], "原始回执与经验来源不符")
        stamp = engine.proof_stamp(event["stamp"], event["scenario_stamp"], event["id"], event["revision"])
        receipt = engine.verified_receipt(workspace, event, stamp)
        proof = {"id": event["id"], "action": event["action"], "scenario": event["scenario"],
                 **{key: receipt[key] for key in ("kind", "actor", "level", "environment", "passed", "artifact")},
                 "actual": receipt["actual"][:500]}
        if receipt["kind"] == "run":
            proof.update(argv=receipt["argv"], exit_code=receipt["exit_code"])
        engine.expect(all(proof.get(key) == value for key, value in original["proof"].items()),
                      "回执内容与提交审查时不符")
    except (OSError, ValueError, KeyError, TypeError):
        return False
    return True


def live_row(row, work, cases, bucket, workspace, engine):
    sources, issues = [], []
    for original in row["sources"]:
        current, issue = source_result(original, cases, work)
        if current and current["proof"] != original["proof"]:
            issue = "回执内容与提交审查时不符"
        if issue:
            issues.append(f"{original['scenario']}/{original['receipt']}：{issue}")
        sources.append({**original, "valid": not issue,
                        "readable": not issue or historical_source(original, work, workspace, engine)})
    result = {**row, "task": work["id"], "task_title": work["title"], "bucket": bucket,
              "sources": sources, "issues": issues}
    if issues and row["state"] == "approved":
        result["state"] = "stale"
    return result


def review(work, workspace, key, verdict, actor, reason, engine, *, version=None):
    row = work.get("lesson_cards", {}).get(key)
    engine.expect(row is not None and verdict in VERDICTS, "经验或审查结论无效")
    engine.expect(version is None or row["version"] == version, "提案已改版，请重新核对当前版本和依据")
    engine.expect(text(actor) and text(reason), "经验审查需要署名和理由")
    engine.expect(normalized(actor) != normalized(row["author"]), "经验提案须由另一位审查者复核")
    engine.expect(row["state"] == "pending" or verdict == "retire" and row["state"] == "approved",
                  "当前经验版本已审查，修订后可重新提交")
    if verdict == "approve":
        item = live_row(row, work, case_index(work, workspace, engine), "active", workspace, engine)
        engine.expect(not item["issues"], "经验来源需要复核：" + "；".join(item["issues"]))
        if row.get("supersedes"):
            ref = row["supersedes"]
            prior = next((c for c in project_cards(workspace, engine, current_work=work)
                          if all(c[k] == ref[k] for k in ("task", "id", "version"))), None)
            engine.expect(prior and prior["state"] in ("approved", "stale") and prior.get("review", {}).get("verdict") == "approve",
                          "替代对象应是本项目已审查且尚未被取代的指定版本")
    work["revision"] += 1
    event = engine.append_event(work, "lesson-review", actor.strip(), lesson=key, version=row["version"],
                                proposal_digest=engine.digest(row), verdict=verdict, reason=reason.strip())
    work["lesson_cards"][key] = reviewed(row, event)
    return True


def contract_keys(work, actions):
    ids = {contract for a in actions for contract in (*a.get("contracts", []), *a.get("closes_contracts", []))}
    operations, fields = set(), set()
    for key in ids:
        contract = work["contracts"][key]
        if text(contract.get("operation")):
            operations.add(contract["operation"])
        fields.update(f["name"] for f in contract.get("fields", []) if usable_tag(f["name"]))
        for endpoint in contract.get("endpoints", []):
            operations.add(endpoint["method"] + " " + endpoint["path"])
            for side in ("request", "response"):
                fields.update(f["name"] for f in endpoint[side] if usable_tag(f["name"]))
    return operations, fields


def query_contexts(work, stories, action):
    selected = {stories} if isinstance(stories, str) else set(stories or [])
    action_id = action.get("id") if isinstance(action, dict) else action
    current = work["actions"].get(action_id) if action_id else None
    if current:
        owners = set(current.get("stories", [])) | set(current.get("read_stories", []))
        if owners:
            selected = selected & owners if selected else owners
            if not selected:
                return []
    owners = [s for s in work["stories"] if not selected or s in selected]
    contexts = []
    for sid in owners or ([None] if not selected else []):
        story = work["stories"].get(sid, {})
        actions = [current] if current else [a for a in work["actions"].values() if sid and
                                              sid in (*a.get("stories", []), *a.get("read_stories", []))]
        operations, fields = contract_keys(work, actions)
        parts = [story.get(k) for k in ("title", "goal", "before", "module")]
        parts.extend(story.get("flow", []))
        parts.extend(story.get("tags", []))
        for case in story.get("examples", []):
            parts.extend(case.get(k) for k in ("given", "when", "then"))
        for a in actions:
            parts.extend((a.get("title"), a.get("done"), a.get("module")))
        for key in {contract for a in actions for contract in a.get("contracts", [])}:
            parts.append(work["contracts"][key]["title"])
        parts.extend(sorted(operations | fields))
        if sid is None:
            parts.extend((work.get("raw_request"), work.get("goal"), work.get("title")))
        contexts.append((sid, "\n".join(normalized(p) for p in parts if text(p)),
                         {normalized(v) for v in operations}, {normalized(v) for v in fields}))
    return contexts


def match_info(card, contexts):
    reasons, matched_stories = {}, []
    source_operations = {v for s in card["sources"] for v in s.get("operations", [])}
    source_fields = {v for s in card["sources"] for v in s.get("fields", [])}
    for story_id, corpus, operations, fields in contexts:
        relevant = False
        for tag in card["tags"]:
            if not usable_tag(tag):
                continue
            key = normalized(tag)
            # Latin names and identifiers must match whole tokens (e.g. store vs restore).
            pattern = (r"(?<![a-z0-9_])" if re.match("[a-z0-9_]", key[0]) else "") + re.escape(key)
            pattern += r"(?![a-z0-9_])" if re.match("[a-z0-9_]", key[-1]) else ""
            if re.search(pattern, corpus):
                reasons["匹配标签：" + tag] = 3
                relevant = True
        for operation in sorted(source_operations):
            if normalized(operation) in operations:
                reasons["相同契约操作：" + operation] = 6
                relevant = True
        for field in sorted(source_fields):
            if normalized(field) in fields:
                reasons["相同契约字段：" + field] = 2
                relevant = True
        if relevant and story_id is not None:
            matched_stories.append(story_id)
    return sum(reasons.values()), matched_stories, list(reasons)


def card_key(card):
    return (card["task"], card["id"], card.get("version"))


def memory_hits(workspace, contexts):
    """Keep the search engine's identity and query scope. The task ledger supplies all displayed facts."""
    store = Path(workspace).parent.parent
    hits = {}
    if store.name != ".requirements":
        return hits
    for story, corpus, _, _ in contexts:
        if not corpus.strip():
            continue
        try:
            candidates = basic_memory.search(store, corpus)
        except (OSError, ValueError, RuntimeError):
            continue
        for rank, hit in enumerate(candidates):
            if not isinstance(hit, dict) or not all(text(hit.get(k)) for k in ("task", "id")) or type(hit.get("version")) is not int:
                continue
            key = card_key(hit)
            reason = hit.get("reason") if text(hit.get("reason")) else "Basic Memory 命中该需求的经验笔记"
            hits.setdefault(key, {}).setdefault(story, (rank, reason))
    return hits


def match_cards(work, cards, *, stories=None, action=None, limit=5, hits=None):
    contexts = query_contexts(work, stories, action)
    matches = []
    for card in cards:
        if card["task"] == work["id"] or card["state"] != "approved":
            continue
        score, matched_stories, reasons = match_info(card, contexts)
        story_hits = (hits or {}).get(card_key(card), {})
        relevant = [sid for sid, *_ in contexts if sid in story_hits]
        if relevant:
            reasons.extend(dict.fromkeys(story_hits[sid][1] for sid in relevant))
            matched_stories = list(dict.fromkeys([*matched_stories, *(sid for sid in relevant if sid is not None)]))
            # The index orders FTS results by relevance; keep this ordering within each structural score.
            score += 2 + 1 / (1 + min(story_hits[sid][0] for sid in relevant))
        if score:
            matches.append((score, {**card, "matched_stories": matched_stories, "match_reasons": reasons}))
    matches.sort(key=lambda row: (-row[0], row[1]["task"], row[1]["id"]))
    return [card for _, card in matches[:limit]]


@lru_cache(maxsize=32)
def read_source_model(path, stamp, engine):
    """Cache ledger parsing only. Evidence files, source aliases and retirements are rechecked on every read."""
    model = engine.load(path)
    work = model["work"]
    if not isinstance(work, dict) or not work.get("lesson_cards"):
        if stamp == fingerprint(path):
            remember_empty(path, stamp)
        return None
    versions = engine.validate(model)
    return work, versions


def load_tasks(store, workspace, current_work, engine):
    folders = {}
    for bucket in ("active", "archive"):
        base = store / bucket
        if linked(base) or not base.is_dir():
            continue
        for folder in sorted(base.iterdir()):
            if not linked(folder) and folder.is_dir():
                folders.setdefault(unicodedata.normalize("NFC", folder.name), []).append(folder)
    for task, locations in folders.items():
        if len(locations) != 1:
            continue
        folder, = locations
        model_file = folder / "model.json"
        if linked(model_file) or not model_file.is_file():
            continue
        try:
            if folder == workspace and current_work is not None:
                work = current_work
                if not work.get("lesson_cards"):
                    continue
                versions = validate_cards(work, engine)
            else:
                model_file = model_file.absolute()
                stamp = fingerprint(model_file)
                if known_empty(model_file, stamp):
                    continue
                record = read_source_model(model_file, stamp, engine)
                if record is None:
                    continue
                work, versions = record
            if task == work["id"]:
                yield folder, work, versions
        except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError):
            # Invalid unrelated or concurrently archived records cannot enter the catalogue.
            continue


def project_cards(workspace, engine, *, current_work=None, relevant_to=None, stories=None, action=None, include_keys=()):
    """Build the project projection from current and archived tasks; no duplicated approval ledger."""
    with engine.input_scope():
        return _project_cards(workspace, engine, current_work=current_work, relevant_to=relevant_to,
                              stories=stories, action=action, include_keys=include_keys)


def _project_cards(workspace, engine, *, current_work=None, relevant_to=None, stories=None, action=None, include_keys=()):
    workspace = Path(workspace)
    store = workspace if workspace.name == ".requirements" else workspace.parent.parent
    if store.name != ".requirements" or linked(store) or not store.is_dir():
        return []
    contexts = query_contexts(relevant_to, stories, action) if relevant_to is not None else None
    results, replacements = [], {}
    paths = None
    for folder, work, versions in load_tasks(store, workspace, current_work, engine):
        # A later rejection/retirement of the replacement cannot resurrect its predecessor.
        published, approvals, retired = {}, {}, {}
        for event in work["events"]:
            if event["kind"] == "lesson-propose":
                key, version = event["lesson"], event["card"]["version"]
                previous = versions.get((key, version - 1))
                if previous and previous["state"] == "pending":
                    replacements[work["id"], key, version - 1] = {"task": work["id"], "id": key, "version": version}
            elif event["kind"] == "lesson-review" and event["verdict"] == "approve":
                key, version = event["lesson"], event["version"]
                approvals[key, version] = (engine.digest(event), {
                    "event": event["id"], "actor": event["actor"], "reason": event["reason"], "at": event.get("time")})
                successor = {"task": work["id"], "id": key, "version": version}
                if key in published:
                    replacements[work["id"], key, published[key]] = successor
                published[key] = version
                ref = versions[key, version].get("supersedes")
                if ref:
                    replacements[ref["task"], ref["id"], ref["version"]] = successor
            elif event["kind"] == "lesson-review" and event["verdict"] == "retire":
                retired[event["lesson"], event["version"]] = {
                    "actor": event["actor"], "reason": event["reason"], "at": event.get("time")}
        cases = None
        for row in versions.values():
            identity = (work["id"], row["id"], row["version"])
            if contexts is not None and work["id"] != relevant_to["id"] and identity not in include_keys:
                if row["state"] != "approved" or not match_info(row, contexts)[0]:
                    continue
            if cases is None:
                cases = case_index(work, folder, engine)
            item = live_row(row, work, cases, folder.parent.name, folder, engine)
            edition = (row["id"], row["version"])
            if edition in approvals:
                item["approval_digest"], item["approval"] = approvals[edition]
            if edition in retired:
                item["retirement"] = retired[edition]
            if paths is None:
                paths = SourcePaths(store)
            for source in item["sources"]:
                basis = work["stories"].get(source["story"], {}).get("basis")
                current = paths.text(basis)
                if current != basis:
                    source["current_basis"] = current
            try:
                retirement = read_retirement(store, work["id"], row["id"], row["version"])
            except (OSError, ValueError) as error:
                item["state"] = "stale"
                item["issues"].append("项目退役决定需要复核：" + str(error))
            else:
                if retirement:
                    item.update(state="retired", retirement=retirement)
            results.append(item)
    for item in results:
        replacement = replacements.get((item["task"], item["id"], item["version"]))
        if replacement:
            item.update(state="superseded", replaced_by=replacement)
    return sorted(results, key=lambda item: (item["task"], item["id"], item["version"]))


def adoption_events(work, stories=()):
    return [event for event in work["events"] if event["kind"] == "lesson-adopt"
            and (not stories or event["story"] in stories)]


def validate_adoptions(work, engine):
    seen = set()
    for event in adoption_events(work):
        ref = event["origin"]
        engine.expect(event["story"] in work["stories"] and text(event["actor"]) and text(event["reason"])
                      and text(event["time"]), "经验采用缺少故事、署名、时间或理由")
        engine.expect(text(ref["task"]) and ref["task"] != work["id"] and text(ref["id"])
                      and type(ref["version"]) is int and ref["version"] > 0
                      and re.fullmatch(r"[0-9a-f]{64}", ref["approval_digest"]), "经验采用需要锁定来源及审查版本")
        engine.expect(all(text(ref.get(k)) for k in FIELDS), "经验采用缺少原始做法或边界")
        sources = ref.get("sources")
        engine.expect(isinstance(sources, list) and sources and all(
            isinstance(source, dict) and all(text(source.get(k)) for k in REF) for source in sources),
            "经验采用需要保留原场景及回执编号")
        key = (event["story"], *card_key(ref))
        engine.expect(key not in seen, "同一故事重复采用经验版本")
        seen.add(key)


def adopt(work, workspace, story, task, lesson, version, reason, actor, engine):
    engine.expect(story in work["stories"] and text(reason) and text(actor), "请选择已有故事并填写采用理由和执行人")
    task = unicodedata.normalize("NFC", task)
    key = (task, lesson, version)
    previous = next((e for e in adoption_events(work, {story}) if card_key(e["origin"]) == key), None)
    if previous:
        engine.expect(previous["actor"] == actor.strip() and previous["reason"] == reason.strip(),
                      "此故事已经记录该版本的采用理由，请查阅原决定")
        return False
    engine.expect(task != work["id"] and version > 0, "请选择其他需求中已批准的具体经验版本")
    cards = project_cards(workspace, engine, current_work=work, relevant_to=work, stories={story}, include_keys={key})
    card = next((c for c in cards if card_key(c) == key), None)
    engine.expect(card and card["state"] == "approved", "来源经验尚未批准、已失效或已退役，请重新查阅")
    # Store the adopted conclusion and immutable proof IDs, so a missing origin never erases the decision.
    origin = {k: card[k] for k in ("task", "task_title", "id", "version", "approval_digest", "approval", *FIELDS)}
    origin["sources"] = [{k: source[k] for k in REF} for source in card["sources"]]
    work["revision"] += 1
    engine.append_event(work, "lesson-adopt", actor.strip(), story=story, reason=reason.strip(), origin=origin)
    return True


def adopted_cards(events, cards):
    ledger = {card_key(c): c for c in cards}
    history = []
    for event in events:
        ref = event["origin"]
        current = ledger.get(card_key(ref))
        if current and current.get("approval_digest") == ref["approval_digest"]:
            card = current
        else:
            card = {**ref, "state": "missing", "issues": ["当前工作树缺少采用时的原始审查版本"],
                    "sources": [{**s, "valid": False, "readable": False} for s in ref["sources"]]}
        history.append({**card, "adoption": {"story": event["story"], "actor": event["actor"],
                                             "reason": event["reason"], "at": event["time"]}})
    return history
