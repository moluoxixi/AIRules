"""An adopted version must outlive search, retirement and archival without granting unverified evidence."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

from test_knowledge_flow import LESSON, NOTE, SEARCH, SOURCE, TARGET, Project

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import knowledge
import sync

REASON = "目的门店不在首屏，提交前要按关键词查到正确的门店编号。"


class AdoptionTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.p = Project(Path(temp.name))
        self.store = self.p.root / ".requirements"
        self.receipt = self.p.prepare_review()

    def test_pinned_version_reason_and_evidence_survive_retirement(self):
        p = self.p
        args = [SOURCE, LESSON, "--version", "1", "--story", SEARCH, "--why", REASON]
        p.write(TARGET, "lesson-adopt", *args, ok=False)
        p.review()
        found = p.data("new", "lookup", "--request", "门店选择器如何匹配首屏以外的门店")
        self.assertEqual([c["id"] for c in found["related_lessons"]], [LESSON])
        revision = p.next(TARGET)["revision"]
        command = p.command("task", TARGET, "lesson-adopt", *args, "--rev", str(revision), "--actor", "验收员")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: subprocess.run(command, capture_output=True, timeout=15), range(2)))
        self.assertEqual(sorted(r.returncode for r in results), [0, 1])
        self.assertIn("版本已更新", next(r.stderr.decode() for r in results if r.returncode))
        p.write(TARGET, "lesson-adopt", *args)
        self.assertEqual(p.next(TARGET)["revision"], revision + 1)
        p.write(TARGET, "lesson-adopt", *args[:-1], "另一个理由", ok=False)
        self.assertEqual(p.next(TARGET, NOTE)["adopted_lessons"], [])
        p.cli("archive", SOURCE)
        p.cli("lesson-retire", SOURCE, LESSON, "--version", 1, "--actor", "业务", "--why", "该场景已有新流程")

        self.assertEqual(p.next("lookup")["related_lessons"], [])
        self.assertEqual(p.data("new", "new-lookup", "--request", "再做一个门店选择器")["related_lessons"], [])
        p.write(TARGET, "lesson-adopt", SOURCE, LESSON, "--version", 1, "--story", NOTE, "--why", "新故事引用", ok=False)
        p.write(TARGET, "lesson-adopt", *args)  # replay of the original decision after retirement
        for queue in (p.next(TARGET, SEARCH), p.data("task", TARGET, "context", SEARCH),
                      json.loads(p.write(TARGET, "claim", "--story", SEARCH))["next"]):
            self.assertEqual(queue["related_lessons"], [])
            adopted, = queue["adopted_lessons"]
            self.assertEqual((adopted["id"], adopted["version"], adopted["state"], adopted["bucket"]),
                             (LESSON, 1, "retired", "archive"))
            self.assertEqual(adopted["adoption"]["reason"], REASON)
            self.assertEqual(adopted["adoption"]["story"], SEARCH)
            self.assertTrue(adopted["sources"][0]["valid"])

        query = urlencode({"task": SOURCE, "lesson": LESSON, "version": 1, "receipt": self.receipt["id"]})
        with p.serve() as url:
            with urlopen(url + "lesson-source?" + query, timeout=5) as page:
                body = page.read().decode()
                self.assertIn("AC-directory", body)
                self.assertIn('href="/home"', body)
            with urlopen(url + "lesson-evidence?" + query, timeout=5) as response:
                self.assertIn(b"test_store_on_later_page", response.read())
            artifact = self.store / "archive" / SOURCE / self.receipt["artifact"]["path"]
            artifact.write_bytes(b"changed after retirement")
            for route in ("lesson-source", "lesson-evidence"):
                with self.assertRaises(HTTPError) as result:
                    urlopen(url + route + "?" + query, timeout=5)
                self.assertIn(result.exception.code, (404, 409))
        p.cli("archive", TARGET, "--allow-incomplete")
        history = p.data("task", TARGET, "context", SEARCH)["adopted_lessons"]
        self.assertEqual(history[0]["adoption"]["reason"], REASON)
        self.assertFalse(history[0]["sources"][0]["valid"])
        p.cli("task", TARGET, "--check")

    def test_divergent_checkout_cannot_rebind_a_pinned_source_link(self):
        p = self.p
        p.review()
        p.write(TARGET, "lesson-adopt", SOURCE, LESSON, "--version", 1, "--story", SEARCH, "--why", REASON)
        history = p.data("task", TARGET, "context", SEARCH)["adopted_lessons"][0]
        query = urlencode({"task": SOURCE, "lesson": LESSON, "version": 1, "receipt": self.receipt["id"],
                           "approval": history["approval_digest"]})
        with p.serve() as url:
            with urlopen(url + "lesson-source?" + query, timeout=5) as page:
                self.assertIn(history["approval_digest"], page.read().decode())
            # A divergent checkout may publish its own approval for the same task, card and numeric version.
            path = self.store / "active" / SOURCE / "model.json"
            model = sync.load(path)
            review = next(e for e in model["work"]["events"] if e["kind"] == "lesson-review")
            review["actor"] = "另一份检出的审查员"
            model["work"]["lesson_cards"][LESSON]["review"]["actor"] = review["actor"]
            sync.validate(model)
            sync.atomic(path, sync.encoded(model))
            queue = p.data("task", TARGET, "context", SEARCH)
            self.assertEqual(queue["related_lessons"][0]["id"], LESSON)
            adopted, = queue["adopted_lessons"]
            self.assertEqual(adopted["state"], "missing")
            self.assertEqual(adopted["adoption"]["reason"], REASON)
            self.assertFalse(adopted["sources"][0]["valid"])
            for route in ("lesson-source", "lesson-evidence"):
                with self.assertRaises(HTTPError) as missing:
                    urlopen(url + route + "?" + query, timeout=5)
                self.assertEqual(missing.exception.code, 404)

    def test_source_task_retirement_keeps_original_approver_and_distinct_decisions(self):
        p = self.p
        p.review()
        p.write(TARGET, "lesson-adopt", SOURCE, LESSON, "--version", 1, "--story", SEARCH, "--why", REASON)
        p.write(SOURCE, "lesson-review", LESSON, "retire", "--why", "目录已改版", actor="目录维护员")
        adopted, = p.next(TARGET, SEARCH)["adopted_lessons"]
        self.assertEqual(adopted["state"], "retired")
        self.assertEqual(adopted["approval"]["actor"], "独立审查员")
        self.assertEqual(adopted["retirement"]["reason"], "目录已改版")
        self.assertEqual(adopted["adoption"]["reason"], REASON)
        self.assertEqual(p.next(TARGET, SEARCH)["related_lessons"], [])

    def test_unavailable_dependency_reports_nonzero_and_does_not_block_review(self):
        p = self.p
        for operation in ("enable", "sync"):
            result = subprocess.run(p.command("memory", operation), cwd=p.root, text=True, capture_output=True,
                                    env={**os.environ, "PATH": ""}, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            state = json.loads(result.stdout)
            self.assertFalse(state["ready"])
            self.assertIn("uv", state["error"])
        p.review()
        self.assertEqual([card["id"] for card in p.next(TARGET, SEARCH)["related_lessons"]], [LESSON])

    def test_memory_discovery_without_structured_matches_revalidates_live_origin(self):
        p = self.p
        p.review()
        workspace = self.store / "active" / TARGET
        model = sync.load(workspace / "model.json")
        ref = {"task": SOURCE, "id": LESSON, "version": 1}
        bogus = {"task": "missing", "id": LESSON, "version": 1}
        with patch.object(knowledge.basic_memory, "search", return_value=[ref, bogus]) as recall:
            packet = sync.context(model, NOTE, workspace=workspace)
            card, = packet["related_lessons"]
            self.assertEqual(card["match_reasons"], ["Basic Memory 命中该需求的经验笔记"])
            self.assertEqual(card["matched_stories"], [NOTE])
            self.assertIn("字号", recall.call_args[0][1])
            self.assertTrue(card["sources"][0]["valid"])
            p.cli("lesson-retire", SOURCE, LESSON, "--version", 1, "--actor", "项目", "--why", "该规则下线")
            self.assertEqual(sync.context(model, NOTE, workspace=workspace)["related_lessons"], [])
        with patch.object(knowledge.basic_memory, "search", side_effect=OSError("index unavailable")):
            self.assertEqual(sync.context(model, NOTE, workspace=workspace)["related_lessons"], [])


if __name__ == "__main__":
    unittest.main()
