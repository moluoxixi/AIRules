"""Test project installation, upgrade and migration using only disposable directories."""
import importlib.util
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch


SKILL_SOURCE = Path(__file__).resolve().parents[1] / "skills" / "requirement-flow"
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("requirement_flow_install_test", SKILL_SOURCE / "install_project.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


def write(root, relative, content):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content if isinstance(content, bytes) else content.encode("utf-8"))
    return path


def snapshot(root):
    return {
        p.relative_to(root).as_posix(): p.read_bytes() if p.is_file() else None
        for p in root.rglob("*")
    }


class InstallProjectTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.project = self.root / "项目"
        self.project.mkdir()

    def legacy_project(self):
        write(self.project, "AGENTS.md", (
            "# Team\r\nPreserve approvals for publishing.\r\n"
            "<!-- MOLUOXIXI:START -->\r\nlegacy workflow\r\n<!-- MOLUOXIXI:END -->\r\n"
            "Keep the audit rules below.\r\n"
        ))
        write(self.project, ".moluoxixi/tasks/old/prd.md", "已有需求和验收记录\n")
        write(self.project, ".agents/skills/moluoxixi-start/SKILL.md", "legacy project start\n")
        write(self.project, ".codex/agents/moluoxixi-implement.toml", 'name = "moluoxixi-implement"\n')
        write(self.project, ".codex/hooks/inject-workflow-state.py", "# Moluoxixi workflow state\n")
        write(self.project, ".agents/skills/team-release/SKILL.md", "team release with explicit approval\n")
        write(self.project, ".codex/hooks/metrics.py", "print('metrics')\n")
        write(self.project, ".codex/config.toml", '[agents]\nmax_threads = 3\n')
        old = {"type": "command", "command": "python3 -X utf8 .codex/hooks/inject-workflow-state.py"}
        team = {"type": "command", "command": "python3 .codex/hooks/metrics.py", "timeout": 8}
        hooks = {"description": "team settings", "hooks": {
            "UserPromptSubmit": [{"matcher": "*", "hooks": [old, team]}],
            "SessionStart": [{"hooks": [team]}],
        }}
        write(self.project, ".codex/hooks.json", json.dumps(hooks, indent=4))
        return team

    def test_migration_requires_opt_in_and_archives_only_legacy_entries(self):
        team_hook = self.legacy_project()
        original = snapshot(self.project)
        with self.assertRaisesRegex(ValueError, "--migrate"):
            installer.install(self.project)
        self.assertEqual(snapshot(self.project), original)

        result = installer.install(self.project, migrate=True)
        self.assertTrue(result["migrated"])
        archive = Path(result["archive"])
        self.assertTrue(archive.is_relative_to(self.project))
        self.assertEqual((archive / "AGENTS.md").read_bytes(), original["AGENTS.md"])
        self.assertEqual((archive / ".codex/hooks.json").read_bytes(), original[".codex/hooks.json"])
        for relative in (".agents/skills/moluoxixi-start/SKILL.md", ".codex/agents/moluoxixi-implement.toml",
                         ".codex/hooks/inject-workflow-state.py"):
            self.assertFalse((self.project / relative).exists(), relative)
            self.assertEqual((archive / relative).read_bytes(), original[relative])
        for relative in (".agents/skills/team-release/SKILL.md", ".codex/hooks/metrics.py",
                         ".moluoxixi/tasks/old/prd.md", ".codex/config.toml"):
            self.assertEqual((self.project / relative).read_bytes(), original[relative])
        settings = json.loads((self.project / ".codex/hooks.json").read_bytes())
        self.assertEqual(settings["description"], "team settings")
        self.assertEqual(settings["hooks"]["UserPromptSubmit"], [{"matcher": "*", "hooks": [team_hook]}])
        self.assertEqual(settings["hooks"]["SessionStart"], [{"hooks": [team_hook]}])
        agents = (self.project / "AGENTS.md").read_bytes()
        self.assertIn(b"Preserve approvals for publishing.\r\n", agents)
        self.assertIn(b"Keep the audit rules below.\r\n", agents)
        self.assertNotIn(b"<!-- MOLUOXIXI:START -->", agents)
        self.assertEqual(agents.count(b"<!-- REQUIREMENT-FLOW:START -->"), 1)
        migrated = snapshot(self.project)
        self.assertFalse(installer.install(self.project)["changed"])
        self.assertEqual(snapshot(self.project), migrated)

    def test_clean_install_and_upgrade_preserve_data_and_project_rules(self):
        skills = self.root / "next-version" / "skills"
        shutil.copytree(SKILL_SOURCE.parent, skills)
        source = skills / "requirement-flow"
        write(source, "runtime/test_fake.py", "# should not enter business projects")
        write(source, "runtime/__pycache__/sync.cpython-311.pyc", b"cached")
        with patch.object(installer, "SOURCE", source):
            self.assertTrue(installer.install(self.project)["changed"])
            skill = self.project / ".agents/skills/requirement-flow"
            self.assertTrue((skill / "flow.py").is_file())
            self.assertTrue((skill / "references/model.md").is_file())
            self.assertTrue((skill / "runtime/evidence.py").is_file())
            for name in installer.SPECIALISTS:
                self.assertEqual((skill.parent / name / "SKILL.md").read_bytes(),
                                 (skills / name / "SKILL.md").read_bytes())
            self.assertFalse((skill / "runtime/test_fake.py").exists())
            self.assertFalse((skill / "runtime/__pycache__").exists())
            self.assertFalse(installer.install(self.project)["changed"])

            data = write(self.project, ".requirements/active/work/model.json", b'{"work":{"revision":72}}\r\n')
            archived = write(self.project, ".requirements/archive/old/handbook.html", b"historical page\n")
            agents = self.project / "AGENTS.md"
            agents.write_bytes(b"# Team-only rules\n" + agents.read_bytes() + b"Keep deployment review.\n")
            update = (source / "runtime/layout.html").read_bytes() + b"\n<!-- future template -->\n"
            write(source, "runtime/layout.html", update)
            self.assertTrue(installer.install(self.project)["changed"])
            self.assertEqual((skill / "runtime/layout.html").read_bytes(), update)
            self.assertEqual(data.read_bytes(), b'{"work":{"revision":72}}\r\n')
            self.assertEqual(archived.read_bytes(), b"historical page\n")
            self.assertTrue(agents.read_bytes().startswith(b"# Team-only rules\n"))
            self.assertTrue(agents.read_bytes().endswith(b"Keep deployment review.\n"))
            self.assertFalse(installer.install(self.project)["changed"])

    def test_upgrades_v010_manifest_into_six_skills_without_rewriting_project_data(self):
        base = self.project / ".agents/skills/requirement-flow"
        files = {}
        # v0.1.0 keyed hashes relative to the orchestrator, with no sibling skills.
        legacy_runtime = {"dagre.min.js", "graph_view.py", "layout.html", "map.js", "protocol.json", "sync.py"}
        for name in sorted(installer.ROOT_FILES | {"runtime/" + n for n in legacy_runtime}):
            old = ("previous release: " + name + "\n").encode()
            write(base, name, old)
            files[name] = hashlib.sha256(old).hexdigest()
        old_block = "<!-- REQUIREMENT-FLOW:START -->\nold project instructions\n<!-- REQUIREMENT-FLOW:END -->"
        manifest = {"format": 1, "role": "requirement-flow", "files": files, "migrated": False,
                    "agents_block": hashlib.sha256(old_block.encode()).hexdigest()}
        write(self.project, ".requirements/installation.json", json.dumps(manifest))
        write(self.project, "AGENTS.md", "Use test portal.\n" + old_block + "\nPreserve project reviews.\n")
        before = {}
        for bucket in ("active", "archive"):
            for asset in ("model.json", "handbook.html"):
                relative = Path(".requirements") / bucket / "old" / asset
                before[relative] = write(self.project, relative, "Persisted old story and verification results\n").read_bytes()

        collision = write(self.project, ".agents/skills/flow-review/notes.md", "private team skill")
        original = snapshot(self.project)
        with self.assertRaisesRegex(ValueError, "同名"):
            installer.install(self.project)
        self.assertEqual(snapshot(self.project), original)
        collision.unlink()
        collision.parent.rmdir()
        self.assertTrue(installer.install(self.project)["changed"])
        new_manifest = json.loads((self.project / ".requirements/installation.json").read_bytes())
        self.assertEqual(new_manifest["format"], 3)
        for name in ("requirement-flow", *installer.SPECIALISTS):
            self.assertIn(f"{name}/SKILL.md", new_manifest["files"])
            self.assertEqual((base.parent / name / "SKILL.md").read_bytes(),
                             (SKILL_SOURCE.parent / name / "SKILL.md").read_bytes())
        self.assertIn("requirement-flow/runtime/evidence.py", new_manifest["files"])
        for relative, data in before.items():
            self.assertEqual((self.project / relative).read_bytes(), data)
        rules = (self.project / "AGENTS.md").read_text()
        self.assertEqual(rules.count("<!-- REQUIREMENT-FLOW:START -->"), 1)
        self.assertTrue(rules.startswith("Use test portal.\n"))
        self.assertTrue(rules.endswith("Preserve project reviews.\n"))
        self.assertFalse(installer.install(self.project)["changed"])

    def test_refuses_unknown_same_name_without_writing(self):
        write(self.project, ".agents/skills/requirement-flow/SKILL.md", "project-owned")
        original = snapshot(self.project)
        with self.assertRaises(ValueError):
            installer.install(self.project)
        self.assertEqual(snapshot(self.project), original)

    def test_install_adds_local_evidence_ignores_and_keeps_project_patterns(self):
        path = write(self.project, ".requirements/.gitignore", b"team-local/\r\n.workflow.lock")
        installer.install(self.project)
        self.assertTrue(path.read_bytes().startswith(b"team-local/\r\n.workflow.lock\r\n"))
        for pattern in installer.LOCAL_PATTERNS:
            self.assertEqual(path.read_bytes().splitlines().count(pattern), 1)
        self.assertFalse(installer.install(self.project)["changed"])

    def test_refuses_modified_managed_files_and_rules_without_writing(self):
        installer.install(self.project)
        for relative in (".agents/skills/requirement-flow/flow.py", ".agents/skills/flow-review/SKILL.md", "AGENTS.md"):
            with self.subTest(relative=relative):
                target = self.project / relative
                previous = target.read_bytes()
                if relative == "AGENTS.md":
                    target.write_bytes(previous.replace(b"<!-- REQUIREMENT-FLOW:START -->",
                                                        b"<!-- REQUIREMENT-FLOW:START -->\nNew team rule"))
                else:
                    target.write_bytes(previous + b"\n# local modifications\n")
                original = snapshot(self.project)
                with self.assertRaises(ValueError):
                    installer.install(self.project)
                self.assertEqual(snapshot(self.project), original)
                target.write_bytes(previous)

    def test_late_failure_restores_moved_entries_and_shared_files(self):
        self.legacy_project()
        original = snapshot(self.project)
        replace = Path.replace
        manifest = self.project / ".requirements/installation.json"

        def fail_on_manifest(source, target):
            if target == manifest:
                raise OSError("simulated disk error while committing manifest")
            return replace(source, target)

        with patch.object(Path, "replace", fail_on_manifest):
            with self.assertRaisesRegex(OSError, "simulated disk error"):
                installer.install(self.project, migrate=True)
        self.assertEqual(snapshot(self.project), original)
        self.assertTrue(installer.install(self.project, migrate=True)["migrated"])


if __name__ == "__main__":
    unittest.main()
