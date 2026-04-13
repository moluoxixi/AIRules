#!/usr/bin/env python3
"""
分析本地代码库 - 使用C3.x分析套件

用法:
    python analyze-codebase.py <directory> [--depth quick|comprehensive] [--enhance]

示例:
    # 快速分析
    python analyze-codebase.py ./my-project

    # 完整分析含AI增强
    python analyze-codebase.py ./my-project --depth comprehensive --enhance

    # 仅提取设计模式
    python analyze-codebase.py ./godot-game --depth comprehensive
"""

import argparse
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


def analyze_codebase(directory, depth='quick', enhance=False):
    """分析代码库"""
    print(f"\n🔍 分析代码库...")
    print(f"   目录: {directory}")
    print(f"   深度: {depth}")

    # 确定分析命令
    if depth == 'quick':
        cmd = f"skill-seekers analyze --directory {directory} --quick"
    else:
        cmd = f"skill-seekers analyze --directory {directory} --comprehensive"

    if enhance:
        cmd += " --enhance"

    if not run_command(cmd, '代码库分析'):
        print("❌ 分析失败!")
        return False

    # 提取目录名作为技能名
    skill_name = Path(directory).name

    print(f"\n✅ 分析完成!")
    print(f"   输出目录: output/{skill_name}/")

    # 显示生成的内容
    output_dir = Path(f'output/{skill_name}')
    if output_dir.exists():
        print(f"\n📁 生成的文件:")
        for f in output_dir.rglob('*'):
            if f.is_file():
                print(f"   - {f.relative_to(output_dir)}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='分析本地代码库',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('directory', help='代码库目录路径')
    parser.add_argument('--depth', '-d', choices=['quick', 'comprehensive'],
                       default='quick', help='分析深度 (默认: quick)')
    parser.add_argument('--enhance', '-e', action='store_true',
                       help='启用AI增强')

    args = parser.parse_args()

    success = analyze_codebase(args.directory, args.depth, args.enhance)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
