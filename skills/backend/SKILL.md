---
name: backend
description: 跨技术栈后端指导，覆盖 API 边界、服务职责、校验和错误处理。
---

# Backend

## 概述

这个 skill 处理跨技术栈、跨框架都成立的后端问题，重点是清晰的 API 契约、聚焦的服务职责，以及可预期的副作用边界。

## 何时使用

在任意后端技术栈中实现或审查 API、服务层逻辑、数据访问或集成行为时使用。

## 硬约束

1. 在进入业务逻辑前，先在系统边界完成输入校验和归一化。
2. 服务职责要保持收敛，避免 handler 同时承担持久化和编排内部细节。
3. 内部失败要映射成稳定的外部错误面。
4. 数据库、队列、外部 API 等副作用必须隔离在显式接口后面。

## 流程

1. 先定义 API/契约形状，以及预期的状态和错误结果。
2. 把职责拆分到传输层、领域逻辑层和持久化层。
3. 在边界处明确校验、鉴权和幂等规则。
4. 让写入和副作用显式、可观察、可测试。
5. 围绕成功、失败和边界情况补行为导向测试。

## 边界

这个 skill 保持技术栈无关，不规定 Nest 模块、Spring 分层、Django 约定等框架特定模式。相关细节交给后续的 stack/framework skills。

## 相关 Skills

- `standard-workflow`
- `javascript`, `typescript`
- `frontend`
- `testing`, `verification`
- `personal-defaults`
