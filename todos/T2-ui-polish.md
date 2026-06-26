# T2 — Web UI 视觉精修

> **状态**：未开始（**M6 签收后再做**；**建议 T1 路由更名完成后再精修**，避免 `/ai`→`/chat` 返工）  
> **周期**：约 2～4 人周（1～2 人）  
> **前置（硬）**：M6 全量验收通过（MS5）  
> **前置（软）**：T1 完成（路由与 Navbar 文案稳定）  
> **性质**：Meek 自有优化，**非** MCP-Client parity；可改样式、布局、DOM 类名与组件结构，**不改** `/api/*` 路径与 `storage-contract` 键名  
> **参考视觉**：`MCP-Client/frontend/src/` + 本地运行的参考产品；可选 **Pencil**（`.pen`）作验收基准

---

## 背景

M0～M6 / M3 签收标准是 **行为 / API / 存储键 parity**，**不要求像素复刻**（同 MCP-Client T3/T5）。迁移采用 React + Next 重写，存在典型视觉债：

| 类型 | 示例 |
|------|------|
| DOM / 类名漂移 | 参考 `.chat-container`，Meek `.chat-panel` 需单独补 CSS |
| CSS 搬运膨胀 | `chat.css` 行数远大于参考 `chat-ui.css`，易漏态与断点 |
| 组件 API 改写 | `OverlayModal` 受控模式 vs 参考 imperative，交互细节易偏 |
| Agent 盲区 | 间距、层叠、滚动区域高度等难以从 TS 读出 |

本任务书用于 **M6 之后集中偿还视觉债**；与 T1 命名债并列，均属 post-parity 优化。

---

## 目标

1. 五页 + 聊天 **9 Modal** + 共享 Design System 与参考产品 **视觉并排可接受**（允许 Next/React 实现差异，禁止明显「半成品感」）  
2. Design token（`globals.css` `@theme`）与参考 `theme.css` 一致，删除无引用的扩展 token  
3. `chat.css` 与参考对齐、去冗余，断点与参考 `chat-ui.css` 一致  
4. 缺陷 backlog 清零或登记书面例外  
5. **不改** API 路径、storage 键、SSE 事件语义

---

## 工具（可选）

| 工具 | 用途 |
|------|------|
| **Pencil.dev** | 仓库内 `.pen` 视觉 SSOT；Cursor MCP 读写；与代码同 PR 版本化 |
| 参考产品本地实例 | 并排对比 SSOT（优先于静态截图） |
| `docs/ui/` 截图 | 无 Pencil 时的轻量基准（**不替代**参考源码对照） |

> M6 期间可只做 **T2-00**（录基准、记 backlog），**不写**精修代码。

---

## 执行顺序

```
T2-00（基准，可与 M6 并行）
→ T2-01（Design System）
→ T2-02（五页壳层）
→ T2-03（聊天深页 + 9 Modal）
→ T2-04（横切：Navbar / 响应式 / a11y）
→ T2-05（验收）
```

**建议**：`T1 完成 → T2-01～T2-05`；若 T1 未做，T2 仍可按 **当前 parity 路由**（`/ai`、`/info`）精修，T1 后再冒烟一轮。

---

## T2-00 基准与 backlog（M6 期间可准备）

- [ ] **T2-00-01** 建立 UI 缺陷 backlog（本文件附录或 issue 列表）：`页面/组件 | 现象 | 参考位置`  
- [ ] **T2-00-02** 本地运行 MCP-Client，五页 + 9 Modal 关键态截图或录入 Pencil（`design/ui-baseline.pen` 或团队约定路径）  
- [ ] **T2-00-03** 对照 `frontend/src/shared/theme.css` 与 `apps/web/app/globals.css`，列出 token 差异  
- [ ] **T2-00-04** （可选）安装 Pencil 扩展 + 验证 Cursor MCP 可读写 `.pen`  

---

## T2-01 Design System

参考：`frontend/src/shared/ui/*`、`shared/theme.css`

- [ ] **T2-01-01** Button / Toggle / Spinner — hover、disabled、尺寸  
- [ ] **T2-01-02** OverlayModal / ConfirmDialog — 遮罩、圆角、宽屏模式、Esc / 焦点  
- [ ] **T2-01-03** FormField / DropdownSelect / Segmented / Stepper / InputDialog  
- [ ] **T2-01-04** Toast / Tooltip / StatusChip / StatusDot / EmptyState / ChipGroup  
- [ ] **T2-01-05** `styles/ui.css` 与参考 `ui-primitives.css`、`modal-shell.css` 差异收敛  

---

## T2-02 五页壳层

参考：`frontend/src/{landing,settings,info,admin}/*`、对应 `*.html`

- [ ] **T2-02-01** Landing `/` — 排版、CTA、与 Navbar 间距  
- [ ] **T2-02-02** 聊天路由页（T1 前 `/ai`，T1 后 `/chat`）— 外壳与 Navbar 下留白  
- [ ] **T2-02-03** MCP 管理页（T1 前 `/info`，T1 后 `/mcp`）— 列表、抽屉、连接态  
- [ ] **T2-02-04** Settings `/settings` — 表单栅格、只读门控样式  
- [ ] **T2-02-05** Admin `/admin` — Tab、渠道 rail、配置面板密度  

---

## T2-03 聊天深页

参考：`frontend/src/chat/chat-ui.css`、`ui/*-modal.js`、`ui/chat-shell-ui.js`

- [ ] **T2-03-01** 布局壳 — `chat-shell` / 主列 / 消息区高度与滚动；收敛 `.chat-panel` vs 参考 `.chat-container` 漂移  
- [ ] **T2-03-02** MessageList — 气泡、reasoning 折叠、context notice、markdown 代码块  
- [ ] **T2-03-03** Toolbar / Composer / Tool 卡片 / Planning 浮层 / Usage 展示  
- [ ] **T2-03-04** 9 Modal — `history` `settings` `context` `system-tools` `mcp` `quick-messages` `edit-message` `memory-debug` `prompts`（`modalId` 保持不变）  
- [ ] **T2-03-05** `app/ai/chat.css` 对齐参考 `chat-ui.css`：去重、断点、修复乱码注释  

---

## T2-04 横切

- [ ] **T2-04-01** Navbar — 链接态、SUPERADMIN 显隐、client-info 区  
- [ ] **T2-04-02** 响应式 — 对齐参考 `@media`（聊天窄屏、Admin 侧栏）  
- [ ] **T2-04-03** 可访问性 — Modal 焦点、按钮 `aria`、对比度（不降级现有行为）  

---

## T2-05 验收

- [ ] **T2-05-01** 五页 + 9 Modal 与参考产品 **并排手工对比**通过（或对照 `.pen` 基准）  
- [ ] **T2-05-02** backlog 项全部关闭，或写入「已知视觉例外」表（须注明原因）  
- [ ] **T2-05-03** `storage-contract` 键名未改；`pnpm build` 通过  
- [ ] **T2-05-04** （可选）Playwright 截图基线或视觉回归脚本  

---

## 明确不在 T2

| 项 | 原因 |
|----|------|
| 修改 `/api/*`、SSE 事件 | 契约变更，非 UI 任务 |
| 改 `storage-contract` 键名 | 破坏兼容 |
| M6 完成前大范围改 UI | 与 parity 验收冲突；仅允许修 **阻断验收** 的 UI bug（记入对应 Mx 批次） |
| 为视觉重命名 `lib/chat` 等业务目录 | 无用户可见收益 |
| 引入新页面 / 新能力 | 非精修范围 |

---

## 与 M / T 阶段关系

```
M0～M6（parity，行为签收）→ MS5
  → T1（路由/文案，可选但建议在 T2 前）
  → T2（UI 精修）
  → （可选）API 路由收敛
```

**禁止**在 M3～M6 功能迁移 PR 中夹带 T2 视觉大改（阻断级小修除外）。

---

## 附录：缺陷 backlog 模板

| ID | 页面/组件 | 现象 | 参考文件 | 状态 |
|----|-----------|------|----------|------|
| UI-001 | | | | open |
