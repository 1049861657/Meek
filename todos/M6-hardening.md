# M6 — 联调与全量验收



> **状态**：未开始  

> **周期**：2 ~ 3 人周（2 人）  

> **前置**：M0～M5 完成  

> **现查验收**：Read `routes.ts`、`storage-contract.js`；Glob `src/**`、`frontend/src/**`（排除 `generated/`）



---



## 目标



逐目录对照 `MCP-Client` 落地源码完成回归；运行等价于 `pnpm start` + Redis。



---



## M6-01 API 对照



- [ ] **M6-01-01** Read `src/api/routes.ts` → Meek 逐路由 + `/api/auth/*` 等价

- [ ] **M6-01-02** Controller 行为对齐（guest 匿名 chat、鉴权边界）

- [ ] **M6-01-03** `src/api/middleware/request-runtime.ts` 缓存策略

- [ ] **M6-01-04** **API 契约测试**：快照 `routes.ts` 路由表 + guest/auth/superadmin 边界



## M6-02 前端对照



- [ ] **M6-02-01** Read `storage-contract.js` → 全部存储键对齐

- [ ] **M6-02-02** Glob `frontend/src/**` → 5 页 + 共享 UI + 9 Modal 行为对齐

- [ ] **M6-02-03** SSE / tool 卡片 / guest-authed 双模式与参考一致

- [ ] **M6-02-04** **M4 门控补验**（M3-08-09 登记）：`M3-03-37` MemoryDebug（M4-06，`memory-debug-modal` + API）、`M3-03-43` Authed 会话（M4-05，`authed-sessions-gate.ts`）、`M3-05-05` Settings 保存/reload（M4-04，`settings-api-gate.ts`）、`M3-07` Admin 写操作（M4-02/03，`admin-api-gate.ts`）



## M6-03 后端模块对照



- [ ] **M6-03-01** Glob `src/core/agent-harness/**` → packages/agent-core 覆盖

- [ ] **M6-03-02** Glob `src/core/mcp/**` + `src/mcp-servers/**`

- [ ] **M6-03-03** Glob `src/core/memory/**` + memory debug API

- [ ] **M6-03-04** Glob `src/message-bus/**` + `src/channels/**`

- [ ] **M6-03-05** Glob `src/config-plane/**`、`src/services/` 遗漏扫描



## M6-04 审计与日志



- [ ] **M6-04-01** `audit.ts` 四类 audit 事件写入日志

- [ ] **M6-04-02** 同一 `requestId` 可重建决策链（`utils/logger.ts` → `logs/app.log`）



## M6-05 构建



- [ ] **M6-05-01** `pnpm build` 全 monorepo 通过

- [ ] **M6-05-02** 前端 Markdown lazy chunk 可接受



## M6-06 收尾



- [ ] **M6-06-01** 根 README：等价参考产品启动步骤

- [ ] **M6-06-02** 更新 `todos/README.md` 进度 100%



## M6-07 禁止项核查



- [ ] **M6-07-01** 确认未实现 README「禁止项」所列能力（Rate limit、Langfuse、断流续传等）

- [ ] **M6-07-02** 确认 `package.json` 无 `ai` / `@ai-sdk/*`



---



## 验收标准



| 指标 | 标准 |

|------|------|

| 覆盖 | `routes.ts` + 目录 Glob 无遗漏 |

| 新增 | 0（禁止项不得出现） |

| 依据 | 仅 `src/` + `frontend/src/` 现查 |


