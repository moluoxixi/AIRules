"""Exercise the installed CLI after Git moves a requirement between active and archive."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from urllib.request import urlopen

from test_knowledge_flow import LESSON, Project, ROLE, SOURCE, TARGET
from test_worktree_evidence import git


class ArchivedWorktreeTest(unittest.TestCase):
    def test_direct_new_protects_signed_artifacts_before_installation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            git(root, 'init', '-q')
            entry = ROLE / 'skills/requirement-flow/flow.py'
            subprocess.run([sys.executable, '-B', str(entry), '--project', temp,
                            'new', 'checkout', '--request', '核对证据'], check=True, capture_output=True)
            for bucket in ('active', 'archive'):
                attachment = f'.requirements/{bucket}/checkout/evidence/capture/output.log'
                self.assertEqual(git(root, 'check-attr', 'text', '--', attachment).strip(),
                                 f'{attachment}: text: unset'.encode())

    def test_fast_forward_keeps_one_readable_archived_record_and_its_lesson(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            main = base / 'main'
            main.mkdir()
            git(main, 'init', '-q')
            git(main, 'config', 'core.autocrlf', 'true')
            attributes = main / '.requirements/.gitattributes'
            attributes.parent.mkdir()
            team_rules = b'# Team export rules\r\ninstallation.json export-ignore\r\n'
            attributes.write_bytes(team_rules)
            producer = Project(main)
            self.assertTrue(attributes.read_bytes().startswith(team_rules))
            for file in ('directory.py', 'test_directory.py'):
                # Keep the verified implementation identical in both Windows-style worktrees.
                source = main / file
                source.write_bytes(source.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
            producer.prepare_review()
            producer.review()
            git(main, 'add', '-A')
            git(main, 'commit', '-qm', 'capture reviewed lesson')
            other = base / 'second'
            git(main, 'worktree', 'add', '-qb', 'reader', str(other))
            reader = Project(other, installed=True)
            reader.cli('task', SOURCE, '--check')
            active = other / '.requirements/active' / SOURCE
            proof = next((active / 'evidence').glob('*/output.log'))
            self.assertEqual(proof.read_bytes(), (main / proof.relative_to(other)).read_bytes())
            original_proof = proof.read_bytes()
            proof.write_bytes(original_proof + b'\n')
            self.assertEqual(reader.next(SOURCE)['scenarios'][0]['status'], 'stale')
            proof.write_bytes(original_proof)
            book = active / 'handbook.html'
            original = book.read_bytes()
            self.assertIn(b'\r\n', original)
            book.write_bytes(original + b'<!-- incorrect page -->')
            reader.cli('task', SOURCE, '--check', ok=False)
            book.write_bytes(original)
            # A current reader keeps its lock outside the model directory. An older installed
            # reader may already have left this ignored byte before the worktree fast-forwards.
            lock = active / '.workflow.lock'
            self.assertFalse(lock.exists())
            lock.write_bytes(b'\0')
            producer.cli('archive', SOURCE)
            git(main, 'add', '-A')
            git(main, 'commit', '-qm', 'archive requirement')
            git(other, 'merge', '--ff-only', git(main, 'rev-parse', 'HEAD').decode().strip())
            self.assertEqual(list(active.iterdir()), [lock])
            rows = reader.data('list')
            self.assertEqual([row['id'] for row in rows['active']], [TARGET])
            self.assertEqual([row['id'] for row in rows['archive']], [SOURCE])
            self.assertIn('revision', reader.data('task', SOURCE, 'context'))
            reader.cli('task', SOURCE, '--check')
            self.assertEqual(reader.next(SOURCE)['state'], 'complete')
            card, = reader.data('lessons')['lessons']
            self.assertEqual((card['id'], card['bucket']), (LESSON, 'archive'))
            checked_out_rules = other / '.requirements/.gitattributes'
            installed_rules = checked_out_rules.read_bytes()
            for _ in range(2):
                self.assertNotIn(SOURCE, reader.data('upgrade')['refreshed'])
                self.assertEqual(checked_out_rules.read_bytes(), installed_rules)
            with reader.serve() as url:
                with urlopen(url + 'catalog.json', timeout=5) as response:
                    matches = [card for card in json.load(response)['tasks'] if card['id'] == SOURCE]
                self.assertEqual([(card['bucket'], card['href']) for card in matches],
                                 [('archive', f'/tasks/{SOURCE}/')])
                with urlopen(url + f'tasks/{SOURCE}/model.json', timeout=5) as response:
                    self.assertEqual(json.load(response)['work']['id'], SOURCE)
            # A second model is a genuine conflict. Lookup fails and no lesson is published.
            archived_model = other / '.requirements/archive' / SOURCE / 'model.json'
            (active / 'model.json').write_bytes(archived_model.read_bytes())
            result = subprocess.run(reader.command('task', SOURCE, 'context'), capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('重复', result.stderr)
            self.assertEqual(reader.data('lessons')['lessons'], [])
