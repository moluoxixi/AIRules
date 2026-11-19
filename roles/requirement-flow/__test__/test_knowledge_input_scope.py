"""Every public query checks a shared code range once, then checks it anew next time."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_knowledge_flow import Project, check, story

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import sync


class KnowledgeInputScopeTest(unittest.TestCase):
    def test_six_real_sources_share_each_request_and_changed_code_is_rechecked(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Project(Path(folder))
            for i in range(6):
                task = "source-" + str(i)
                p.cli("new", task, "--request", "门店选择器搜索")
                p.with_json(task, "plan", {
                    "stories": {"S": story("门店选择器", "搜索门店", "C", "门店不在首屏", "搜索", "找到门店")},
                    "actions": {"V": check("门店搜索验证", "S", "C")},
                }, "--why", "明确独立来源的业务验收")
                p.write(task, "finish", "A-intake", "--output", "确认场景", "--evidence", "用户需求")
                receipt = p.capture(task, "V", "C", "test_directory.DirectoryChecks.test_store_on_later_page")
                p.with_json(task, "lesson-propose", {
                    "id": "L-search", "observation": "门店分页缺项", "when": "门店选择器",
                    "practice": "先搜索再分页", "boundary": "目录支持搜索", "tags": ["门店选择器"],
                    "sources": [{"story": "S", "scenario": "C", "action": "V", "receipt": receipt["id"]}],
                }, actor="实现者")
                p.write(task, "lesson-review", "L-search", "approve", "--why", "核对实际门店查询", actor="审查者")
            p.cli("new", "target", "--request", "门店选择器搜索")
            workspace = p.root / ".requirements/active/target"
            model = sync.load(workspace / "model.json")
            code_inputs, knowledge = sync.evidence.code_inputs, sync.knowledge

            def once(query):
                with patch.object(code_inputs, "snapshot", wraps=code_inputs.snapshot) as snapshots:
                    result = query()
                    self.assertEqual(snapshots.call_count, 1)
                    return result

            cards = once(lambda: knowledge.project_cards(workspace, sync))
            self.assertEqual(len(cards), 6)
            self.assertTrue(all(c["state"] == "approved" for c in cards))
            self.assertEqual(len(once(lambda: sync.dispatch(model["work"], workspace=workspace))["related_lessons"]), 5)
            self.assertEqual(len(once(lambda: sync.context(model, workspace=workspace))["related_lessons"]), 5)
            previous = sync.TASK_DIR
            try:
                sync.bind_workspace(workspace)
                once(lambda: sync.claim(model["work"]["revision"], "新执行者"))
            finally:
                sync.bind_workspace(previous)

            # A failing query must release its snapshot too. Otherwise the next
            # source change would incorrectly keep all six approvals current.
            with patch.object(knowledge, "live_row", side_effect=RuntimeError("interrupted projection")):
                with self.assertRaisesRegex(RuntimeError, "interrupted"):
                    knowledge.project_cards(workspace, sync)
            source = p.root / "directory.py"
            source.write_text(source.read_text() + "\n# next checkout change\n")
            changed = once(lambda: knowledge.project_cards(workspace, sync))
            self.assertEqual(len(changed), 6)
            self.assertTrue(all(c["state"] == "stale" for c in changed))
            self.assertTrue(all(c["sources"][0]["readable"] for c in changed))
            self.assertEqual(once(lambda: sync.dispatch(model["work"], workspace=workspace))["related_lessons"], [])


if __name__ == "__main__":
    unittest.main()
