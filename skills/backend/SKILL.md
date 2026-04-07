---
name: backend
description: Use when 处理 API、service、输入校验、数据访问、错误映射或外部副作用边界。
---

# Backend

## 概述

这个 skill 处理技术栈无关的后端共性问题，关注点是 API/契约形状、service 职责、校验、错误映射和副作用边界。

它不负责框架特定模式，例如 Nest 模块、Spring 分层、Django 约定。

## 何时使用

- 任务涉及 API、service、数据访问或集成行为
- 需要明确输入校验、错误映射、幂等或副作用边界
- 你在判断 transport、domain 和 persistence 之间该如何拆职责

## 不在这些情况下使用

- 问题主要是前端页面、交互或状态归属
- 问题主要是某个框架特定模式，而不是跨栈后端共性

## 快速参考

- 先定义 API/契约形状，再拆实现
- 在系统边界完成校验和归一化
- service 保持收敛，不要把编排和持久化揉进同一层
- 把副作用显式隔离在边界后面
- 错误映射成稳定的外部错误面

## 常见误区

- handler 同时做编排、持久化和校验
- 直接暴露内部错误，导致外部错误面不稳定
- 把副作用散落在多个层里，后续难以测试和追踪

## 相关 Skills

- `standard-workflow`
- `javascript`, `typescript`
- `frontend`
- `testing`, `verification`
