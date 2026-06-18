# M0 — Monorepo 脚手架与工程基线

> **状态**：未开始  
> **周期**：1.5 ~ 2 人周（2 人）  
> **前置**：无  
> **参考代码**：`MCP-Client/src/app.ts`、`prisma/schema.prisma`、`src/lib/auth.ts`  
> **现查**：`MCP-Client/package.json`、`src/app.ts`、`prisma/schema.prisma`、`src/lib/auth.ts`

---

## 目标

初始化 Meek monorepo，使后续阶段能 **等价运行** MCP-Client 已有栈（Web + Worker + Redis + SQLite + better-auth）。

---

## M0-01 Monorepo 初始化

- [ ] **M0-01-01** 根 `package.json`：pnpm workspace、`engines.node >= 24`（参考 `MCP-Client/package.json`）
- [ ] **M0-01-02** `pnpm-workspace.yaml`：`apps/*`、`packages/*`
- [ ] **M0-01-03** Turborepo：`build` / `dev` / `lint`（等价 `pnpm run build` / `start` 工作流）
- [ ] **M0-01-04** 根 TS：`tsconfig.base.json`（**strict**、ESM、公共 API 显式返回类型）
- [ ] **M0-01-05** ESLint 9 flat config
- [ ] **M0-01-06** `.gitignore`（已就绪）；`.env.example` 键名在 M0-06-01 对齐参考

## M0-02 apps/web（Next.js 16 — 替代 Vite MPA 载体）

- [ ] **M0-02-01** `create-next-app` → `apps/web`（App Router、TS、Tailwind、pnpm）
- [ ] **M0-02-02** 核心依赖：`openai`、`@modelcontextprotocol/sdk`（对齐参考 `package.json`；**不装** `ai` / `@ai-sdk/*`）
- [ ] **M0-02-03** 5 路由壳：`/`、`/ai`、`/settings`、`/info`、`/admin`（参考 5× html 入口）
- [ ] **M0-02-04** Layout + Navbar 壳（参考 `frontend/src/shared/navbar.js`）
- [ ] **M0-02-05** API Route 模板：`runtime=nodejs`（stdio/MCP 不进 Edge）

## M0-03 apps/worker（替代 Express 进程内 MCP/渠道/BullMQ）

- [ ] **M0-03-01** worker 入口（参考 `src/app.ts` 中 `startMessageBus` + `startChannels` 职责拆分）
- [ ] **M0-03-02** `GET :4001/health`
- [ ] **M0-03-03** graceful shutdown（SIGTERM）

## M0-04 packages 初始化

- [ ] **M0-04-01** `packages/shared`
- [ ] **M0-04-02** `packages/db`：Prisma client 输出至此（**不用** `src/generated/`）
- [ ] **M0-04-03** workspace 交叉引用可用

## M0-05 数据库与认证（参考 `prisma/schema.prisma`、`src/lib/auth.ts`）

- [ ] **M0-05-01** `prisma/schema.prisma`（参考 `MCP-Client/prisma/schema.prisma` §九）
- [ ] **M0-05-02** migrate 脚本
- [ ] **M0-05-03** better-auth（参考 `src/lib/auth.ts`、`src/app.ts` 挂载顺序）
- [ ] **M0-05-04** `/api/auth/*`

## M0-06 本地运行（参考 `.env.example`、`README.md`）

> 参考**没有** `docker-compose`；Redis 由开发者自备，代码只读 `REDIS_URL`。

- [ ] **M0-06-01** `.env.example` 对齐参考键名：`DATABASE_URL`、`REDIS_URL`、`INBOUND_WORKER_CONCURRENCY` 等（见 `MCP-Client/.env.example`）
- [ ] **M0-06-02** `pnpm dev` 并行 web + worker；无 `REDIS_URL` 时 worker 启动 fail-fast（对齐 `redis-connection.ts`）
- [ ] **M0-06-03** README：等价参考「需 Redis + 配置 `REDIS_URL`」的启动说明（**不要求**提交 docker-compose）

---

## 完成检查清单

- [ ] `pnpm install && pnpm dev` 无报错
- [ ] 5 路由壳可访问
- [ ] worker `/health` 可响应
- [ ] Prisma **14** model migrate 成功
- [ ] better-auth 端点可调用
