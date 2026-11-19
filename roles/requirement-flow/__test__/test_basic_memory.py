"""The optional real-CLI case exercises the pinned package and SQLite index end to end."""
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import basic_memory as memory


def lesson(version=1, state="approved"):
    receipt = "b" * 32
    return dict(id="L-selection", task="merch-plan", task_title="陈列方案批量确认", version=version,
                bucket="active", state=state, when="跨页选择门店类型后批量确认",
                practice="切换分页时保留先前勾选的门店类型", boundary="仅对支持跨页提交的列表生效",
                observation="跨页勾选后超时，刷新失败时应保留选择", tags=["门店类型", "批量确认"],
                review=dict(actor="reviewer", reason="核对跨页场景与对应回执"),
                sources=[dict(story="S-batch", story_title="批量确认", scenario="AC-select",
                              action="A-verify", receipt=receipt, given="已勾选", when="切换分页",
                              then="选择保留", proof=dict(artifact=dict(
                                  path=f"evidence/{receipt}/output.log", sha256="a" * 64)))])


class BasicMemoryTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.store = Path(tmp.name) / ".requirements"
        self.store.mkdir()
        self.note = self.store / "knowledge/lessons/merch-plan/L-selection.md"

    def test_projection_is_deterministic_and_removes_only_generated_notes(self):
        card = lesson()
        self.assertEqual(memory.project(self.store, [card])["written"], 1)
        before = self.note.stat().st_mtime_ns
        self.assertEqual(memory.project(self.store, [lesson(2, "pending"), card])["unchanged"], 1)
        self.assertEqual(self.note.stat().st_mtime_ns, before)
        text = self.note.read_text(encoding="utf-8")
        for fragment in ("## 适用边界", "version: 1", "../../../active/merch-plan/evidence/", "#node=S-batch"):
            self.assertIn(fragment, text)
        manual = self.note.with_name("handwritten.md")
        manual.write_text("保留我的笔记", encoding="utf-8")
        self.assertEqual(memory.project(self.store, [lesson(1, "retired")])["removed"], 1)
        self.assertFalse(self.note.exists())
        self.assertTrue(manual.exists())
        self.assertEqual(memory.status(self.store)["mode"], "structured")

    def test_unconfigured_worktree_never_calls_uv_or_another_worktree(self):
        memory.project(self.store, [lesson()])
        with patch.object(memory, "launch", side_effect=AssertionError("must not start a process")):
            self.assertEqual(memory.search(self.store, "跨页勾选"), [])
        notes, state = memory.paths(self.store)
        state.mkdir()
        memory.write_state(state, {"project": "another-checkout", "package": memory.PACKAGE})
        self.assertFalse(memory.status(self.store)["enabled"])
        self.assertFalse(memory.search(self.store, "跨页勾选"))

    def test_offline_errors_are_visible_and_reads_fall_back_without_retry_storm(self):
        with patch.object(memory, "binary", side_effect=ValueError("offline")) as blocked:
            result = memory.enable(self.store, [lesson()])
            self.assertTrue(result["enabled"])
            self.assertFalse(result["ready"])
            self.assertEqual(result["error"], "offline")
            for _ in range(2):
                self.assertEqual(memory.search(self.store, "分页切换后要保留此前的勾选状态"), [])
            self.assertEqual(blocked.call_count, 1)

    def test_shared_derived_files_cannot_escape_the_worktree(self):
        outside = self.store.parent / "private"
        outside.mkdir()
        knowledge = self.store / "knowledge"
        knowledge.mkdir()
        (knowledge / "lessons").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            memory.project(self.store, [lesson()])
        self.assertEqual(list(outside.iterdir()), [])

    @unittest.skipUnless(os.getenv("AIRULES_TEST_BASIC_MEMORY") == "1" and shutil.which("uv"),
                         "set AIRULES_TEST_BASIC_MEMORY=1 to install and exercise real Basic Memory")
    def test_upstream_index_chinese_search_recovery_and_retirement(self):
        ready = memory.enable(self.store, [lesson()])
        self.assertTrue(ready["ready"], ready)
        notes, state = memory.paths(self.store)
        row = memory.registration(state, notes)
        with memory.open_index(state, row) as db:
            ddl, = db.execute("SELECT sql FROM sqlite_master WHERE name='search_index'").fetchone()
            self.assertIn("fts5(", ddl)
        query = "跨页切换以后，怎样保留原先勾选的门店？"
        with patch.object(memory, "launch", side_effect=AssertionError("queries use the actual index")):
            hit, = memory.search(self.store, query)
            self.assertEqual((hit["task"], hit["id"], hit["version"]), ("merch-plan", "L-selection", 1))
            self.assertTrue(hit["reason"].startswith("Basic Memory"))
            self.assertEqual(memory.search(self.store, "图片裁剪像素"), [])
        # Reproduce a sync from another checkout: a generated note changes on disk.
        self.note.write_text(memory.markdown(dict(lesson(2), practice="橱窗图片裁剪后按照像素校准")), encoding="utf-8")
        hit, = memory.search(self.store, "橱窗图片裁剪")
        self.assertEqual(hit["version"], 2)
        memory.project(self.store, [lesson(2, "retired")])
        self.assertEqual(memory.search(self.store, query), [])
        self.assertEqual(memory.status(self.store)["indexed"], 0)


if __name__ == "__main__":
    unittest.main()
