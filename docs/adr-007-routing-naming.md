# ADR-007：前端路由与命名对齐

**状态**：已采纳  
**日期**：2026-06-29  
**前置**：MS5（M0～M5 parity 迁移完成）

## 背景

M0～M5 为 MCP-Client parity 迁移，页面路由与参考 HTML 一致（`/ai`、`/info` 等）。参考产品部分命名来自 demo 时期，领域语义不准确。MS5 后通过 T1 一次性偿还命名债。

## 决策

### 路由对照（旧 → 新）

| 旧路径 | 新路径 | App Router 目录 |
|--------|--------|-----------------|
| `/ai` | `/chat` | `apps/web/app/chat/` |
| `/info` | `/mcp` | `apps/web/app/mcp/` |
| `/` | `/` | `apps/web/app/page.tsx` |
| `/settings` | `/settings` | 不变 |
| `/admin` | `/admin` | 不变 |

### 不保留兼容

- **不做** `/ai`→`/chat`、`/info`→`/mcp` 重定向或 rewrite
- 旧 URL 访问即 **404**
- `next.config`、middleware 无旧路径别名

### API 路径（本 ADR 不改）

| 路径 | 说明 |
|------|------|
| `/api/chat/*` | 聊天 API，保持 |
| `/api/info` | MCP 汇总 API，保持（另立任务收敛） |
| `/api/server/*` | MCP 服务器操作，保持 |

前端 `lib/chat`、`components/info` 等代码域目录名**不在 T1 范围**内重命名。

### Navbar / 页面标题

| 页面 | Navbar 文案 | `metadata.title` |
|------|-------------|------------------|
| Admin | 系统管理 | 系统管理 |
| Settings | 模型配置 | 模型配置 |
| Chat | 聊天 | 聊天 |
| MCP | MCP服务 | MCP服务 |

OAuth 授权回跳目标：`/mcp`（`/api/mcp/oauth/callback`）。

## 后果

- 书签与外部硬编码旧路径将失效（Meek 未对外发布，可接受）
- T2 UI 精修应在 T1 完成后进行，避免路径返工

## 参考

- 任务书：[`todos/T1-routing-naming.md`](../todos/T1-routing-naming.md)
