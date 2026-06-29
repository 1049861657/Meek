# 参考代码 → Meek 落点

> **读者 = 编码 agent（步骤 4）**。本表是**默认落点索引**；编码前仍须 review 现查验证文件存在。边界规则见 `todos/README.md`。

## 使用方式

```
1. 从评审映射表拿到参考路径
2. 在本文件 Grep 参考侧路径
3. 找到 → 写到表内 Meek 落点
4. 未找到 → 停，问用户（禁猜目录）
5. 落点后 Glob Meek 侧是否已有同类模块 → 优先扩展
```

## 进程

| MCP-Client | Meek |
|------------|------|
| `src/app.ts` | `apps/web` 启动 + `apps/worker/src/main.ts` |
| `startMessageBus` / `startChannels` | worker only |

## API（对照 `src/api/routes.ts`）

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
| `frontend/ai.html` | `apps/web/app/chat/` |
| `frontend/settings.html` | `apps/web/app/settings/` |
| `frontend/info.html` | `apps/web/app/mcp/` |
| `frontend/admin.html` | `apps/web/app/admin/` |

## 聊天页（`frontend/src/chat/`）

| 参考 | Meek |
|------|------|
| `storage-contract.js` | `apps/web/lib/chat/storage-contract.ts` |
| `stream-handler.js` / `sse-parse.js` | React hooks；**保留参考 SSE 事件格式** |
| `ui/*-modal.js` | `components/chat/modals/*` |
| `session-idb.js` | `lib/chat/session-idb.ts` |

## 后端核心

| MCP-Client | Meek |
|------------|------|
| `src/core/agent-harness/*` | `packages/agent-core/` |
| `src/core/mcp/*` | `packages/mcp-runtime/` |
| `src/mcp-servers/*` | `apps/worker/mcp-servers/` → `dist/mcp-servers/` |
| `src/core/memory/*` | `packages/agent-core/memory/` |
| `src/config-plane/*` | `packages/config-plane/` |
| `src/message-bus/*` | `apps/worker/message-bus/` |
| `src/channels/*` | `apps/worker/channels/` |
| `src/services/*` | 按职责 → `packages/*` 或 worker |

## 数据

| MCP-Client | Meek |
|------------|------|
| `prisma/schema.prisma` | 同结构；`packages/db` |

## 落点冲突时

| 情况 | 动作 |
|------|------|
| 表内落点已有实现 | 扩展该模块，禁平行新建 |
| 表内落点不存在但邻近模块可承载 | 评审表标注「扩展现有」并等确认 |
| 表无条目 | 不编码；回 review 补映射 |
