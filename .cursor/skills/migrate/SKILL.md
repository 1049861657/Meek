---
name: meek-migrate
description: >-
  Migrate MCP-Client landed source into Meek (Next.js 16 + Worker) with behavior
  parity. Use when the user says 迁移, Meek, M0-M6, 复刻, MCP-Client 参考, or asks to
  implement a migration task with optional 优化/改进/重构.
paths:
  - "todos/**"
  - "apps/**"
  - "packages/**"
  - "prisma/**"
  - "docs/**"
metadata:
  version: "2"
  modes: migrate, optimize
---

# Meek Migrate

**任务书** [`todos/README.md`](../../todos/README.md) + [`todos/M*.md`](../../todos/)  
**参考源码** `../MCP-Client/src/`、`../MCP-Client/frontend/src/`、`../MCP-Client/prisma/`  
**运行时** [`docs/adr-006-agent-runtime-hybrid.md`](../../docs/adr-006-agent-runtime-hybrid.md)  
**禁止** 以 `../MCP-Client/todos/` 界定范围。

## 现查锚点（每批次编码前）

| 锚点 | 路径 |
|------|------|
| API | `src/api/routes.ts` |
| 存储键 | `frontend/src/chat/storage-contract.js` |
| 数据模型 | `prisma/schema.prisma` |
| 本批目录 | 见 `todos/M*.md` 头部「现查」 |
| 禁止项 | `todos/README.md` |

## 双模式

| 模式 | 触发 | 目标 |
|------|------|------|
| **migrate**（默认） | 做 Mx-yy、复刻 | 按任务书 + 参考源码对齐 |
| **optimize** | 用户明确说优化/重构等 | 超出任务书的改进；见 [optimize.md](./optimize.md) |

## 执行清单

```
[ ] 0  解析批次：M3 / M3-03 / M3-03-04
[ ] 1  Read todos/M*.md 对应节
[ ] 2  现查 MCP-Client（锚点 + Glob 本批目录）
[ ] 3  参考映射表（见 review.md）→ 用户确认（未说跳过评审时）
[ ] 4  编码：iron-rules + main-rule
[ ] 5  验证：routes.ts / storage-contract / pnpm build
[ ] 6  勾选任务 + 更新 todos/README.md 进度
[ ] 7  交付：做了什么 / 参考路径 / 差异（若有）
```

## 硬约束（ADR-006）

- Harness 移植 + `openai` + `@modelcontextprotocol/sdk`；**不装** `ai` / `@ai-sdk/*`
- Web `chatStream`：**registerSink → publishInbound → worker**；禁止直连 Agent
- SSE 对齐 `web-channel.adapter.ts`；前端移植 `stream-handler.js`

## Meek 落点

见 [reference-map.md](./reference-map.md)。

## 阶段路由

| 阶段 | 读 |
|------|-----|
| 评审 | [review.md](./review.md) |
| 编码 | [iron-rules.md](./iron-rules.md) |
| optimize | [optimize.md](./optimize.md) |
| 交付 | [delivery.md](./delivery.md) |

## 禁止

- MCP-Client `todos/` 定范围  
- 未读参考源码就写 API/UI  
- 改 API 路径或存储键（migrate 模式）  
- `npm` / `yarn`
