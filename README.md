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
pnpm db:migrate
pnpm dev
```

`pnpm dev` 从根目录 `.env` 加载 `PORT` / `WORKER_PORT`（经 Turbo 传给 Web；Worker 另用 `node --env-file`）。默认 Web `http://localhost:3000`、Worker `http://localhost:4001/health`。

### 常用命令

| 命令 | 用途 | 说明 |
|------|------|------|
| `pnpm dev` | 本地开发 | Turbo 先构建依赖包 + 生成 Prisma，再启动 web/worker |
| `pnpm build` | 生产构建 | 全量编译 packages → apps，Turbo 缓存 `dist/` 与 `.next/` |
| `pnpm start` | 生产预览 | 等价于 build 完成后启动 web + worker（无需单独 `look`） |
| `pnpm db:generate` | 生成 Prisma Client | 仅 `@meek/db` 执行，由 Turbo 编排 |
| `pnpm db:migrate` | 应用迁移 | 使用根目录 `prisma.config.ts` |
| `pnpm lint` | 代码检查 | 全仓库 ESLint |

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
└── todos/            # M0～M5 + T1 任务书
```

## 迁移进度

见 [`todos/README.md`](todos/README.md)。当前阶段：**T1 路由/命名债已偿还**（M0～M5 / MS5 已完成）。

## 参考

行为与 API 契约对齐 [`MCP-Client`](../MCP-Client/) 已落地源码（非其 `todos/` 路线图）。
