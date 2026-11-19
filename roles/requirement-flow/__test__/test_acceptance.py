"""Run the save/connection-loss counterexample through the public project CLI."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from textwrap import dedent
import unittest

FLOW = Path(__file__).resolve().parents[1] / 'skills/requirement-flow/flow.py'


class AcceptanceTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.project = Path(temp.name)
        self.workdir = self.project / '.requirements/active/save'
        # A disposable consumer project supplies two independently runnable checks.
        (self.project / 'save_checks.py').write_text(dedent("""\
            import unittest
            from unittest.mock import Mock

            class SaveChecks(unittest.TestCase):
                def test_save(self):
                    records = {}
                    records['item'] = 'stored'
                    self.assertEqual(records['item'], 'stored')

                def test_retry(self):
                    send = Mock(side_effect=[ConnectionError('offline'), 'stored'])
                    with self.assertRaises(ConnectionError):
                        send('item')
                    self.assertEqual(send('item'), 'stored')
                    self.assertEqual(send.call_count, 2)
            """), encoding='utf-8')
        self.cli('new', 'save', '--request', '保存后回显，断网后可以重试')
        self.cases = [
            {'id': 'AC-save', 'given': '记录有效', 'when': '点击保存', 'then': '成功回显'},
            {'id': 'AC-retry', 'given': '网络中断', 'when': '恢复网络并重试', 'then': '保存成功'},
        ]
        self.plan(stories={'S-save': {'title': '保存', 'actor': '用户', 'goal': '保存记录', 'examples': self.cases}},
                  actions={'A-save': self.check('AC-save')})
        self.write('finish', 'A-intake', '--output', '明确两个场景', '--evidence', '需求原话')

    def cli(self, *args, ok=True):
        result = subprocess.run([sys.executable, '-B', str(FLOW), '--project', str(self.project), *map(str, args)],
                                capture_output=True, text=True, cwd=self.project, timeout=20)
        if ok:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def queue(self):
        return json.loads(self.cli('task', 'save', 'next').stdout)

    def write(self, cmd, *args, ok=True):
        return self.cli('task', 'save', cmd, '--rev', self.queue()['revision'], '--actor', '验收者', *args, ok=ok)

    def plan(self, ok=True, **records):
        plan = self.project / 'plan.json'
        plan.write_text(json.dumps(records, ensure_ascii=False), encoding='utf-8')
        return self.write('plan', plan, '--why', '维护场景与验证的关联', ok=ok)

    def check(self, scenario):
        return {'title': '核对 ' + scenario, 'kind': '验证', 'stories': ['S-save'], 'read_stories': ['S-save'],
                'decisions': [], 'contracts': [], 'depends_on': [{'id': 'A-intake'}], 'done': '符合预期',
                'covers': [scenario], 'accepts': ['自动化'], 'code_paths': ['save_checks.py']}

    def finish(self, action, ok=True):
        extras = () if ok else ('--evidence', 'missing-report.log', '--level', '自动化',
                                '--environment', '本机', '--expected', '符合预期')
        return self.write('finish', action, '--output', '通过', *extras, ok=ok)

    def collect(self, action, scenario, ok=True, fail=False):
        test = {'AC-save': 'test_save', 'AC-retry': 'test_retry'}[scenario]
        command = [sys.executable, '-m', 'unittest', '-v', f'save_checks.SaveChecks.{test}']
        if fail:
            command = [sys.executable, '-c', "raise AssertionError('重试未保存')"]
        return self.write('verify-run', action, '--scenario', scenario, '--environment', '本机',
                          '--', *command, ok=ok)

    def statuses(self):
        return {s['id']: s['status'] for s in self.queue()['scenarios']}

    def test_relocated_sources_keep_evidence_and_archived_model_intact(self):
        import re
        old, new = 'notes/保存.md:9', 'history/保存.md:9'
        story = json.loads((self.workdir / 'model.json').read_text())['work']['stories']['S-save']
        case = self.check('AC-retry')
        case['contracts'] = ['C-save']
        contract = {'title': '保存服务', 'operation': 'POST /save', 'state': 'confirmed',
                    'source': old, 'status': '已对接', 'fields': []}
        self.plan(stories={'S-save': {**story, 'basis': old}}, contracts={'C-save': contract},
                  actions={'A-retry': case})
        self.collect('A-save', 'AC-save')
        self.finish('A-save')
        current = self.workdir / 'model.json'
        immutable = {p: p.read_bytes() for p in [current, *(self.workdir / 'evidence').glob('*/*')]}
        store = self.project / '.requirements'
        (self.project / 'history').mkdir()
        (self.project / 'history/保存.md').write_text('已迁移需求')
        (store / 'source-paths.json').write_text(json.dumps({'version': 1, 'directories': {'notes/': 'history/'}}))
        (store / 'rules').mkdir()
        (store / 'rules/index.md').write_text('项目约定')
        packet = self.queue()['next']
        self.assertEqual(packet['inputs']['stories']['S-save']['basis'], new)
        self.assertEqual(packet['inputs']['contracts']['C-save']['source'], new)
        self.assertEqual(packet['project_rules'], '.requirements/rules/index.md')
        self.assertEqual(self.statuses()['AC-save'], 'passed')
        ctx = json.loads(self.cli('task', 'save', 'context').stdout)
        self.assertEqual((ctx['stories']['S-save']['basis'], ctx['contracts']['C-save']['source']), (new, new))
        self.assertEqual(ctx['project_rules'], packet['project_rules'])
        self.cli('task', 'save')
        page = (self.workdir / 'handbook.html').read_text()
        payload = json.loads(re.search(r'<script type="application/json" id="data">(.+?)</script>', page).group(1))
        self.assertEqual(payload['source_labels'][old], new)
        self.assertEqual(payload['model'], json.loads(current.read_bytes()))
        self.assertEqual(immutable, {p: p.read_bytes() for p in immutable})
        self.cli('archive', 'save', '--allow-incomplete')
        self.cli('task', 'save', '--check')
        archived = json.loads(self.cli('task', 'save', 'context').stdout)
        self.assertEqual(archived['stories']['S-save']['basis'], new)
        self.assertEqual(archived['scenarios'][0]['status'], 'passed')

    def test_repeated_failed_verification_routes_to_independent_diagnosis(self):
        for step in ('diagnose', 'independent_review'):
            self.collect('A-save', 'AC-save', ok=False, fail=True)
            followup, = self.queue()['verification_followups']
            self.assertEqual((followup['step'], followup['scenario']), (step, 'AC-save'))
            packet = self.queue()['next']
            self.assertEqual(packet['verification_followups'], [followup])
            self.assertEqual(packet['skill'], followup['skill'])
            if step == 'independent_review':
                self.assertEqual(packet['handoff']['receipts'], followup['receipts'])
                self.assertEqual(packet['handoff']['verification_actors'], ['验收者'])
            self.assertNotEqual(self.queue()['state'], 'complete')
        self.assertEqual(len(followup['receipts']), 2)
        revision = self.queue()['revision']
        handoff = json.loads(self.cli('task', 'save', 'claim', '--rev', revision, '--actor', '复核者').stdout)
        self.assertEqual(handoff['outcome'], 'claimed')
        self.assertEqual(handoff['next']['skill'], 'flow-review')
        self.assertEqual(handoff['next']['review_for']['receipts'], followup['receipts'])
        self.assertGreater(handoff['revision'], revision)
        self.collect('A-save', 'AC-save', ok=False)
        self.cli('task', 'save', 'finish', handoff['claimed'], '--rev', self.queue()['revision'], '--actor', '复核者',
                 '--output', '失败命令始终抛错，复核真实断网重试用例后改用对应测试', '--evidence', '原失败回执及 save_checks.py')
        self.collect('A-save', 'AC-save')
        self.finish('A-save')
        self.assertFalse(self.queue()['verification_followups'])
        self.assertEqual(self.statuses()['AC-retry'], 'uncovered')

    def test_removing_an_unverified_case_requires_a_recorded_scope_decision(self):
        self.collect('A-save', 'AC-save')
        self.finish('A-save')
        story = {'S-save': {'title': '保存', 'actor': '用户', 'goal': '保存记录', 'examples': self.cases[:1]}}
        revision = self.queue()['revision']
        self.plan(ok=False, stories=story)
        self.assertEqual(self.queue()['revision'], revision)
        self.assertEqual(self.statuses()['AC-retry'], 'uncovered')
        self.plan(decisions={'D-scope': {
            'title': '本期是否支持断网后重试？', 'owner': '产品负责人', 'why': '明确本期验收范围',
            'stories': ['S-save'], 'options': {
                'keep': {'label': '本期交付', 'consequence': '验收断网重试'},
                'defer': {'label': '后续交付', 'consequence': '本期保留在线保存'},
            },
        }})
        retirement = {'AC-retry': {'decision': 'D-scope', 'is': 'defer'}}
        self.plan(ok=False, stories=story, retire_scenarios=retirement)
        self.cli('task', 'save', 'decision', 'D-scope', 'defer', '--rev', self.queue()['revision'],
                 '--actor', '产品负责人', '--why', '分期交付，本期仅支持在线保存')
        self.plan(ok=False, stories=story, retire_scenarios={'AC-retry': {'decision': 'D-scope', 'is': 'keep'}})
        self.plan(stories=story, retire_scenarios=retirement)
        queue = self.queue()
        self.assertEqual(queue['state'], 'complete')
        self.assertEqual(self.statuses(), {'AC-save': 'passed'})
        retired, = queue['retired_scenarios']
        self.assertEqual((retired['id'], retired['then'], retired['answer']['actor']),
                         ('AC-retry', '保存成功', '产品负责人'))
        for decision, expected_state in [('keep', 'uncovered'), ('defer', None)]:
            self.cli('task', 'save', 'decision', 'D-scope', decision, '--rev', self.queue()['revision'],
                     '--actor', '产品负责人', '--why', '重新评估本期交付范围')
            self.assertEqual(self.statuses().get('AC-retry'), expected_state)
            self.assertEqual(self.queue()['state'] == 'complete', expected_state is None)
            if expected_state:
                self.cli('archive', 'save', ok=False)

    def test_research_with_an_explicit_scenario_cannot_ignore_it(self):
        self.cli('new', 'survey', '--request', '调研离线重试', '--outcome', 'research')
        plan = self.project / 'survey.json'
        plan.write_text(json.dumps({'stories': {'S-survey': {
            'title': '重试条件', 'actor': '业务人员', 'goal': '确认恢复结果', 'examples': self.cases[1:],
        }}}, ensure_ascii=False), encoding='utf-8')
        self.cli('task', 'survey', 'plan', plan, '--rev', 1, '--why', '明确需要实测的场景')
        self.cli('task', 'survey', 'finish', 'A-intake', '--rev', 2, '--actor', '调研者',
                 '--output', '已查认重试规则', '--evidence', '项目需求记录')
        result = json.loads(self.cli('task', 'survey', 'next').stdout)
        self.assertNotEqual(result['state'], 'complete')
        self.assertEqual(result['scenarios'][0]['status'], 'uncovered')
        self.assertEqual(result['review_skill'], 'flow-review')
        self.cli('archive', 'survey', ok=False)

    def test_missing_report_and_uncovered_retry_cannot_complete(self):
        self.assertFalse((self.project / 'missing-report.log').exists())
        self.finish('A-save', ok=False)
        self.assertNotEqual(self.queue()['state'], 'complete')
        self.assertEqual(self.statuses()['AC-retry'], 'uncovered')
        self.collect('A-save', 'AC-save')
        self.finish('A-save')
        self.assertEqual(self.statuses(), {'AC-save': 'passed', 'AC-retry': 'uncovered'})
        self.cli('archive', 'save', ok=False)
        self.plan(actions={'A-retry': self.check('AC-retry')})
        self.collect('A-retry', 'AC-retry', ok=False, fail=True)
        self.finish('A-retry', ok=False)
        self.assertNotEqual(self.queue()['state'], 'complete')
        self.collect('A-retry', 'AC-retry')
        self.finish('A-retry')
        self.assertEqual(self.queue()['state'], 'complete')
        self.assertEqual(self.statuses(), {'AC-save': 'passed', 'AC-retry': 'passed'})
        self.cli('archive', 'save')
        self.assertEqual(self.queue()['state'], 'complete')
        self.cli('task', 'save', '--check')
        saved = next(c for c in self.queue()['scenarios'] if c['id'] == 'AC-retry')
        archived_file = self.project / '.requirements/archive/save' / saved['receipts'][0]['artifact']['path']
        archived_file.unlink()
        self.assertIn('AC-retry', self.cli('task', 'save', '--check', ok=False).stderr)
        self.assertNotEqual(self.queue()['state'], 'complete')

    def test_changed_or_missing_output_invalidates_only_its_scenario(self):
        self.plan(actions={'A-retry': self.check('AC-retry')})
        for action, case in [('A-save', 'AC-save'), ('A-retry', 'AC-retry')]:
            self.collect(action, case)
            self.finish(action)
        self.assertEqual(self.queue()['state'], 'complete')
        receipt = next(s for s in self.queue()['scenarios'] if s['id'] == 'AC-save')['receipts'][-1]
        artifact = self.workdir / receipt['artifact']['path']
        original = artifact.read_bytes()
        for replacement in (b'changed', None):
            if replacement is None:
                artifact.unlink()
            else:
                artifact.write_bytes(replacement)
            self.assertNotEqual(self.queue()['state'], 'complete')
            self.assertNotEqual(self.statuses()['AC-save'], 'passed')
            self.assertEqual(self.statuses()['AC-retry'], 'passed')
            listing = json.loads(self.cli('list').stdout)['active'][0]
            self.assertNotEqual(listing['state'], 'complete')
            self.cli('archive', 'save', ok=False)
            artifact.write_bytes(original)
        self.assertEqual(self.queue()['state'], 'complete')
        artifact.unlink()
        self.cli('archive', 'save', '--allow-incomplete')
        self.assertNotEqual(self.queue()['state'], 'complete')
        self.cli('task', 'save', '--check')

    def test_changed_event_actor_cannot_replace_the_signed_observer(self):
        self.plan(actions={'A-retry': self.check('AC-retry')})
        for action, case in [('A-save', 'AC-save'), ('A-retry', 'AC-retry')]:
            self.collect(action, case)
            self.finish(action)
        self.assertEqual(self.queue()['state'], 'complete')
        model_path = self.workdir / 'model.json'
        model = json.loads(model_path.read_bytes())
        event = next(e for e in model['work']['events'] if e['kind'] == 'evidence' and e['scenario'] == 'AC-save')
        self.assertEqual(event['actor'], event['receipt']['actor'])
        event['actor'] = '从未参与的观察者'
        model_path.write_text(json.dumps(model, ensure_ascii=False), encoding='utf-8')
        queue = self.queue()
        rows = {case['id']:case for case in queue['scenarios']}
        self.assertEqual(rows['AC-save']['status'], 'stale')
        self.assertNotEqual(queue['state'], 'complete')
        self.assertEqual(rows['AC-retry']['status'], 'passed')

    def test_previous_success_cannot_be_replayed_over_a_later_failure(self):
        self.plan(actions={'A-retry': self.check('AC-retry')})
        for action, case in [('A-save', 'AC-save'), ('A-retry', 'AC-retry')]:
            self.collect(action, case)
            self.finish(action)
        self.assertEqual(self.queue()['state'], 'complete')
        self.collect('A-save', 'AC-save', fail=True, ok=False)
        self.assertEqual(self.statuses(), {'AC-save':'failed', 'AC-retry':'passed'})

        path = self.workdir / 'model.json'
        model = json.loads(path.read_bytes())
        work = model['work']
        previous = next(e for e in work['events'] if e['kind'] == 'evidence'
                        and e['scenario'] == 'AC-save' and e['receipt']['passed'])
        work['revision'] += 1
        repeated = {**previous, 'id': 'E' + str(len(work['events']) + 1), 'revision': work['revision']}
        work['events'].append(repeated)
        path.write_text(json.dumps(model, ensure_ascii=False), encoding='utf-8')
        before = path.read_bytes()
        self.cli('task','save','finish','A-save','--rev',work['revision'],'--actor','验收者',
                 '--output','沿用旧结果',ok=False)
        self.cli('archive','save',ok=False)
        self.assertEqual(path.read_bytes(), before)
