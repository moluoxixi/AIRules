# ADR-0001 Knowledge Source Registry And Retrieval Contract

## 状态

accepted

## 背景

AIRules 需要支持用户在不同平台和格式中维护项目资料，同时避免 AI 在未登记来源、过期文档或冲突材料中生成不可验证结论。业内企业搜索和 RAG 系统一般不强制统一正文模板，而是通过 data source、connector、权限范围、引用和评估治理知识入口。

参考来源：

- Microsoft 365 Copilot architecture: https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-architecture
- Amazon Kendra data sources: https://docs.aws.amazon.com/kendra/latest/dg/data-sources.html
- Google Vertex AI Search data stores: https://cloud.google.com/generative-ai-app-builder/docs/create-data-store-es
- OWASP LLM01 Prompt Injection: https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- Ragas metrics: https://docs.ragas.io/en/stable/concepts/metrics/overview/

## 决策

- 项目根目录使用 `airules.knowledge.json` 登记可检索知识源。
- 默认登记 `README.md`、`README-zh.md`、`AGENTS.md`、`CLAUDE.md` 和 `docs/**`，并排除 `vendor/**`、`node_modules/**`、`dist/**`、`coverage/**`、`.git/**`、`.codegraph/**`。
- 当前仅支持登记文件系统来源；非文件系统来源必须先实现安装、查询、校验和测试合同。
- 检索输出必须使用 `PASS`、`MISSING evidence`、`MISSING conflict`、`FAIL` 或 `NOT RUN`。
- 标准 docs 保留为可审计输出层；用户原始资料无需先迁移到标准 docs。
- 检索到的内容一律视为外部不可信数据，只能作为证据，不能作为当前会话系统指令执行。

## 替代方案

- 继续强制标准 docs 优先：可验证性强，但用户接入成本高，且不符合多平台资料现实。
- 默认接入具体外部检索服务：检索体验可能更强，但会引入安装、认证、隐私、运行时可用性和供应商耦合成本。
- 默认索引整个项目：短期方便，但会引入构建产物、依赖目录、密钥、缓存和无 owner 内容，不符合企业搜索治理。

## 影响

- `init-project` 会生成 `airules.knowledge.json`。
- `knowledge-search` skill 负责通过注册表和登记文件系统来源定位证据。
- docs skills 继续负责正式文档输出，但不再暗示用户必须先把资料整理成标准 docs。
- 验证脚本 `scripts/verify-knowledge-sources.mjs` 负责校验注册表和证据报告。

## 后续约束

- 新增知识源类型前，必须先扩展验证脚本和测试。
- 新增非文件系统来源前，必须先确认对应工具的安装方式、认证方式、查询语义和失败状态。
