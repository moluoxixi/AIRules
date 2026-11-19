"""Exercise contract ownership and actionable verification inputs on real task state."""
import copy
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/requirement-flow'))
from runtime import sync


class StateFixture(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.project = Path(temporary.name).resolve()
        self.addCleanup(sync.bind_workspace, sync.TASK_DIR)
        (self.project / 'save.py').write_text(
            "def save(records, key, value):\n records[key] = value\n return records[key]\n", encoding='utf-8')
        (self.project / 'check.py').write_text(
            "from save import save\nrecords = {}\nassert save(records, 'item', 7) == 7\n"
            "assert records['item'] == 7\nprint('saved value reread: 7')\n", encoding='utf-8')
        self.task = self.project / '.requirements/active/save'
        sync.initialize_task(self.task, '确认保存契约并验证回读', key='save')
        sync.bind_workspace(self.task)
        self.contract = {'title': '保存契约', 'operation': '保存并回读', 'state': 'confirmed',
                         'status': '已确认', 'source': '保存接口核对', 'fields': [
                             {'name': 'value', 'type': 'integer', 'constraint': '原值保存', 'use': '回读显示'}]}
        base = {'stories': ['S-save'], 'read_stories': ['S-save'], 'contracts': [], 'decisions': [], 'depends_on': []}
        self.verify_action = {**base, 'title': '验证回读', 'kind': '验证', 'done': '保存和回读一致',
                              'depends_on': [{'id': 'A-contract'}], 'covers': ['AC-save'],
                              'code_paths': ['save.py', 'check.py']}
        self.plan({'stories': {'S-save': {'title': '保存', 'actor': '用户', 'goal': '回读原值', 'examples': [
            {'id': 'AC-save', 'given': '有效数值', 'when': '保存后回读', 'then': '数值一致'}]}},
            'contracts': {'C-save': self.contract},
            'actions': {'A-contract': {**base, 'title': '核对契约', 'kind': '调研',
                                       'done': '确认保存字段及来源', 'closes_contracts': ['C-save']},
                        'A-verify': self.verify_action}})
        self.finish('A-intake')
        self.finish('A-contract')

    def work(self):
        return sync.load()['work']

    def write(self, operation):
        return sync.commit(self.work()['revision'], operation)['work']

    def plan(self, patch):
        return self.write(lambda w: sync.apply_plan(w, patch, 'planner', '核对本次输入变化'))

    def finish(self, action):
        return self.write(lambda w: sync.progress(w, 'finish', action, 'qa',
                                                  '已核对保存结果', 'save.py 与接口来源'))

    def capture(self):
        return sync.capture('verify-run', 'A-verify', 'AC-save', self.work()['revision'], 'qa', 'local',
                            argv=[sys.executable, '-B', 'check.py'])

    def queue(self):
        return sync.dispatch(self.work(), include_lessons=False)


class StateMachineTest(StateFixture):
    def test_owned_contract_reopening_invalidates_owner_and_downstream_receipt(self):
        self.assertTrue(self.capture()['passed'])
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'], 'complete')
        self.plan({'contracts': {'C-save': {**self.contract, 'state': 'open', 'status': '待复核'}}})
        states = sync.evaluate(self.work())
        self.assertEqual(states['A-contract']['state'], 'stale')
        self.assertEqual(states['A-verify']['state'], 'stale')
        self.assertIn({'kind': 'dependency', 'id': 'A-contract'}, states['A-verify']['blockers'])
        self.assertEqual(self.queue()['scenarios'][0]['status'], 'stale')
        self.assertNotEqual(self.queue()['state'], 'complete')
        with self.assertRaisesRegex(sync.Invalid, '先补齐契约'):
            self.finish('A-contract')
        with self.assertRaisesRegex(sync.Invalid, '前置条件'):
            self.capture()

    def test_owned_contract_field_change_requires_new_owner_output_and_verification(self):
        self.capture()
        self.finish('A-verify')
        prior = self.queue()['scenarios'][0]['receipts'][0]['id']
        revised = copy.deepcopy(self.contract)
        revised['fields'][0]['constraint'] = '原值保存，合法范围 0 至 100'
        self.plan({'contracts': {'C-save': revised}})
        self.assertEqual(sync.evaluate(self.work())['A-contract']['state'], 'stale')
        self.assertNotEqual(self.queue()['scenarios'][0]['status'], 'passed')
        self.finish('A-contract')
        self.assertEqual(self.queue()['next']['id'], 'A-verify')
        with self.assertRaisesRegex(sync.Invalid, '缺少有效的成功凭据'):
            self.finish('A-verify')
        self.capture()
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'], 'complete')
        self.assertNotEqual(self.queue()['scenarios'][0]['receipts'][0]['id'], prior)

    def test_next_and_claim_expose_explicit_or_default_code_scope(self):
        next_packet = self.queue()['next']
        self.assertEqual(next_packet['code_paths'], ['save.py', 'check.py'])
        self.assertEqual(next_packet['verification_project_root'], str(self.project))
        claimed = sync.claim(self.work()['revision'], 'qa')['next']
        self.assertEqual((claimed['code_paths'], claimed['verification_project_root']),
                         (next_packet['code_paths'], next_packet['verification_project_root']))
        default = {k: v for k, v in self.verify_action.items() if k != 'code_paths'}
        self.plan({'actions': {'A-verify': default}})
        next_packet = self.queue()['next']
        self.assertIsNone(next_packet['code_paths'])
        self.assertEqual(next_packet['verification_project_root'], str(self.project))
        # A catalog request uses its own task, regardless of the CLI's last selected workspace.
        sync.bind_workspace(self.project / 'unrelated-selection')
        packet = sync.dispatch(sync.load(self.task / 'model.json')['work'], workspace=self.task,
                               include_lessons=False)['next']
        self.assertEqual(packet['verification_project_root'], str(self.project))


class IndependentDiagnosisTest(StateFixture):
    def fail_twice(self, scenario='AC-save'):
        for _ in range(2):
            result = sync.capture('verify-run', 'A-verify', scenario, self.work()['revision'], 'qa', 'local',
                                  argv=[sys.executable, '-B', '-c',
                                        "from save import save; assert save({}, 'item', 7) == 8, 'wrong expected value'"])
            self.assertFalse(result['passed'])

    def review_id(self):
        return next(reversed([key for key, action in self.work()['actions'].items() if action.get('review_for')]))

    def finish_review(self, actor='independent-reviewer'):
        return self.write(lambda w: sync.progress(w, 'finish', self.review_id(), actor,
                                                  '断言把输入 7 错写成预期 8，应核对原值 7',
                                                  '已复查原失败日志与 save.py 的保存行为'))

    def test_review_is_claimed_and_completed_without_starving_other_work_in_the_same_story(self):
        self.plan({'actions': {'A-parallel': {
            'title': '核对独立页面', 'kind': '开发', 'stories': ['S-save'], 'read_stories': [],
            'contracts': [], 'decisions': [], 'depends_on': [], 'done': '核对独立页面产出'}}})
        self.fail_twice()
        with self.assertRaisesRegex(sync.Invalid, '先用 claim'):
            self.capture()
        queue = sync.claim(self.work()['revision'], 'qa', 'S-save')
        self.assertEqual(queue['claimed'], 'A-parallel')
        review = self.review_id()
        self.assertEqual(self.work()['actions'][review]['review_for']['verification_actors'], ['qa'])
        self.assertEqual(len(self.work()['actions'][review]['review_for']['receipts']), 2)
        graph = sync.graph_view.make_graph(self.work(), sync.evaluate(self.work()), self.queue()['scenarios'])
        self.assertIn(review, {node['id'] for node in graph['nodes']})
        self.assertTrue(any(edge['source'] == review and edge['target'] == 'A-verify' for edge in graph['edges']))
        self.assertEqual(sync.claim(self.work()['revision'], 'independent-reviewer', 'S-save')['claimed'], review)
        packet = sync.dispatch(self.work(), 'independent-reviewer', include_lessons=False)['next']
        self.assertEqual(packet['review_for']['action'], 'A-verify')
        self.assertEqual([e['id'] for e in packet['failed_evidence']], packet['review_for']['receipts'])
        self.assertEqual(packet['mode'], 'resume')
        self.finish_review()
        self.finish('A-parallel')
        self.assertTrue(self.capture()['passed'])
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'], 'complete')
        event = next(e for e in reversed(self.work()['events']) if e.get('action') == review and e['kind'] == 'finish')
        self.assertEqual(event['actor'], 'independent-reviewer')
        self.assertIn('预期 8', event['output'])
        self.assertIn('失败日志', event['evidence'])

    def test_failure_author_cannot_start_or_finish_review_and_later_failures_need_a_new_review(self):
        self.fail_twice()
        queue = sync.claim(self.work()['revision'], 'qa')
        self.assertIsNone(queue['claimed'])
        first = self.review_id()
        for actor in ('qa', ' QA ', 'ｑａ'):
            self.assertIsNone(sync.claim(self.work()['revision'], actor)['claimed'])
            for mode in ('start', 'finish'):
                with self.subTest(actor=actor, mode=mode), self.assertRaisesRegex(sync.Invalid, '原失败执行者不能'):
                    self.write(lambda w: sync.progress(w, mode, first, actor, '自己已诊断', '自查记录'))
        sync.claim(self.work()['revision'], 'independent-reviewer')
        self.finish_review()
        self.fail_twice()
        sync.claim(self.work()['revision'], 'qa')
        second = self.review_id()
        self.assertNotEqual(first, second)
        self.assertEqual(sync.evaluate(self.work())[first]['state'], 'done')
        self.assertEqual(sync.evaluate(self.work())[second]['state'], 'ready')
        self.assertNotEqual(self.queue()['state'], 'complete')

    def test_scoped_claim_diagnoses_failed_case_in_another_story_of_the_shared_action(self):
        self.plan({'stories': {'S-other': {'title': '刷新', 'actor': '用户', 'goal': '刷新回读', 'examples': [
            {'id': 'AC-other', 'given': '已保存', 'when': '刷新', 'then': '值一致'}]}},
            'actions': {'A-verify': {**self.verify_action, 'stories': ['S-save','S-other'],
                                     'read_stories': ['S-save','S-other'], 'covers': ['AC-save','AC-other']}}})
        self.fail_twice('AC-other')
        sync.claim(self.work()['revision'], 'qa', 'S-save')
        review = self.review_id()
        self.assertEqual(self.work()['actions'][review]['review_for']['scenarios'][0]['story'], 'S-other')
        self.assertEqual(sync.claim(self.work()['revision'], 'independent-reviewer', 'S-save')['claimed'], review)
        self.finish_review()
        self.assertEqual(sync.dispatch(self.work(), 'qa', 'S-save', include_lessons=False)['next']['id'], 'A-verify')

    def test_plan_cannot_remove_diagnosis_or_move_covers_to_bypass_it(self):
        self.fail_twice()
        sync.claim(self.work()['revision'], 'qa')
        review = self.review_id()
        verify = self.work()['actions']['A-verify']
        original = sync.MODEL.read_bytes()
        patches = [
            {'actions': {'A-verify': {**verify, 'depends_on': [{'id': 'A-contract'}]}}},
            {'actions': {'A-verify': {**verify, 'covers': []}}},
            {'actions': {review: {k: v for k, v in self.work()['actions'][review].items() if k != 'review_for'}}},
            {'actions': {review: {**self.work()['actions'][review], 'kind': '开发'}}},
        ]
        for patch in patches:
            with self.subTest(patch=patch), self.assertRaises(sync.Invalid):
                self.plan(patch)
            self.assertEqual(sync.MODEL.read_bytes(), original)
        # Editing wording or code does not remove an already materialized review dependency.
        self.plan({'actions': {'A-verify': {**verify, 'title': '改名后的验证'}}})
        (self.project / 'save.py').write_text((self.project / 'save.py').read_text() + '\n# rechecked\n')
        with self.assertRaisesRegex(sync.Invalid, '前置条件'):
            self.capture()

    def test_partial_and_full_scope_withdrawal_skip_only_the_related_diagnosis(self):
        story = copy.deepcopy(self.work()['stories']['S-save'])
        story['examples'].append({'id': 'AC-other', 'given': '有效记录', 'when': '刷新', 'then': '仍显示原值'})
        verify = {**self.verify_action, 'covers': ['AC-save', 'AC-other']}
        self.plan({'stories': {'S-save': story}, 'actions': {'A-verify': verify},
                   'decisions': {'D-scope': {'title': '保存是否本期交付', 'why': '确定范围', 'owner': '产品',
                       'stories': ['S-save'], 'options': {'keep': {'label': '保留', 'consequence': '继续核验'},
                                                        'defer': {'label': '延期', 'consequence': '撤下场景'}}}}})
        self.finish('A-contract')
        self.fail_twice()
        sync.claim(self.work()['revision'], 'qa')
        review = self.review_id()
        self.write(lambda w: sync.decide(w, 'D-scope', 'defer', '产品确认延期保存', '产品'))
        current = self.work()['actions']['A-verify']
        self.plan({'stories': {'S-save': {**story, 'examples': story['examples'][1:]}},
                   'actions': {'A-verify': {**current, 'covers': ['AC-other']}},
                   'retire_scenarios': {'AC-save': {'decision': 'D-scope', 'is': 'defer'}}})
        self.assertEqual(sync.evaluate(self.work())[review]['state'], 'skipped')
        graph = sync.graph_view.make_graph(self.work(), sync.evaluate(self.work()), self.queue()['scenarios'])
        edge = next(edge for edge in graph['edges'] if edge['source'] == review and edge['target'] == 'A-verify')
        self.assertEqual(edge['mode'], 'skipped')
        self.finish('A-contract')
        self.assertNotEqual(self.queue()['state'], 'complete')
        result = sync.capture('verify-run', 'A-verify', 'AC-other', self.work()['revision'], 'qa', 'local',
                              argv=[sys.executable, '-B', 'check.py'])
        self.assertTrue(result['passed'])
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'], 'complete')
        self.plan({'stories': {'S-save': {**story, 'examples': []}},
                   'actions': {'A-verify': {**current, 'covers': []}},
                   'retire_scenarios': {'AC-other': {'decision': 'D-scope', 'is': 'defer'}}})
        self.assertEqual(self.queue()['state'], 'complete')
        self.assertEqual(sync.evaluate(self.work())[review]['state'], 'skipped')
        self.write(lambda w: sync.decide(w, 'D-scope', 'keep', '恢复本期要求', '产品'))
        self.assertNotEqual(sync.evaluate(self.work())[review]['state'], 'skipped')
        self.assertNotEqual(self.queue()['state'], 'complete')

    def test_review_rejects_modified_original_attachment_and_allocates_noncolliding_id(self):
        self.fail_twice()
        end = self.work()['events'][-1]['id']
        collision = 'A-review-' + end
        self.plan({'contracts': {collision: self.contract}})
        sync.claim(self.work()['revision'], 'qa')
        review = self.review_id()
        self.assertNotEqual(review, collision)
        origin = self.work()['actions'][review]['review_for']
        event = next(e for e in self.work()['events'] if e['id'] == origin['receipts'][0])
        path = self.task / event['receipt']['artifact']['path']
        path.write_bytes(path.read_bytes() + b'\nchanged source log\n')
        self.assertIn({'kind': 'review_evidence', 'id': review}, sync.evaluate(self.work())[review]['blockers'])
        with self.assertRaises(ValueError):
            self.finish_review()


if __name__ == '__main__':
    unittest.main()
