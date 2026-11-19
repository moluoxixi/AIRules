"""Receipts must survive local Git worktree synchronization without checking a signing key into Git."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import evidence


def git(repo, *args):
    return subprocess.check_output(["git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                                    "-C", str(repo), *args], stderr=subprocess.STDOUT)


class WorktreeEvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.main = self.base / "陈列"
        self.main.mkdir()
        git(self.main, "init", "-q")
        git(self.main, "commit", "-q", "--allow-empty", "-m", "initial")
        self.other = self.base / "关联工作区"
        self.rel = Path(".requirements/active/display")
        self.binding = dict(action="A-verify", scenario="SC-save", stamp="same-input")

    def workspace(self, project):
        work = project / self.rel
        work.mkdir(parents=True, exist_ok=True)
        (work / "model.json").write_text(json.dumps({"work": {"id": "display"}}), encoding="utf-8")
        return work

    def issue(self, project):
        return evidence.run(self.workspace(project), project, [sys.executable, "-c", "print('1 assertion passed')"],
                            actor="reviewer", environment="local", **self.binding)

    def test_actual_git_add_commit_worktree_and_archive_keep_receipts_valid(self):
        first = self.issue(self.main)
        work = self.main / self.rel
        root = work / "evidence"
        self.assertFalse((root / ".receipt-key").exists())
        shared = evidence.shared_key_path(root)
        self.assertEqual(shared.parent.parent, self.main / ".git")
        if os.name != "nt":
            self.assertEqual(stat.S_IMODE(shared.stat().st_mode), 0o600)
        git(self.main, "add", "-A")
        names = git(self.main, "diff", "--cached", "--name-only", "-z")
        self.assertIn(b"receipt.json", names)
        self.assertNotIn(b".receipt-key", names)
        git(self.main, "commit", "-qm", "record evidence")
        git(self.main, "worktree", "add", "-qb", "topic", str(self.other))
        self.assertEqual(evidence.validate(self.other / self.rel, first, **self.binding), first)
        second = self.issue(self.other)
        archived = Path(".requirements/archive/display")
        (self.other / archived.parent).mkdir()
        (self.other / self.rel).rename(self.other / archived)
        git(self.other, "add", "-A")
        git(self.other, "commit", "-qm", "archive")
        git(self.main, "merge", "--ff-only", "topic")
        for receipt in (first, second):
            self.assertEqual(evidence.validate(self.main / archived, receipt, **self.binding), receipt)

    def test_nested_preview_import_and_legacy_adoption_preserve_origins(self):
        preview = self.main / ".local-review" / "project"
        receipt = self.issue(preview)
        original = preview / self.rel / "evidence/.receipt-key"
        self.assertTrue(original.is_file())
        work = self.main / self.rel
        shutil.copytree(preview / self.rel, work, ignore=shutil.ignore_patterns(".receipt-key"))
        root = work / "evidence"
        with self.assertRaises(ValueError):
            self.issue(self.main)  # Never replace a lost original key for data already synchronized.
        evidence.import_worktree_key(root, original)
        evidence.import_worktree_key(root, original)
        self.assertFalse((root / ".receipt-key").exists())
        self.assertEqual(evidence.validate(work, receipt, **self.binding), receipt)
        # A competing import or an older checkout with a different same-ID task cannot overwrite it.
        unrelated = self.base / "独立项目"
        self.issue(unrelated)
        other_key = unrelated / self.rel / "evidence/.receipt-key"
        with self.assertRaisesRegex(ValueError, "另一份"):
            evidence.import_worktree_key(root, other_key)
        shutil.copy2(other_key, root / ".receipt-key")
        with self.assertRaisesRegex(ValueError, "另一份"):
            evidence.validate(work, receipt, **self.binding)
        (root / ".receipt-key").unlink()
        self.assertEqual(evidence.validate(work, receipt, **self.binding), receipt)
        # An old repository that still has only its local key adopts it during normal validation.
        fresh = self.base / "旧项目"
        shutil.copytree(preview, fresh)
        git(fresh, "init", "-q")
        self.assertEqual(evidence.validate(fresh / self.rel, receipt, **self.binding), receipt)
        (fresh / self.rel / "evidence/.receipt-key").unlink()
        self.assertEqual(evidence.validate(fresh / self.rel, receipt, **self.binding), receipt)

    def test_concurrent_first_key_and_symlink_rejection(self):
        git(self.main, "worktree", "add", "-qb", "topic", str(self.other))
        roots = [evidence.storage(self.workspace(project), create=True) for project in (self.main, self.other)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            keys = list(pool.map(lambda root: evidence.local_key(root, create=True), roots * 4))
        self.assertTrue(all(key == keys[0] for key in keys))
        path = evidence.shared_key_path(roots[0])
        self.assertEqual(list(path.parent.iterdir()), [path])
        outside = self.base / "outside"
        path.rename(outside)
        try:
            path.symlink_to(outside)
        except OSError as exc:
            self.skipTest(f"symlink unavailable: {exc}")
        with self.assertRaises(ValueError):
            evidence.local_key(roots[1], create=True)


if __name__ == "__main__":
    unittest.main()
