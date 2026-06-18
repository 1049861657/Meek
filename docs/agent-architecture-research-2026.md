# 2026 年 React + Next.js Agent 架构调研

> 调研日期：2026-06-17  
> 目标：为 Meek（MCP Agent Client 全量重写）选定技术栈与系统架构  
> 参考来源：MCP-Client v0.4.0（**仅行为参考，不拷贝代码**）

---

## 一、结论摘要

### 1.1 Meek 推荐架构（TL;DR）

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/web — Next.js 16 + React 19 (App Router)                  │
│  UI · 参考 SSE · 工具卡片 · 权限确认 · Admin/Settings/Info      │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / SSE（参考 `web-channel.adapter` 事件）
┌────────────────────────────▼────────────────────────────────────┐
│  apps/web — Route Handlers（Node.js runtime）                   │
│  薄 BFF：Auth · registerSink · publishInbound · SSE 挂接        │
└────────────────────────────┬────────────────────────────────────┘
                             │ 内部 RPC / 队列 Envelope
┌────────────────────────────▼────────────────────────────────────┐
│  apps/worker — Node.js 常驻进程                                 │
│  Agent Loop · MCP 连接(stdio/HTTP) · BullMQ · 飞书/钉钉渠道     │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  packages/agent-core   packages/mcp-client   packages/db
  (控制面)              (MCP SDK 封装)         (Prisma)
        │                    │
        └──────── 移植 agent-harness + @modelcontextprotocol/sdk ────────┘
```

> **2026-06-17 更新**：Agent 运行时以 [`adr-006-agent-runtime-hybrid.md`](./adr-006-agent-runtime-hybrid.md) 为准（Harness 移植，非 ToolLoopAgent 主路径）。

| 决策 | 选型 | 理由 |
|------|------|------|
| 前端框架 | **Next.js 16 + React 19** | App Router 成熟；Turbopack 默认；内置 MCP DevTools（`/_next/mcp`） |
| Agent 运行时 | **移植 `agent-harness`** + `openai` Provider（ADR-006） | 与参考同形；Web 走 BullMQ + 参考 SSE |
| MCP 连接 | **`@modelcontextprotocol/sdk`** + 自研 `packages/mcp-client` | 与参考一致；HTTP/stdio 均此包；多服聚合自研 |
| 控制面 | **自研 `packages/agent-core`** | MCP-Client 的 Harness 能力（压缩/权限/Config Plane）无现成框架覆盖 |
| 持久化 | **Prisma + SQLite**（可换 PostgreSQL） | 对齐参考产品数据模型 |
| 认证 | **better-auth**（Next.js adapter） | 参考产品已验证 |
| 消息总线 | **BullMQ + Redis**（worker 内） | 参考 `src/message-bus/`、`src/channels/` |
| 可观测 | **Winston/Pino + `audit.ts`**（Langfuse/OTel 首版不做，见 `todos/README.md` 禁止项） |
| **不选** Mastra 作为主框架 | — | 与自研控制面重叠；适合 greenfield 简单 Agent，非 MCP Client 平台 |
| **不选** LangGraph 作为主循环 | — | 过重；Meek 主路径是请求级聊天 + 渠道入站，非长周期图编排 |
| **不选** 纯 Next.js Serverless | — | stdio MCP 子进程、BullMQ Worker、IM 长连接无法跑在 Edge/短超时函数内 |

### 1.2 与 MCP-Client 参考产品的映射

| MCP-Client 模块 | Meek 新栈落点 |
|-----------------|---------------|
| `frontend/` Vanilla MPA | `apps/web` React 组件 + App Router 页面 |
| `src/core/agent-harness/` | `packages/agent-core`（AI SDK Agent 接口 + 自研扩展） |
| `src/core/mcp/` | `packages/mcp-client`（`@modelcontextprotocol/sdk`） |
| `src/api/` | `apps/api` Route Handlers |
| `src/message-bus/` + `src/channels/` | `apps/worker` |
| `src/config-plane/` | `packages/config-plane` |
| `prisma/` | `packages/db` |

---

## 二、2026 市场格局

### 2.1 主流 TypeScript Agent 技术栈（2026 中）

| 层级 | 代表方案 | 定位 | 月下载/Stars（约） |
|------|----------|------|-------------------|
| **UI + 流式** | Vercel AI SDK (`ai`, `@ai-sdk/react`) | 模型无关工具包 + React hooks | 2000 万+/月 |
| **Agent 抽象** | AI SDK 6 `ToolLoopAgent` | 多步 tool loop + UI 类型推导 | SDK 内置 |
| **MCP 客户端** | `@ai-sdk/mcp` `createMCPClient` | MCP → AI SDK tools 适配 | SDK 内置（v6 稳定） |
| **全栈 Agent 框架** | Mastra (`@mastra/core`) | Agent + Workflow + Memory + RAG | ~30 万 npm/周，25k GitHub stars |
| ** durable 图编排** | LangGraph.js (`@langchain/langgraph`) | 状态图 + Checkpoint 持久化 | LangChain 生态 |
| **OpenAI 官方** | OpenAI Agents SDK (TS) | Handoff 多 Agent | OpenAI 中心化 |
| **长任务编排** | Inngest / Trigger.dev | 步骤级 durable execution | 事件驱动 / 长时任务 |
| **Web 框架** | Next.js 16 | App Router + RSC + Route Handlers | Vercel 生态默认 |

### 2.2 2026 行业共识（与 MCP-Client ROADMAP 对齐）

以下实践在 OpenAI Agents SDK、Vercel AI SDK 6、AWS MCP Guidance、Cherry/VS Code MCP 客户端中高度一致：

1. **Harness 拥有控制面，MCP 拥有执行面** — Loop、压缩、权限在应用层；MCP 只管连接与调用
2. **内部 messages ≠ API messages** — 发送前 normalize；完整 message graph 持久化
3. **工具调用需 OAuth + 最小权限 + Human-in-the-loop**
4. **MCP 生产部署用 HTTP/SSE**，stdio 仅本地开发
5. **可观测默认开启** — 每次 tool call 结构化审计
6. **Workflow-scoped 工具过滤** — 减少 context 占用

---

## 三、方案深度对比

### 3.1 Vercel AI SDK 6/7（市场调研 · **Meek 不采用**）

> Meek 运行时见 ADR-006：Harness + `openai` + `@modelcontextprotocol/sdk`，不装 `ai` / `@ai-sdk/*`。

**发布**：AI SDK 6（2025-12-22）；当前文档已至 v7。

**核心能力**：

| 能力 | API | 说明 |
|------|-----|------|
| Agent 循环 | `ToolLoopAgent` | 默认 `stopWhen: stepCountIs(20)` |
| UI 流式 | `createAgentUIStreamResponse` | Route Handler 一行接入 |
| 客户端 | `useChat<AgentUIMessage>()` | `message.parts` 区分 text/tool/reasoning |
| 工具审批 | `needsApproval` / tool approval | Human-in-the-loop |
| MCP | `createMCPClient` | HTTP/SSE/stdio；OAuth authProvider |
| 类型安全 | `InferAgentUIMessage<typeof agent>` | Agent → UI 端到端类型 |

**Next.js 集成模式**：

```typescript
// apps/web/app/api/chat/route.ts
import { createAgentUIStreamResponse } from 'ai';
import { chatAgent } from '@meek/agent-core';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, ...callOptions } = await req.json();
  return createAgentUIStreamResponse({
    agent: chatAgent,
    uiMessages: messages,
    options: callOptions,
  });
}
```

```tsx
// apps/web/app/ai/page.tsx
'use client';
import { useChat } from '@ai-sdk/react';
import type { ChatAgentUIMessage } from '@meek/agent-core';

export default function ChatPage() {
  const { messages, sendMessage, status, stop } = useChat<ChatAgentUIMessage>();
  // 按 part.type 渲染 tool 卡片、权限确认、推理块
}
```

**优势**：与 Next.js/React 耦合最深；MCP 一等公民；Meek 聊天 UI 改造成本最低。

**局限**：

- `ToolLoopAgent` .persistence 在单次请求上下文内；长时/跨天工作流需外接 Inngest/LangGraph/自研队列
- stdio MCP 不适合 Serverless — 必须放 worker 进程
- 多 MCP 服聚合、ToolNameCodec、连接状态机 — 需自研（参考 MCP-Client，非 SDK 内置）

**Meek 适用度**：⭐⭐⭐⭐⭐（UI + Agent Loop 基础）

---

### 3.2 Mastra

**定位**：TypeScript-native 全栈 Agent 框架（Gatsby 团队，2024-10 发布，2026-01 达 1.0）。

**能力**：Agents、Workflows、Memory、RAG、Evals、Observability；`@mastra/ai-sdk` 桥接 AI SDK UI。

**与 AI SDK 关系**：**库 vs 框架** — Mastra 构建于 AI SDK 之上，增加 batteries-included 后端。

**优势**：

- Next.js 集成指南完善；可嵌入或独立部署（Hono standalone）
- Memory / Workflow / Eval 开箱即用
- 「Python trains, TypeScript ships」— 面向 Web 开发者

**局限**：

- 抽象层厚，MCP Client **平台化**需求（多服管理、OAuth、Config Plane、IM 渠道）仍需大量定制
- 与 Meek 自研 `agent-core` 职责重叠
- 团队需同时学习 Mastra 约定 + 底层 AI SDK

**Meek 适用度**：⭐⭐⭐（可作 Memory/Workflow 子模块参考，不宜作为主框架）

---

### 3.3 LangGraph.js

**定位**：显式状态图 + Checkpoint 持久化（LangGraph 1.0，2025-10-22 stable）。

**核心差异**：

| 维度 | AI SDK ToolLoopAgent | LangGraph.js |
|------|---------------------|--------------|
| 心智模型 | 隐式 tool loop | 显式节点/边状态图 |
| 持久化 | 应用层负责 | Checkpoint 自动序列化 |
| 恢复 | 需外接 | 崩溃后从 checkpoint 恢复 |
| UI 流式 | 一等公民 `useChat` | 需自建 SSE 管道 |
| 适用场景 | 聊天、Copilot、短请求 Agent | 多步审批、跨天工作流、审计追溯 |

**Next.js 部署要点**（LangGraph 官方指南）：

- `export const runtime = 'nodejs'`（禁用 Edge）
- `maxDuration` 60~300s（Vercel Pro）
- 生产 Checkpointer：PostgreSQL / Redis（`@langchain/langgraph-checkpoint-*`）
- 冷启动 1~5s；复杂 Agent 可能超时 — 需 background job

**Meek 适用度**：⭐⭐（仅当 P3+ 需要跨会话 durable workflow 时局部引入；主聊天 loop 不需要）

---

### 3.4 Inngest / Trigger.dev（Durable Execution）

**场景**：Agent 步骤需 survive 崩溃、跨小时运行、步骤级重试。

| 平台 | 强项 | 弱项 |
|------|------|------|
| **Inngest** | 事件驱动；`step.run()` 原子 memo；Next.js 原生 | 额外 SaaS 依赖 |
| **Trigger.dev v3** | 无超时长任务；Realtime 推前端；可自托管 | 学习曲线；托管成本 |

**Meek 是否需要**：

- **Web 聊天主路径**：不需要 — SSE 请求内 `ToolLoopAgent` + worker 队列即可
- **IM 渠道异步入站**：BullMQ（参考 `src/message-bus/`、`src/channels/bootstrap.ts`）

---

### 3.5 Next.js 16 原生 MCP 能力

Next.js 16+ 在开发服务器暴露 **`/_next/mcp`** 内置端点（需 `experimental.mcpServer: true` 或默认启用），配合 `next-devtools-mcp` 供 **Coding Agent**（Cursor/Claude）读取：

- 运行时错误、路由列表、Server Actions、构建日志

**注意区分**：

| 能力 | 对象 | Meek 是否需要 |
|------|------|---------------|
| Next.js Dev MCP | 开发期 IDE 集成 | M0 必配，加速开发 |
| Meek 产品 MCP Client | 终端用户连接外部 MCP 服 | **核心功能** — `@modelcontextprotocol/sdk` + worker |

Next.js 16 的 Agent DevTools 面板与 `create-next-app` Agent 模板反映 Vercel **AI-native 开发**方向，与 Meek 产品定位（MCP Client 平台）是不同层面。

---

## 四、Meek 推荐分层架构

### 4.1 Monorepo 结构

```
Meek/
├── apps/
│   ├── web/                    # Next.js 16 — 前端 + 薄 BFF
│   └── worker/                 # Node.js 常驻 — Agent/MCP/Queue/Channels
├── packages/
│   ├── agent-core/             # 移植 agent-harness 控制面
│   ├── mcp-client/             # 多服连接、OAuth、状态机
│   ├── config-plane/           # Profile/Route 解析
│   ├── db/                     # Prisma client + schema
│   └── shared/                 # 类型、Zod schema、常量
├── prisma/
├── docs/
└── todos/
```

**包管理**：pnpm workspace + Turborepo（与 MCP-Client 一致用 pnpm）。

### 4.2 前端层（apps/web）

| 技术 | 版本建议 | 用途 |
|------|----------|------|
| Next.js | 16.x | App Router、Route Handlers、Turbopack |
| React | 19.x | Server/Client Components、Activity、View Transitions |
| Tailwind CSS | 4.x | 样式（参考 `frontend/src/shared/theme.css`） |
| `@modelcontextprotocol/sdk` | 与参考同版 | MCP HTTP/stdio |
| better-auth | 1.6+ | 登录/会话/RBAC |
| Zod | 4.x | 表单/API 校验 |

**页面映射**（参考 MCP-Client）：

| 路由 | 功能 |
|------|------|
| `/` | Landing |
| `/ai` | 聊天（SSE、工具卡片、Modal） |
| `/settings` | Provider / MCP / Prompt |
| `/info` | MCP 信息、Tools/Resources/Prompts 测试 |
| `/admin` | Profile / Route / Channel / User（SUPERADMIN） |

**RSC 策略**：

- 静态壳（Navbar、Layout）→ Server Component
- 聊天/Admin 交互 → Client Component + 参考 SSE hooks / fetch
- 不在 RSC 内直接调用 LLM

### 4.3 API 层（apps/web Route Handlers）

**原则**：Route Handler 做 **Auth 边界 + 协议转换**，重逻辑委托 worker 或 `packages/*`。

| 路由类型 | runtime | maxDuration | 说明 |
|----------|---------|-------------|------|
| `/api/chat/stream` | nodejs | 300 | SSE 代理或 inline agent（M1 前可 inline，M1 后走 worker） |
| `/api/sessions/*` | nodejs | 30 | CRUD |
| `/api/admin/*` | nodejs | 30 | SUPERADMIN |
| `/api/auth/*` | nodejs | — | better-auth handler |

**禁止**：在 Edge Runtime 跑 MCP stdio、BullMQ、Prisma better-sqlite3。

### 4.4 Worker 层（apps/worker）

**必须常驻的原因**：

1. **MCP stdio** — `spawn` 子进程，生命周期跨请求
2. **BullMQ** — Inbound Worker 消费队列
3. **飞书/钉钉** — Webhook / Stream 长连接
4. **MCP 连接池** — 断线重连、工具列表 TTL 缓存

**进程模型**：

```
worker 启动
  ├── MCPConnectionPool（stdio + HTTP 客户端）
  ├── InboundWorker（BullMQ consumer → agent-core）
  ├── OutboundRouter（Web SSE / IM 出站）
  ├── FeishuListener
  └── DingTalkStreamListener
```

### 4.5 Agent 核心（packages/agent-core）

**移植 MCP-Client `agent-harness/`**（ADR-006）：

| 能力 | 实现策略 |
|------|----------|
| 多轮 tool loop | 移植 `agent-loop.ts` / `AgentLoopProvider` |
| 消息规范化 | `MessageNormalizer`（发送前 transform） |
| 上下文压缩 | `ContextBudget`（三层策略 + 落盘） |
| 权限门 | `permission-gate` + Redis pending（对齐参考） |
| Prompt Pipeline | `prompt-pipeline.ts` 分段 system instructions |
| System Tools | `system-tool-registry`（Todo、ReadOutput 等） |
| Memory | Hindsight provider（对齐参考） |
| 审计 | `audit.ts` 结构化日志 |

LLM 调用 **`openai` 包**（与参考一致）。

### 4.6 MCP 层（packages/mcp-client）

**双轨集成**：

| 传输 | 使用场景 | 库 |
|------|----------|-----|
| HTTP / SSE | 远程 MCP 服、生产 | `@modelcontextprotocol/sdk` Streamable HTTP |
| stdio | 本地 MCP 服 | `@modelcontextprotocol/sdk` + worker spawn |

**自研职责**（参考 MCP-Client，SDK 不覆盖）：

- 多服聚合 + `ToolNameCodec`（防命名冲突）
- 连接状态机：`connecting → connected → needs-auth → failed`
- OAuth PKCE + token 持久化（Prisma `MCPServerAuth`）
- `supportsProgress` + 进度通知
- Resources/Prompts 列举（info 页，不进主 loop）

### 4.7 数据与认证

- **Prisma 7** + `@prisma/adapter-better-sqlite3`（开发）；生产可换 PostgreSQL
- **better-auth** + `@better-auth/prisma-adapter`
- **角色**：guest（IDB 本地会话）/ user / superadmin

### 4.8 可观测性

| 层级 | 工具 |
|------|------|
| 开发 | AI SDK DevTools、Next.js `/_next/mcp` |
| 生产 | Winston/Pino 结构化日志（对齐参考 `audit.ts`） |
| Agent 调试 | 结构化 audit 日志；Langfuse/LangSmith **首版不做** |
| Tool audit | 每次 call 记录 `{ tool, args, result, duration, userId }` |

---

## 五、关键设计决策（ADR 摘要）

### ADR-001：Harness 移植为主，非 Mastra/LangGraph / AI SDK 主循环

- **决策**：移植 `agent-harness` + `openai`；**不引入** Vercel AI SDK 运行时
- **理由**：与参考同形；MCP 已用 `@modelcontextprotocol/sdk`
- **放弃**：Mastra 全包、LangGraph 主循环、`ToolLoopAgent`/`useChat`

### ADR-002：Web + Worker 双进程

- **决策**：Next.js 不承载 stdio MCP 与 BullMQ
- **理由**：Serverless 超时、无子进程、无持久连接
- **放弃**：纯 Next.js 单体

### ADR-003：UI 流式协议用参考 SSE

- **决策**：保留 `web-channel.adapter` 事件格式；React 移植 `stream-handler`
- **理由**：Web 走 BullMQ；与参考前端行为 1:1
- **放弃**：AI SDK UI Message Stream / `useChat`

### ADR-004：消息总线保留 BullMQ 模式

- **决策**：Web/IM 入站 → Envelope → BullMQ → Worker → Agent
- **理由**：参考 `src/message-bus/` + `src/channels/` 已落地；Harness 无渠道分支
- **放弃**：Inngest 替代（首版）

### ADR-005：MCP 生产只用 HTTP

- **决策**：stdio 限定 worker 本地；远程服 Streamable HTTP
- **理由**：AI SDK 官方建议；Vercel/AWS 部署共识

---

## 六、风险与缓解

| 风险 | 级别 | 缓解 |
|------|------|------|
| AI SDK 版本迭代（Meek 未采用） | — | 见 §3.1 市场调研；实施以 ADR-006 为准 |
| 参考 SSE 前端状态机复杂度 | 高 | M3 契约测试；工具卡片 golden snapshot |
| Worker 部署复杂度 | 中 | Docker Compose 一键起；文档化 web/worker/redis |
| stdio MCP 安全 | 高 | 命令白名单；沙箱；仅 admin 可配置 |
| Next.js Route Handler 超时 | 中 | `maxDuration=300`；超长任务走 worker 异步 + 轮询/SSE |

---

## 七、推荐依赖版本（2026-06 基线）

```json
{
  "next": "^16.2.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "openai": "^6.42.0",
  "@modelcontextprotocol/sdk": "^1.29.0",
  "better-auth": "^1.6.0",
  "@prisma/client": "^7.8.0",
  "bullmq": "^5.78.0",
  "ioredis": "^5.11.0",
  "zod": "^4.4.0",
  "tailwindcss": "^4.3.0"
}
```

> 实施前以 `pnpm view <pkg> version` 为准。**Meek 不引入 `ai` / `@ai-sdk/*`**（ADR-006）。

---

## 八、参考资料

### 官方文档

- [Vercel AI SDK 6 发布公告](https://vercel.com/blog/ai-sdk-6)
- [AI SDK Agents / ToolLoopAgent](https://ai-sdk.dev/docs/agents/overview)
- [AI SDK MCP Tools](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools)
- [Next.js 16 发布公告](https://nextjs.org/blog/next-16)
- [Next.js MCP Server 指南](https://nextjs.org/docs/app/guides/mcp)
- [MCP 规范](https://modelcontextprotocol.io/)

### 架构分析（2026）

- [TypeScript AI Agent Stack Mid-2026 对比](https://www.developersdigest.tech/blog/typescript-ai-agent-stack-2026)
- [Vercel AI SDK 6 vs LangGraph 1.0](https://www.developersdigest.tech/blog/vercel-ai-sdk-6-vs-langgraph-typescript-agents)
- [Next.js Agent Architecture Production Design](https://markaicode.com/architecture/agent-architecture-with-nextjs/)
- [Mastra 官方文档](https://mastra.ai/docs)
- [Inngest Durable AI Agent](https://www.inngest.com/blog/ai-agents-inngest-durable-steps)

### 项目内部

- MCP-Client 源码 SSOT：`src/`、`frontend/src/`、`prisma/`（**不以 `todos/` 界定范围**）
> 迁移计划：[`../todos/README.md`](../todos/README.md)

---

### ADR-006：Agent 运行时混合方案（2026-06-17 采纳）

- **决策**：移植 `agent-harness`；Web 走 BullMQ + 参考 SSE；MCP 仅 `@modelcontextprotocol/sdk`；**不装** `ai` / `@ai-sdk/*`
- **详述**：[`adr-006-agent-runtime-hybrid.md`](./adr-006-agent-runtime-hybrid.md)

---

## 九、下一步

1. 确认 ADR-001 ~ ADR-006
2. 按 [`todos/M0-scaffold.md`](../todos/M0-scaffold.md) 初始化 monorepo
3. M1 移植 `packages/agent-core` + M1-07 Message Bus Web 最小路径
