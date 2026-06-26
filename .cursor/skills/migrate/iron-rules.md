# Migrate 编码铁律

> **读者 = 步骤 4–5 的编码 agent**。migrate 为默认；optimize 模式叠加 [optimize.md](./optimize.md)。

## 编码前（每条满足后才写第一行代码）

1. Glob + Read 本批参考文件（路径来自 review 映射表，**禁**凭记忆）
2. 对照 [reference-map.md](./reference-map.md) 确认 Meek 落点；表无条目 → **停**，问用户
3. 确认本批模式：migrate → API 路径、storage 键与参考**同名同义**
4. 确认可复用：`packages/*`、`apps/web/lib/*` 已有模块优先扩展

## 编码中：必做 / 禁止

| 必做 | 禁止 |
|------|------|
| 对照参考**重写**为 TS/React | 拷 `.js` / `.html` 进 Meek |
| 最小 diff；扩展现有包/模块 | 平行重复实现同一职责 |
| 底层失败 `throw`；API 边界返回明确错误 | 空 `catch`、静默 fallback 掩盖配置缺失 |
| 命名导出；相对 import 带 `.js` 后缀 | `default export` |
| 边编码边记入变更清单（delivery.md） | 批末才回忆改了哪些文件 |

## 技术栈（Meek 约定）

| 项 | 值 |
|----|-----|
| Node | ≥ 24 |
| Web | Next.js App Router；需 Node API 的路由标 `nodejs` runtime |
| Worker | stdio MCP + BullMQ 消息总线 |
| Agent | `packages/agent-core`（agent-harness） |
| 包管理 | **pnpm** |

## 契约对齐（migrate 禁改名）

| 契约 | 对齐源 | 动作 |
|------|--------|------|
| HTTP API | `MCP-Client/src/api/routes.ts` | 新路由须能在 routes 找到对应项 |
| 前端 storage 键 | `storage-contract.js` | 键名、语义与参考一致 |
| DB | `schema.prisma` | 结构对齐；客户端经 `packages/db` |

触 API 路径 / storage 键变更 → 不是 migrate 范围；改走 optimize + 用户授权。

## 批末验证（步骤 5，顺序执行）

```
1. 新增/改的 API → Grep apps/web/app/api 与 routes.ts 对照
2. 新增/改的前端存储 → Grep storage-contract 键名一致
3. 在 apps/web 或 monorepo 根执行 pnpm build → 必须通过
4. 失败则修到通过，再进入 delivery 门禁
```

## 参考缺失时

```
Grep 参考仓库仍无对应实现？
├─ 任务书要求有 → 停，向用户说明「参考无，需补参考或改任务书」
└─ 任务书未要求 → 不实现；评审表记「参考无」
```
