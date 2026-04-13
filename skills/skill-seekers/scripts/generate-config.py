#!/usr/bin/env python3
"""
生成skill-seekers配置文件

用法:
    python generate-config.py <base-url> [--name <name>] [--output <file>]

示例:
    python generate-config.py https://docs.react.dev/ --name react
    python generate-config.py https://docs.djangoproject.com/ --name django --output configs/django.json
"""

import argparse
import json
import sys
from urllib.parse import urlparse


DEFAULT_SELECTORS = {
    'main_content': 'article, main, div[role="main"], .content, #content',
    'title': 'h1, .title, .heading',
    'code_blocks': 'pre code, .code-block, code'
}

CATEGORIES = {
    'getting_started': ['intro', 'quickstart', 'installation', 'getting-started', 'start'],
    'guides': ['guide', 'tutorial', 'how-to', 'tutorials'],
    'api': ['api', 'reference', 'endpoints'],
    'best_practices': ['best-practices', 'performance', 'optimization']
}


def generate_config(base_url, name=None, include_patterns=None, exclude_patterns=None):
    """生成配置文件"""

    # 从URL提取名称
    if not name:
        parsed = urlparse(base_url)
        domain = parsed.netloc.replace('www.', '')
        name = domain.split('.')[0]

    # 解析URL路径
    parsed = urlparse(base_url)
    base_path = parsed.path.rstrip('/')

    config = {
        'name': name,
        'description': f'用于{name}框架/库的AI技能',
        'base_url': base_url,
        'selectors': DEFAULT_SELECTORS.copy(),
        'url_patterns': {
            'include': include_patterns or ['/docs', '/guide', '/api', '/reference'],
            'exclude': exclude_patterns or ['/blog', '/changelog', '/community']
        },
        'categories': CATEGORIES.copy(),
        'rate_limit': 0.5,
        'max_pages': 500
    }

    return config


def main():
    parser = argparse.ArgumentParser(description='生成skill-seekers配置文件')
    parser.add_argument('base_url', help='文档网站基础URL')
    parser.add_argument('--name', '-n', help='技能名称（默认从URL提取）')
    parser.add_argument('--output', '-o', help='输出文件路径')
    parser.add_argument('--include', '-i', nargs='+', help='包含的URL模式')
    parser.add_argument('--exclude', '-e', nargs='+', help='排除的URL模式')

    args = parser.parse_args()

    config = generate_config(
        args.base_url,
        args.name,
        args.include,
        args.exclude
    )

    output = args.output or f'configs/{config["name"]}.json'

    with open(output, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    print(f'✅ 配置文件已生成: {output}')
    print(f'\n使用方式:')
    print(f'  skill-seekers scrape --config {output}')
    print(f'  skill-seekers create {args.base_url}')


if __name__ == '__main__':
    main()
