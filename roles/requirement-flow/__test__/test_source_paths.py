import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

RUNTIME = Path(__file__).resolve().parents[1] / "skills/requirement-flow/runtime"
sys.path.insert(0, str(RUNTIME))
import source_paths


class SourcePathsTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name) / "project"
        self.store = self.root / ".requirements"
        self.store.mkdir(parents=True)
        self.config = self.store / "source-paths.json"
        self.directory = self.root / "历史"
        self.directory.mkdir()
        (self.directory / "Plan A.md").write_text("原始文件")

    def aliases(self, pairs):
        self.config.write_text(json.dumps({"version": 1, "directories": pairs}))
        return source_paths.SourcePaths(self.store)

    def test_no_mapping_and_rules_are_optional_and_project_scoped(self):
        task = self.store / "active" / "t"
        record = {"basis": "old/Plan A.md:14"}
        self.assertIs(source_paths.SourcePaths.for_task(task).reading_context(record), record)
        (self.store / "rules").mkdir()
        (self.store / "rules/index.md").write_text("规则")
        self.assertEqual(source_paths.SourcePaths.for_task(task).reading_context(record)["project_rules"],
                         ".requirements/rules/index.md")
        nested = self.root / "nested/.requirements/archive/t"
        self.assertIs(source_paths.SourcePaths.for_task(nested).reading_context(record), record)

    def test_only_existing_project_files_are_resolved_once_per_file(self):
        paths = self.aliases({"old/": "历史/", "old/missing/": "other/"})
        with patch.object(source_paths, "project_file", wraps=source_paths.project_file) as check:
            self.assertEqual(paths.citation("  old/Plan A.md:12:3  "), "  历史/Plan A.md:12:3  ")
            self.assertEqual(paths.citation("old/Plan A.md:18-20"), "历史/Plan A.md:18-20")
            self.assertEqual(check.call_count, 1)
        for ref in ("old/absent.md", "old/missing/Plan A.md", "old/../历史/Plan A.md", "older/Plan A.md",
                    "/old/Plan A.md", "prefix/old/Plan A.md", "old//Plan A.md", "看 old/Plan A.md",
                    "run old/Plan A.md:12", "old/Plan A.md:line", "old/", "old/Plan A.md is the file",
                    "C:\\old\\Plan A.md", "https://example.org/old/Plan A.md"):
            self.assertEqual(paths.citation(ref), ref, ref)
        self.assertEqual(paths.text("old/Plan A.md\r\n帮助\r\n"), "历史/Plan A.md\r\n帮助\r\n")

    def test_rejects_unsafe_directories_and_symlinks(self):
        for prefix in ("../", "/outside/", "./a/", ".git/", "C:/bad/", "a//b/", "a"):
            with self.assertRaises(ValueError):
                self.aliases({prefix: "历史/"})
            with self.assertRaises(ValueError):
                self.aliases({"old/": prefix})
        outside = self.root.parent / "external"
        outside.mkdir()
        (outside / "prd.md").write_text("other project")
        try:
            (self.directory / "linked").symlink_to(outside, target_is_directory=True)
            (self.directory / "link.md").symlink_to(outside / "prd.md")
        except OSError:
            self.skipTest("filesystem does not support symbolic links")
        paths = self.aliases({"old/": "历史/"})
        for ref in ("old/linked/prd.md:4", "old/link.md"):
            self.assertEqual(paths.citation(ref), ref)
        (self.store / "rules").symlink_to(outside, target_is_directory=True)
        (outside / "index.md").write_text("other rules")
        self.assertNotIn("project_rules", paths.reading_context({}))
        self.config.unlink()
        self.config.symlink_to(outside / "prd.md")
        with self.assertRaises(ValueError):
            source_paths.SourcePaths(self.store)
