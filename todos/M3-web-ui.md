# M3 — Web 前端全页面

> **状态**：未开始  
> **周期**：4 ~ 5 人周（2 人）  
> **前置**：M1 SSE 契约稳定；M2 Info API 就绪（Info 页）  
> **参考代码**：`MCP-Client/frontend/src/`（入口见 `frontend/*.html`）  
> **现查**：`frontend/src/`、`frontend/*.html`

---

## 目标

用 React + Next.js **全量重写** 5 个页面、全部 Modal、共享 Design System；功能与存储契约对齐参考产品。

---

## M3-01 Design System（`apps/web/components/ui`）

- [ ] **M3-01-01** Tailwind v4 主题令牌（对齐参考 `theme.css`）
- [ ] **M3-01-02** Button / Toggle / Spinner
- [ ] **M3-01-03** Modal（overlay + confirm 两种）
- [ ] **M3-01-04** DropdownSelect / Segmented / Stepper
- [ ] **M3-01-05** Toast / Tooltip / StatusChip / EmptyState
- [ ] **M3-01-06** FormField / InputDialog / StatusPill / ChipGroup

## M3-02 共享壳

- [ ] **M3-02-01** Navbar（路由高亮、Auth 态）
- [ ] **M3-02-02** AuthModal + LoginForm + NavAuth（better-auth）
- [ ] **M3-02-03** `fetch-json` 封装 + 错误 toast

## M3-03 聊天页 `/ai`

- [ ] **M3-03-01** SSE hooks 完整接入（O10，对齐 `stream-handler.js`）
- [ ] **M3-03-02** 消息列表：user/assistant/tool/reasoning 分渲染
- [ ] **M3-03-03** Markdown + 代码高亮（**lazy load**，对齐 `markdown-stack`）
- [ ] **M3-03-04** Tool 卡片：状态机（pending/running/approval/done/error）
- [ ] **M3-03-05** 权限确认 UI → `permission-resolve`
- [ ] **M3-03-06** 停止生成、重试、错误态
- [ ] **M3-03-07** Planning / Todo 浮层（`planning-panel` + `todo-card-view`）
- [ ] **M3-03-08** Usage telemetry 展示（对齐 `usage-telemetry.js`）
- [ ] **M3-03-09** Prompt 编辑器（`prompt-editor.js`）
- [ ] **M3-03-10** MCP 选择器（`mcp-selection.js`）
- [ ] **M3-03-11** `message-history-builder` / context-preview UI
- [ ] **M3-03-12** `turn-collector` / 流式 chunk 聚合

### M3-03 聊天 Modal（6 个，全量）

- [ ] **M3-03-13** SettingsModal（模型/MCP/Profile 覆盖）
- [ ] **M3-03-14** HistoryModal（会话列表）
- [ ] **M3-03-15** McpModal（服务器选择）
- [ ] **M3-03-16** CompactModal（上下文压缩）
- [ ] **M3-03-17** MemoryDebugModal（Recall/Reflect/Prompt 注入预览）
- [ ] **M3-03-18** SystemToolsModal

### M3-03 会话存储

- [ ] **M3-03-19** Guest：IndexedDB `AIChatDatabase` 契约对齐
- [ ] **M3-03-20** Authed：服务端 `/api/sessions` 双向同步
- [ ] **M3-03-21** `localStorage` `aiChatSettings` 契约
- [ ] **M3-03-22** `aiCompactBaseline:{sessionId}` + `compact-baseline-storage`
- [ ] **M3-03-23** QuickMessage 面板（读写本地化 + 种子拉取）
- [ ] **M3-03-24** `chat-request-body` / `config-fetch` / `context-messages` 对齐
- [ ] **M3-03-25** `lib/chat/storage-contract.ts`：单模块导出全部 localStorage/IDB 键名（对齐 `storage-contract.js`）

## M3-04 Settings 页 `/settings`

- [ ] **M3-04-01** AI Provider CRUD + 模型列表
- [ ] **M3-04-02** Provider 导入/导出剪贴板（`provider-clipboard.js`）
- [ ] **M3-04-03** MCP 服务器 CRUD（stdio/HTTP 表单）
- [ ] **M3-04-04** Tool Prompt 编辑器
- [ ] **M3-04-05** System Prompt Sections 展示
- [ ] **M3-04-06** Reset 操作 + 确认对话框

## M3-05 Info 页 `/info`

- [ ] **M3-05-01** 客户端/服务器信息总览
- [ ] **M3-05-02** Tools 面板 + 连接状态点（`tools-panel.js`）
- [ ] **M3-05-03** Resources / Prompts 面板（`rp-panel.js`）
- [ ] **M3-05-04** Tool 测试 Drawer（`tool-test-drawer.js`）
- [ ] **M3-05-05** Tool preferences 编辑

## M3-06 Landing `/`

- [ ] **M3-06-01** 产品介绍 + 导航 CTA（参考 `landing/`；**静态壳用 RSC**）

## M3-07 Admin 页 `/admin`（参考 `frontend/src/admin/`，API 见 M4）

- [ ] **M3-07-01** Profile 列表/编辑表单
- [ ] **M3-07-02** Route 规则编辑器
- [ ] **M3-07-03** Channel Config 面板（`channel-config-panel.js`）
- [ ] **M3-07-04** Channel Status 仪表盘
- [ ] **M3-07-05** 用户管理表格 + Seed 初始化按钮

---

## 功能契约（`frontend/src/chat/storage-contract.js`）

| 契约 | 验证 |
|------|------|
| `localStorage` `aiChatSettings` | 改设置 → 刷新仍生效 |
| IDB `AIChatDatabase` | guest 会话可读；需提供迁移/兼容策略 |
| SSE tool 卡片 | 发消息、停生成、多 tool 并行 |
| 请求体 | 对照 `chat-request-body` / `normalize-web-inbound` |
| guest/authed | 双模式切换无数据丢失 |

---

## 完成检查清单

- [ ] 5 页面 + 6 Modal 对照 `frontend/src/` 模块清单
- [ ] 存储键与 `storage-contract.js` 一致
- [ ] Settings 改 Provider 后聊天可用新模型
- [ ] Info 页可测工具、见 OAuth 状态、Resources/Prompts 可预览
- [ ] Admin 页 SUPERADMIN 全流程可操作
- [ ] Markdown lazy bundle，首屏体积可接受

## 参考文件映射

| 参考 | Meek |
|------|------|
| `frontend/src/chat/*` | `apps/web/app/ai/` + `components/chat/` |
| `frontend/src/settings/*` | `apps/web/app/settings/` |
| `frontend/src/info/*` | `apps/web/app/info/` |
| `frontend/src/admin/*` | `apps/web/app/admin/` |
| `frontend/src/shared/ui/*` | `apps/web/components/ui/` |
