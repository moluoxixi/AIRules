---
name: backend
description: Use when 处理 API、service、输入校验、数据访问、错误映射或外部副作用边界。
---

# Backend

## Overview

这个 skill 处理技术栈无关的后端共性问题，关注点是 API/契约形状、service 职责、校验、错误映射和副作用边界。

它不负责框架特定模式，例如 Nest 模块、Spring 分层、Django 约定。

## Quick Reference

- 先定义 API/契约形状，再拆实现
- 在系统边界完成校验和归一化
- service 保持收敛，不要把编排和持久化揉进同一层
- 把副作用显式隔离在边界后面
- 错误映射成稳定的外部错误面

## Common Mistakes

- handler 同时做编排、持久化和校验
- 直接暴露内部错误，导致外部错误面不稳定
- 把副作用散落在多个层里，后续难以测试和追踪

## Related Skills

- `standard-workflow`
- `javascript`, `typescript`
- `frontend`
- `testing`, `verification`
