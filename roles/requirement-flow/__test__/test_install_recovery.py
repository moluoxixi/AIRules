"""Hard-exit recovery touches only temporary, synthetic projects and releases."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_install import SKILL_SOURCE, installer, snapshot, write


CRASH = r"""
import json
import os
from pathlib import Path
import sys

source, project, mode, victim = map(Path, sys.argv[1:])
sys.path.insert(0, str(source))
import install_project as installer
import flow
mode = str(mode)
victim = project / victim
original_replace, original_rename = Path.replace, Path.rename
original_unlink, original_rmdir = Path.unlink, Path.rmdir
original_open, original_fsync = Path.open, os.fsync
staged_fd = None

def stage_file(path, *args, **kwargs):
    global staged_fd
    watched = mode in ('before-prepare-write', 'prepare-fsync') and path.parent.name.startswith('.install-') and path.name.startswith('new-')
    if watched:
        is_page = victim == project / '.requirements/active/live/handbook.html'
        if is_page:
            manifest = project / installer.MANIFEST
            watched = (manifest.is_file() and json.loads(manifest.read_bytes())['role_version'] == installer.ROLE_VERSION)
    if watched and mode == 'before-prepare-write':
        os._exit(71)
    stream = original_open(path, *args, **kwargs)
    if watched:
        staged_fd = stream.fileno()
    return stream

def fsync(fd):
    original_fsync(fd)
    if mode == 'prepare-fsync' and fd == staged_fd:
        os._exit(71)

def replace(path, target):
    if mode in ('register-journal-tmp', 'prepare-journal-tmp') and path.name == installer.JOURNAL + '.tmp':
        proposal = json.loads(path.read_bytes())
        if len(proposal['files']) == 1:
            operation = proposal['files'][0]
            if mode == 'register-journal-tmp' and operation['state'] == 'preparing':
                assert not json.loads(Path(target).read_bytes())['files']
                os._exit(71)
            if mode == 'prepare-journal-tmp' and operation['state'] == 'pending':
                prior = json.loads(Path(target).read_bytes())
                assert operation == {**prior['files'][0], 'state': 'pending'}
                assert prior['files'][0]['state'] == 'preparing'
                os._exit(71)
    result = original_replace(path, target)
    target = Path(target)
    if ((mode == 'old' and path == victim and target.name.startswith('old-'))
            or (mode == 'new' and target == victim and path.name.startswith('new-'))
            or (mode == 'rollback-gap' and path == victim and target.name.startswith('new-'))
            or (mode == 'rollback-old' and target == victim and path.name.startswith('old-'))):
        os._exit(71)
    return result

def rename(path, target):
    result = original_rename(path, target)
    if mode == 'move' and path == victim:
        os._exit(71)
    return result

original_save = installer.save_journal

def save(stage, journal):
    original_save(stage, journal)
    if mode == 'commit' and journal['phase'] == 'committed':
        os._exit(71)
    if mode == 'rollback-preparation' and journal['phase'] == 'rolling_back':
        os._exit(71)
    if mode == 'cleanup-restored-journal' and journal['phase'] == 'rolling_back':
        os._exit(72)  # A finished rollback must never go back to rolling_back.

def unlink(path, *args, **kwargs):
    result = original_unlink(path, *args, **kwargs)
    if path.parent.name.startswith('.install-'):
        if mode == 'cleanup-new-file' and path.name.startswith('new-'):
            assert json.loads((path.parent / installer.JOURNAL).read_bytes())['phase'] == 'rolled_back'
            os._exit(71)
        if mode in ('cleanup-journal', 'cleanup-restored-journal') and path.name == installer.JOURNAL:
            os._exit(71)
    return result

def rmdir(path):
    result = original_rmdir(path)
    if ((mode == 'cleanup-directory' and path == victim)
            or (mode == 'cleanup-stage' and path.name.startswith('.install-'))):
        os._exit(71)
    return result

Path.replace, Path.rename = replace, rename
Path.unlink, Path.rmdir = unlink, rmdir
Path.open, os.fsync = stage_file, fsync
installer.save_journal = save
if mode == 'move' or not (project / installer.MANIFEST).exists():
    installer.install(project, migrate=mode == 'move')
else:
    flow.upgrade(project)
raise AssertionError('crash point was not reached')
"""


class InstallRecoveryTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve()
        self.project = self.base / "项目"
        self.project.mkdir()
        self.release_number = 0

    def cli(self, source, *arguments, ok=True):
        result = subprocess.run([sys.executable, "-B", str(source / "flow.py"), "--project", str(self.project),
                                 *arguments], capture_output=True, text=True, timeout=30)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout) if result.stdout.lstrip().startswith("{") else result.stdout
        self.assertNotEqual(result.returncode, 0)
        return result

    def installed_project(self):
        self.cli(SKILL_SOURCE, "init")
        self.cli(SKILL_SOURCE, "new", "live", "--request", "保留旧验收证据")
        self.cli(SKILL_SOURCE, "task", "live")
        protected = {
            ".requirements/active/live/model.json": (self.project / ".requirements/active/live/model.json").read_bytes(),
            ".requirements/active/live/evidence/old.bin": b"old evidence\x00\xff\r\n",
            ".requirements/archive/history/model.json": b'{"historical": true}\r\n',
            ".requirements/archive/history/handbook.html": b"historical rendered page\r\n",
            ".requirements/archive/history/evidence/output.log": b"old assertion\r\n\xff\x00",
        }
        for name, data in protected.items():
            write(self.project, name, data)
        return protected

    def release(self):
        self.release_number += 1
        source = self.base / f"release-{self.release_number}/skills/requirement-flow"
        shutil.copytree(SKILL_SOURCE.parent, source.parent)
        theme = source / "runtime/theme.css"
        theme.write_bytes(theme.read_bytes() + f"\n/* release {self.release_number} */\n".encode())
        script = source / "install_project.py"
        script.write_text(re.sub(r'ROLE_VERSION = "[\d.]+"', f'ROLE_VERSION = "0.11.{self.release_number}"',
                                 script.read_text()), encoding="utf-8")
        return source

    def interrupt(self, source, mode, victim):
        result = subprocess.run([sys.executable, "-B", "-c", CRASH, str(source), str(self.project), mode, victim],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 71, result.stderr)
        stages = list((self.project / ".requirements").glob(".install-*"))
        self.assertEqual(len(stages), 1)
        return stages[0]

    def assert_protected(self, protected):
        for name, data in protected.items():
            self.assertEqual((self.project / name).read_bytes(), data, name)

    def test_preparation_interruption_recovers_on_first_install_and_upgrade(self):
        for stage_name in ('initial', 'upgraded-asset', 'upgraded-page'):
            for mode in ('before-prepare-write', 'prepare-fsync'):
                with self.subTest(stage=stage_name, mode=mode), tempfile.TemporaryDirectory(dir=self.base) as directory:
                    self.project = Path(directory)
                    initial = stage_name == 'initial'
                    protected = {'.requirements/archive/history/evidence/output.log': b'original\x00\xff'}
                    if initial:
                        for name, data in protected.items():
                            write(self.project, name, data)
                        source = SKILL_SOURCE
                    else:
                        protected = self.installed_project()
                        source = self.release()
                    victim = ('.requirements/active/live/handbook.html' if stage_name == 'upgraded-page'
                              else '.agents/skills/requirement-flow/runtime/theme.css')
                    stage = self.interrupt(source, mode, victim)
                    if mode == 'prepare-fsync':
                        self.assertTrue(any(p.name.startswith('new-') for p in stage.iterdir()))
                    self.assert_protected(protected)
                    command = 'init' if initial else 'upgrade'
                    result = self.cli(source, command)
                    self.assertEqual(result['recovered'], [{'stage': stage.name, 'action': 'rolled_back'}])
                    self.assertFalse(stage.exists())
                    self.assert_protected(protected)
                    self.assertEqual((self.project / '.agents/skills/requirement-flow/runtime/theme.css').read_bytes(),
                                     (source / 'runtime/theme.css').read_bytes())
                    self.assertFalse(self.cli(source, command)['changed'])

    def test_preparation_without_a_staged_file_can_resume_interrupted_rollback(self):
        protected = self.installed_project()
        source = self.release()
        victim = '.requirements/active/live/handbook.html'
        stage = self.interrupt(source, 'before-prepare-write', victim)
        self.assertEqual(self.interrupt(source, 'rollback-preparation', victim), stage)
        self.assert_protected(protected)
        self.assertEqual(self.cli(source, 'upgrade')['recovered'], [{'stage': stage.name, 'action': 'rolled_back'}])
        self.assertFalse(stage.exists())
        self.assertFalse(self.cli(source, 'upgrade')['changed'])
        self.assert_protected(protected)

    def test_interrupted_preparation_retains_ambiguous_or_modified_data(self):
        for damage in ('edited-stage', 'added-stage', 'edited-target'):
            with self.subTest(damage=damage), tempfile.TemporaryDirectory(dir=self.base) as directory:
                self.project = Path(directory)
                protected = self.installed_project()
                source = self.release()
                victim = '.agents/skills/requirement-flow/runtime/theme.css'
                stage = self.interrupt(source, 'prepare-fsync', victim)
                staged, = stage.glob('new-*')
                index = int(staged.name.removeprefix('new-'))
                intent = json.loads((stage / installer.JOURNAL).read_bytes())['files'][index]
                self.assertEqual(intent['state'], 'preparing')
                self.assertEqual(intent['post'], 'f:' + installer.digest(staged.read_bytes()))
                if damage == 'edited-stage':
                    staged.write_bytes(b'incomplete or user-edited stage')
                elif damage == 'added-stage':
                    write(stage, 'new-999', b'unowned manual data')
                else:
                    write(self.project, intent['path'], b'keep a manual target edit')
                before = snapshot(self.project)
                rejected = self.cli(source, 'upgrade', ok=False)
                self.assertIn('保留 stage 和备份', rejected.stderr)
                self.assertEqual(snapshot(self.project), before)
                self.assert_protected(protected)

    def test_only_a_known_temporary_journal_can_be_removed_on_retry(self):
        for mode, damage in [('prepare-journal-tmp', item) for item in
                             ('none', 'unknown-bytes', 'unrelated-record', 'staged-file-missing')] + [
                                 ('register-journal-tmp', 'none'), ('register-journal-tmp', 'skip-preparing')]:
            with self.subTest(mode=mode, damage=damage), tempfile.TemporaryDirectory(dir=self.base) as directory:
                self.project = Path(directory)
                protected = {'.requirements/archive/history/evidence/output.bin': b'original\x00\xff'}
                write(self.project, next(iter(protected)), next(iter(protected.values())))
                stage = self.interrupt(SKILL_SOURCE, mode, 'irrelevant-first-file')
                temporary = stage / (installer.JOURNAL + '.tmp')
                if damage == 'unknown-bytes':
                    temporary.write_bytes(b'unrelated data\x00\xff')
                elif damage == 'staged-file-missing':
                    (stage / 'new-0').unlink()
                elif damage in ('unrelated-record', 'skip-preparing'):
                    proposed = json.loads(temporary.read_bytes())
                    operation = proposed['files'][0]
                    if damage == 'skip-preparing':
                        operation['state'] = 'pending'
                    else:
                        operation['post'] = 'f:' + installer.digest(b'another transaction')
                    temporary.write_bytes(installer.journal_bytes(proposed))
                before = snapshot(self.project)
                if damage == 'none':
                    self.assertEqual(self.cli(SKILL_SOURCE, 'init')['recovered'],
                                     [{'stage': stage.name, 'action': 'rolled_back'}])
                    self.assertFalse(stage.exists())
                    self.assertFalse(self.cli(SKILL_SOURCE, 'init')['changed'])
                else:
                    rejected = self.cli(SKILL_SOURCE, 'init', ok=False)
                    self.assertIn('保留 stage 和备份', rejected.stderr)
                    self.assertEqual(snapshot(self.project), before)
                self.assert_protected(protected)

    def test_real_journal_writes_can_be_recovered_before_atomic_replacement(self):
        windows = []
        original_replace = Path.replace

        def record_before_replace(path, target):
            target = Path(target)
            if path.name == installer.JOURNAL + '.tmp' and target.is_file():
                previous = json.loads(target.read_bytes())
                proposed = json.loads(path.read_bytes())
                mirror = self.base / f'journal-window-{len(windows)}'
                shutil.copytree(self.project, mirror)
                windows.append((mirror, path.parent.name, previous, proposed))
            return original_replace(path, target)

        for rollback in (False, True):
            nested = tempfile.TemporaryDirectory(dir=self.base)
            self.addCleanup(nested.cleanup)
            self.project = Path(nested.name)
            legacy = Path('.agents/skills/moluoxixi-start')
            write(self.project, (legacy / 'SKILL.md').as_posix(), b'original legacy skill')
            write(self.project, '.codex/hooks.json', b'original managed hook')
            write(self.project, 'AGENTS.md', b'original project instructions')
            write(self.project, '.requirements/archive/history/evidence/check.log', b'original receipt\x00')
            original = snapshot(self.project)
            files = {Path('AGENTS.md'): b'new project instructions', Path('.codex/hooks.json'): None}
            moves = [(legacy, installer.ARCHIVE / legacy)]

            def abort():
                raise ValueError('requested rollback')

            index = len(windows)
            with patch.object(Path, 'replace', record_before_replace):
                if rollback:
                    with self.assertRaisesRegex(ValueError, 'requested rollback'):
                        installer.apply(self.project, files, moves, after_apply=abort)
                else:
                    installer.apply(self.project, files, moves)
            for mirror, stage_name, previous, proposed in windows[index:]:
                with self.subTest(previous=previous, proposed=proposed):
                    stage = mirror / '.requirements' / stage_name
                    self.assertEqual(installer.recover_stage(mirror, stage)['action'], 'rolled_back')
                    self.assertEqual(snapshot(mirror), original)

        self.assertTrue(any(b['phase'] == 'committed' for _, _, _, b in windows))
        self.assertTrue(any(b['phase'] == 'rolled_back' for _, _, _, b in windows))
        self.assertTrue(any(b['directories'] != a['directories'] for _, _, a, b in windows))
        self.assertTrue(any(b['moves'] and b['moves'][0]['state'] == 'applied' for _, _, _, b in windows))
        self.assertTrue(any(b['files'] and b['files'][-1]['post'] is None and b['files'][-1]['state'] == 'applied'
                            for _, _, _, b in windows))

    def test_cleanup_can_be_interrupted_twice_without_reopening_finished_rollback(self):
        protected = self.installed_project()
        source = self.release()
        victim = '.agents/skills/requirement-flow/runtime/theme.css'
        original = (self.project / victim).read_bytes()
        stage = self.interrupt(source, 'new', victim)
        self.assertEqual(self.interrupt(source, 'cleanup-new-file', victim), stage)
        restored = json.loads((stage / installer.JOURNAL).read_bytes())
        self.assertEqual(restored['phase'], 'rolled_back')
        self.assertEqual((self.project / victim).read_bytes(), original)
        self.assertEqual(self.interrupt(source, 'cleanup-restored-journal', victim), stage)
        self.assertEqual(list(stage.iterdir()), [])
        self.assertEqual((self.project / victim).read_bytes(), original)
        self.assertEqual(self.cli(source, 'upgrade')['recovered'], [{'stage': stage.name, 'action': 'cleaned'}])
        self.assertFalse(stage.exists())
        self.assertFalse(self.cli(source, 'upgrade')['changed'])
        self.assert_protected(protected)

    def test_upgrade_recovers_old_new_manifest_and_page_rename_windows(self):
        protected = self.installed_project()
        theme = ".agents/skills/requirement-flow/runtime/theme.css"
        for mode, victim in (("old", theme), ("new", theme), ("old", ".requirements/installation.json"),
                             ("new", ".requirements/installation.json"),
                             ("old", ".requirements/active/live/handbook.html"),
                             ("new", ".requirements/active/live/handbook.html")):
            with self.subTest(mode=mode, victim=victim):
                source = self.release()
                old = (self.project / victim).read_bytes()
                old_manifest = (self.project / installer.MANIFEST).read_bytes()
                stage = self.interrupt(source, mode, victim)
                journal = json.loads((stage / installer.JOURNAL).read_bytes())
                operation = next(op for op in journal["files"] if op["path"] == victim)
                n = journal["files"].index(operation)
                self.assertEqual((stage / f"old-{n}").read_bytes(), old)
                if victim == installer.MANIFEST.as_posix():
                    self.assertEqual((stage / f"old-{n}").read_bytes(), old_manifest)
                if mode == "old":
                    self.assertFalse((self.project / victim).exists())
                self.assertNotIn("old evidence", (stage / installer.JOURNAL).read_text())
                self.assert_protected(protected)
                # init must recover even when the manifest was temporarily moved out.
                result = self.cli(source, "init")
                self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "rolled_back"}])
                self.assertFalse(stage.exists())
                self.assertEqual((self.project / theme).read_bytes(), (source / "runtime/theme.css").read_bytes())
                self.assertIn(f"release {self.release_number}".encode(),
                              (self.project / ".requirements/active/live/handbook.html").read_bytes())
                self.assert_protected(protected)
                self.assertFalse(self.cli(source, "upgrade")["changed"])

    def test_upgrade_direct_retry_recovers_a_missing_manifest_under_task_locks(self):
        from flow import project_lock as store_lock

        protected = self.installed_project()
        source = self.release()
        stage = self.interrupt(source, "old", installer.MANIFEST.as_posix())
        before = snapshot(self.project)
        with store_lock(self.project / ".requirements", "live"):
            self.cli(source, "upgrade", ok=False)
        self.assertEqual(snapshot(self.project), before)
        self.assertTrue(stage.is_dir())
        result = self.cli(source, "upgrade")
        self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "rolled_back"}])
        self.assertFalse(stage.exists())
        self.assert_protected(protected)
        self.assertFalse(self.cli(source, "upgrade")["changed"])

    def test_interrupted_recovery_can_resume_both_rollback_renames(self):
        protected = self.installed_project()
        victim = ".agents/skills/requirement-flow/runtime/theme.css"
        for mode in ("rollback-gap", "rollback-old"):
            with self.subTest(mode=mode):
                source = self.release()
                stage = self.interrupt(source, "new", victim)
                again = self.interrupt(source, mode, victim)
                self.assertEqual(again, stage)
                self.assertEqual(json.loads((stage / installer.JOURNAL).read_bytes())["phase"], "rolling_back")
                result = self.cli(source, "init")
                self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "rolled_back"}])
                self.assertFalse(stage.exists())
                self.assert_protected(protected)

    def test_rollback_cleanup_interruption_retains_plan_until_directories_are_removed(self):
        for mode in ("cleanup-directory", "cleanup-journal", "cleanup-stage"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory(dir=self.base) as directory:
                self.project = Path(directory)
                history = {".requirements/archive/history/evidence/output.bin": b"history\x00\xff"}
                write(self.project, next(iter(history)), next(iter(history.values())))
                stage = self.interrupt(SKILL_SOURCE, "new", ".agents/skills/requirement-flow/SKILL.md")
                result = subprocess.run([sys.executable, "-B", "-c", CRASH, str(SKILL_SOURCE), str(self.project),
                                         mode, ".agents/skills/requirement-flow"],
                                        capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 71, result.stderr)
                if mode == "cleanup-directory":
                    self.assertTrue((stage / installer.JOURNAL).is_file())
                elif mode == "cleanup-journal":
                    self.assertTrue(stage.is_dir())
                    self.assertEqual(list(stage.iterdir()), [])
                else:
                    self.assertFalse(stage.exists())
                self.cli(SKILL_SOURCE, "init")
                self.assertFalse(stage.exists())
                self.assert_protected(history)
                self.assertFalse(self.cli(SKILL_SOURCE, "init")["changed"])

    def test_initial_install_recovers_new_directories_without_same_name_collision(self):
        history = {".requirements/archive/history/evidence/output.bin": b"historic\x00\xff\r\n"}
        write(self.project, next(iter(history)), next(iter(history.values())))
        victim = ".agents/skills/requirement-flow/SKILL.md"
        stage = self.interrupt(SKILL_SOURCE, "new", victim)
        self.assertFalse((self.project / installer.MANIFEST).exists())
        result = self.cli(SKILL_SOURCE, "init")
        self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "rolled_back"}])
        self.assert_protected(history)
        self.assertFalse(stage.exists())
        self.assertFalse(self.cli(SKILL_SOURCE, "init")["changed"])

    def test_migration_directory_move_recovers_and_retains_old_task_bytes(self):
        task = write(self.project, ".moluoxixi/tasks/old/evidence/output.bin", b"old result\xff\x00\r\n")
        skill = write(self.project, ".agents/skills/moluoxixi-start/SKILL.md", "legacy skill\r\n")
        original_task, original_skill = task.read_bytes(), skill.read_bytes()
        stage = self.interrupt(SKILL_SOURCE, "move", ".agents/skills/moluoxixi-start")
        self.assertFalse(skill.exists())
        result = self.cli(SKILL_SOURCE, "init", "--migrate")
        self.assertTrue(result["migrated"])
        self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "rolled_back"}])
        self.assertEqual(task.read_bytes(), original_task)
        archived = self.project / installer.ARCHIVE / ".agents/skills/moluoxixi-start/SKILL.md"
        self.assertEqual(archived.read_bytes(), original_skill)

    def test_committed_stage_is_finalized_not_rolled_back(self):
        protected = self.installed_project()
        source = self.release()
        stage = self.interrupt(source, "commit", ".agents/skills/requirement-flow/runtime/theme.css")
        before = {p: data for p, data in snapshot(self.project).items() if ".install-" not in p}
        result = self.cli(source, "upgrade")
        self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "committed"}])
        self.assertFalse(result["changed"])
        self.assertEqual(snapshot(self.project), before)
        self.assert_protected(protected)

    def test_user_edit_or_missing_backup_refuses_recovery_and_preserves_stage(self):
        for damage in ("edit", "missing-backup", "removed-target", "symlink"):
            with self.subTest(damage=damage), tempfile.TemporaryDirectory(dir=self.base) as directory:
                self.project = Path(directory)
                protected = self.installed_project()
                source = self.release()
                victim = ".agents/skills/requirement-flow/runtime/theme.css"
                stage = self.interrupt(source, "new", victim)
                journal = json.loads((stage / installer.JOURNAL).read_bytes())
                n = next(n for n, op in enumerate(journal["files"]) if op["path"] == victim)
                backup = stage / f"old-{n}"
                old = backup.read_bytes()
                target = self.project / victim
                if damage == "edit":
                    target.write_bytes(b"user later change\n")
                elif damage == "missing-backup":
                    backup.unlink()
                elif damage == "removed-target":
                    target.unlink()
                else:
                    target.unlink()
                    target.symlink_to(source / "runtime/theme.css")
                before = snapshot(self.project)
                result = self.cli(source, "init", ok=False)
                self.assertIn("保留 stage 和备份", result.stderr)
                self.assertEqual(snapshot(self.project), before)
                self.assertTrue(stage.is_dir())
                if damage != "missing-backup":
                    self.assertEqual(backup.read_bytes(), old)
                self.assert_protected(protected)

    def test_unknown_legacy_or_unsafe_journal_stage_is_never_deleted(self):
        for damage in ("legacy", "traversal", "unowned", "stage-symlink", "backup-symlink"):
            with self.subTest(damage=damage), tempfile.TemporaryDirectory(dir=self.base) as directory:
                self.project = Path(directory)
                self.installed_project()
                source = self.release()
                victim = ".agents/skills/requirement-flow/runtime/theme.css"
                if damage == "legacy":
                    stage = self.project / ".requirements/.install-legacy"
                    write(stage, "old-0", b"only old backup\x00")
                else:
                    stage = self.interrupt(source, "new", victim)
                    journal_path = stage / installer.JOURNAL
                    journal = json.loads(journal_path.read_bytes())
                    if damage in ("traversal", "unowned"):
                        journal["files"][0]["path"] = "../outside" if damage == "traversal" else ".requirements/active/live/model.json"
                        journal_path.write_text(json.dumps(journal))
                    elif damage == "stage-symlink":
                        relocated = stage.with_name("retained-stage")
                        stage.rename(relocated)
                        stage.symlink_to(relocated, target_is_directory=True)
                    else:
                        backup = next(stage.glob("old-*"))
                        backup.unlink()
                        backup.symlink_to(source / "SKILL.md")
                before = snapshot(self.project)
                result = self.cli(source, "init", ok=False)
                self.assertIn("保留 stage 和备份", result.stderr)
                self.assertEqual(snapshot(self.project), before)
                self.assertTrue(stage.exists())

    def test_missing_manifest_recovery_respects_an_existing_task_lease(self):
        from flow import project_lock as store_lock

        protected = self.installed_project()
        source = self.release()
        stage = self.interrupt(source, "old", installer.MANIFEST.as_posix())
        before = snapshot(self.project)
        with store_lock(self.project / ".requirements", "live"):
            self.cli(source, "init", ok=False)
        self.assertEqual(snapshot(self.project), before)
        self.assertTrue(stage.is_dir())
        result = self.cli(source, "init")
        self.assertEqual(result["recovered"], [{"stage": stage.name, "action": "rolled_back"}])
        self.assert_protected(protected)

    def test_failed_ordinary_rollback_does_not_auto_delete_the_only_backup(self):
        self.installed_project()
        source = self.release()
        victim = self.project / ".agents/skills/requirement-flow/runtime/theme.css"
        old = victim.read_bytes()

        def fail_after_user_edit():
            victim.write_bytes(b"concurrent manual edit\n")
            raise OSError("render failed after target edit")

        with patch.object(installer, "SOURCE", source):
            with self.assertRaisesRegex(ValueError, "保留 stage 和备份"):
                installer.install_locked(self.project, False, after_apply=fail_after_user_edit)
        stage = next((self.project / ".requirements").glob(".install-*"))
        self.assertIn(old, [p.read_bytes() for p in stage.glob("old-*")])
        self.assertEqual(victim.read_bytes(), b"concurrent manual edit\n")


if __name__ == "__main__":
    unittest.main()
