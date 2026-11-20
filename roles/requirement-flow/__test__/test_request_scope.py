"""Requirement-wide input changes must invalidate research, work in progress and evidence."""
from test_state_machine import StateFixture, sync


class RequestScopeTest(StateFixture):
    def test_research_rechecks_goal_and_scope_then_can_finish_again(self):
        research = self.project / '.requirements/active/research'
        sync.initialize_task(research, '核实收货单据', key='research', outcome='research')
        sync.bind_workspace(research)
        self.finish('A-intake')
        for update in ({'goal': '核实供应商是否取消发货'}, {'scope': ['核实回执']}, {'scope': []}):
            self.assertEqual(self.queue()['state'], 'complete')
            self.plan(update)
            self.assertEqual(self.queue()['next']['id'], 'A-intake')
            self.assertEqual(self.queue()['progress']['completed'], [])
            self.finish('A-intake')
        revision = self.work()['revision']
        self.plan({'scope': []})
        self.assertEqual(self.work()['revision'], revision)
        self.assertEqual(self.queue()['state'], 'complete')

    def test_delivery_retains_old_record_but_requires_current_receipt(self):
        self.capture()
        self.finish('A-verify')
        before = self.queue()['scenarios'][0]['receipts'][0]['id']
        self.plan({'scope': ['增加移动端验收']})
        self.assertEqual(self.queue()['scenarios'][0]['status'], 'stale')
        self.finish('A-intake')
        self.finish('A-contract')
        with self.assertRaisesRegex(sync.Invalid, '缺少有效的成功凭据'):
            self.finish('A-verify')
        self.capture()
        self.finish('A-verify')
        self.assertEqual(self.queue()['state'], 'complete')
        self.assertNotEqual(self.queue()['scenarios'][0]['receipts'][0]['id'], before)

    def test_running_action_must_start_again_after_goal_change(self):
        sync.claim(self.work()['revision'], 'alice')
        self.assertEqual(self.queue()['running'][0]['actor'], 'alice')
        prior = sync.evaluate(self.work())['A-verify']['stamp']
        self.plan({'goal': '确认退货后的回读'})
        status = sync.evaluate(self.work())['A-verify']
        self.assertEqual(status['state'], 'stale')
        self.assertNotEqual(status['stamp'], prior)
        self.assertEqual(self.queue()['running'], [])

    def test_legacy_finish_after_scope_revision_stays_valid(self):
        research = self.project / '.requirements/active/legacy'
        sync.initialize_task(research, '历史调研', key='legacy', outcome='research')
        sync.bind_workspace(research)
        # Older releases recorded changed field names but signed only per-action inputs.
        def legacy_plan(work, scope):
            work['scope'] = scope
            work['revision'] += 1
            sync.append_event(work, 'plan', '产品', changed=['scope'], output='核实门店')
            return True
        self.write(lambda work: legacy_plan(work, ['门店']))
        self.finish('A-intake')
        self.assertEqual(self.queue()['state'], 'complete')
        self.write(lambda work: legacy_plan(work, ['门店', '供应商']))
        self.assertEqual(self.queue()['state'], 'ready')

    def test_edit_to_entity_named_scope_keeps_unrelated_legacy_evidence(self):
        self.capture()
        self.finish('A-verify')
        receipt = self.queue()['scenarios'][0]['receipts'][0]['id']
        self.plan({'actions': {'scope': {**self.work()['actions']['A-intake'], 'title': '独立调研'}}})
        self.assertEqual(self.queue()['scenarios'][0]['status'], 'passed')
        self.assertEqual(self.queue()['scenarios'][0]['receipts'][0]['id'], receipt)
