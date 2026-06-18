# M2 — MCP 平台

> **状态**：未开始  
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
- [x] **M2-02-02** seed 基线（userId=null）+ per-user 覆盖
- [x] **M2-02-03** CRUD service（Settings 页复用）

## M2-03 OAuth

- [x] **M2-03-01** PKCE 流程（Streamable HTTP）
- [x] **M2-03-02** `GET /api/server/:id/oauth/authorize`
- [x] **M2-03-03** `GET /api/mcp/oauth/callback`
- [x] **M2-03-04** Token 持久化 + 刷新

## M2-04 Info API

- [ ] **M2-04-01** `GET /api/info` — 服务器/工具/连接汇总
- [ ] **M2-04-02** `GET /api/client-info`
- [ ] **M2-04-03** `POST /api/server/connect|switch|disconnect/:id`
- [ ] **M2-04-04** `POST /api/server/add|update|delete`
- [ ] **M2-04-05** `POST /api/server/reload-config`
- [ ] **M2-04-06** Tool preferences GET/PUT
- [ ] **M2-04-07** `POST /api/server/:id/tools/call`（Info 页测试）
- [ ] **M2-04-08** Resources/Prompts preview 路由

## M2-05 Agent 集成

- [ ] **M2-05-01** Agent 启动时从 Pool 拉取 tools → 注入 `agent-core` loop
- [ ] **M2-05-02** Workflow-scoped 工具过滤（Profile mcpServerIds）
- [ ] **M2-05-03** MCP progress 通知 → SSE parts
- [ ] **M2-05-04** `GET /api/mcp/servers`、`POST /api/mcp/probe`

## M2-06 内置 Demo MCP 服

- [ ] **M2-06-01** `echo-mcp`：stdio 配置种子 + worker 打包
- [ ] **M2-06-02** `large-json-mcp`：stdio 配置种子 + worker 打包
- [ ] **M2-06-03** `product-list-mcp`：stdio 配置种子 + worker 打包
- [ ] **M2-06-04** 三服默认 seed 写入 DB，Info 页可见

## M2-07 MCP 协议扩展

- [ ] **M2-07-01** `mcp-sampling-handler`（Client capabilities）
- [ ] **M2-07-02** `mcp-roots-handler`
- [ ] **M2-07-03** listResources / listPrompts（Info 展示，不进 Harness 主路径）

## M2-08 Worker 职责边界

- [ ] **M2-08-01** stdio spawn 仅 worker 执行
- [ ] **M2-08-02** web 经 HTTP/RPC 调 worker 执行 MCP 操作

---

## 完成检查清单

- [ ] 同时连接 2+ MCP 服，工具名不冲突
- [ ] 内置 echo / large-json / product-list 三服均可连接并 call tool
- [ ] OAuth 远程服 authorize → callback 成功
- [ ] Info API 返回连接状态、Tools、Resources、Prompts
- [ ] Agent 聊天可调用远程与 stdio MCP 工具
- [ ] stdio 服仅在 worker 进程内运行

## 参考对照

| 参考文件 | 对齐点 |
|----------|--------|
| `mcp-client-manager.ts` | 聚合与缓存 |
| `server-connection.ts` | 状态机 |
| `mcp-oauth.ts` | PKCE |
| `info.controller.ts` | 全部 Info 路由 |
| `src/mcp-servers/*.ts` | 三内置 Demo MCP |
