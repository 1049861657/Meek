# 参考代码 → Meek 落点

边界与现查规则见 [`todos/README.md`](../../todos/README.md)。

## 进程

| MCP-Client | Meek |
|------------|------|
| `src/app.ts` | `apps/web` 启动 + `apps/worker/src/main.ts` |
| `startMessageBus` / `startChannels` | worker only |

## API（`src/api/routes.ts`）

| 控制器 | Meek |
|--------|------|
| `ai.controller.ts` | `apps/web/app/api/chat/*` + worker agent |
| `info.controller.ts` | `apps/web/app/api/info/*`、`server/*` |
| `settings.controller.ts` | `apps/web/app/api/settings/*` |
| `admin.controller.ts` | `apps/web/app/api/admin/*` |
| `sessions.controller.ts` | `apps/web/app/api/sessions/*` |
| `users.controller.ts` | `apps/web/app/api/users/*` |
| `memory-debug.controller.ts` | `apps/web/app/api/memory/debug/*` |
| `config.controller.ts` | `apps/web/app/api/config/*` |
| `user-auth.ts` | middleware + better-auth |
| `lib/auth.ts` | `apps/web/lib/auth.ts` |

## 前端 HTML → 路由

| MCP-Client | Meek |
|------------|------|
| `frontend/index.html` | `apps/web/app/page.tsx` |
| `frontend/ai.html` | `apps/web/app/ai/` |
| `frontend/settings.html` | `apps/web/app/settings/` |
| `frontend/info.html` | `apps/web/app/info/` |
| `frontend/admin.html` | `apps/web/app/admin/` |

## 聊天页模块（`frontend/src/chat/`）

| 参考 | Meek 建议 |
|------|-----------|
| `storage-contract.js` | `apps/web/lib/chat/storage-contract.ts` |
| `stream-handler.js` / `sse-parse.js` | React hooks，保留参考 SSE 事件格式 |
| `ui/*-modal.js` | `components/chat/modals/*` |
| `session-idb.js` | `lib/chat/session-idb.ts` |

## 后端核心

| MCP-Client | Meek |
|------------|------|
| `src/core/agent-harness/*` | `packages/agent-core/` |
| `src/core/mcp/*` | `packages/mcp-client/` |
| `src/mcp-servers/*` | `apps/worker/mcp-servers/` 或 `packages/mcp-client/servers/` |
| `src/core/memory/*` | `packages/agent-core/memory/` |
| `src/config-plane/*` | `packages/config-plane/` |
| `src/message-bus/*` | `apps/worker/message-bus/` |
| `src/channels/*` | `apps/worker/channels/` |
| `src/services/*` | 按职责进 `packages/*` 或 worker |

## 数据

| MCP-Client | Meek |
|------------|------|
| `prisma/schema.prisma` | 同结构；`packages/db` |
