---
name: meek-migrate
description: >-
  Migrate MCP-Client landed source into Meek (Next.js 16 + Worker) with behavior
  parity. Use when the user says 迁移, Meek, M0-M6, 复刻, MCP-Client 参考, or asks to
  implement a migration task with optional 优化/改进/重构. After each batch: readonly
  generalPurpose gate (not Bugbot), adjudicate all proposals, deferred todos as Mx-yy-Dnn;
  see delivery.md.
paths:
  - "todos/**"
  - "apps/**"
  - "packages/**"
  - "prisma/**"
  - "docs/**"
metadata:
  version: "4.1"
  modes: migrate, optimize
---

# Meek Migrate

**任务书** `todos/README.md` + `todos/M*.md` · **参考** `MCP-Client/{src,frontend/src,prisma}/` · **禁** `MCP-Client/todos/` 定范围 · **运行时** `docs/adr-006-agent-runtime-hybrid.md`

## 现查锚点（编码前）

`routes.ts` · `storage-contract.js` · `schema.prisma` · 本批 `M*.md`「现查」Glob · `todos/README.md` 禁止项

## 模式

| 模式 | 触发 | 目标 |
|------|------|------|
| migrate（默认） | Mx-yy、复刻 | 任务书 + 参考 parity |
| optimize | 用户明确优化/重构 | 见 [optimize.md](./optimize.md) |

## 执行清单

```
0  解析批次
1  Read 本批 todos/M*.md
2  现查 MCP-Client（锚点 + Glob）
3  映射表（review.md）→ 用户确认（未说跳过评审）
4  编码（iron-rules；边做边记变更路径）
5  验证 routes / storage-contract / pnpm build
6  勾选 M*.md + 更新 README 进度
7  变更清单 → 门禁 subagent（delivery.md）
8  裁决全部 proposals（采纳|写入 todos Mx-yy-Dnn|拒绝）+ Grep deferred
9  交付正文（含裁决表）→ 方可对用户说「本批完成」
```

## ADR-006 硬约束

Harness + `openai` + `@modelcontextprotocol/sdk`（禁 `ai`/`@ai-sdk/*`）· chatStream：`registerSink → publishInbound → worker` · SSE 对齐 `web-channel.adapter.ts`

## 路由

| 阶段 | 文档 |
|------|------|
| 评审 | [review.md](./review.md) |
| 编码 | [iron-rules.md](./iron-rules.md) |
| 优化 | [optimize.md](./optimize.md) |
| 交付 | [delivery.md](./delivery.md) |
| 落点 | [reference-map.md](./reference-map.md) |

## 禁止

未读参考就写 · 改 API 路径/存储键（migrate）· 拷 JS 进 Meek · 建 `apps/web/docs/` · `npm`/`yarn`
