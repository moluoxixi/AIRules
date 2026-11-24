"""Core receipt scope, result details and archive snapshot regressions."""
import copy
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import test_acceptance
import test_dispatch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "skills/requirement-flow"))
import flow

sync = test_dispatch.sync
story = test_dispatch.story
action = test_dispatch.action


class CoreClarityTest(unittest.TestCase):
    def setUp(self):
        self.fixture = test_dispatch.DispatchTest()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.setUp()
        self.addCleanup(flow.engine.bind_workspace, flow.engine.TASK_DIR)

    def setup_reference(self, *, dependency=False):
        verify = action("核对回读", "验证", "S-target", covers=["SC-weight"],
                        read_stories=["S-target", "S-source"],
                        depends_on=[{"id": "A-build"}] if dependency else [])
        self.fixture.plan(stories={
            "S-target": story("显示重量", test_dispatch.WEIGHT),
            "S-source": story("读取源", ("SC-source", "读取", "7")),
        }, actions={"A-verify": verify, **({"A-build": action("实现", "开发", "S-source")} if dependency else {})})
        if dependency:
            self.fixture.finish("A-build")
        self.fixture.verify("A-verify")

    def test_explicit_reference_expectation_invalidates_receipt_and_rejects_finish(self):
        self.setup_reference()
        updated = copy.deepcopy(self.fixture.work()["stories"]["S-source"])
        updated["examples"][0]["then"] = "9"
        self.fixture.plan(stories={"S-source": updated})
        state = sync.evaluate(self.fixture.work())["A-verify"]
        self.assertEqual(state["state"], "stale")
        self.assertEqual(state["cases"]["SC-weight"]["status"], "stale")
        with self.assertRaisesRegex(sync.Invalid, "缺少有效的成功凭据"):
            self.fixture.finish("A-verify")

    def test_developer_reading_reference_stays_a_dependency_control(self):
        self.setup_reference(dependency=True)
        updated = copy.deepcopy(self.fixture.work()["stories"]["S-source"])
        updated["examples"][0]["then"] = "9"
        self.fixture.plan(stories={"S-source": updated})
        states = sync.evaluate(self.fixture.work())
        self.assertEqual(states["A-build"]["state"], "stale")
        self.assertIn({"kind": "dependency", "id": "A-build"}, states["A-verify"]["blockers"])
        self.fixture.finish("A-build")
        with self.assertRaisesRegex(sync.Invalid, "缺少有效的成功凭据"):
            self.fixture.finish("A-verify")

    def test_new_or_edited_sibling_case_keeps_independent_covered_receipt(self):
        self.setup_reference()
        state = sync.evaluate(self.fixture.work())["A-verify"]
        updated = copy.deepcopy(self.fixture.work()["stories"]["S-target"])
        updated["examples"].append({"id": "SC-new", "given": "已保存", "when": "刷新", "then": "9"})
        self.fixture.plan(stories={"S-target": updated})
        self.assertEqual(sync.evaluate(self.fixture.work())["A-verify"]["proof"], state["proof"])
        updated["examples"][1]["then"] = "11"
        self.fixture.plan(stories={"S-target": updated})
        self.assertEqual(sync.evaluate(self.fixture.work())["A-verify"]["cases"]["SC-weight"]["status"], "captured")

    def test_scoped_context_has_read_and_ancestor_stories_without_widening_acceptance(self):
        self.fixture.plan(stories={
            "S-target": story("显示", test_dispatch.DISPLAY),
            "S-source": story("读取", test_dispatch.WEIGHT),
            "S-reference": story("参考", test_dispatch.NOTE),
            "S-unrelated": story("无关", test_dispatch.RETRY),
        }, actions={
            "A-source": action("读取", "开发", "S-source", read_stories=["S-reference"]),
            "A-target": action("显示", "开发", "S-target", read_stories=["S-reference"], depends_on=[{"id": "A-source"}]),
        })
        context = sync.context(sync.load(), "S-target")
        self.assertEqual(set(context["stories"]), {"S-target"})
        self.assertEqual(set(context["reference_stories"]), {"S-source", "S-reference"})
        self.assertEqual({s["story"] for s in context["scenarios"]}, {"S-target"})
        self.assertEqual(context["reference_stories"]["S-reference"]["examples"][0]["id"], "SC-note")
        self.assertEqual(sync.context(sync.load())["reference_stories"], {})

    def test_packet_identity_root_and_unfinished_execution_warning_are_not_a_lock(self):
        self.fixture.plan(stories={"S": story("输入", test_dispatch.WEIGHT)},
                          actions={"A-build": action("实现", "开发", "S")})
        sync.claim(self.fixture.work()["revision"], "alice")
        start = self.fixture.work()["events"][-1]
        self.fixture.write(lambda w: sync.handoff(w, "A-build", "alice", "bob", "交接"))
        handoff = self.fixture.work()["events"][-1]
        updated = copy.deepcopy(self.fixture.work()["stories"]["S"])
        updated["goal"] = "已修订"
        self.fixture.plan(stories={"S": updated})
        packet = sync.dispatch(self.fixture.work(), "carol")["next"]
        self.assertEqual((packet["task_id"], packet["revision"], packet["execution_project_root"]),
                         ("delivery", self.fixture.work()["revision"], str(self.fixture.root.resolve())))
        self.assertEqual(packet["previous_execution"], {"actor": "bob", "event_id": handoff["id"],
                                                       "reason": "输入已修订，须确认原执行停止再领取"})
        self.assertNotEqual(start["id"], handoff["id"])
        offline = sync.dispatch(self.fixture.work(), for_map=True)["next"]
        self.assertNotIn("execution_project_root", offline)
        reclaimed = sync.claim(self.fixture.work()["revision"], "carol")
        self.assertEqual(reclaimed["claimed"], "A-build")
        self.assertEqual(reclaimed["next"]["previous_execution"], packet["previous_execution"])
        self.fixture.write(lambda w: sync.progress(w, "finish", "A-build", "carol", "实现完毕", "代码核对"))
        updated["goal"] = "再次修订"
        self.fixture.plan(stories={"S": updated})
        self.assertNotIn("previous_execution", sync.dispatch(self.fixture.work())["next"])
        self.assertNotIn(str(self.fixture.root).encode(), sync.BOOK.read_bytes())

    def test_new_task_staging_is_not_mistaken_for_a_broken_ledger(self):
        path = self.fixture.root / ".requirements/active/new-task"
        sync.initialize_task(path, "新需求", key="new-task", outcome="research")
        parser = flow.SnapshotHTML()
        parser.feed((path / "handbook.html").read_text())
        payload = json.loads(parser.payloads[0])
        self.assertEqual(payload["queue"]["knowledge_warnings"], [])
        self.assertEqual(payload["queue"]["next"]["knowledge_warnings"], [])
        self.assertEqual(list(path.parent.glob(".new-*")), [])
        flow.check_snapshot(path)
        self.assertEqual(payload["lesson_version"], sync.graph_view.lesson_version(
            sync.dispatch(sync.load(path / "model.json")["work"], workspace=path, for_map=True)))

    def test_knowledge_diagnostics_are_projected_but_index_failure_still_degrades(self):
        class Cards(list):
            diagnostics = [{"task": "broken", "reason": "账本无法核验"}]
        self.fixture.plan(actions={"A-build": {**self.fixture.work()["actions"]["A-intake"], "kind": "开发"}})
        with patch.object(sync.knowledge, "project_cards", return_value=Cards()), \
                patch.object(sync.knowledge, "memory_hits", return_value={}):
            queue = sync.dispatch(self.fixture.work())
            self.assertEqual(queue["knowledge_warnings"], Cards.diagnostics)
            self.assertEqual(queue["next"]["knowledge_warnings"], Cards.diagnostics)
            self.assertEqual(sync.context(sync.load())["knowledge_warnings"], Cards.diagnostics)
        with patch.object(sync.knowledge, "project_cards", return_value=[]), \
                patch.object(sync.knowledge, "memory_hits", return_value={}):
            self.assertEqual(sync.dispatch(self.fixture.work())["knowledge_warnings"], [])
        with patch.object(flow.engine.knowledge, "project_cards", return_value=Cards()), redirect_stdout(io.StringIO()) as output:
            flow.list_lessons(self.fixture.root / ".requirements", False)
        self.assertEqual(json.loads(output.getvalue())["warnings"], Cards.diagnostics)

    def archive(self):
        store = self.fixture.root / ".requirements"
        args = SimpleNamespace(id="delivery", allow_incomplete=True)
        with redirect_stdout(io.StringIO()):
            flow.archive(store, args)
        return store / "archive/delivery"

    def test_new_archive_is_read_only_and_rearchiving_keeps_exact_historical_page(self):
        self.setup_reference()
        model = sync.MODEL.read_bytes()
        evidence_files = {p.relative_to(sync.TASK_DIR): p.read_bytes() for p in (sync.TASK_DIR / "evidence").glob("*/*")}
        archived = self.archive()
        parser = flow.SnapshotHTML()
        parser.feed((archived / "handbook.html").read_text())
        payload = json.loads(parser.payloads[0])
        self.assertTrue(payload["read_only"])
        self.assertEqual(payload["catalog_card"]["bucket"], "archive")
        self.assertEqual((archived / "model.json").read_bytes(), model)
        self.assertEqual(evidence_files, {p: (archived / p).read_bytes() for p in evidence_files})
        flow.check_snapshot(archived)
        original = (archived / "handbook.html").read_bytes()
        with patch.object(flow.engine, "render", side_effect=AssertionError("do not rerender historical archive")):
            self.archive()
            flow.check_snapshot(archived)
        self.assertEqual((archived / "handbook.html").read_bytes(), original)

    def test_archive_move_failure_rolls_back_active_page(self):
        page, model = sync.BOOK.read_bytes(), sync.MODEL.read_bytes()
        with patch.object(Path, "rename", side_effect=OSError("move failed")), self.assertRaisesRegex(OSError, "move failed"):
            self.archive()
        self.assertEqual((sync.BOOK.read_bytes(), sync.MODEL.read_bytes()), (page, model))

    def test_archive_snapshot_compares_story_identity_when_id_is_moved_then_retirement_reversed(self):
        self.fixture.plan(stories={"S-old": story("原故事", test_dispatch.WEIGHT)},
            decisions={"D-scope": {"title": "延期原故事", "owner": "产品", "why": "范围", "stories": ["S-old"],
                                  "options": {"keep": {"label": "保留", "consequence": "本期交付"},
                                              "defer": {"label": "延期", "consequence": "移出范围"}}}},
            actions={"A-verify": action("核对", "验证", "S-old", covers=["SC-weight"], read_stories=[])})
        self.fixture.write(lambda w: sync.decide(w, "D-scope", "defer", "改期", "产品"))
        old = self.fixture.work()["stories"]["S-old"]
        self.fixture.plan(stories={"S-old": {**old, "examples": []}, "S-new": story("新故事", test_dispatch.WEIGHT)},
                          actions={"A-verify": action("核对", "验证", "S-new", covers=["SC-weight"], read_stories=[])},
                          retire_scenarios={"SC-weight": {"decision": "D-scope", "is": "defer"}})
        self.fixture.verify("A-verify")
        self.fixture.write(lambda w: sync.decide(w, "D-scope", "keep", "恢复原范围", "产品"))
        archived = self.archive()
        flow.check_snapshot(archived)
        attachment = next((archived / "evidence").glob("*/output.log"))
        attachment.write_bytes(attachment.read_bytes() + b"changed")
        with self.assertRaisesRegex(ValueError, "S-new/SC-weight"):
            flow.check_snapshot(archived)


class ImplementationCLITest(unittest.TestCase):
    def setUp(self):
        self.fixture = test_acceptance.AcceptanceTest()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.setUp()
        self.fixture.plan(actions={"A-build": {"title": "实现保存", "kind": "开发", "stories": ["S-save"],
                             "read_stories": ["S-save"], "contracts": [], "decisions": [], "depends_on": [], "done": "可保存"}})
        self.details = {"summary": "保存并显示结果", "steps": [{"title": "持久化", "detail": "保存输入值", "source": "save_checks.py:1"}],
                        "branches": [{"condition": "离线", "behavior": "恢复后重试", "source": "save_checks.py:1"}]}
        self.file = self.fixture.project / "implementation.json"

    def finish(self, value, *, key="A-build", mode="finish", ok=True, evidence="原核对\nsave_checks.py:1"):
        self.file.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        return self.fixture.write(mode, key, "--output", "代码已核对", "--evidence", evidence,
                                  "--implementation", self.file, ok=ok)

    def test_cli_stores_actual_details_merges_sources_and_exposes_effective_output(self):
        before = json.loads((self.fixture.workdir / "model.json").read_bytes())["work"]
        self.finish(self.details)
        work = json.loads((self.fixture.workdir / "model.json").read_bytes())["work"]
        event = work["events"][-1]
        self.assertEqual(event["implementation"], self.details)
        self.assertEqual(event["evidence"], "原核对\nsave_checks.py:1")
        self.assertEqual(work["stories"], before["stories"])
        self.assertEqual(work["actions"], before["actions"])
        context = json.loads(self.fixture.cli("task", "save", "context").stdout)
        self.assertIn(event, context["effective_outputs"])
        aliases = sync.source_paths.SourcePaths.for_task(self.fixture.workdir)
        self.assertIsNotNone(sync.source_paths.source_location(work, aliases, self.fixture.project, "save_checks.py:1"))
        # Optional arrays are valid, but references alone never replace the evidence rule.
        self.finish({"summary": "only summary"}, ok=False)
        changed = copy.deepcopy(work["stories"]["S-save"])
        changed["goal"] = "再实现"
        self.fixture.plan(stories={"S-save": changed})
        # The validation action comes first; inspect the development packet directly.
        development = sync.action_packet(work, sync.evaluate(work, self.fixture.workdir), "A-build", "start", self.fixture.workdir)
        self.assertEqual(development["prior_result"]["implementation"], self.details)
        self.finish({"summary": "重新实现", "steps": [{"title": "入口", "detail": "核对", "source": "save_checks.py:2"}]},
                    evidence="原依据")
        current = json.loads((self.fixture.workdir / "model.json").read_bytes())["work"]["events"][-1]
        self.assertEqual(current["evidence"], "原依据\nsave_checks.py:2")

    def test_malformed_or_wrong_owner_details_do_not_change_records(self):
        original = {name: (self.fixture.workdir / name).read_bytes() for name in ("model.json", "handbook.html")}
        for value in (None, [], {}, {"summary": " "}, {"summary": "ok", "unknown": 1},
                      {"summary": "ok", "steps": None}, {"summary": "ok", "branches": {}},
                      {"summary": "ok", "steps": [{"title": "x", "detail": " "}]},
                      {"summary": "ok", "branches": [{"condition": "x", "behavior": "y", "source": None}]},
                      {"summary": "ok", "steps": [{"title": "x", "detail": "y", "extra": "z"}]}):
            with self.subTest(value=value):
                self.finish(value, ok=False)
        self.finish(self.details, key="A-save", ok=False)
        self.finish(self.details, key="A-intake", ok=False)
        self.finish(self.details, mode="start", ok=False)
        self.finish(self.details, evidence="", ok=False)
        self.assertEqual(original, {name: (self.fixture.workdir / name).read_bytes() for name in original})

    def test_old_models_and_finish_history_validate_but_misplaced_field_is_rejected(self):
        model = json.loads((self.fixture.workdir / "model.json").read_bytes())
        sync.validate(model)
        for place in ("story", "action", "historical"):
            changed = copy.deepcopy(model)
            if place == "story":
                changed["work"]["stories"]["S-save"]["implementation"] = self.details
            elif place == "action":
                changed["work"]["actions"]["A-build"]["implementation"] = self.details
            else:
                changed["work"]["events"][-1]["implementation"] = self.details
            with self.subTest(place=place), self.assertRaisesRegex(sync.Invalid, "implementation"):
                sync.validate(changed)
        self.finish({"summary": "完成"})
        current = json.loads((self.fixture.workdir / "model.json").read_bytes())
        sync.validate(current)
        current["work"]["events"][-1]["implementation"] = {"summary": "", "steps": []}
        with self.assertRaisesRegex(sync.Invalid, "implementation"):
            sync.validate(current)
