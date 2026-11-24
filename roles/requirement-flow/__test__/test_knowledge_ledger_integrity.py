"""Incomplete task ledgers close recall and new adoption, not historical decisions."""
import copy
import errno
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlencode
from urllib.request import urlopen

from test_basic_memory import lesson
from test_knowledge_adoption import REASON
from test_knowledge_flow import LESSON, NOTE, SEARCH, SOURCE, TARGET, Project, check, story

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import knowledge
import sync


class LedgerDiagnosticsTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.store = self.root / ".requirements"
        for bucket in ("active", "archive"):
            (self.store / bucket).mkdir(parents=True)

    def empty_model(self, task="empty", bucket="active"):
        folder = self.store / bucket / task
        folder.mkdir(exist_ok=True)
        model = {"protocol": {"version": "2.0"}, "work": {
            "id": task, "title": "Empty lesson ledger", "raw_request": "核对需求",
            "revision": 1, "stories": {}, "contracts": {}, "decisions": {},
            "actions": {}, "answers": {}, "events": [], "lessons": [], "lesson_cards": {},
        }}
        path = folder / "model.json"
        path.write_text(json.dumps(model), encoding="utf-8")
        return path, model

    def catalogue(self):
        return knowledge.project_cards(self.store, sync)

    def assert_diagnostic(self, cards, task):
        self.assertIsInstance(cards, list)
        self.assertIsInstance(cards.diagnostics, list)
        self.assertTrue(any(row["task"] == task for row in cards.diagnostics), cards.diagnostics)
        for row in cards.diagnostics:
            self.assertEqual(set(row), {"task", "reason"})
            self.assertIn("账本不完整待复核", row["reason"])
            self.assertNotIn(str(self.root), row["reason"])

    def test_list_compatibility_and_optional_load_diagnostics(self):
        path, _ = self.empty_model()
        cards = self.catalogue()
        self.assertEqual(cards, [])
        self.assertEqual(cards.diagnostics, [])
        self.assertEqual(list(cards), [])
        self.assertEqual(cards[:], [])
        self.assertEqual(list(knowledge.load_tasks(self.store, self.store, None, sync)), [])
        path.unlink()
        diagnostics = []
        self.assertEqual(list(knowledge.load_tasks(self.store, self.store, None, sync, diagnostics)), [])
        self.assertEqual([row["task"] for row in diagnostics], ["empty"])
        self.assertEqual(list(knowledge.load_tasks(self.store, self.store, None, sync)), [])

    def test_missing_malformed_and_non_file_models_are_diagnostic(self):
        for task, content in (("missing", None), ("bad-json", "{"), ("bad-shape", "{}")):
            folder = self.store / "active" / task
            folder.mkdir()
            if content is not None:
                (folder / "model.json").write_text(content, encoding="utf-8")
        folder = self.store / "active" / "model-directory"
        (folder / "model.json").mkdir(parents=True)
        cards = self.catalogue()
        self.assertEqual(cards, [])
        self.assertEqual({row["task"] for row in cards.diagnostics},
                         {"missing", "bad-json", "bad-shape", "model-directory"})
        self.assert_diagnostic(cards, "missing")

    def test_empty_models_are_fully_validated_before_caching(self):
        path, model = self.empty_model()
        with patch.object(sync, "validate", wraps=sync.validate) as validate:
            self.assertEqual(self.catalogue().diagnostics, [])
            self.assertEqual(self.catalogue().diagnostics, [])
            self.assertEqual(validate.call_count, 1, "only validated empty ledgers may skip parsing")
            model["work"]["revision"] = 0
            path.write_text(json.dumps(model), encoding="utf-8")
            for _ in range(2):
                self.assert_diagnostic(self.catalogue(), "empty")
            self.assertEqual(validate.call_count, 3, "an invalid empty model must not be cached as empty")
            model["work"]["revision"] = 1
            path.write_text(json.dumps(model), encoding="utf-8")
            self.assertEqual(self.catalogue().diagnostics, [])
            self.assertEqual(validate.call_count, 3, "restoring the exact validated bytes may reuse parsing")

    def test_same_size_invalid_model_is_not_hidden_by_unchanged_file_metadata(self):
        path, model = self.empty_model()
        original = knowledge.fingerprint(path)
        with patch.object(knowledge, "fingerprint", return_value=original):
            self.assertEqual(self.catalogue().diagnostics, [])
            size = path.stat().st_size
            model["work"]["revision"] = 0
            path.write_text(json.dumps(model), encoding="utf-8")
            self.assertEqual(path.stat().st_size, size)
            for _ in range(2):
                self.assert_diagnostic(self.catalogue(), "empty")
            model["work"]["revision"] = 1
            path.write_text(json.dumps(model), encoding="utf-8")
            self.assertEqual(self.catalogue().diagnostics, [])

    def test_nonempty_model_cache_reads_same_size_new_bytes(self):
        path, model = self.empty_model()
        model["work"]["lesson_cards"] = {"L": {"version": 1}}
        path.write_text(json.dumps(model), encoding="utf-8")
        stamp = knowledge.fingerprint(path)

        def read():
            (_, work, _), = knowledge.load_tasks(self.store, self.store, None, sync)
            return work

        with patch.object(knowledge, "fingerprint", return_value=stamp), patch.object(sync, "validate", return_value={}) as validate:
            before = read()
            self.assertEqual(before["revision"], 1)
            size = path.stat().st_size
            model["work"]["revision"] = 2
            path.write_text(json.dumps(model), encoding="utf-8")
            self.assertEqual(path.stat().st_size, size)
            after = read()
            self.assertEqual(after["revision"], 2)
            self.assertEqual(validate.call_count, 2)
            self.assertIs(read(), after)
            self.assertEqual(validate.call_count, 2)

    def test_duplicate_json_keys_remain_diagnostic_after_cached_empty_model(self):
        path, _ = self.empty_model()
        self.assertEqual(self.catalogue().diagnostics, [])
        content = path.read_text(encoding="utf-8")
        path.write_text(content.replace('"revision": 1', '"revision": 1, "revision": 2'), encoding="utf-8")
        for _ in range(2):
            self.assert_diagnostic(self.catalogue(), "empty")
        path.write_text(content, encoding="utf-8")
        self.assertEqual(self.catalogue().diagnostics, [])

    def test_empty_model_with_mismatched_task_id_is_not_known_empty(self):
        path, model = self.empty_model()
        model["work"]["id"] = "different"
        path.write_text(json.dumps(model), encoding="utf-8")
        self.assert_diagnostic(self.catalogue(), "empty")
        self.assert_diagnostic(self.catalogue(), "empty")

    def test_duplicate_active_archive_ids_are_diagnostic(self):
        self.empty_model("重复-é")
        self.empty_model("重复-e\u0301", "archive")
        cards = self.catalogue()
        self.assert_diagnostic(cards, "重复-é")
        self.assertEqual(len(cards.diagnostics), 1)
        self.assertIn("重复", cards.diagnostics[0]["reason"])

    def test_legacy_locks_hidden_and_non_task_entries_do_not_block(self):
        for name in (".hidden", "not a task", "_scratch", "CON", "notes.md"):
            folder = self.store / "active" / name
            folder.mkdir()
            (folder / "model.json").write_text("{", encoding="utf-8")
        (self.store / "active" / "regular-file").write_text("not a directory", encoding="utf-8")
        legacy = self.store / "active" / "empty"
        legacy.mkdir()
        (legacy / ".workflow.lock").touch()
        self.empty_model("empty", "archive")
        self.assertEqual(self.catalogue().diagnostics, [])

    @unittest.skipIf(os.name == "nt", "POSIX symlink fixture")
    def test_symlinked_folders_and_models_do_not_follow_private_targets(self):
        private = self.root / "private-original"
        private.mkdir()
        target = private / "model.json"
        target.write_text("{}", encoding="utf-8")
        (self.store / "active" / "linked-folder").symlink_to(private, target_is_directory=True)
        path, _ = self.empty_model("linked-model")
        path.unlink()
        path.symlink_to(target)
        path, _ = self.empty_model("dangling-model")
        path.unlink()
        path.symlink_to(private / "missing.json")
        (path.parent / ".workflow.lock").touch()
        cards = self.catalogue()
        self.assertEqual({row["task"] for row in cards.diagnostics},
                         {"linked-folder", "linked-model", "dangling-model"})
        self.assert_diagnostic(cards, "linked-model")
        self.assertNotIn(str(private), json.dumps(cards.diagnostics))
        self.assertEqual(target.read_text(), "{}")

    @unittest.skipIf(os.name == "nt", "POSIX symlink fixture")
    def test_symlinked_bucket_and_store_are_diagnostic(self):
        private = self.root / "private"
        private.mkdir()
        bucket = self.store / "archive"
        bucket.rmdir()
        bucket.symlink_to(private, target_is_directory=True)
        self.assert_diagnostic(self.catalogue(), "archive")
        linked_store = self.root / "other" / ".requirements"
        linked_store.parent.mkdir()
        linked_store.symlink_to(private, target_is_directory=True)
        self.assert_diagnostic(knowledge.project_cards(linked_store, sync), ".requirements")

    def test_directory_and_model_read_errors_report_only_portable_reasons(self):
        path, _ = self.empty_model()
        private = "/private/unrelated-user/credentials.json"
        error = PermissionError(errno.EACCES, "denied", private)
        original = Path.iterdir

        def scan(folder):
            if folder == self.store / "archive":
                raise error
            return original(folder)

        with patch.object(Path, "iterdir", scan):
            self.assert_diagnostic(self.catalogue(), "archive")
        # A previously validated ledger must still be readable on each request.
        read_bytes = Path.read_bytes
        reads = []

        def read(candidate):
            if candidate == path:
                reads.append(candidate)
                raise error
            return read_bytes(candidate)

        with patch.object(Path, "read_bytes", read):
            for _ in range(2):
                cards = self.catalogue()
                self.assert_diagnostic(cards, "empty")
                self.assertNotIn(private, json.dumps(cards.diagnostics))
        self.assertEqual(reads, [path, path])
        self.assertEqual(self.catalogue().diagnostics, [])
        with patch.object(knowledge, "linked", side_effect=error):
            self.assert_diagnostic(self.catalogue(), ".requirements")
        self.assertTrue(path.exists())

    def test_completely_absent_store_or_bucket_has_no_invented_history(self):
        self.assertEqual(self.catalogue().diagnostics, [])
        (self.store / "archive").rmdir()
        self.assertEqual(self.catalogue().diagnostics, [])
        missing = self.root / "absent" / ".requirements"
        cards = knowledge.project_cards(missing, sync)
        self.assertEqual(cards, [])
        self.assertEqual(cards.diagnostics, [])
        self.assertEqual(knowledge.project_cards(self.root, sync).diagnostics, [])

    def test_matcher_and_note_projection_defend_against_approved_partial_lists(self):
        card = lesson()
        diagnostics = [{"task": "missing", "reason": knowledge.LEDGER_INCOMPLETE}]
        cards = knowledge.Catalogue([card], diagnostics=diagnostics)
        self.assertEqual(cards, [card])
        self.assertIs(cards[0], card)
        self.assertEqual(knowledge.match_cards({}, cards), [], "guard precedes query evaluation")
        memory = knowledge.basic_memory
        memory.project(self.store, [card], refresh_index=False)
        note = self.store / "knowledge/lessons" / card["task"] / (card["id"] + ".md")
        manual = note.with_name("manual.md")
        manual.write_text("手写笔记原文", encoding="utf-8")
        self.assertEqual(memory.project(self.store, cards, refresh_index=False)["removed"], 1)
        self.assertFalse(note.exists())
        self.assertEqual(memory.project(self.store, cards, refresh_index=False)["written"], 0)
        self.assertEqual(manual.read_text(encoding="utf-8"), "手写笔记原文")
        self.assertEqual(card["state"], "approved", "a projection must not rewrite ledger facts")
        self.assertEqual(memory.project(self.store, [card], refresh_index=False)["written"], 1)


class LedgerFailureFlowTest(unittest.TestCase):
    def test_cross_task_replacement_failure_closes_recall_and_recovers_live(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Project(Path(folder))
            proof = p.prepare_review()
            p.review()
            p.write(TARGET, "lesson-adopt", SOURCE, LESSON, "--version", 1,
                    "--story", SEARCH, "--why", REASON)
            p.cli("archive", SOURCE)
            replacement_task, replacement_id = "store-picker-upgrade", "L-global-search"
            p.cli("new", replacement_task, "--request", "门店选择器检索升级")
            p.with_json(replacement_task, "plan", {
                "stories": {"S-upgrade": story("门店选择器", "检索所有门店", "AC-upgrade",
                                                 "南桥不在首屏", "关键词检索", "找到南桥")},
                "actions": {"A-upgrade": check("核对门店检索", "S-upgrade", "AC-upgrade",
                                                 code_paths=["directory.py", "test_directory.py"])},
            }, "--why", "核对替代经验的实际场景")
            p.write(replacement_task, "finish", "A-intake", "--output", "确认升级场景", "--evidence", "用户需求")
            replacement_proof = p.capture(replacement_task, "A-upgrade", "AC-upgrade",
                                          "test_directory.DirectoryChecks.test_store_on_later_page")
            replacement = {
                "id": replacement_id, "observation": "跨页检索仍需核对正确的门店。", "when": "门店选择器检索",
                "practice": "先检索所有匹配门店，再核对返回编号。", "boundary": "支持关键词检索的目录。",
                "tags": ["门店选择器"],
                "sources": [{"story": "S-upgrade", "scenario": "AC-upgrade", "action": "A-upgrade",
                             "receipt": replacement_proof["id"]}],
                "supersedes": {"task": SOURCE, "id": LESSON, "version": 1},
            }
            p.with_json(replacement_task, "lesson-propose", replacement, actor="升级开发者")
            p.write(replacement_task, "lesson-review", replacement_id, "approve", "--why", "已复核替代来源",
                    actor="升级审查者")
            store = p.root / ".requirements"
            workspace = store / "active" / TARGET
            model_path = store / "active" / replacement_task / "model.json"
            original = model_path.read_bytes()
            archived_path = store / "archive" / SOURCE / "model.json"
            archived = archived_path.read_bytes()
            target_path = workspace / "model.json"
            target_before = target_path.read_bytes()
            before = {c["id"]: c for c in knowledge.project_cards(workspace, sync)}
            self.assertEqual(before[LESSON]["state"], "superseded")
            self.assertEqual(before[replacement_id]["state"], "approved")
            self.assertEqual([c["id"] for c in p.next(TARGET, SEARCH)["related_lessons"]], [replacement_id])
            history_before = p.next(TARGET, SEARCH)["adopted_lessons"][0]
            query = urlencode({"task": SOURCE, "lesson": LESSON, "version": 1,
                               "receipt": proof["id"], "approval": history_before["approval_digest"]})
            with p.serve() as url:
                def live_context():
                    with urlopen(url + "context?story=" + SEARCH, timeout=5) as response:
                        return json.load(response)

                self.assertEqual([c["id"] for c in live_context()["related_lessons"]], [replacement_id])
                for fault in ("missing", "malformed", "invalid-empty"):
                    with self.subTest(fault=fault):
                        if fault == "missing":
                            model_path.unlink()
                        elif fault == "malformed":
                            model_path.write_text("{", encoding="utf-8")
                        else:
                            invalid = json.loads(original)
                            invalid["work"]["lesson_cards"] = {}
                            model_path.write_text(json.dumps(invalid), encoding="utf-8")
                        cards = knowledge.project_cards(workspace, sync)
                        self.assertEqual([d["task"] for d in cards.diagnostics], [replacement_task])
                        self.assertNotIn(str(p.root), json.dumps(cards.diagnostics, ensure_ascii=False))
                        old, = cards
                        self.assertEqual((old["id"], old["state"], old["ledger_state"]),
                                         (LESSON, "stale", "approved"))
                        self.assertEqual(old["availability"], "ledger_incomplete")
                        self.assertIn("账本不完整待复核", "；".join(old["issues"]))
                        for key in knowledge.FIELDS:
                            self.assertEqual(old[key], before[LESSON][key])
                        self.assertTrue(old["sources"][0]["readable"])
                        self.assertEqual(p.data("lessons")["lessons"], [])
                        self.assertEqual(p.next(TARGET, SEARCH)["related_lessons"], [])
                        packet = live_context()
                        self.assertEqual(packet["related_lessons"], [])
                        history, = packet["adopted_lessons"]
                        self.assertEqual(history["state"], "stale")
                        self.assertEqual(history["adoption"], history_before["adoption"])
                        for key in knowledge.FIELDS:
                            self.assertEqual(history[key], history_before[key])
                        with urlopen(url + "lesson-source?" + query, timeout=5) as response:
                            source = response.read().decode()
                            self.assertIn("AC-directory", source)
                            self.assertIn("返回南桥门店", source)
                        with urlopen(url + "lesson-evidence?" + query, timeout=5) as response:
                            self.assertIn(b"test_store_on_later_page", response.read())
                        for task, key in ((SOURCE, LESSON), (replacement_task, replacement_id)):
                            revision = p.next(TARGET)["revision"]
                            rejected = subprocess.run(p.command(
                                "task", TARGET, "lesson-adopt", task, key, "--version", 1,
                                "--story", NOTE, "--why", "新故事引用", "--actor", "验收员", "--rev", revision),
                                cwd=p.root, capture_output=True, text=True, timeout=15)
                            self.assertNotEqual(rejected.returncode, 0)
                            self.assertIn("账本不完整待复核", rejected.stderr)
                            self.assertNotIn(str(p.root), rejected.stderr)
                        # Replaying an existing immutable decision is not a new adoption.
                        p.write(TARGET, "lesson-adopt", SOURCE, LESSON, "--version", 1,
                                "--story", SEARCH, "--why", REASON)
                        self.assertEqual(target_path.read_bytes(), target_before)
                        target_model = sync.load(target_path)
                        index_hit = {"task": SOURCE, "id": LESSON, "version": 1}
                        with patch.object(knowledge.basic_memory, "search", return_value=[index_hit]):
                            self.assertEqual(sync.context(target_model, NOTE,
                                                          workspace=workspace)["related_lessons"], [])
                        knowledge.basic_memory.project(store, cards, refresh_index=False)
                        self.assertEqual(list((store / "knowledge/lessons").glob("*/*.md")), [])
                        self.assertEqual(archived_path.read_bytes(), archived)
                        model_path.write_bytes(original)
                        recovered = knowledge.project_cards(workspace, sync)
                        self.assertEqual(recovered.diagnostics, [])
                        self.assertEqual({c["id"]: c["state"] for c in recovered},
                                         {LESSON: "superseded", replacement_id: "approved"})
                        self.assertEqual([c["id"] for c in live_context()["related_lessons"]], [replacement_id])
                        knowledge.basic_memory.project(store, recovered, refresh_index=False)
                        self.assertTrue((store / "knowledge/lessons" / replacement_task /
                                         (replacement_id + ".md")).exists())

    def test_index_failure_keeps_tag_recommendations_and_allows_new_adoption(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Project(Path(folder))
            p.prepare_review()
            p.review()
            workspace = p.root / ".requirements/active" / TARGET
            model = sync.load(workspace / "model.json")
            with patch.object(knowledge.basic_memory, "search", side_effect=OSError("index unavailable")):
                cards = knowledge.project_cards(workspace, sync, current_work=model["work"])
                self.assertEqual(cards.diagnostics, [])
                context = sync.context(model, SEARCH, workspace=workspace)
                card, = context["related_lessons"]
                self.assertEqual(card["id"], LESSON)
                self.assertIn("匹配标签：门店选择器", card["match_reasons"])
                work = copy.deepcopy(model["work"])
                self.assertTrue(knowledge.adopt(work, workspace, SEARCH, SOURCE, LESSON, 1, REASON, "验收员", sync))
                self.assertEqual(knowledge.adoption_events(work)[0]["origin"]["id"], LESSON)


if __name__ == "__main__":
    unittest.main()
