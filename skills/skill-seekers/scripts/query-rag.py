#!/usr/bin/env python3
"""
RAG查询工具 - 使用构建好的RAG知识库进行查询

用法:
    python query-rag.py <vectorstore-path> <query> [--k <num-results>]

示例:
    python query-rag.py ./chroma_db "如何使用Django ORM?"
    python query-rag.py ./chroma_db "React Hooks最佳实践" --k 5
"""

import argparse
import json
import os
import sys
from pathlib import Path


def query_chroma(vectorstore_path, query, k=3):
    """查询Chroma向量数据库"""
    try:
        import chromadb
        from langchain_openai import OpenAIEmbeddings
    except ImportError:
        print("错误: 请安装依赖: pip install chromadb langchain-openai")
        sys.exit(1)

    # 连接数据库
    client = chromadb.PersistentClient(path=vectorstore_path)
    collection = client.get_or_create_collection("documents")

    # 获取嵌入
    embeddings = OpenAIEmbeddings()

    # 查询
    query_embedding = embeddings.embed_query(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=k
    )

    return results


def query_langchain_json(json_path, query, k=3):
    """查询LangChain格式的JSON文件"""
    try:
        from langchain_openai import OpenAIEmbeddings
        from langchain.schema import Document
    except ImportError:
        print("错误: 请安装依赖: pip install langchain-openai")
        sys.exit(1)

    # 加载文档
    with open(json_path, 'r') as f:
        data = json.load(f)

    documents = []
    for item in data:
        documents.append(Document(
            page_content=item['page_content'],
            metadata=item.get('metadata', {})
        ))

    # 简单向量搜索（使用嵌入）
    embeddings = OpenAIEmbeddings()
    query_embedding = embeddings.embed_query(query)

    # 计算相似度（简化版）
    scored = []
    for i, doc in enumerate(documents):
        doc_embedding = embeddings.embed_query(doc.page_content[:500])
        # 余弦相似度（简化）
        score = sum(a * b for a, b in zip(query_embedding, doc_embedding))
        scored.append((score, i, doc))

    # 排序并返回top-k
    scored.sort(reverse=True)
    return [(s, d) for s, _, d in scored[:k]]


def main():
    parser = argparse.ArgumentParser(description='RAG查询工具')
    parser.add_argument('vectorstore', help='向量数据库路径或JSON文件')
    parser.add_argument('query', help='查询文本')
    parser.add_argument('--k', type=int, default=3, help='返回结果数量 (默认: 3)')

    args = parser.parse_args()

    path = Path(args.vectorstore)

    if path.suffix == '.json':
        print(f"\n🔍 查询: {args.query}")
        print(f"📁 格式: LangChain JSON")
        print(f"📊 数量: {args.k}")
        print("-" * 60)

        results = query_langchain_json(str(path), args.query, args.k)

        for i, (score, doc) in enumerate(results, 1):
            print(f"\n📄 结果 {i} (相似度: {score:.4f})")
            print(f"   标题: {doc.metadata.get('title', 'N/A')}")
            print(f"   来源: {doc.metadata.get('source', 'N/A')}")
            print(f"\n   内容预览:")
            content = doc.page_content[:500]
            if len(doc.page_content) > 500:
                content += "..."
            print(f"   {content}")

    elif path.is_dir():
        print(f"\n🔍 查询: {args.query}")
        print(f"📁 格式: ChromaDB")
        print(f"📊 数量: {args.k}")
        print("-" * 60)

        results = query_chroma(str(path), args.query, args.k)

        if not results['documents']:
            print("未找到结果")
            return

        for i, (doc, meta) in enumerate(zip(results['documents'][0], results['metadatas'][0]), 1):
            print(f"\n📄 结果 {i}")
            print(f"   标题: {meta.get('title', 'N/A')}")
            print(f"   来源: {meta.get('source', 'N/A')}")
            content = doc[:500]
            if len(doc) > 500:
                content += "..."
            print(f"\n   内容预览:")
            print(f"   {content}")
    else:
        print(f"错误: 不支持的文件格式: {path}")
        sys.exit(1)


if __name__ == '__main__':
    main()
