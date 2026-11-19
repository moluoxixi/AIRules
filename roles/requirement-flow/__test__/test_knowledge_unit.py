"""Project lesson revisions and feature-specific matching."""
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from urllib.request import urlopen

from test_knowledge_flow import LESSON, SEARCH, SOURCE, TARGET, Project

RUNTIME = Path(__file__).resolve().parents[1] / 'skills/requirement-flow/runtime'
sys.path.insert(0, str(RUNTIME))
import knowledge


class KnowledgeTests(unittest.TestCase):
    def test_tags_match_local_story_or_request_and_keep_specificity(self):
        work = {'id': 'next', 'title': 'Store and restore', 'raw_request': '提供门店搜索',
                'actions': {'A-note': {'stories': ['S-note'], 'contracts': [], 'title': 'Restore metadata'}},
                'stories': {'S-search': {'title': '分页门店搜索'}, 'S-note': {'title': 'Restore metadata'}},
                'contracts': {}}
        approved = {'id': 'L1', 'task': 'past', 'tags': ['Store', '门店搜索', '测试', 'id'],
                    'sources': [], 'state': 'approved'}
        self.assertEqual(knowledge.match_cards(work, [approved], stories='S-note'), [])
        self.assertEqual(knowledge.match_cards(work, [approved], action='A-note'), [])
        row, = knowledge.match_cards(work, [approved], stories='S-search')
        self.assertEqual(row['matched_stories'], ['S-search'])
        self.assertEqual(row['match_reasons'], ['匹配标签：门店搜索'])
        self.assertEqual(knowledge.match_cards(work, [dict(approved, task='next')]), [])
        self.assertEqual(knowledge.match_cards(work, [dict(approved, state='pending')]), [])
        fresh = dict(work, stories={}, actions={})
        self.assertEqual(knowledge.match_cards(fresh, [approved])[0]['id'], 'L1')
        many = [dict(approved, id='L' + str(i)) for i in range(9)]
        self.assertEqual(len(knowledge.match_cards(fresh, many)), 5)
        self.assertEqual(len(knowledge.match_cards(fresh, many, limit=None)), 9)

    def test_amended_draft_and_rejection_preserve_the_prior_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Project(Path(directory))
            receipt = p.prepare_review()
            p.review()
            revised = {'id': LESSON, 'tags': ['门店选择器'], 'observation': '使用分页目录时发现遗漏门店。',
                       'when': '门店分页搜索', 'practice': '先筛选关键词，再分页。', 'boundary': '用于支持搜索的目录。',
                       'sources': [{'story': 'S-directory', 'scenario': 'AC-directory',
                                    'action': 'A-check', 'receipt': receipt['id']}]}

            def states():
                return [(c['version'], c['state']) for c in p.data('lessons', '--all')['lessons'] if c['id'] == LESSON]

            def recalled_version():
                return [c['version'] for c in p.next(TARGET, SEARCH)['related_lessons'] if c['id'] == LESSON]

            p.with_json(SOURCE, 'lesson-propose', revised, actor='开发')
            self.assertEqual(states(), [(1, 'approved'), (2, 'pending')])
            self.assertEqual(recalled_version(), [1])
            p.review(verdict='reject')
            self.assertEqual(states(), [(1, 'approved'), (2, 'rejected')])
            self.assertEqual(recalled_version(), [1])
            revised['boundary'] = '用于支持后端搜索且关键词作用于所有分页的目录。'
            p.with_json(SOURCE, 'lesson-propose', revised, actor='开发')
            p.review()
            self.assertEqual(states(), [(1, 'superseded'), (2, 'rejected'), (3, 'approved')])
            self.assertEqual(recalled_version(), [3])
            for boundary in ('只涉及门店目录', '只涉及启用名称搜索的门店目录'):
                revised['boundary'] = boundary
                p.with_json(SOURCE, 'lesson-propose', revised, actor='开发')
            self.assertEqual(states()[-2:], [(4, 'revised'), (5, 'pending')])
            reviews = p.next(SOURCE)['lesson_reviews']
            self.assertEqual([(r['id'], r['version']) for r in reviews], [(LESSON, 5)])
            p.write(SOURCE, 'lesson-review', LESSON, 'approve', '--why', '已复核旧提案', '--version', 4,
                    actor='复核者', ok=False)
            self.assertEqual(recalled_version(), [3])

    def test_archived_version_stays_superseded_when_replacement_loses_its_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Project(Path(directory))
            old_proof = p.prepare_review()
            p.review()
            p.cli('archive', SOURCE)
            proof = p.capture(TARGET, 'A-stop', 'AC-stop', 'test_directory.DirectoryChecks.test_add_route_stop')
            replacement = {
                'id': 'L-route', 'observation': '搜索命中后仍需校验实际保存的门店。', 'when': '使用门店选择器添加路线',
                'practice': '核对检索结果和落库的编号。', 'boundary': '适用于门店路线。', 'tags': ['门店选择器'],
                'sources': [{'story': SEARCH, 'scenario': 'AC-stop', 'action': 'A-stop', 'receipt': proof['id']}],
                'supersedes': {'task': SOURCE, 'id': LESSON, 'version': 1}}
            p.with_json(TARGET, 'lesson-propose', replacement, actor='开发')
            p.write(TARGET, 'lesson-review', replacement['id'], 'approve', '--why', '已复核来源及替代边界', actor='审查')

            def catalogue():
                return {c['id']: c for c in p.data('lessons', '--all')['lessons']}

            cards = catalogue()
            self.assertEqual(cards[LESSON]['state'], 'superseded')
            self.assertEqual(cards[LESSON]['replaced_by']['task'], TARGET)
            self.assertEqual(cards[LESSON]['sources'][0]['receipt'], old_proof['id'])
            self.assertEqual(cards[replacement['id']]['state'], 'approved')
            artifact = p.root / '.requirements/active' / TARGET / proof['artifact']['path']
            artifact.unlink()
            states = {key: row['state'] for key, row in catalogue().items()}
            self.assertEqual(states, {LESSON: 'superseded', replacement['id']: 'stale'})
            self.assertEqual(p.data('lessons')['lessons'], [])

    def test_running_server_sees_new_cards_in_a_previously_empty_source(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Project(Path(directory))
            p.requirements()
            proof = p.capture(SOURCE, 'A-check', 'AC-directory', 'test_directory.DirectoryChecks.test_store_on_later_page')
            with p.serve() as url:
                def recalled():
                    with urlopen(url + 'dispatch?story=' + SEARCH, timeout=5) as response:
                        return json.load(response)['related_lessons']
                self.assertEqual(recalled(), [])
                p.propose(proof['id'])
                self.assertEqual(recalled(), [])
                p.review()
                self.assertEqual([c['id'] for c in recalled()], [LESSON])
                path = p.root / '.requirements/active' / SOURCE / proof['artifact']['path']
                original = path.read_bytes()
                path.unlink()
                self.assertEqual(recalled(), [])
                path.write_bytes(original)
                p.propose(proof['id'], key='L-second')
                p.review(key='L-second')
                p.cli('lesson-retire', SOURCE, LESSON, '--version', 1, '--actor', '审查', '--why', '停止使用')
                decision = p.root / '.requirements/knowledge/retired' / SOURCE / LESSON / '1.json'
                decision.write_text('{', encoding='utf-8')
                self.assertEqual([c['id'] for c in recalled()], ['L-second'])
                affected = next(c for c in p.data('lessons', '--all')['lessons'] if c['id'] == LESSON)
                self.assertEqual(affected['state'], 'stale')
                self.assertTrue(affected['issues'])

    def test_archive_captures_external_retirement_and_stays_frozen(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Project(Path(directory))
            proof = p.prepare_review()
            p.review()
            p.cli('new', 'lookup', '--request', '调研门店选择器', '--outcome', 'research')
            p.write('lookup', 'finish', 'A-intake', '--output', '已核对关键词作用范围',
                    '--evidence', '已检查 directory.py 的查询')

            def frozen(bucket):
                page = (p.root / '.requirements' / bucket / 'lookup/handbook.html').read_text(encoding='utf-8')
                data = json.loads(re.search(r'<script(?=[^>]*id="data")[^>]*>(.*?)</script>', page, re.S)[1])
                return [c['id'] for c in data['queue']['related_lessons']]

            self.assertEqual(frozen('active'), [LESSON])
            p.cli('lesson-retire', SOURCE, LESSON, '--version', 1, '--actor', '业务审查', '--why', '原规则已停用')
            self.assertEqual(p.next('lookup')['related_lessons'], [])
            p.cli('archive', 'lookup')
            self.assertEqual(frozen('archive'), [])
            p.propose(proof['id'], key='L-new')
            p.review(key='L-new')
            self.assertEqual(frozen('archive'), [])
            p.cli('task', 'lookup', '--check')


if __name__ == '__main__':
    unittest.main()
