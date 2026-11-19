"""Repeated real failures must escalate despite timestamps and test-run durations."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/requirement-flow'))
from runtime import sync


class FailureFollowupsTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.project = Path(temp.name)
        self.addCleanup(sync.bind_workspace, sync.TASK_DIR)
        self.checker = self.project / 'check.py'
        self.saved = self.project / 'saved.json'
        self.saved.write_text('false', encoding='utf-8')
        self.checker.write_text(
            "from datetime import datetime\nfrom pathlib import Path\nimport json, sys, unittest\n"
            "print(datetime.now().isoformat(), 'checking saved result')\n"
            "class Check(unittest.TestCase):\n"
            " def test_save(self): self.assertTrue(json.loads(Path('saved.json').read_text()), 'missing saved result')\n"
            "unittest.main(argv=[sys.argv[0]])\n", encoding='utf-8')
        task = self.project / '.requirements/active/save'
        sync.initialize_task(task, '保存后可以回读', key='save')
        sync.bind_workspace(task)
        self.commit(lambda w: sync.apply_plan(w, {
            'stories': {'S-save': {'title': '保存', 'actor': '用户', 'goal': '回读结果', 'examples': [
                {'id': 'AC-save', 'given': '记录有效', 'when': '保存后重开', 'then': '值一致'}]}},
            'actions': {'A-check': {'title': '验证回读', 'kind': '验证', 'stories': ['S-save'],
                'read_stories': ['S-save'], 'contracts': [], 'decisions': [], 'depends_on': [],
                'covers': ['AC-save'], 'code_paths': ['check.py'], 'done': '回读一致'}},
        }, 'planner', '增加独立回读验证'))

    def work(self):
        return sync.load()['work']

    def commit(self, fn):
        return sync.commit(self.work()['revision'], fn)

    def collect(self, environment='local', extra=()):
        result = sync.capture('verify-run', 'A-check', 'AC-save', self.work()['revision'],
                              'qa', environment, argv=[sys.executable, '-B', 'check.py', *extra])
        queue = sync.dispatch(self.work(), include_lessons=False)
        return result, queue['verification_followups']

    def test_dynamic_test_output_does_not_reset_consecutive_failures(self):
        artifacts = []
        events = []
        for index in range(2):
            result, followups = self.collect()
            self.assertFalse(result['passed'])
            artifacts.append(result['artifact']['sha256'])
            events.append(result['id'])
            self.assertEqual(followups[0]['receipts'], events)
            self.assertEqual(followups[0]['step'], 'diagnose' if index == 0 else 'independent_review')
        self.assertEqual(len(set(artifacts)), 2, 'Each real test log contains a different timestamp')

    def test_changed_command_environment_or_code_starts_a_new_failure_series(self):
        self.collect()
        for kwargs in ({'extra': ('new-case',)}, {'extra': ('new-case',), 'environment': 'uat'}):
            result, followups = self.collect(**kwargs)
            self.assertEqual(followups[0]['receipts'], [result['id']])
            self.assertEqual(followups[0]['step'], 'diagnose')
        self.checker.write_text(self.checker.read_text() + '\n# Fix attempt changes the tested input.\n')
        result, followups = self.collect(extra=('new-case',), environment='uat')
        self.assertEqual(followups[0]['receipts'], [result['id']])
        self.assertEqual(followups[0]['step'], 'diagnose')

    def test_success_breaks_the_failure_series(self):
        self.collect()
        original = self.work()['events'][-1]['receipt']
        # Business data changes, while the implementation, command and environment stay fixed.
        self.saved.write_text('true', encoding='utf-8')
        result, followups = self.collect()
        self.assertTrue(result['passed'])
        success = self.work()['events'][-1]['receipt']
        self.assertEqual((success['code_inputs'], success['argv'], success['environment']),
                         (original['code_inputs'], original['argv'], original['environment']))
        self.assertEqual(followups, [])
        self.saved.write_text('false', encoding='utf-8')
        result, followups = self.collect()
        self.assertEqual(followups[0]['receipts'], [result['id']])
        self.assertEqual(followups[0]['step'], 'diagnose')

    def test_successful_observation_resets_failures_with_no_command_or_exit_code(self):
        artifact = self.project / 'observation.txt'
        artifact.write_text('保存结果的人工核对记录', encoding='utf-8')
        def observe(passed):
            result = sync.capture('verify-observe', 'A-check', 'AC-save', self.work()['revision'],
                                  'observer', 'local', artifact='observation.txt', level='人工核对',
                                  actual='回读符合预期' if passed else '回读缺少记录', passed=passed)
            return result, sync.dispatch(self.work(), include_lessons=False)['verification_followups']
        _, followups = observe(False)
        self.assertEqual(followups[0]['step'], 'diagnose')
        result, followups = observe(True)
        self.assertTrue(result['passed'])
        self.assertEqual(followups, [])
        result, followups = observe(False)
        self.assertEqual(followups[0]['receipts'], [result['id']])
        self.assertEqual(followups[0]['step'], 'diagnose')


if __name__ == '__main__':
    unittest.main()
