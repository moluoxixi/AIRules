#!/usr/bin/env python3
"""
视频知识提取 - 从YouTube视频或本地视频提取知识

用法:
    python extract-video.py <url-or-file> --name <skill-name> [--visual] [--enhance]

示例:
    # 从YouTube提取字幕和元数据
    python extract-video.py https://youtube.com/watch?v=abc123 --name tutorial

    # 使用视觉帧分析（提取代码编辑器内容）
    python extract-video.py https://youtube.com/watch?v=abc123 --name tutorial --visual

    # AI增强并生成SKILL.md
    python extract-video.py https://youtube.com/watch?v=abc123 --name tutorial --enhance

    # 从本地视频提取
    python extract-video.py ./recording.mp4 --name demo --visual
"""

import argparse
import subprocess
import sys


def run_command(cmd, description=""):
    """执行命令并输出结果"""
    print(f"\n{'='*60}")
    print(f"{description or '执行'}: {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True)
    return result.returncode == 0


def extract_video(url_or_file, name, visual=False, enhance=False, start_time=None, end_time=None):
    """从视频提取知识"""

    # 构建命令
    if url_or_file.startswith(('http://', 'https://')):
        cmd = f"skill-seekers video --url {url_or_file} --name {name}"
    else:
        cmd = f"skill-seekers video --video-file {url_or_file} --name {name}"

    if visual:
        cmd += " --visual"

    if enhance:
        cmd += " --enhance-level 2"

    if start_time:
        cmd += f" --start-time {start_time}"

    if end_time:
        cmd += f" --end-time {end_time}"

    # 执行
    if not run_command(cmd, '视频知识提取'):
        print("❌ 提取失败!")
        return False

    print(f"\n✅ 视频知识提取完成!")
    print(f"   名称: {name}")
    print(f"   输出目录: output/{name}/")

    # 显示生成的文件
    import os
    output_dir = f'output/{name}'
    if os.path.exists(output_dir):
        print(f"\n📁 生成的文件:")
        for root, dirs, files in os.walk(output_dir):
            for f in files:
                fpath = os.path.join(root, f)
                size = os.path.getsize(fpath)
                print(f"   - {os.path.relpath(fpath, output_dir)} ({size} bytes)")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='视频知识提取',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('source', help='YouTube URL 或本地视频文件路径')
    parser.add_argument('--name', '-n', required=True, help='技能名称')
    parser.add_argument('--visual', '-v', action='store_true',
                       help='使用视觉帧分析（提取代码编辑器内容）')
    parser.add_argument('--enhance', '-e', action='store_true',
                       help='使用AI增强')
    parser.add_argument('--start-time', '-s', help='开始时间 (MM:SS 或 HH:MM:SS)')
    parser.add_argument('--end-time', '-t', help='结束时间 (MM:SS 或 HH:MM:SS)')

    args = parser.parse_args()

    success = extract_video(
        args.source,
        args.name,
        args.visual,
        args.enhance,
        args.start_time,
        args.end_time
    )

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
