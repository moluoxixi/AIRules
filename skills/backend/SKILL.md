---
name: backend
description: Use when 处理 API、service、输入校验、数据访问、错误映射或外部副作用边界。
---

# Backend

## 概述

这个 skill 处理技术栈无关的后端问题，重点是 API/契约形状、服务职责、校验、错误处理和副作用边界。

它关注跨技术栈共性，而不是 Nest、Spring、Django 之类的框架特定模式。

## 何时使用

- 任务涉及 API、service、数据访问或集成行为
- 需要明确输入校验、错误映射、幂等或副作用边界
- 你在判断 transport、domain 和 persistence 之间该怎么拆职责

## 不在这些情况下使用

- 问题主要是前端页面、交互或状态归属
- 问题主要是某个框架特定模式，例如 Nest 模块、Spring 分层

## 核心指导

- 先定义清晰的 API/契约形状和预期结果
- 在系统边界处完成校验和归一化
- 让 service 职责保持收敛，不要把持久化和编排内部细节混进 handler
- 把数据库、队列、外部 API 等副作用放在显式边界后面

## 常见误区

- 让 controller / handler 既做编排又直接做持久化
- 把内部错误原样暴露成不稳定的外部错误面
- 把副作用散落在多个层里，导致不可观察、不可测试

## 相关 Skills

- `standard-workflow`
- `javascript`, `typescript`
- `frontend`
- `testing`, `verification`
