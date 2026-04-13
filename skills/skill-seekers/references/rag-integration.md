# RAG 知识库集成

## 快速开始

```bash
# 1. 抓取文档
skill-seekers create https://docs.django.com/

# 2. 导出为RAG格式
skill-seekers package output/django --format langchain

# 3. 使用代码（见下方各格式）
```

---

## LangChain 集成

```bash
skill-seekers package output/django --format langchain
# → output/django-langchain.json
```

**Python 使用：**

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.schema import Document
import json

# 加载文档
documents = []
with open("output/django-langchain/documents.json") as f:
    for doc in json.load(f):
        documents.append(Document(
            page_content=doc["content"],
            metadata=doc["metadata"]
        ))

# 创建向量存储
vectorstore = Chroma.from_documents(
    documents,
    OpenAIEmbeddings(),
    collection_name="django-docs"
)

# 检索
results = vectorstore.similarity_search("Django ORM 使用", k=3)
```

---

## LlamaIndex 集成

```bash
skill-seekers package output/django --format llama-index
# → output/django-llama-index.json
```

**Python 使用：**

```python
from llama_index import VectorStoreIndex
from llama_index.schema import TextNode
import json

nodes = [TextNode.from_dict(n) for n in json.load(open("output/django-llama-index.json"))]
index = VectorStoreIndex(nodes)
query_engine = index.as_query_engine()
response = query_engine.query("Django ORM 使用")
```

---

## ChromaDB 集成

```bash
# 直接上传
skill-seekers package output/django --format chroma --upload

# 或仅导出
skill-seekers package output/django --format chroma
# → output/django-chroma/ 目录
```

**Python 使用：**

```python
import chromadb

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection("django-docs")

collection.add(
    documents=["Django is a web framework..."],
    metadatas=[{"source": "django docs"}],
    ids=["doc1"]
)

results = collection.query(
    query_texts=["How to use Django ORM?"],
    n_results=3
)
```

---

## FAISS 集成

```bash
skill-seekers package output/django --format faiss
# → output/django-faiss.index + output/django-faiss-metadata.json
```

**Python 使用：**

```python
import faiss
import json
import numpy as np

index = faiss.read_index("output/django-faiss.index")
with open("output/django-faiss-metadata.json") as f:
    metadata = json.load(f)

query_vector = np.random.randn(1536).astype('float32')
D, I = index.search(query_vector.reshape(1, -1), k=5)
```

---

## Weaviate/Qdrant

```bash
# Weaviate
export WEAVIATE_URL=http://localhost:8080
export WEAVIATE_API_KEY=your-key
skill-seekers package output/django --format weaviate --upload

# Qdrant
export QDRANT_URL=http://localhost:6333
export QDRANT_API_KEY=your-key
skill-seekers package output/django --format qdrant --upload
```

---

## Haystack 集成

```bash
skill-seekers package output/django --format haystack
# → output/django-haystack.json
```

**Python 使用：**

```python
from haystack import Document
import json

with open("output/django-haystack/documents.json") as f:
    documents = [Document.from_dict(doc) for doc in json.load(f)]

# 用于 Haystack RAG 管道
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore

store = InMemoryDocumentStore()
store.write_documents(documents)
retriever = InMemoryBM25Retriever(document_store=store)
result = retriever.run(query="Django ORM 使用", top_k=3)
```

---

## Pinecone 集成

```bash
pip install skill-seekers[pinecone]
skill-seekers package output/django --format pinecone --upload
```

**Python 使用：**

```python
from pinecone import Pinecone
import json

pc = Pinecone(api_key="your-api-key")
index = pc.Index("django-docs")

with open("output/django-pinecone/vectors.json") as f:
    vectors = json.load(f)

# 批量上传
index.upsert(vectors=vectors)

# 查询
results = index.query(vector=[0.1, 0.2, ...], top_k=3)
```

---

## 元数据过滤

```python
# 按类别过滤
results = vectorstore.similarity_search(
    "How to use chains?",
    filter={"category": "api"}
)

# 按来源过滤
results = vectorstore.similarity_search(
    "Authentication",
    filter={"source": "security-guide"}
)
```

---

## 性能对比

| 方案 | 数据量 | 特点 |
|------|--------|------|
| Chroma | <10K | 本地，简单 |
| FAISS | 10K-1M | 高效，内存 |
| Qdrant | >1M | 云原生，高可用 |
| Weaviate | >1M | 混合搜索 |
| Haystack | 任意 | 企业级管道 |
| Pinecone | >1M | 托管服务，高可用 |