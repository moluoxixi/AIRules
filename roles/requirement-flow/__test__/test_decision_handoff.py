"""Keep the active branch, business decision history and actual operator in sync."""
import json
from pathlib import Path
import subprocess
import sys

from test_state_machine import StateFixture, sync


def decision(title):
    return {'title': title, 'owner': '主管', 'why': '确定本期交付', 'stories': ['S-save'],
            'options': {'a': {'label': '甲', 'consequence': '按甲执行'}, 'b': {'label': '乙', 'consequence': '按乙执行'}}}


class DecisionHandoffTest(StateFixture):
    def task_cli(self, *args, ok=True):
        flow = Path(__file__).resolve().parents[1] / 'skills/requirement-flow/flow.py'
        result = subprocess.run([sys.executable, '-B', str(flow), '--project', str(self.project),
                                 'task', 'save', *args], text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, ok, (result.stdout, result.stderr))
        return result

    def decide(self, key, choice, reason='已与业务核对', actor='主管'):
        return self.write(lambda w: sync.decide(w, key, choice, reason, actor))

    def test_skipped_consumers_do_not_block_delivery_but_decision_returns_with_branch(self):
        manual = {**self.verify_action, 'when': {'decision': 'D-mode', 'is': 'a'}}
        device = {**self.verify_action, 'when': {'decision': 'D-mode', 'is': 'b'}, 'decisions': ['D-device']}
        self.plan({'decisions': {'D-mode': decision('录入方式'), 'D-device': decision('设备型号')},
                   'actions': {'A-verify': manual, 'A-device': device}})
        self.decide('D-mode', 'a')
        self.capture()
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'], 'complete')
        self.assertEqual(self.queue()['pending_decisions'], [])
        self.assertNotIn('D-device', self.work()['answers'])
        graph = sync.graph_view.make_graph(self.work(), sync.evaluate(self.work()), self.queue()['scenarios'])
        node = next(n for n in graph['nodes'] if n['id'] == 'D-device')
        self.assertEqual(node['state'], '当前分支不涉及')
        self.decide('D-mode', 'b')
        self.assertEqual(self.queue()['state'], 'waiting')
        self.assertEqual([d['id'] for d in self.queue()['pending_decisions']], ['D-device'])
        self.assertEqual(self.queue()['pending_decisions'][0]['actions'], ['A-device'])

    def test_standalone_and_shared_decisions_still_require_answers(self):
        consumer = {**self.verify_action, 'decisions': ['D-shared']}
        skipped = {**consumer, 'when': {'decision':'D-mode','is':'b'}}
        self.plan({'decisions': {k: decision(k) for k in ('D-mode','D-alone','D-shared')},
                   'actions': {'A-verify': consumer, 'A-other': skipped}})
        self.decide('D-mode', 'a')
        self.assertEqual({d['id'] for d in self.queue()['pending_decisions']}, {'D-alone','D-shared'})

    def test_story_query_excludes_decision_required_only_by_other_story(self):
        other = {**self.work()['stories']['S-save'], 'examples': [
            {'id':'AC-other','given':'设备已安装','when':'读取','then':'看到重量'}]}
        skipped = {**self.verify_action, 'when': {'decision':'D-mode','is':'b'}, 'decisions':['D-device']}
        required = {**self.verify_action, 'stories':['S-other'],'read_stories':['S-other'],
                    'covers':['AC-other'],'decisions':['D-device']}
        shared = {**decision('设备型号'), 'stories':['S-save','S-other']}
        self.plan({'stories':{'S-other':other},'decisions':{'D-mode':decision('方式'),'D-device':shared},
                   'actions':{'A-skipped':skipped,'A-other':required}})
        self.decide('D-mode','a')
        self.capture()
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'],'waiting')
        self.assertEqual(sync.dispatch(self.work(),story='S-save')['state'],'complete')

        def assert_story_projection(expected):
            work = self.work()
            self.assertNotIn('story_queues', sync.dispatch(work, for_map=True, include_lessons=False))
            page = sync.dispatch(work, for_map=True, include_lessons=False, include_story_queues=True)
            actual = {story: [row['id'] for row in sync.dispatch(work, story=story, include_lessons=False)['pending_decisions']]
                      for story in work['stories']}
            self.assertEqual(actual, expected)
            self.assertEqual({story: scope['pending_decisions'] for story, scope in page['story_queues'].items()}, actual)

        assert_story_projection({'S-save': [], 'S-other': ['D-device']})
        self.plan({'decisions': {'D-alone': decision('独立业务约定')}})
        alone = sync.dispatch(self.work(), story='S-save')['pending_decisions']
        self.assertEqual([(row['id'], row['actions']) for row in alone], [('D-alone', [])])
        assert_story_projection({'S-save': ['D-alone'], 'S-other': ['D-device']})
        self.decide('D-alone', 'a')
        downstream = {**self.work()['actions']['A-contract'], 'title': '汇总下游验证', 'closes_contracts': [],
                      'depends_on': [{'id': 'A-other', 'when': {'decision': 'D-mode', 'is': 'a'}}]}
        self.plan({'actions': {'A-join': downstream}})
        # A conditionally active dependency may bring the other story's decision into scope.
        assert_story_projection({'S-save': ['D-device'], 'S-other': ['D-device']})
        self.decide('D-device', 'a')
        assert_story_projection({'S-save': [], 'S-other': []})

    def test_reason_amendment_preserves_proof_and_retry_is_idempotent(self):
        self.plan({'decisions': {'D': decision('使用甲或乙')},
                   'actions': {'A-verify': {**self.verify_action, 'decisions': ['D']}}})
        self.decide('D', 'a', '备货充足')
        self.capture()
        self.finish('A-verify')
        receipt = self.queue()['scenarios'][0]['receipts'][0]['id']
        original = self.work()['revision']
        def amend(revision):
            self.task_cli('decision','D','a','--actor','业务代表','--why','合同要求','--rev',str(revision))
        amend(original)
        work = self.work()
        self.assertEqual(work['revision'], original+1)
        answer = work['answers']['D']
        self.assertEqual((answer['choice'],answer['version'],answer['actor'],answer['reason']), ('a',1,'主管','合同要求'))
        self.assertEqual(self.queue()['state'], 'complete')
        self.assertEqual(self.queue()['scenarios'][0]['receipts'][0]['id'], receipt)
        event = work['events'][-1]
        self.assertEqual((event['kind'],event['actor'],event['previous_reason'],event['output']),
                         ('decision_reason','业务代表','备货充足','合同要求'))
        amend(work['revision'])
        self.assertEqual(self.work()['events'],work['events'])
        self.decide('D','b')
        self.assertEqual(self.work()['answers']['D']['version'], 2)
        self.assertEqual(self.queue()['scenarios'][0]['status'], 'stale')

    def test_active_action_transfers_atomically_and_old_owner_cannot_finish(self):
        sync.claim(self.work()['revision'], 'alice')
        current = self.work()['revision']
        args = ['handoff','A-verify','--from','alice','--actor','bob','--why','夜班接手','--rev',str(current)]
        self.task_cli(*args[:-1], str(current-1), ok=False)
        self.task_cli('handoff','A-verify','--from','other','--actor','bob','--why','交班','--rev',str(current),ok=False)
        self.assertEqual(self.work()['revision'],current)
        self.task_cli(*args)
        self.task_cli(*args,ok=False)
        work=self.work()
        self.assertEqual(work['revision'],current+1)
        event=work['events'][-1]
        self.assertEqual((event['kind'],event['previous_actor'],event['actor'],event['output']),
                         ('handoff','alice','bob','夜班接手'))
        resumed = json.loads(self.task_cli('next','--actor','bob').stdout)
        self.assertEqual((resumed['state'],resumed['next']['id']),('resume','A-verify'))
        failed = self.task_cli('finish','A-verify','--actor','alice','--rev',str(work['revision']),'--output','已完成',ok=False)
        self.assertIn('bob',failed.stderr)
        sync.capture('verify-run', 'A-verify','AC-save',work['revision'],'bob','本地',
                     argv=[sys.executable, '-B','check.py'])
        self.task_cli('finish','A-verify','--actor','bob','--rev',str(self.work()['revision']),'--output','已完成')
        self.assertEqual(self.queue()['state'],'complete')

    def test_independent_diagnosis_cannot_be_handed_to_original_verifier(self):
        (self.project/'check.py').write_text("raise AssertionError('两次相同失败')",encoding='utf-8')
        self.assertFalse(self.capture()['passed'])
        self.assertFalse(self.capture()['passed'])
        review = sync.claim(self.work()['revision'], 'reviewer')['claimed']
        self.assertTrue(self.work()['actions'][review]['review_for'])
        with self.assertRaisesRegex(sync.Invalid, '原失败执行者'):
            self.write(lambda w: sync.handoff(w,review,'reviewer','qa','交班'))
        self.write(lambda w: sync.handoff(w,review,'reviewer','new-reviewer','夜班继续诊断'))
        self.assertEqual(sync.evaluate(self.work())[review]['actor'],'new-reviewer')
