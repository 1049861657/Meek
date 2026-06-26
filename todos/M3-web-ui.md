# M3 — Web 前端全页面

> **状态**：未开始  
> **周期**：6 ~ 8 人周（2 人）  
> **前置（硬）**：M1 SSE 契约稳定（MS1）；M2 Info / MCP API 就绪（MS2）  
> **前置（软 / 可 UI 壳先行）**：M4 Settings / Sessions / Admin / Memory API — 见 **联调门控**  
> **参考代码**：`MCP-Client/frontend/src/`（入口 `frontend/*.html`）  
> **现查（每节编码前）**：`frontend/src/`、`frontend/*.html`、`src/api/routes.ts`、`frontend/src/chat/storage-contract.js`  
> **文档**：迁移只写 **代码 + 勾选 `todos/M*.md`**，**不建** `apps/web/docs/`；对照与约定以任务书 + 参考源码为准。

---

## 目标

用 **React + Next.js App Router** 全量重写 5 个页面、聊天页 **9 个 Modal**、共享 Design System；**行为 / API 路径 / 存储键** 与参考产品一致，**禁止**拷贝 JS 文件。

交付 MS3：**5 页 + storage-contract 契约 + 聊天 guest 全功能 + Info 页可联调**；Settings/Admin 写操作与 Authed 会话在 M4 门控通过后收尾（M6 E2E）。

---

## 执行顺序

按章节从上到下、任务 ID 从小到大执行：

```
M3-00 → M3-01 → M3-02
→ M3-03-A → M3-03-B → M3-03-C → M3-03-D → M3-03-E
→ M3-04 → M3-05 → M3-06 → M3-07 → M3-08
```

| 节 | 任务 ID | 说明 |
|----|---------|------|
| **M3-00** | 00-01～00-05 | 基线、边界约定 |
| **M3-01** | 01-01～01-09 | Design System |
| **M3-02** | 02-01～02-08 | Navbar、Auth、fetch-json |
| **M3-03-A** | 03-01～03-14 | 聊天 `lib/chat` 纯逻辑 |
| **M3-03-B** | 03-15～03-29 | 聊天 UI 核心 |
| **M3-03-C** | 03-30～03-38 | 聊天 9 Modal |
| **M3-03-D** | 03-39～03-46 | 会话存储与契约 |
| **M3-03-E** | 03-47～03-48 | 聊天样式 |
| **M3-04** | 04-01～04-14 | Info（M2 API，先于 Settings） |
| **M3-05** | 05-01～05-09 | Settings（写操作门控 M4-04） |
| **M3-06** | 06-01～06-02 | Landing RSC |
| **M3-07** | 07-01～07-10 | Admin（写操作门控 M4-02/03） |
| **M3-08** | 08-01～08-10 | 跨页验收、MS3 签收 |

> **M3-04 在 M3-05 前**：Info 依赖 M2（已就绪）；Settings 写操作依赖 M4-04。

---

## 架构原则（Meek 全局最优）

| 维度 | 约束 | Meek 落点 |
|------|------|-----------|
| **高性能** | 静态壳 RSC；Markdown/Modal `dynamic()` lazy；SSE 单连接 + `AbortSignal` | `app/*`、`components/**` |
| **高可用** | 失败显式 toast；SSE 可 stop；IDB 异常不吞 | `lib/api/fetch-json.ts` |
| **高稳定** | `lib/chat/*` 无 React；键名仅 `storage-contract.ts`；guest/authed init-once | `lib/chat/`、`hooks/` |
| **高扩展** | Modal lazy loader；renderers 注册表 | `components/chat/` |
| **低风险** | **扩展 M1**，不推倒 `use-chat-stream`；M4 未就绪 → 壳 + 门控 | 见 M3-03-C/D、M3-05、M3-07 |

### 分层目录（固定）

```
apps/web/
├── app/{/,ai,info,settings,admin}/   # 路由壳（Landing/壳层可 RSC）
├── components/ui/                     # Design System
├── components/{chat,info,settings,admin,auth}/
├── hooks/
├── lib/chat/、lib/api/、lib/auth/
└── providers/
```

### M1 已有基线（extend-only，禁止重写）

| 已完成 | 路径 | M3 动作 |
|--------|------|---------|
| SSE 最小客户端 | `hooks/use-chat-stream.ts`、`lib/chat/process-sse-stream.ts` | M3-03-B / 03-15 扩展 |
| 消息列表 / 发送 / 停止 | `components/chat/chat-panel.tsx` 等 | M3-03-B / 03-16～03-29 |
| Tool 卡片骨架 | `components/chat/tool-call-card.tsx` | M3-03-B / 03-23 |
| 请求体 / SSE 解析 | `chat-request-body.ts`、`sse-parse.ts` | M3-03-A / 03-06 |
| Navbar 壳 | `components/navbar.tsx` | M3-02 / 02-01～02-03 |
| 路由占位页 | `app/settings|info|admin/page.tsx` | M3-04 / M3-05 / M3-07 替换 |

---

## M3-00 基线与门控

- [x] **M3-00-01** 编码前 Glob `frontend/src/{chat,settings,info,admin,shared}/` 现查；映射见下文 **参考 → 章节速查**（禁抄静态清单、不落 docs）
- [x] **M3-00-02** M1 extend-only：见上文 **M1 已有基线** 表；PR 不得删除 MS1 行为
- [x] **M3-00-03** 各页 `error.tsx` / `loading.tsx`（Info 文案对齐 `info.html#loading`）
- [x] **M3-00-04** Client 岛：见下表；Info/Settings/Admin 用 `*-page-client.tsx`
- [x] **M3-00-05** `pnpm build` 基线通过

### Client 岛（M3-00-04）

| 路由 | `page.tsx` | Client 子树 |
|------|------------|---------------|
| `/` | RSC | M3-06 Landing |
| `/ai` | RSC 壳 | `ChatPanel` |
| `/info` | RSC 壳 | `InfoPageClient` |
| `/settings` | RSC 壳 | `SettingsPageClient` |
| `/admin` | RSC 壳 | `AdminPageClient` |

| 路由 | `loading.tsx` | `error.tsx` |
|------|---------------|-------------|
| `/ai` | 通用 spinner | 有 |
| `/info` | Info 加载壳 | 有 |
| `/settings` | 通用 | 有 |
| `/admin` | 通用 | 有 |
| 全局 | — | `app/error.tsx` |

**禁止**：`lib/chat/*` 使用 `'use client'`；RSC `page.tsx` 内直接 hooks。

---

## M3-01 Design System

参考：`frontend/src/shared/ui/*`、`shared/theme.css`

- [x] **M3-01-01** Tailwind v4 主题令牌（`theme.css` → `globals.css`）
- [x] **M3-01-02** Button / Toggle / Spinner
- [x] **M3-01-03** OverlayModal（`overlay-modal.js`）
- [x] **M3-01-04** ConfirmDialog（Settings/Info/Admin 共用）
- [x] **M3-01-05** DropdownSelect / Segmented / Stepper
- [x] **M3-01-06** Toast / Tooltip / StatusChip / EmptyState
- [x] **M3-01-07** FormField / InputDialog / StatusPill / ChipGroup
- [x] **M3-01-08** StatusDot（Info 连接态）
- [x] **M3-01-09** safe text 工具（对齐 `escape-html.js`）

---

## M3-02 共享壳

参考：`shared/navbar.js`、`auth/*`、`shared/fetch-json.js`

- [x] **M3-02-01** Navbar 链接 + 路由高亮
- [x] **M3-02-02** Navbar `GET /api/client-info` 名/版本
- [x] **M3-02-03** SUPERADMIN 链接显隐
- [x] **M3-02-04** `lib/auth/session.ts`（对齐 `auth/session.js`）
- [x] **M3-02-05** AuthModal + LoginForm + NavAuth
- [x] **M3-02-06** AuthShell：`data-auth` + `data-requires-auth` guest 写拦截
- [x] **M3-02-07** `lib/api/fetch-json.ts` + 统一错误 toast
- [x] **M3-02-08** `AuthProvider`：登录/登出整页 refresh；init-once 会话 SSOT

---

## M3-03 聊天页 `/ai`

参考：`frontend/src/chat/*` → `app/ai/` + `components/chat/` + `lib/chat/` + `hooks/`

### M3-03-A 纯逻辑（03-01～03-14，`lib/chat` 无 React）

- [x] **M3-03-01** `storage-contract.ts` — 全量键名/类型（**本节最先**）
- [x] **M3-03-02** 扩展 `process-sse-stream` / `apply-stream-chunk`（`stream-handler.js` 全事件）
- [x] **M3-03-03** `turn-collector.ts`
- [x] **M3-03-04** `message-history-builder.ts`
- [x] **M3-03-05** `config-fetch.ts`
- [x] **M3-03-06** 扩展 `context-messages.ts` + `chat-request-body.ts`
- [x] **M3-03-07** `mcp-selection.ts` + probe 封装
- [x] **M3-03-08** `compact-baseline-storage.ts` + compact 消费
- [x] **M3-03-09** `session-idb.ts`（`AIChatDatabase` v1）
- [x] **M3-03-10** `session-data.ts`
- [x] **M3-03-11** `session-store.ts`（guest/authed 双模式）
- [x] **M3-03-12** `session-conversation.ts`
- [x] **M3-03-13** `chat-orchestrator.ts`（`chat-api.js` + `app-core.js` 编排）
- [x] **M3-03-14** `time.ts` + `usage-telemetry.ts`

### M3-03-B UI 核心（03-15～03-29）

- [x] **M3-03-15** 扩展 `use-chat-stream.ts`（保留 M1 API，接 orchestrator）
- [x] **M3-03-16** Chat 布局 + 工具栏（`ai.html`、`app-lifecycle.js`）
- [x] **M3-03-17** 工具栏图标（`icons.js`）
- [x] **M3-03-18** 会话名 + 新建会话 + 清除对话
- [x] **M3-03-19** MessageList：user / assistant / reasoning / tool
- [x] **M3-03-20** Renderers 注册表 + 历史 tool 回放 + todo 合并
- [x] **M3-03-21** Reasoning 折叠 + thinking + 耗时
- [x] **M3-03-22** Markdown **`dynamic()` lazy**（`markdown-stack.js`）
- [x] **M3-03-23** Tool 卡片状态机（pending→error + progressSteps）
- [x] **M3-03-24** 权限确认 → `permission-resolve`
- [x] **M3-03-25** 停止 / 重试 / 错误态
- [x] **M3-03-26** Planning 浮层 + Todo 卡片
- [x] **M3-03-27** Usage telemetry 展示
- [x] **M3-03-28** Context compact 横幅 notice
- [x] **M3-03-29** Composer 发送/停止/Enter

### M3-03-C Modal ×9（03-30～03-38，`dynamic()` lazy）

> **M3-01 落点**：用 React `OverlayModal` 的 `open`/`onClose` 受控模式；**不移植**参考 `openOverlayModal` / `bindOverlayModalClose` imperative API。

| DOM id | 参考 | 任务 |
|--------|------|------|
| `history-modal` | `history-modal.js` | 03-30 |
| `settings-modal` | `settings-modal.js` | 03-31 |
| `context-modal` | `compact-modal.js` | 03-32 |
| `system-tools-modal` | `system-tools-modal.js` | 03-33 |
| `mcp-servers-modal` | `mcp-modal.js` | 03-34 |
| `quick-messages-modal` | `quickmessage.js` | 03-35 |
| `edit-message-modal` | `quickmessage.js` | 03-36 |
| `memory-debug-modal` | `memory-debug-modal.js` | 03-37 |
| `prompts-modal` | `prompt-editor.js` | 03-38 |

- [x] **M3-03-30** HistoryModal — 搜索、批量删、加载会话
- [x] **M3-03-31** SettingsModal — 模型/权限/MCP 开关/恢复默认（Toggle 用受控 `ToggleSwitch`，不移植 `bindToggle`）
- [x] **M3-03-32** ContextModal — 预览/生成/应用/清除摘要
- [x] **M3-03-33** SystemToolsModal
- [x] **M3-03-34** McpModal — probe 后保存、顶栏计数
- [x] **M3-03-35** QuickMessagesModal — 分类 CRUD
- [x] **M3-03-36** EditMessageModal
- [x] **M3-03-37** MemoryDebugModal（**门控 M4-06**：未就绪仅壳）
- [x] **M3-03-38** PromptsModal — Tool Prompt + System Sections（**非 Settings 页**）

### M3-03-D 存储与契约（03-39～03-46）

- [x] **M3-03-39** `aiChatSettings` 读写（**M3-03-C 提前完成**：`chat-settings-storage.ts` + Settings 关闭时持久化）
- [x] **M3-03-40** `aiQuickMessages` + 服务端种子（**M3-03-C 提前完成**：`quick-messages-storage.ts`）
- [x] **M3-03-41** `aiCompactBaseline:{sessionId}`
- [x] **M3-03-42** Guest IDB 持久化 + 旧数据兼容
- [x] **M3-03-43** Authed `/api/sessions`（**门控 M4-05**：壳 + 提示）
- [x] **M3-03-44** guest/authed init-once；登录 reload
- [x] **M3-03-45** QuickMessage 随机/追加气泡
- [x] **M3-03-46** ContextModal ↔ `POST /api/chat/context-preview`

### M3-03-E 样式（03-47～03-48）

- [x] **M3-03-47** 迁移 `chat/style.css`、`chat-ui.css` → `app/ai/chat.css`
- [x] **M3-03-48** 分包验证 + `scrollToBottom` 行为

---

## M3-04 Info 页 `/info`

> MCP CRUD / 连接 / OAuth **仅在本页**（不在 Settings）。

参考：`frontend/src/info/*` · **依赖 M2 API**

- [ ] **M3-04-01** Loading shell → app shell
- [ ] **M3-04-02** 服务器侧边栏 + 搜索 + 刷新
- [ ] **M3-04-03** MCP 新增/编辑/删除（stdio/HTTP、headers）
- [ ] **M3-04-04** 连接 / 断开 / 切换 + pending UI
- [ ] **M3-04-05** OAuth authorize + `?oauth=` 回跳
- [ ] **M3-04-06** `POST /api/server/reload-config`
- [ ] **M3-04-07** 详情栏 StatusChip + 连接/授权按钮
- [ ] **M3-04-08** Tools 面板 + StatusDot + 单工具开关
- [ ] **M3-04-09** 工具 bulk 全选/全不选 + preferences
- [ ] **M3-04-10** Resources / Prompts（`rp-panel.js`）
- [ ] **M3-04-11** Tool 测试 Drawer
- [ ] **M3-04-12** URL intent 深链
- [ ] **M3-04-13** Guest 写操作 AuthShell 拦截
- [ ] **M3-04-14** Info 样式（`info/style.css`）

---

## M3-05 Settings 页 `/settings`

> **仅 Provider CRUD**（参考 `settings.html`）；无 MCP、无 Tool Prompt。

参考：`frontend/src/settings/*` · **写操作门控 M4-04**

- [ ] **M3-05-01** 布局 sidebar + main + 保存栏
- [ ] **M3-05-02** Provider CRUD + 侧边栏切换
- [ ] **M3-05-03** Provider 内模型增删改
- [ ] **M3-05-04** 默认 Provider + 保存
- [ ] **M3-05-05** 保存 + `providers/reload`（M4 联调）
- [ ] **M3-05-06** 剪贴板导入/导出（`provider-clipboard.js`）
- [ ] **M3-05-07** API Key 显隐
- [ ] **M3-05-08** Guest 只读 + `data-requires-auth`
- [ ] **M3-05-09** Settings 样式（`settings/style.css`）

---

## M3-06 Landing `/`

- [ ] **M3-06-01** 产品介绍 + CTA（**RSC**，`landing/main.js`）
- [ ] **M3-06-02** Landing 样式

---

## M3-07 Admin 页 `/admin`

> 参考 `admin.html`：**用户 + 渠道** 两 Tab；Profile/Route 经渠道面板间接编辑。

参考：`frontend/src/admin/*` · **写操作门控 M4-02/03**

- [ ] **M3-07-01** 三态门禁（未登录 / forbidden / workspace）
- [ ] **M3-07-02** Tab：用户管理 | 渠道管理
- [ ] **M3-07-03** Seed 面板（guest 默认归属账号）
- [ ] **M3-07-04** 用户表 + 角色 + 重置密码
- [ ] **M3-07-05** `POST /api/admin/seed` 初始化
- [ ] **M3-07-06** 渠道 rail + status 轮询
- [ ] **M3-07-07** Channel Binding（RouteRule `boundUserId`）
- [ ] **M3-07-08** Channel Config 面板（`channel-config-panel.js` 全量）
- [ ] **M3-07-09** 保存 + MCP probe 失败 flash
- [ ] **M3-07-10** Admin 样式 + `admin/icons.js`

---

## M3-08 跨页验收

- [ ] **M3-08-01** Glob：`frontend/src/chat/*.js` 均有映射或合并说明
- [ ] **M3-08-02** 9 Modal DOM id 与参考一致
- [ ] **M3-08-03** Settings 页无 MCP CRUD / Tool Prompt
- [ ] **M3-08-04** `storage-contract` 键名逐字一致
- [ ] **M3-08-05** guest/authed：init-once + reload，无 silent 丢数据
- [ ] **M3-08-06** SSE：多 tool 并行 + permission + stop
- [ ] **M3-08-07** Info：OAuth + reload-config + tool test
- [ ] **M3-08-08** Markdown + Modal lazy；build analyze 首屏可接受
- [ ] **M3-08-09** M4 门控项（03-37、03-43、05-05、07 写操作）登记 M6 补验
- [ ] **M3-08-10** **MS3 签收**：M3-00～M3-07 任务全勾选 + 5 页可访问

---

## 联调门控矩阵

| 任务 | 依赖 M4 | 未就绪时 |
|------|---------|----------|
| M3-03-37 MemoryDebug | M4-06 | Modal 壳 |
| M3-03-43 Authed 会话 | M4-05 | Guest 全功能 |
| M3-05-05 Settings 保存/reload | M4-04 | 只读 + 拦截 |
| M3-07 写操作 | M4-02/03 | 门禁 + 壳 |

---

## 功能契约（`storage-contract.js`）

| 契约 | 验证节 |
|------|--------|
| `aiChatSettings` | M3-03-D（03-39、03-31） |
| `aiQuickMessages` | M3-03-D（03-40） |
| IDB `AIChatDatabase` | M3-03-D（03-42） |
| `aiCompactBaseline:*` | M3-03-D（03-41） |
| SSE + tool + permission | M3-03-B、M3-08-06 |
| guest/authed | M3-03-D、M3-08-05 |
| Info OAuth | M3-04、M3-08-07 |

---

## 参考 → 章节 速查

| 参考 | 章节 |
|------|------|
| `chat/storage-contract.js` | M3-03-A / 03-01 |
| `chat/stream-handler.js` | M3-03-A / 03-02；M3-03-B / 03-15 |
| `chat/session-*.js` | M3-03-A / 03-09～12；M3-03-D / 03-39～44 |
| `chat/ui/*-modal.js` | M3-03-C / 03-30～38 |
| `chat/prompt-editor.js` | M3-03-C / 03-38 |
| `info/*` | M3-04 |
| `settings/*` | M3-05 |
| `landing/*` | M3-06 |
| `admin/*` | M3-07 |
| `shared/ui/*`、`auth/*` | M3-01、M3-02 |

---

## Meek 落点

| 参考 | Meek |
|------|------|
| `frontend/src/chat/*` | `app/ai/` + `components/chat/` + `lib/chat/` + `hooks/` |
| `frontend/src/info/*` | `app/info/` + `components/info/` |
| `frontend/src/settings/*` | `app/settings/` + `components/settings/` |
| `frontend/src/admin/*` | `app/admin/` + `components/admin/` |
| `frontend/src/shared/ui/*` | `components/ui/` |
| `frontend/src/auth/*` | `components/auth/` + `lib/auth/` + `providers/` |
| `frontend/src/landing/*` | `app/page.tsx` |
