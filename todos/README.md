# Meek 迁移

MCP-Client **已落地源码** → Meek 全量重写（Next.js 16 + Worker + BullMQ）。  
**禁止**用 `MCP-Client/todos/` 定范围。运行时见 [`../docs/adr-006-agent-runtime-hybrid.md`](../docs/adr-006-agent-runtime-hybrid.md)。

## 原则

| 规则 | 说明 |
|------|------|
| 代码为准 | 范围 = `MCP-Client/src/`、`frontend/src/`、`prisma/` 现查 |
| 重写不拷贝 | 行为/API/存储键与参考一致 |
| 禁止新增 | 参考无实现的 API/页面/能力不得做（见下「禁止项」） |
| Web 走队列 | `chatStream`：`registerSink` → `publishInbound` → worker（ADR-006） |
| 不装 AI SDK | 仅 `openai` + `@modelcontextprotocol/sdk` + Harness 移植 |

## 编码前现查（每批次必做）

1. Read 锚点：`src/api/routes.ts`、`frontend/src/chat/storage-contract.js`、`prisma/schema.prisma`
2. Glob 本阶段目录（见各 `M*.md` 头部）
3. 映射表路径必须来自现查，禁抄静态清单

**禁止项**（参考代码不存在）：调研子 Agent、全局限流、断流续传、Langfuse/OTel、产品级 `/_next/mcp` Dev MCP。

## 模块落点

| 参考 | Meek |
|------|------|
| `frontend/src/*` | `apps/web` |
| `src/api/*`、`src/app.ts` | `apps/web` API + `apps/worker` |
| `src/core/agent-harness/` | `packages/agent-core` |
| `src/core/mcp/`、`src/mcp-servers/` | `packages/mcp-client` |
| `src/config-plane/` | `packages/config-plane` |
| `src/message-bus/`、`src/channels/` | `apps/worker` |
| `prisma/schema.prisma` | `packages/db`（14 model） |

页面：`index→/`、`ai→/ai`、`settings→/settings`、`info→/info`、`admin→/admin`。

## 阶段依赖

```
M0（含 Redis）
  → M1 agent-core + Bus Web 最小路径 → MS1 能对话
  ├→ M2 MCP  ├→ M4 平台（可与 M2 并行）  └→ M3 UI（依赖 M1 SSE）
M2+M4+M1 → M5 IM 渠道 + Bus 完善 → M6 验收
```

## 里程碑

- **MS1**：`publishInbound` 队列入站 + `agent-loop` + 参考 SSE
- **MS2**：MCP 多服 + Info API
- **MS3**：5 页 + `storage-contract` 契约
- **MS4**：Admin/Sessions + 三渠道
- **MS5**：M6 全量验收通过

## 任务书

| 文件 | 内容 |
|------|------|
| [M0-scaffold.md](./M0-scaffold.md) | Monorepo、Web/Worker、DB、Redis |
| [M1-agent-core.md](./M1-agent-core.md) | Harness、聊天 API、Bus Web |
| [M2-mcp-platform.md](./M2-mcp-platform.md) | MCP 平台、Info API |
| [M3-web-ui.md](./M3-web-ui.md) | 5 页 + Modal + Design System |
| [M4-platform-admin.md](./M4-platform-admin.md) | Config Plane、Admin、Sessions、Memory |
| [M5-channels.md](./M5-channels.md) | 飞书/钉钉 + Bus 完善 |
| [M6-hardening.md](./M6-hardening.md) | 全量验收 |

Agent 启用 [`.cursor/skills/migrate/`](../.cursor/skills/migrate/SKILL.md)。完成子项改 `- [x]`，交付附现查得到的 `参考：MCP-Client/...`。

## 进度

| 阶段 | 总数 | 已完成 |
|------|------|--------|
| M0 | 24 | 24 |
| M1 | 48 | 0 |
| M2 | 34 | 0 |
| M3 | 56 | 0 |
| M4 | 37 | 0 |
| M5 | 31 | 0 |
| M6 | 20 | 0 |
| **合计** | **253** | **24** |

**当前：M1 — 未开始**
