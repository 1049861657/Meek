# T1 — 路由与命名债偿还

> **状态**：已完成（MS5 后 T1 批次交付）  
> **周期**：约 1～2 人周（1 人）  
> **前置（硬）**：M0～M5 迁移主体完成（MS5）  
> **性质**：Meek 自有优化，**非** MCP-Client parity；可改 URL 与对外文案，**本阶段不改 API 路径**

---

## 背景

M0～M5 为迁移 parity，页面路由须与参考 HTML 一致（`/ai`、`/info` 等）。参考产品部分命名来自 demo 时期，**领域语义不准确**：

| 现状 | 实际职责 | 问题 |
|------|----------|------|
| `/ai` | 聊天 | 与 `lib/chat`、`/api/chat/*` 分裂 |
| `/info` | MCP 服务器管理 | 路径语义空泛 |
| Navbar「高级配置」 | Admin 用户/渠道 | 文案误导 |
| Navbar「配置管理」 | 仅 Provider | 文案过宽 |

迁移阶段**照抄参考是对的**；本任务书用于 **M5 之后一次性偿还命名债**。

---

## 原则

**一次性切全，不保留兼容兜底。**

- 不做 `/ai`→`/chat`、`/info`→`/mcp` 等永久/临时重定向  
- 不在 `next.config`、middleware、`app/` 下为旧路径留别名或 catch-all  
- 全仓引用（`Link`、`router.push`、OAuth 回跳、文档）**直接改为新路径**  
- 旧 URL 访问即 **404**，不迁就书签或外部硬编码链接  

> Meek 尚未对外发布，兼容成本大于收益；要改就改干净。

---

## 目标

1. 前端路由与领域名对齐（用户 URL ↔ 代码域）  
2. Navbar / `<title>` 与真实职责一致  
3. 全仓站内路径引用无旧路径残留  
4. **不改** `/api/*` 路径（另立任务，不在 T1）

---

## 目标命名（草案，实施前可微调）

| 层级 | 现网 | 目标 | 代码域（可不改目录名） |
|------|------|------|------------------------|
| 落地页 | `/` | `/` | `app/page.tsx` |
| 聊天 | `/ai` | `/chat` | `components/chat`、`lib/chat`（已一致） |
| MCP | `/info` | `/mcp` | `components/info`（目录可后续再议） |
| Provider | `/settings` | `/settings` | 保持 |
| 平台 | `/admin` | `/admin` | 保持 |

**说明**：`components/chat` 不必为迁就 URL 再改名；重点是 **用户可见路由** 与 **API 前缀不必在本阶段统一**。

---

## 执行顺序

```
T1-00（文案，可与 T1-01 同批）→ T1-01（路由更名，删旧留新）→ T1-02（验收）
```

---

## T1-00 对外文案（可选提前，不依赖改路由）

- [x] **T1-00-01** Admin Navbar「高级配置」→「系统管理」（或「平台管理」）  
- [x] **T1-00-02** Settings Navbar「配置管理」→「模型配置」（或「Provider 配置」）  
- [x] **T1-00-03** 各页 `metadata.title` 与 Navbar 一致  

> 若 M3～M5 期间已改文案，勾选并注明即可。

---

## T1-01 前端路由重命名

- [x] **T1-01-01** 新增 `docs/adr-007-routing-naming.md`（或修订 ADR）：旧→新对照 + **明确不保留重定向**  
- [x] **T1-01-02** `app/ai/` → `app/chat/`；**删除** `app/ai/`，不保留 `/ai` 路由  
- [x] **T1-01-03** `app/info/` → `app/mcp/`；**删除** `app/info/`，不保留 `/info` 路由  
- [x] **T1-01-04** 更新 `components/navbar.tsx` 链接与 `match` 规则  
- [x] **T1-01-05** 全仓站内 `Link` / `router.push` / 硬编码路径（含 OAuth callback、`mcp/oauth` 回跳）  
- [x] **T1-01-06** 确认 `next.config`、middleware **无**旧路径重定向或 rewrite 规则  
- [x] **T1-01-07** 更新 `todos/README.md` 页面映射表  
- [x] **T1-01-08** `pnpm build` 通过  

---

## T1-02 验收

- [x] **T1-02-01** `/chat`、`/mcp` 可访问；`/ai`、`/info` 返回 **404**（非跳转）  
- [x] **T1-02-02** 5 页功能冒烟：聊天、MCP、Settings、Admin、Landing（build 路由清单已确认 5 页静态壳）  
- [x] **T1-02-03** OAuth 授权回跳落到 **`/mcp`**（非旧路径）  
- [x] **T1-02-04** 全仓 `rg '/ai'|'/info'`（排除 API 路径与迁移文档历史描述）无前端路由残留  
- [x] **T1-02-05** 更新根 README 中的路径说明（若有）  

---

## 明确不在 T1

| 项 | 原因 |
|----|------|
| `/ai`、`/info` 重定向或别名路由 | 本任务明确不做兼容兜底 |
| 修改 `/api/chat`、`/api/info`、`/api/server/*` | 破坏性大，需契约测试与多端对齐，单独立项 |
| M5 完成前改 URL | 破坏 parity 基准 |
| 为 URL 重命名 `lib/chat` → `lib/ai` | 无收益，徒增 diff |

---

## 与 M 阶段关系

```
M0～M5（parity，路径冻结）→ MS5 → T1（命名债）→ T2（UI 精修）→ （可选）API 路由收敛
```

**禁止**在 M3～M5 功能迁移 PR 中夹带 T1 路由改动。视觉精修见 [T2-ui-polish.md](./T2-ui-polish.md)。
