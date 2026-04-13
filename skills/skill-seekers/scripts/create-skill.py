#!/usr/bin/env python3
"""
快速创建AI技能 - 封装skill-seekers的常用工作流

用法:
    python create-skill.py <source> [--target claude|gemini|openai] [--enhance]
    python create-skill.py https://docs.react.dev/
    python create-skill.py facebook/react --target claude --enhance

示例:
    # 创建React文档技能
    python create-skill.py https://react.dev/ --target claude

    # 创建GitHub仓库技能并AI增强
    python create-skill.py django/django --enhance

    # 创建本地代码库技能
    python create-skill.py ./my-project --target cursor
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def run_command(cmd, description=""):
    """执行命令并输出结果"""
    print(f"\n{'='*60}")
    print(f"{description or '执行'}: {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True)
    return result.returncode == 0


def detect_source_type(source):
    """检测来源类型"""
    if source.startswith(('http://', 'https://')):
        return 'url'
    elif '/' in source and not os.path.exists(source):
        return 'github'
    elif os.path.isfile(source):
        return 'file'
    elif os.path.isdir(source):
        return 'directory'
    else:
        return 'unknown'


def create_skill(source, target='claude', enhance=False, preset=None):
    """创建AI技能"""
    print(f"\n📦 开始创建技能...")
    print(f"   来源: {source}")
    print(f"   目标: {target}")
    print(f"   增强: {'是' if enhance else '否'}")
    print(f"   预设: {preset or '默认'}")

    # 检测来源类型
    source_type = detect_source_type(source)
    print(f"   类型: {source_type}")

    # 构建命令
    cmd_parts = ['skill-seekers', 'create', source]

    if preset:
        cmd_parts.extend(['-p', preset])

    if enhance:
        cmd_parts.append('--enhance')

    # 执行创建
    if not run_command(' '.join(cmd_parts), '创建技能'):
        print("❌ 创建失败!")
        return False

    # 提取技能名称
    skill_name = source.split('/')[-1].replace('.', '_')
    if source.startswith('https://'):
        from urllib.parse import urlparse
        domain = urlparse(source).netloc
        skill_name = domain.replace('.', '_')

    # 打包
    package_cmd = f"skill-seekers package output/{skill_name} --target {target}"
    if not run_command(package_cmd, '打包技能'):
        print("❌ 打包失败!")
        return False

    print(f"\n✅ 技能创建完成!")
    print(f"   输出目录: output/{skill_name}-{target}")

    # 显示安装说明
    if target == 'cursor':
        print(f"\n📥 安装到Cursor:")
        print(f"   cp output/{skill_name}-{target}/SKILL.md .cursorrules")
    elif target == 'claude':
        print(f"\n📥 安装到Claude:")
        print(f"   skill-seekers install --config {skill_name}")
        print(f"   或手动上传 output/{skill_name}-{target}.zip")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='快速创建AI技能',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('source', help='来源: URL、GitHub仓库路径、本地文件或目录')
    parser.add_argument('--target', '-t', default='claude',
                        choices=['claude', 'gemini', 'openai', 'cursor', 'markdown'],
                        help='目标平台 (默认: claude)')
    parser.add_argument('--enhance', '-e', action='store_true',
                        help='启用AI增强')
    parser.add_argument('--preset', '-p', choices=['quick', 'standard', 'comprehensive'],
                        help='预设模式')

    args = parser.parse_args()

    success = create_skill(args.source, args.target, args.enhance, args.preset)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
