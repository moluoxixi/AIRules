#!/usr/bin/env python3
"""
构建RAG知识库 - 封装skill-seekers的RAG工作流

用法:
    python build-rag.py <source> [--format langchain|chroma|faiss] [--upload]

示例:
    # 构建LangChain知识库
    python build-rag.py https://docs.django.com/ --format langchain

    # 构建ChromaDB知识库并上传
    python build-rag.py ./my-docs --format chroma --upload

    # 构建FAISS索引
    python build-rag.py manual.pdf --format faiss
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


def build_rag(source, format='langchain', upload=False):
    """构建RAG知识库"""
    print(f"\n🔍 构建RAG知识库...")
    print(f"   来源: {source}")
    print(f"   格式: {format}")
    print(f"   上传: {'是' if upload else '否'}")

    # 创建技能
    create_cmd = f"skill-seekers create {source}"
    if not run_command(create_cmd, '抓取文档'):
        print("❌ 抓取失败!")
        return False

    # 提取名称
    skill_name = source.split('/')[-1].replace('.', '_')
    if source.startswith('https://'):
        from urllib.parse import urlparse
        skill_name = urlparse(source).netloc.replace('.', '_')

    # 打包为RAG格式
    package_cmd = f"skill-seekers package output/{skill_name} --format {format}"
    if upload:
        package_cmd += " --upload"

    if not run_command(package_cmd, '打包RAG格式'):
        print("❌ 打包失败!")
        return False

    print(f"\n✅ RAG知识库构建完成!")
    print(f"   输出目录: output/{skill_name}-{format}")

    # 显示下一步
    if format == 'langchain':
        print(f"\n📖 使用方法:")
        print(f"   from langchain_community.vectorstores import Chroma")
        print(f"   # 加载 documents.json")
    elif format == 'chroma':
        print(f"\n📖 使用方法:")
        print(f"   import chromadb")
        print(f"   client = chromadb.PersistentClient(path='./chroma_db')")
    elif format == 'faiss':
        print(f"\n📖 使用方法:")
        print(f"   import faiss")
        print(f"   index = faiss.read_index('{skill_name}.index')")

    return True


def main():
    parser = argparse.ArgumentParser(
        description='构建RAG知识库',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('source', help='来源: URL、GitHub仓库路径、本地文件或目录')
    parser.add_argument('--format', '-f', default='langchain',
                       choices=['langchain', 'llama-index', 'haystack', 'chroma', 'faiss', 'qdrant', 'weaviate'],
                       help='RAG格式 (默认: langchain)')
    parser.add_argument('--upload', '-u', action='store_true',
                       help='打包后直接上传到向量数据库')

    args = parser.parse_args()

    success = build_rag(args.source, args.format, args.upload)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
