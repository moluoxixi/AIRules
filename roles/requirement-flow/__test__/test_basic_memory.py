"""The optional real-CLI case exercises the pinned package and SQLite index end to end."""
from contextlib import closing
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import sqlite3
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

    def test_windows_project_binding_uses_the_indexed_project_and_exact_directory(self):
        notes = PureWindowsPath(r"C:\Work\陈列\.requirements\knowledge\lessons")
        with closing(sqlite3.connect(":memory:")) as db:
            db.execute("CREATE TABLE project (id INTEGER, name TEXT UNIQUE, path TEXT)")
            db.execute("INSERT INTO project VALUES(7, 'flow', ?)", (notes.as_posix(),))
            db.execute("INSERT INTO project VALUES(9, 'neighbor', ?)", (notes.as_posix() + "-other",))
            self.assertEqual(memory.project_id(db, "flow", notes), 7)
            self.assertEqual(memory.project_id(db, "flow", PureWindowsPath("c:" + str(notes)[2:])), 7)
            for other in (PureWindowsPath("D:" + str(notes)[2:]), notes.parent, notes.with_name("lessons-other")):
                with self.assertRaisesRegex(ValueError, "未绑定"):
                    memory.project_id(db, "flow", other)
            with self.assertRaisesRegex(ValueError, "未绑定"):
                memory.project_id(db, "neighbor", notes)
            # Do not alias separately existing folders differing only in case.
            with patch.object(os.path, "samefile", return_value=False):
                with self.assertRaisesRegex(ValueError, "未绑定"):
                    memory.project_id(db, "flow", PureWindowsPath(str(notes).replace("Work", "work")))
            with patch.object(os.path, "samefile", return_value=True):
                self.assertEqual(memory.project_id(db, "flow", PureWindowsPath(str(notes).replace("Work", "work"))), 7)
        for relative in (r"merch-plan\L-selection.md", "merch-plan/L-selection.md"):
            self.assertEqual(memory.note_key(notes, relative), "merch-plan/L-selection.md")
        for outside in (str(notes / "merch-plan/L-selection.md"), r"..\L-selection.md", "C:task/note.md"):
            self.assertIsNone(memory.note_key(notes, outside))
        self.assertIsNone(memory.note_key(PurePosixPath("/notes"), r"merch-plan\L-selection.md"))

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
            notes, state = memory.paths(self.store)
            memory.write_state(state, dict(memory.registration(state, notes), retry_after=0))
            for _ in range(2):
                self.assertEqual(memory.search(self.store, "分页切换后要保留此前的勾选状态"), [])
            self.assertEqual(blocked.call_count, 1)

    def test_retirement_needs_explicit_sync_after_index_failure(self):
        memory.project(self.store, [lesson()])
        notes, state = memory.paths(self.store)
        state.mkdir()
        runtime = state / "index-ready"
        runtime.mkdir()
        with closing(sqlite3.connect(runtime / "memory.db")) as db:
            db.execute("CREATE TABLE project(id INTEGER, name TEXT, path TEXT)")
            db.execute("INSERT INTO project VALUES(1, ?, ?)", (memory.binding_id(notes), str(notes)))
            db.execute("CREATE TABLE search_index(project_id INTEGER)")
            db.commit()
        memory.write_state(state, {"project": memory.binding_id(notes), "package": memory.PACKAGE,
                                   "generation": runtime.name, "indexed": 1, "stamp": memory.snapshot(notes)[0]})
        with patch.object(memory, "rebuild", side_effect=TimeoutError("index unavailable")) as rebuild:
            with self.assertRaisesRegex(ValueError, "index unavailable"):
                memory.project(self.store, [lesson(state="retired")])
            self.assertEqual(rebuild.call_args.kwargs["purpose"], "publish")
        status = memory.status(self.store)
        self.assertFalse(status["ready"], status)
        self.assertIn("index unavailable", status["error"])
        self.assertEqual(memory.search(self.store, "跨页勾选"), [])
        with patch.object(memory, "rebuild", side_effect=lambda notes, state, row, files, **options: row) as retry:
            with self.assertRaisesRegex(ValueError, "index unavailable"):
                memory.project(self.store, [lesson(state="retired")])
            self.assertEqual(retry.call_count, 0)
            memory.enable(self.store, [lesson(state="retired")])
            self.assertEqual(retry.call_count, 1)
            self.assertEqual(retry.call_args.kwargs["purpose"], "enable")
        self.assertEqual(memory.registration(state, notes)["indexed"], 0)

    def test_missing_registered_database_does_not_start_recovery_during_publication(self):
        memory.project(self.store, [lesson()])
        notes, state = memory.paths(self.store)
        state.mkdir()
        memory.write_state(state, {"project": memory.binding_id(notes), "package": memory.PACKAGE,
                                  "generation": "index-missing", "stamp": memory.snapshot(notes)[0]})
        with patch.object(memory, "launch", side_effect=AssertionError("explicit sync is required")):
            with self.assertRaisesRegex(ValueError, "memory sync"):
                memory.project(self.store, [lesson(2)])
        self.assertIn("version: 2", self.note.read_text())
        self.assertFalse(memory.status(self.store)["ready"])

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
        with closing(memory.open_index(state, row)) as db:
            ddl, = db.execute("SELECT sql FROM sqlite_master WHERE name='search_index'").fetchone()
            self.assertIn("fts5(", ddl)
        query = "跨页切换以后，怎样保留原先勾选的门店？"
        with patch.object(memory, "launch", side_effect=AssertionError("queries use the actual index")):
            hits = memory.search(self.store, query)
            self.assertEqual(len(hits), 1, memory.status(self.store))
            hit, = hits
            self.assertEqual((hit["task"], hit["id"], hit["version"]), ("merch-plan", "L-selection", 1))
            self.assertTrue(hit["reason"].startswith("Basic Memory"))
            self.assertEqual(memory.search(self.store, "图片裁剪像素"), [])
        # Reproduce a sync from another checkout: a generated note changes on disk.
        self.note.write_text(memory.markdown(dict(lesson(2), practice="橱窗图片裁剪后按照像素校准")), encoding="utf-8")
        hits = memory.search(self.store, "橱窗图片裁剪")
        self.assertEqual(len(hits), 1, memory.status(self.store))
        self.assertEqual(hits[0]["version"], 2)
        memory.project(self.store, [lesson(2, "retired")])
        self.assertEqual(memory.search(self.store, query), [])
        status = memory.status(self.store)
        self.assertTrue(status["ready"], status)
        self.assertEqual(status["indexed"], 0, status)
        row = memory.registration(state, notes)
        with closing(memory.open_index(state, row)) as db:
            scope = memory.project_id(db, row["project"], notes)
            found = db.execute("SELECT file_path FROM search_index WHERE project_id=? AND type='entity'",
                               (scope,)).fetchall()
        self.assertEqual(found, [], status)
        with patch.object(memory, "launch", side_effect=AssertionError("stable empty catalogue")):
            self.assertEqual(memory.project(self.store, [lesson(2, "retired")])["removed"], 0)


if __name__ == "__main__":
    unittest.main()
