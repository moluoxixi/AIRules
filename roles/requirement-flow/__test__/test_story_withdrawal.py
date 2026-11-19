"""Withdraw whole stories through the public CLI without fabricating acceptance."""
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

FLOW = Path(__file__).resolve().parents[1] / 'skills/requirement-flow/flow.py'


class ScopeProject:
    def __init__(self, root, outcome='delivery'):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / 'check.py').write_text("assert 2 + 2 == 4\nprint('saved value reread: 4')\n", encoding='utf-8')
        self.cli('new', 'scope', '--request', '本期保存记录，导出功能可由产品决定延期', '--outcome', outcome)
        self.story = {'title': '导出记录', 'actor': '运营', 'goal': '导出记录', 'examples': [
            {'id': 'AC-export', 'given': '有一条记录', 'when': '导出', 'then': '导出内容正确'}]}
        self.action = {'title': '核验导出', 'kind': '验证', 'stories': ['S-export'], 'read_stories': ['S-export'],
                       'contracts': [], 'decisions': [], 'depends_on': [{'id': 'A-intake'}],
                       'covers': ['AC-export'], 'done': '核对导出内容', 'accepts': ['自动化']}
        self.plan({'stories': {'S-export': self.story}, 'actions': {'A-export': self.action},
                   'decisions': {'D-scope': {'title': '导出是否本期交付', 'owner': '产品负责人', 'why': '按期交付',
                       'stories': ['S-export'], 'options': {
                           'keep': {'label': '本期交付', 'consequence': '核验导出'},
                           'defer': {'label': '后续交付', 'consequence': '本期撤出导出'}}}}})
        self.write('finish', 'A-intake', '--output', '已明确功能、验收和决定', '--evidence', '原始需求')

    def cli(self, *args, ok=True):
        r = subprocess.run([sys.executable, '-B', str(FLOW), '--project', str(self.root), *map(str, args)],
                           cwd=self.root, capture_output=True, text=True, timeout=30)
        if (r.returncode == 0) != ok:
            raise AssertionError(f'{args}: {r.returncode}\n{r.stdout}\n{r.stderr}')
        return r

    def queue(self):
        return json.loads(self.cli('task', 'scope', 'next').stdout)

    def write(self, command, *args, ok=True):
        return self.cli('task', 'scope', command, '--rev', self.queue()['revision'], '--actor', '产品负责人', *args, ok=ok)

    def plan(self, patch, ok=True):
        path = self.root / '.requirements/patch.json'
        path.write_text(json.dumps(patch, ensure_ascii=False), encoding='utf-8')
        return self.write('plan', path, '--why', '按产品决定维护本期范围', ok=ok)

    def decide(self, choice):
        self.write('decision', 'D-scope', choice, '--why', '产品确认本期范围')

    def withdraw(self):
        self.decide('defer')
        self.plan({'stories': {'S-export': {**self.story, 'examples': []}},
                   'actions': {'A-export': {**self.action, 'covers': []}},
                   'retire_scenarios': {'AC-export': {'decision': 'D-scope', 'is': 'defer'}}})

    def verify(self, action='A-export', scenario='AC-export'):
        self.write('verify-run', action, '--scenario', scenario, '--environment', '本地记录回读',
                   '--', sys.executable, '-B', 'check.py')
        self.write('finish', action, '--output', '实际断言通过')

    def embedded(self):
        text = (self.root / '.requirements/active/scope/handbook.html').read_text(encoding='utf-8')
        return json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', text)[1])


class StoryWithdrawalTest(unittest.TestCase):
    def project(self, outcome='delivery'):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        return ScopeProject(Path(folder.name), outcome)

    def test_new_empty_stories_and_missing_decisions_cannot_bypass_acceptance(self):
        p = self.project()
        result = p.plan({'stories': {'S-empty': {**p.story, 'examples': []}}}, ok=False)
        self.assertIn('验收例子', result.stderr)
        result = p.plan({'stories': {'S-export': {**p.story, 'examples': []}},
                         'actions': {'A-export': {**p.action, 'covers': []}},
                         'retire_scenarios': {'AC-export': {'decision': 'D-scope', 'is': 'defer'}}}, ok=False)
        self.assertIn('已作出的业务决定', result.stderr)
        self.assertNotEqual(p.queue()['state'], 'complete')

    def test_empty_initial_delivery_does_not_become_complete(self):
        p = self.project()
        p.cli('new', 'empty', '--request', '尚未拆出故事')
        p.cli('task', 'empty', 'finish', 'A-intake', '--rev', 1, '--actor', '产品',
              '--output', '仅讨论', '--evidence', '需求原话')
        self.assertEqual(json.loads(p.cli('task', 'empty', 'next').stdout)['state'], 'unplanned')

    def test_whole_story_withdrawal_is_complete_but_never_verified_and_can_archive(self):
        for outcome in ('delivery', 'research'):
            with self.subTest(outcome=outcome):
                p = self.project(outcome)
                p.withdraw()
                queue = p.queue()
                self.assertEqual(queue['state'], 'complete')
                self.assertEqual(queue['progress']['withdrawn_stories'], ['S-export'])
                self.assertEqual(queue['progress']['verified_stories'], [])
                self.assertEqual(queue['progress']['unverified_stories'], [])
                self.assertEqual(queue['scenarios'], [])
                self.assertEqual(queue['retired_scenarios'][0]['answer']['actor'], '产品负责人')
                data = p.embedded()
                node = next(n for n in data['graph']['nodes'] if n['id'] == 'S-export')
                self.assertEqual(node['state'], '本期已撤出')
                self.assertEqual(data['states']['A-export']['state'], 'skipped')
                self.assertEqual((data['catalog_card']['basis'], data['catalog_card']['passed'], data['catalog_card']['total']),
                                 ('withdrawn', 0, 0))
                context = json.loads(p.cli('task', 'scope', 'context', 'S-export').stdout)
                self.assertEqual(context['withdrawn_stories'], ['S-export'])
                self.assertEqual(context['actions']['A-export']['state'], 'skipped')
                self.assertEqual(json.loads(p.cli('task', 'scope', 'next', '--story', 'S-export').stdout)['state'], 'complete')
                p.cli('archive', 'scope')
                p.cli('task', 'scope', '--check')
                self.assertEqual(p.queue()['state'], 'complete')

    def test_covers_must_be_updated_explicitly_in_withdrawal_patch(self):
        p = self.project()
        p.decide('defer')
        result = p.plan({'stories': {'S-export': {**p.story, 'examples': []}},
                         'retire_scenarios': {'AC-export': {'decision': 'D-scope', 'is': 'defer'}}}, ok=False)
        self.assertIn('covers', result.stderr)
        self.assertEqual(p.queue()['progress']['withdrawn_stories'], [])

    def test_decision_reversal_restores_uncovered_then_requires_new_receipt(self):
        p = self.project()
        p.decide('keep')
        p.verify()
        old = p.queue()['scenarios'][0]['receipts'][0]['id']
        p.withdraw()
        p.decide('keep')
        queue = p.queue()
        self.assertNotEqual(queue['state'], 'complete')
        self.assertEqual(queue['progress']['withdrawn_stories'], [])
        self.assertEqual(queue['scenarios'][0]['status'], 'uncovered')
        self.assertEqual(queue['scenarios'][0]['receipts'], [])
        p.cli('archive', 'scope', ok=False)
        p.plan({'stories': {'S-export': p.story}, 'actions': {'A-export': p.action}})
        self.assertEqual(p.queue()['scenarios'][0]['status'], 'stale')
        p.write('finish', 'A-export', '--output', '沿用历史验收', ok=False)
        p.verify()
        self.assertEqual(p.queue()['state'], 'complete')
        self.assertNotEqual(p.queue()['scenarios'][0]['receipts'][0]['id'], old)
        self.assertTrue(p.queue()['retired_scenarios'])

    def test_partial_withdrawal_keeps_remaining_work_and_shared_dependencies(self):
        p = self.project()
        save = {**p.story, 'title': '保存记录', 'examples': [
            {'id': 'AC-save', 'given': '记录有效', 'when': '保存', 'then': '数据可回读'}]}
        check = {**p.action, 'stories': ['S-save'], 'read_stories': ['S-save'], 'covers': ['AC-save']}
        shared = {**check, 'title': '共享查询', 'kind': '开发', 'covers': [], 'stories': ['S-export', 'S-save'],
                  'read_stories': ['S-export', 'S-save']}
        p.plan({'stories': {'S-save': save}, 'actions': {'A-save': check, 'A-shared': shared}})
        p.withdraw()
        self.assertNotEqual(p.queue()['state'], 'complete')
        self.assertIn('S-save', p.queue()['progress']['unverified_stories'])
        self.assertIn('A-shared', p.queue()['ready'])
        p.write('finish', 'A-shared', '--output', '共享查询仍服务保存', '--evidence', '调用方核对')
        p.verify('A-save', 'AC-save')
        queue = p.queue()
        self.assertEqual(queue['state'], 'complete')
        self.assertEqual(queue['progress']['verified_stories'], ['S-save'])
        self.assertEqual(queue['progress']['withdrawn_stories'], ['S-export'])
        self.assertEqual(p.embedded()['catalog_card']['total'], 1)
        p.plan({'actions': {'A-save': {**check, 'depends_on': [{'id': 'A-export'}]}}})
        self.assertEqual(p.queue()['state'], 'waiting')
        self.assertNotEqual(p.queue()['scenarios'][0]['status'], 'passed')

    def test_unanswered_decision_for_withdrawn_only_story_does_not_block_delivery(self):
        p = self.project()
        p.plan({'decisions': {'D-format': {'title': '导出格式', 'owner': '产品', 'why': '格式选择',
            'stories': ['S-export'], 'options': {'csv': {'label': 'CSV', 'consequence': '逗号分隔'},
                                               'xls': {'label': 'XLS', 'consequence': '表格'}}}}})
        p.withdraw()
        self.assertEqual(p.queue()['pending_decisions'], [])
        self.assertEqual(p.queue()['state'], 'complete')
        p.decide('keep')
        self.assertIn('D-format', [d['id'] for d in p.queue()['pending_decisions']])


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--prepare':
        project = ScopeProject(sys.argv[2])
        project.withdraw()
        print(json.dumps({'root': str(project.root), 'task': 'scope'}))
    else:
        unittest.main()
