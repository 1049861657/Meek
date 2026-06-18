# M4 — 配置平面、Admin API 与认证会话

> **状态**：未开始  
> **周期**：3 ~ 4 人周（2 人）  
> **前置**：M0 Auth + 完整 Prisma；M1 完成后与 M2 并行  
> **参考代码**：`MCP-Client/src/config-plane/`、`src/api/admin.controller.ts`、`settings.controller.ts`、`sessions.controller.ts`、`users.controller.ts`、`src/core/memory/`  
> **现查**：`src/config-plane/`、`*controller.ts`（admin/settings/sessions/users/memory-debug）、`src/core/memory/`

---

## 目标

完整实现 Config Plane、全部 Admin/Settings/Users API、服务端聊天会话持久化、Hindsight Memory 调试 API。

---

## M4-01 packages/config-plane

- [ ] **M4-01-01** `AgentProfile`、`RouteRule`、`Setting`、`AIProvider`、`QuickMessage` 等读写
- [ ] **M4-01-02** `resolveProfile(channel, matchKey, userId)`
- [ ] **M4-01-03** 配置快照 reload（`config-snapshot.ts`）
- [ ] **M4-01-04** Web：localStorage 全局 + body 覆盖；IM：仅 Profile
- [ ] **M4-01-05** seed 默认 Profile/Route/Provider/MCP
- [ ] **M4-01-06** `seed-follow.service`（种子跟随账号）
- [ ] **M4-01-07** Config **运行时单入口**（聚合 `feature-config` + DB `Setting` 解析，对齐参考调用行为）

## M4-02 Admin API（SUPERADMIN）

- [ ] **M4-02-01** `requireSuperAdmin` 中间件
- [ ] **M4-02-02** `POST /api/admin/seed`
- [ ] **M4-02-03** Profile CRUD + reset
- [ ] **M4-02-04** Route CRUD
- [ ] **M4-02-05** `GET/PUT /api/admin/channel-config`
- [ ] **M4-02-06** `GET /api/admin/channel-status`

## M4-03 用户管理 API

- [ ] **M4-03-01** `GET /api/users`
- [ ] **M4-03-02** `POST /api/users/:id/role`
- [ ] **M4-03-03** `POST /api/users/:id/reset-password`
- [ ] **M4-03-04** Seed follow GET/PUT
- [ ] **M4-03-05** `bootstrap-users` 首启超级管理员

## M4-04 Settings API（全路由）

- [ ] **M4-04-01** Provider CRUD + reload + reset
- [ ] **M4-04-02** `GET /api/settings/provider-types`
- [ ] **M4-04-03** Tool prompt get/save/reset
- [ ] **M4-04-04** MCP servers reset
- [ ] **M4-04-05** `GET /api/settings/system-prompt-sections`
- [ ] **M4-04-06** 写操作 `requireAuth`；读接口匿名策略对齐参考

## M4-05 聊天会话（参考 `chat-store.service.ts`、`sessions.controller.ts`）

- [ ] **M4-05-01** `ChatSession`、`ChatMessage` 读写
- [ ] **M4-05-02** `GET/POST/DELETE /api/sessions`
- [ ] **M4-05-03** `GET /api/sessions/:id/messages`
- [ ] **M4-05-04** append-only 消息；级联删除
- [ ] **M4-05-05** Authed 聊天写回 DB；Guest 仍 IDB
- [ ] **M4-05-06** `compactBaselineJson` 字段读写

## M4-06 Memory（参考 `src/core/memory/`、`memory-debug.controller.ts`）

- [ ] **M4-06-01** Hindsight memory provider（recall/retain）
- [ ] **M4-06-02** `memory-pipeline-context` 注入 Prompt
- [ ] **M4-06-03** `GET /api/memory/debug/meta`
- [ ] **M4-06-04** `POST /api/memory/debug/recall|reflect|prompt`
- [ ] **M4-06-05** MemoryDebugModal 数据全对接（M3 UI）

## M4-07 渠道绑定

- [ ] **M4-07-01** `channel-binding.service`（IM boundUserId）
- [ ] **M4-07-02** `channel-config.service` 读写与校验

---

## 完成检查清单

- [ ] SUPERADMIN 可 CRUD Profile/Route/Channel/User
- [ ] Web 聊天 body 覆盖不污染 IM Profile
- [ ] 登录用户会话跨刷新/跨设备保留（同账号）
- [ ] 非 superadmin 无法访问 Admin API 与 `/admin` 页
- [ ] Memory debug recall/reflect/prompt 全可用
- [ ] Settings API 与 MCP-Client `routes.ts` 逐条对齐

## 参考对照

| 参考代码 | 对齐点 |
|----------|--------|
| `profile-resolver.ts` | 渠道路由 |
| `admin.controller.ts` | Admin API |
| `settings.controller.ts` | Settings API |
| `sessions.controller.ts` | 会话 CRUD |
| `memory-debug.controller.ts` | Memory 调试 |
