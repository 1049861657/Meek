# ADR-006：Agent 运行时 — Harness 移植（无 AI SDK）

> 日期：2026-06-17  
> 状态：**已采纳**（用户确认）  
> 关联：[`agent-architecture-research-2026.md`](./agent-architecture-research-2026.md)、[`../todos/README.md`](../todos/README.md)

---

## 背景

MCP-Client 实际栈：

- **`openai`** + 自研 **`agent-harness/agent-loop.ts`**
- **`@modelcontextprotocol/sdk`** — HTTP / stdio MCP **均用此包**（见 `server-connection.ts`、`mcp-client-manager.ts`）
- Web **`chatStream`**：`registerSink` → **`publishInbound`（BullMQ）** → worker → **自研 SSE**
- **无** Vercel AI SDK

---

## 决策

| 层 | 选型 |
|----|------|
| Agent 控制面 | **移植** `src/core/agent-harness/` → `packages/agent-core` |
| LLM | **`openai` 包**（与参考一致） |
| MCP（HTTP + stdio） | **`@modelcontextprotocol/sdk`** + 自研 `packages/mcp-runtime`（连接池 / ToolNameCodec / OAuth，对齐 `src/core/mcp/`） |
| Web 聊天 | **BullMQ 入站** + 参考 SSE + React 移植 `stream-handler` |
| **不引入** | `ai`、`@ai-sdk/react`、`@ai-sdk/mcp`、`ToolLoopAgent`、`useChat` |

**理由**：参考产品 MCP 已全用 `@modelcontextprotocol/sdk`；仅 HTTP 走 AI SDK 多一套依赖、OAuth/连接状态机仍要自研，收益不足。

---

## Web 走队列（硬约束）

与 `ai.controller.ts` 一致：`registerSink` → `publishInbound` → worker。**禁止** Web 直连 Agent。

---

## 依赖顺序

M0（含 Redis）→ M1 agent-core + M1-07 Message Bus Web → MS1 → M2 MCP（`@modelcontextprotocol/sdk`）→ …

---

## 验收

- 无 `ai` / `@ai-sdk/*` 出现在 `package.json`
- MCP HTTP/stdio 行为对齐 `mcp-client-manager.ts`、`server-connection.ts`
- SSE 对齐 `web-channel.adapter.ts`
