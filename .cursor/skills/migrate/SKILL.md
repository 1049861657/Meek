---
name: meek-migrate
description: >-
  Migrate MCP-Client landed source into Meek (Next.js 16 + Worker) with behavior
  parity. Use when the user says 迁移, Meek, M0-M6, 复刻, MCP-Client 参考, or asks to
  implement a migration task with optional 优化/改进/重构. After each batch: readonly
  generalPurpose gate (not Bugbot), adjudicate all proposals; gate items append as Mx-yy-Dnn
  sub-items under parent tasks and complete same batch (see delivery.md).
paths:
  - "todos/**"
  - "apps/**"
  - "packages/**"
  - "prisma/**"
  - "docs/**"
metadata:
  version: "4.2"
  modes: migrate, optimize
---

# Meek Migrate

> **读者 = 执行迁移批次的父 agent**。本文件是总路由；各阶段细节见链接文档。

## 仓库与边界

| 项 | 路径 |
|----|------|
| 任务书 | `todos/README.md` + `todos/M*.md` |
| Meek 代码 | `D:\gitProject\Meek` |
| 参考代码 | `D:\gitProject\MCP-Client\{src,frontend/src,prisma}\` |
| 运行时 ADR | `docs/adr-006-agent-runtime-hybrid.md` |
| **禁作范围来源** | `MCP-Client/todos/`（禁用来定本批范围） |

## 模式选择（编码前定一次）

```
用户是否明确说 优化 / 改进 / 重构？
├─ 否 → migrate（默认）：任务书 + 参考 parity，禁擅自改 API/存储键
└─ 是 → optimize：见 optimize.md；仍须任务书门禁与 delivery 裁决
```

## 执行清单（逐步，不得跳步）

| 步 | 动作 | 读哪个文档 |
|----|------|------------|
| 0 | 解析批次号 `Mx-yy`、本批 `todos/M*.md` 条目 | 本文件 |
| 1 | Read 本批任务书 + `todos/README.md` 禁止项 | 任务书 |
| 2 | 现查参考（锚点 + Glob） | review.md |
| 3 | 输出映射表 → **等用户确认**（用户说「跳过评审」才可跳过） | review.md |
| 4 | 编码；边做边记变更路径 | iron-rules.md + reference-map.md |
| 5 | 验证 routes / storage-contract / `pnpm build` | iron-rules.md |
| 6 | 勾选本批 `M*.md` + 更新 `todos/README.md` 进度 | 任务书 |
| 7 | 填变更清单 → 跑门禁 subagent | delivery.md |
| 8 | 按 delivery.md 决策树裁决全部 proposals + Grep `Mx-yy-Dnn` | delivery.md |
| 9 | 发交付正文（含裁决表）→ **此后**方可对用户说「本批完成」 | delivery.md |

**步骤 6 ≠ 步骤 9**：勾选任务书后还必须完成 7–8。

## 现查锚点（步骤 2 必读）

按顺序 Read：

1. `MCP-Client/src/api/routes.ts`
2. `MCP-Client/frontend/src/chat/storage-contract.js`（或 Meek 对应 `storage-contract.ts`）
3. `MCP-Client/prisma/schema.prisma`
4. 本批 `M*.md` 里「现查」节的 Glob 目标
5. `todos/README.md` 禁止项

## ADR-006 硬约束（违反即 BLOCK）

| 必须 | 禁止 |
|------|------|
| Harness + `openai` + `@modelcontextprotocol/sdk` | `ai` / `@ai-sdk/*` |
| chatStream：`registerSink → publishInbound → worker` | 绕过 worker 直推 SSE |
| SSE 对齐 `web-channel.adapter.ts` | 自造事件名/字段 |

## 阶段路由

| 阶段 | 何时进入 | 文档 |
|------|----------|------|
| 评审 | 步骤 2–3 | [review.md](./review.md) |
| 编码 | 步骤 4–5 | [iron-rules.md](./iron-rules.md) |
| 落点查表 | 步骤 4 编码时 | [reference-map.md](./reference-map.md) |
| 优化 | optimize 模式或 proposals | [optimize.md](./optimize.md) |
| 交付 | 步骤 7–9 | [delivery.md](./delivery.md) |

## 全局禁止

- 未 Read 参考就写实现
- migrate 模式下改 `/api/*` 路径或 storage 键名
- 把 MCP-Client 源文件原样拷进 Meek（须对照重写）
- 新建 `apps/web/docs/`
- 使用 `npm` / `yarn`（用 `pnpm`）
