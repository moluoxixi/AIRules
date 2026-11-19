"""Exercise reviewed knowledge across two requirements from the installed project entry.

For a local review, pass --prepare-review NEW_DIRECTORY, inspect the candidate and
record the review via the installed CLI, then pass --exercise-reuse DIRECTORY.
"""
import json
from contextlib import contextmanager
from pathlib import Path
import subprocess
import sys
import tempfile
import unicodedata
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

ROLE = Path(__file__).resolve().parents[1]
ENTRY = Path('.agents/skills/requirement-flow/flow.py')
SOURCE, TARGET = 'store-picker', 'inspection-route'
LESSON = 'L-search-before-page'
SEARCH = 'S-route-stop'
NOTE = 'S-label'

# The consumer uses an actual SQL query over a small local directory. Requests and
# receipts produced here exercise the public workflow without requiring a live service.
DIRECTORY = '''\
def find_stores(db, keyword=""):
    return db.execute(
        "SELECT id, name FROM store WHERE instr(name, ?) > 0 ORDER BY id LIMIT 2",
        (keyword,),
    ).fetchall()


def add_stop(db, keyword):
    [(store_id, _)] = find_stores(db, keyword)
    db.execute("INSERT INTO stop(store_id) VALUES (?)", (store_id,))
'''
CHECKS = '''\
import sqlite3
import unittest

from directory import add_stop, find_stores


class DirectoryChecks(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.executescript("""
            CREATE TABLE store(id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO store VALUES (1,'东门'),(2,'西门'),(3,'南桥');
            CREATE TABLE stop(store_id INTEGER);
        """)

    def test_store_on_later_page(self):
        self.assertEqual(find_stores(self.db), [(1, '东门'), (2, '西门')])
        self.assertEqual(find_stores(self.db, '南桥'), [(3, '南桥')])

    def test_add_route_stop(self):
        add_stop(self.db, '南桥')
        self.assertEqual(self.db.execute("SELECT store_id FROM stop").fetchall(), [(3,)])
'''
ROUTE_DISPLAY = '''\
from xml.etree import ElementTree as ET


class RouteMap:
    def __init__(self, label):
        self.label = label
        self.large_labels = False

    def render(self):
        svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg')
        text = ET.SubElement(svg, 'text', {'x': '0', 'y': '24',
                                          'font-size': '22px' if self.large_labels else '16px'})
        text.text = self.label
        return ET.tostring(svg, encoding='unicode')
'''
LABEL_CHECK = '''\
import unittest
from xml.etree import ElementTree as ET

from route_display import RouteMap


class RouteDisplayChecks(unittest.TestCase):
    def test_large_labels(self):
        route = RouteMap('周一巡店路线')

        def rendered_size():
            node = ET.fromstring(route.render()).find('{http://www.w3.org/2000/svg}text')
            self.assertEqual(node.text, '周一巡店路线')
            return node.get('font-size')

        self.assertEqual(rendered_size(), '16px')
        route.large_labels = True
        self.assertEqual(rendered_size(), '22px')
        route.large_labels = False
        self.assertEqual(rendered_size(), '16px')
'''


def story(title, goal, case, given, when, then):
    return {'title': title, 'actor': '巡店员', 'goal': goal, 'examples': [
        {'id': case, 'given': given, 'when': when, 'then': then},
    ]}


def check(title, feature, case, contracts=()):
    return {'title': title, 'kind': '验证', 'stories': [feature], 'read_stories': [feature],
            'covers': [case], 'accepts': ['自动化'], 'decisions': [], 'contracts': list(contracts),
            'depends_on': [{'id': 'A-intake'}], 'done': '断言实际结果符合场景预期'}


class Project:
    def __init__(self, root, *, installed=False):
        self.root = root.resolve()
        if not installed:
            self.entry = ROLE / 'skills/requirement-flow/flow.py'
            self.cli('init')
            (self.root / 'directory.py').write_text(DIRECTORY, encoding='utf-8')
            (self.root / 'test_directory.py').write_text(CHECKS, encoding='utf-8')
        self.entry = self.root / ENTRY

    def command(self, *args):
        return [sys.executable, '-B', str(self.entry), '--project', str(self.root), *map(str, args)]

    def cli(self, *args, ok=True):
        p = subprocess.run(self.command(*args), cwd=self.root, text=True, encoding='utf-8',
                           capture_output=True, timeout=15)
        if (p.returncode == 0) != ok:
            raise AssertionError(f'{args} returned {p.returncode}: {p.stderr or p.stdout}')
        return p.stdout

    def data(self, *args):
        return json.loads(self.cli(*args))

    def write(self, task, verb, *args, actor='验收员', ok=True):
        revision = self.data('task', task, 'next')['revision']
        return self.cli('task', task, verb, '--rev', revision, '--actor', actor, *args, ok=ok)

    def with_json(self, task, verb, data, *args, **options):
        with tempfile.TemporaryDirectory() as temp:
            patch = Path(temp) / 'input.json'
            patch.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
            return self.write(task, verb, patch, *args, **options)

    def next(self, task, feature=None):
        args = ['--story', feature] if feature else []
        return self.data('task', task, 'next', *args)

    def requirements(self):
        contract = {'title': '门店目录', 'operation': 'GET /directory/stores', 'state': 'confirmed',
                    'status': '已核对本地实现', 'source': 'directory.py / find_stores',
                    'fields': [{'name': 'keyword', 'type': 'string', 'constraint': '可选',
                                'use': '匹配门店名称后再分页'}]}
        old_note = dict(observation='旧经验', when='搜索', practice='旧项目记录', boundary='旧版',
                        evidence='文字说明', review='再次使用前复核')
        self.cli('new', SOURCE, '--request', '门店选择器支持搜索首屏以外的门店')
        self.with_json(SOURCE, 'plan', {
            'stories': {'S-directory': story('门店选择器', '搜索所有符合条件的门店', 'AC-directory',
                                             '南桥门店不在首屏', '搜索南桥', '返回南桥门店')},
            'contracts': {'C-directory': contract},
            'actions': {'A-check': check('验证门店关键词搜索', 'S-directory', 'AC-directory', ['C-directory'])},
            'lessons': [old_note],
        }, '--why', '明确目录分页与关键词契约')
        self.cli('new', TARGET, '--request', '规划巡店路线，选择目的门店并设置路线标签')
        self.with_json(TARGET, 'plan', {
            'stories': {SEARCH: story('用门店选择器添加路线停靠点', '将搜索到的门店加入路线', 'AC-stop',
                                      '目的门店不在首屏', '按关键词查找并添加', '路线记录正确的门店编号'),
                        NOTE: story('设置路线标签字号', '放大路线标签字号', 'AC-label',
                                    '标签使用默认字号', '切换大字', '字号随设置更新')},
            'contracts': {'C-directory': contract},
            'actions': {'A-stop': check('核对目的门店搜索与路线记录', SEARCH, 'AC-stop', ['C-directory']),
                        'A-label': check('核对标签字号', NOTE, 'AC-label')},
        }, '--why', '分别验证停靠点与标签')
        for task in (SOURCE, TARGET):
            self.write(task, 'finish', 'A-intake', '--output', '已确认故事与验收场景', '--evidence', '需求原话')

    def capture(self, task, action, scenario, test, environment='本地 SQLite 临时数据库'):
        self.write(task, 'verify-run', action, '--scenario', scenario, '--environment', environment,
                   '--', sys.executable, '-B', '-m', 'unittest', '-v', test)
        self.write(task, 'finish', action, '--output', '业务断言已通过')
        return next(s for s in self.next(task)['scenarios'] if s['id'] == scenario)['receipts'][0]

    def propose(self, receipt, key=LESSON, scenario='AC-directory', ok=True):
        card = {'id': key, 'observation': '当前页筛选遗漏了未加载的南桥门店。', 'when': '门店选择器使用分页目录',
                'practice': '先向目录传入关键词，再限制返回的页大小；验收时查找一个不在首屏的门店。',
                'boundary': '适用于目录支持关键词查询的分页选择器。', 'tags': ['门店选择器', '/directory/stores'],
                'sources': [{'story': 'S-directory', 'scenario': scenario, 'action': 'A-check', 'receipt': receipt}]}
        self.with_json(SOURCE, 'lesson-propose', card, actor='目录开发者', ok=ok)

    def review(self, key=LESSON, verdict='approve', actor='独立审查员', ok=True):
        self.write(SOURCE, 'lesson-review', key, verdict, '--why', '已核对实际查询与返回的门店编号',
                   actor=actor, ok=ok)

    def prepare_review(self):
        self.requirements()
        receipt = self.capture(SOURCE, 'A-check', 'AC-directory', 'test_directory.DirectoryChecks.test_store_on_later_page')
        self.propose(receipt['id'])
        return receipt

    def verify_labels(self):
        if self.data('task', TARGET, 'context', NOTE)['related_lessons']:
            raise AssertionError('字号功能不涉及门店目录')
        for name, content in [('route_display.py', ROUTE_DISPLAY), ('test_route_display.py', LABEL_CHECK)]:
            path = self.root / name
            if not path.exists():
                path.write_text(content, encoding='utf-8')
            elif path.read_text(encoding='utf-8') != content:
                raise ValueError(f'已有文件内容不同：{path}')
        return self.capture(TARGET, 'A-label', 'AC-label', 'test_route_display.RouteDisplayChecks.test_large_labels',
                            environment='本地 SVG 路线标签渲染')

    def apply_reviewed_lesson(self):
        queue = self.next(TARGET, SEARCH)
        cards = (queue['next'] or queue)['related_lessons']
        if not any(c['task'] == SOURCE and c['id'] == LESSON for c in cards):
            raise ValueError('请先独立审查来源场景和回执并记录审查结果。')
        self.cli('archive', SOURCE)
        if queue['scenarios'][0]['status'] != 'passed':
            self.write(TARGET, 'claim', '--story', SEARCH)
            self.capture(TARGET, 'A-stop', 'AC-stop', 'test_directory.DirectoryChecks.test_add_route_stop')
        if self.next(TARGET, NOTE)['scenarios'][0]['status'] != 'passed':
            self.verify_labels()
        return self.next(TARGET)

    @contextmanager
    def serve(self):
        with subprocess.Popen(self.command('task', TARGET, 'serve'), cwd=self.root,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) as p:
            try:
                url = p.stdout.readline().strip()
                if not url.startswith('http://127.0.0.1:'):
                    raise AssertionError(p.stderr.read())
                yield url
            finally:
                p.terminate()


class KnowledgeFlowTest(unittest.TestCase):
    def test_equivalent_unicode_task_ids_open_the_same_source_before_and_after_archive(self):
        composed = '门店目录-é'
        decomposed = unicodedata.normalize('NFD', composed)
        with tempfile.TemporaryDirectory() as tmp, patch.dict(globals(), SOURCE=decomposed):
            project = Project(Path(tmp))
            receipt = project.prepare_review()
            project.review()
            with project.serve() as url:
                for archived in (False, True):
                    if archived:
                        project.cli('archive', decomposed)
                    for task in (composed, decomposed):
                        with self.subTest(archived=archived, task=task):
                            query = urlencode({'task': task, 'lesson': LESSON, 'version': 1, 'receipt': receipt['id']})
                            with urlopen(url + 'lesson-source?' + query, timeout=5) as page:
                                self.assertIn(composed, page.read().decode())
                            with urlopen(url + 'lesson-evidence?' + query, timeout=5) as artifact:
                                self.assertIn(b'test_store_on_later_page', artifact.read())

    def test_review_reuse_and_source_integrity_across_two_requirements(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Project(Path(tmp))
            self.run_flow(project)

    def run_flow(self, p):
        p.requirements()
        self.assertEqual(p.data('lessons')['lessons'], [])
        self.assertEqual(p.next(TARGET, SEARCH)['related_lessons'], [])
        p.propose('E1', ok=False)
        receipt = p.capture(SOURCE, 'A-check', 'AC-directory', 'test_directory.DirectoryChecks.test_store_on_later_page')
        p.propose('E9999', ok=False)
        p.propose(receipt['id'], scenario='AC-unknown', ok=False)
        p.propose(receipt['id'])
        p.review(actor='目录开发者', ok=False)
        self.assertEqual(p.data('lessons')['lessons'], [])
        self.assertTrue(p.next(SOURCE)['lesson_reviews'])
        self.assertEqual(p.next(TARGET, SEARCH)['related_lessons'], [])
        p.review(verdict='reject')
        self.assertEqual(p.data('lessons', '--all')['lessons'][0]['state'], 'rejected')
        self.assertEqual(p.next(TARGET, SEARCH)['related_lessons'], [])

        # A distinct proposal lets the rejected record remain auditable.
        approved = 'L-search-reviewed'
        p.propose(receipt['id'], approved)
        p.review(approved)
        published, = p.data('lessons')['lessons']
        self.assertEqual((published['id'], published['state'], published['task']), (approved, 'approved', SOURCE))
        for packet in (p.next(TARGET, SEARCH), p.data('task', TARGET, 'context', SEARCH)):
            match, = packet['related_lessons']
            self.assertEqual(match['id'], approved)
            self.assertEqual(match['matched_stories'], [SEARCH])
            self.assertTrue(match['match_reasons'])
        self.assertEqual(p.next(TARGET, NOTE)['next']['related_lessons'], [])
        self.assertEqual(p.data('task', TARGET, 'context', NOTE)['related_lessons'], [])
        claimed = json.loads(p.write(TARGET, 'claim', '--story', SEARCH))
        self.assertEqual(claimed['next']['related_lessons'][0]['id'], approved)
        pending_case = p.next(TARGET, SEARCH)['scenarios'][0]
        self.assertNotEqual(pending_case['status'], 'passed')
        self.assertEqual(pending_case['receipts'], [])
        p.write(TARGET, 'finish', 'A-stop', '--output', '沿用历史验收', ok=False)

        query = urlencode({'task': SOURCE, 'lesson': approved, 'version': 1, 'receipt': receipt['id']})
        with p.serve() as url:
            with urlopen(url + 'version', timeout=5) as response:
                active_version = json.load(response)
            with urlopen(url + 'lesson-source?' + query, timeout=5) as page:
                self.assertIn('南桥', page.read().decode())
            p.cli('archive', SOURCE)
            with urlopen(url + 'version', timeout=5) as response:
                archived_version = json.load(response)
            self.assertEqual(archived_version['revision'], active_version['revision'])
            self.assertNotEqual(archived_version['lesson_version'], active_version['lesson_version'])
            with urlopen(url + 'lesson-source?' + query, timeout=5) as page:
                self.assertIn('AC-directory', page.read().decode())
            with urlopen(url + 'lesson-evidence?' + query, timeout=5) as response:
                log = response.read()
                self.assertIn(b'test_store_on_later_page', log)
                self.assertIn('attachment', response.headers['Content-Disposition'])
            unlinked = urlencode({'task': SOURCE, 'lesson': approved, 'receipt': 'E9999'})
            with self.assertRaises(HTTPError) as missing:
                urlopen(url + 'lesson-evidence?' + unlinked, timeout=5)
            self.assertEqual(missing.exception.code, 404)
            self.assertEqual(p.next(TARGET, SEARCH)['related_lessons'][0]['bucket'], 'archive')
            artifact = p.root / '.requirements/archive' / SOURCE / receipt['artifact']['path']
            self.assertEqual(artifact.read_bytes(), log)
            artifact.write_bytes(b'changed after approval')
            self.assertEqual(p.next(TARGET, SEARCH)['related_lessons'], [])
            with urlopen(url + 'version', timeout=5) as response:
                invalid_version = json.load(response)
            self.assertEqual(invalid_version['revision'], archived_version['revision'])
            self.assertNotEqual(invalid_version['lesson_version'], archived_version['lesson_version'])
            states = {c['id']: c['state'] for c in p.data('lessons', '--all')['lessons']}
            self.assertEqual(states[approved], 'stale')
            for route in ('lesson-evidence', 'lesson-source'):
                with self.assertRaises(HTTPError) as result:
                    urlopen(url + route + '?' + query, timeout=5)
                self.assertIn(result.exception.code, (404, 409))

        own = p.capture(TARGET, 'A-stop', 'AC-stop', 'test_directory.DirectoryChecks.test_add_route_stop')
        self.assertIn('test_add_route_stop', own['actual'])
        self.assertEqual(p.next(TARGET, SEARCH)['scenarios'][0]['status'], 'passed')
        label = p.verify_labels()
        self.assertIn('test_large_labels', label['actual'])
        self.assertNotEqual(own['id'], label['id'])
        final = p.next(TARGET)
        self.assertEqual(final['state'], 'complete')
        self.assertEqual({s['id']: s['status'] for s in final['scenarios']},
                         {'AC-stop': 'passed', 'AC-label': 'passed'})


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--prepare-review':
        destination = Path(sys.argv[2])
        destination.mkdir(parents=True, exist_ok=False)
        print(json.dumps(Project(destination).prepare_review(), ensure_ascii=False, indent=2))
    elif len(sys.argv) == 3 and sys.argv[1] == '--exercise-reuse':
        print(json.dumps(Project(Path(sys.argv[2]), installed=True).apply_reviewed_lesson(),
                         ensure_ascii=False, indent=2))
    else:
        unittest.main()
