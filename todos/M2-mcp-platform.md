# M2 — MCP 平台

> **状态**：已完成  
> **完成日期**：2026-06-25  
> **周期**：2.5 ~ 3 人周（2 人）  
> **前置**：M1 完成  
> **参考代码**：`MCP-Client/src/core/mcp/`、`src/mcp-servers/`、`src/api/info.controller.ts`  
> **现查**：`src/core/mcp/`、`src/mcp-servers/`、`src/api/info.controller.ts`

---

## 目标

完整实现 MCP 多服务器连接、工具聚合、OAuth、连接状态机、协议扩展；Info/Settings 所需 MCP API 与内置 Demo MCP 全部就绪。

---

## M2-01 packages/mcp-runtime

- [x] **M2-01-01** `McpConnectionPool`：serverId → 连接实例
- [x] **M2-01-02** HTTP + stdio 传输：**`@modelcontextprotocol/sdk`**（对齐 `server-connection.ts`；stdio **仅 worker**）
- [x] **M2-01-03** 连接状态机：`connecting | connected | needs-auth | failed`
- [x] **M2-01-04** 断线重连 + 工具列表 TTL 缓存
- [x] **M2-01-05** `ToolNameCodec`：多服工具名唯一化
- [x] **M2-01-06** `tool-policy.service` 工具策略过滤

## M2-02 MCP 配置存储

- [x] **M2-02-01** Prisma：`MCPServer`、`MCPServerAuth` 读写
- [x] **M2-02-02** per-user 覆盖（无 MCP 自动 seed；Info 页手动添加）
- [x] **M2-02-03** CRUD service（Settings 页复用）

## M2-03 OAuth

- [x] **M2-03-01** PKCE 流程（Streamable HTTP）
- [x] **M2-03-02** `GET /api/server/:id/oauth/authorize`
- [x] **M2-03-03** `GET /api/mcp/oauth/callback`
- [x] **M2-03-04** Token 持久化 + 刷新

## M2-04 Info API

- [x] **M2-04-01** `GET /api/info` — 服务器/工具/连接汇总
- [x] **M2-04-02** `GET /api/client-info`
- [x] **M2-04-03** `POST /api/server/connect|switch|disconnect/:id`
- [x] **M2-04-04** `POST /api/server/add|update|delete`
- [x] **M2-04-05** `POST /api/server/reload-config`
- [x] **M2-04-06** Tool preferences GET/PUT
- [x] **M2-04-07** `POST /api/server/:id/tools/call`（Info 页测试）
- [x] **M2-04-08** Resources/Prompts preview 路由

## M2-05 Agent 集成

- [x] **M2-05-01** Agent 启动时从 Pool 拉取 tools → 注入 `agent-core` loop
- [x] **M2-05-02** Workflow-scoped 工具过滤（Profile mcpServerIds）
- [x] **M2-05-03** MCP progress 通知 → SSE parts
- [x] **M2-05-04** `GET /api/mcp/servers`、`POST /api/mcp/probe`

## M2-06 内置 Demo MCP 服

> **Meek 落点**：`apps/worker/mcp-servers/*.ts` 经 `tsconfig.mcp-servers.json` 编译为 `dist/mcp-servers/*.js`；**不写 DB 种子**，Info 页手动添加（`command: node`，`args: dist/mcp-servers/<name>.js`，相对 worker 进程 cwd）。

- [x] **M2-06-01** `echo-mcp`：源码就绪 + worker 打包
- [x] **M2-06-02** `large-json-mcp`：源码就绪 + worker 打包
- [x] **M2-06-03** `product-list-mcp`：源码就绪 + worker 打包

## M2-07 MCP 协议扩展

- [x] **M2-07-01** `mcp-sampling-handler`（Client capabilities）
- [x] **M2-07-02** `mcp-roots-handler`
- [x] **M2-07-03** listResources / listPrompts（Info 展示，不进 Harness 主路径）

## M2-08 Worker 职责边界

> **架构边界（M2-04/05 已落地，08 验收）**：stdio spawn 仅在 worker 进程（`mcp-runtime` + worker 部署）；web MCP 操作仅 `worker-client` → `/internal/mcp/*`；worker internal HTTP 绑定 `127.0.0.1`。

- [x] **M2-08-01** stdio spawn 仅 worker 执行
- [x] **M2-08-02** web 经 HTTP/RPC 调 worker 执行 MCP 操作

---

## 完成检查清单

> Runtime 联机验收：**按需**（代码路径已就绪；问题单独提修）。

- [ ] 同时连接 2+ MCP 服，工具名不冲突 → **按需**
- [ ] Info 页手动添加后，echo / large-json / product-list 三服均可连接并 call tool → **按需**
- [ ] OAuth 远程服 authorize → callback 成功 → **按需**
- [ ] Info API 返回连接状态、Tools、Resources、Prompts → **按需**（API 已实现）
- [ ] Agent 聊天可调用远程与 stdio MCP 工具 → **按需**
- [ ] stdio 服仅在 worker 进程内运行 → **按需**（架构已就绪）

## 参考对照

| 参考文件 | 对齐点 |
|----------|--------|
| `mcp-client-manager.ts` | 聚合与缓存 |
| `mcp-sampling-handler.ts` | sampling/createMessage 骨架 |
| `mcp-roots-handler.ts` | roots/list（`MCP_CLIENT_ROOTS`） |
| `server-connection.ts` | 状态机；listResources / listPrompts / read / getPrompt |
| `mcp-oauth.ts` | PKCE |
| `info.controller.ts` | 全部 Info 路由 |
| `src/mcp-servers/*.ts` | `apps/worker/mcp-servers/` → `dist/mcp-servers/` |
