# Meek

MCP-Client **已落地源码** 的 monorepo 重写版本：Next.js 16 Web + Worker + BullMQ。  
运行时设计见 [`docs/adr-006-agent-runtime-hybrid.md`](docs/adr-006-agent-runtime-hybrid.md)。

## Quick Start

### 前置依赖

- **Node.js** 24+ 与 [pnpm](https://pnpm.io/) 9+（见根 `package.json` 的 `engines`；不 pin 具体小版本）
- **Redis**：消息总线（BullMQ）依赖 `REDIS_URL`，worker 未配置时启动失败
- **SQLite**：由 Prisma 管理，默认数据库路径见 `.env.example`

### 安装与启动

```bash
cp .env.example .env
# Windows: copy .env.example .env

pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

`pnpm dev` 并行启动 **Web**（http://localhost:3000）与 **Worker**（健康检查 http://localhost:4001/health）。

### 目录结构

```
Meek/
├── apps/
│   ├── web/          # Next.js 16 App Router
│   └── worker/       # 消息总线 + 渠道（MCP/IM）
├── packages/
│   ├── db/           # Prisma schema + client
│   └── shared/       # 跨进程共享工具
├── prisma.config.ts  # Prisma 7 配置（schema 在 packages/db）
└── todos/            # M0～M6 迁移任务书
```

## 迁移进度

见 [`todos/README.md`](todos/README.md)。当前阶段：**M1 agent-core**（M1-01 已完成，M1-02 进行中）。

## 参考

行为与 API 契约对齐 [`MCP-Client`](../MCP-Client/) 已落地源码（非其 `todos/` 路线图）。
