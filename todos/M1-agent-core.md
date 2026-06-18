# M1 — Agent 核心与聊天 API



> **状态**：进行中（M1-04 已完成，M1-05 未开始）  

> **周期**：3 ~ 4 人周（2 人）  

> **前置**：M0 完成（**含 Redis**，见 M0-06）  

> **现查**：`src/core/agent-harness/`、`src/providers/`、`src/api/ai.controller.ts`、`src/message-bus/`、`src/channels/web/`  
> **运行时**：[`../docs/adr-006-agent-runtime-hybrid.md`](../docs/adr-006-agent-runtime-hybrid.md)



---



## 目标



移植 `src/core/agent-harness/` 与聊天 API；**Web 流式聊天必须** `registerSink` → `publishInbound` → BullMQ → worker → 参考 SSE（与 `ai.controller.ts` 一致）。



---



## M1-01 packages/agent-core



- [x] **M1-01-01** 定义 `ChatAgentOptions`、`ResolvedProfile` 类型（`packages/shared`）

- [x] **M1-01-02** 移植 `runAgentLoop` / `AgentLoopProvider`（对齐 `agent-loop.ts`；**按职责拆文件**，行为不变）

- [x] **M1-01-03** `stopWhen` / `maxToolCallRounds` 可配置（对齐 `feature-config`）

- [x] **M1-01-04** Prompt Pipeline 分段组装（对齐 `prompt-pipeline.ts`）

- [x] **M1-01-05** Provider 抽象：`openai` 包 OpenAI 兼容（对齐 `ai-provider.ts`、`ai-providers.ts`）

- [x] **M1-01-06** `onStepFinish` 结构化 audit 日志

- [x] **M1-01-07** `usage-telemetry` 采集与 SSE 透出字段

- [x] **M1-01-08** 现查 `agent-harness/` 其余文件（`permission-session.ts`、`loop-state.ts`、`streaming-tool-scheduler.ts` 等）全部纳入



## M1-02 消息链与规范化

> **Meek 约束**：仅流式 `chatStream` → `runAgentLoop({ stream: true })`；**不迁移**非流式 `chat()` / `POST /api/chat`（见 M1-06-01 跳过）。

- [x] **M1-02-01** InternalMessage 类型（含 tool_calls、tool、reasoning 元数据）

- [x] **M1-02-02** `MessageNormalizer`：API 发送前 transform（`normalizeMessages`）

- [x] **M1-02-03** tool_call ↔ tool_result 配对校验（`findUnpairedToolCallIds` + 补齐 `(cancelled)`）

- [x] **M1-02-04** 取消/中断后状态清理（`ToolCallManager.finalizeAllToolCalls` + normalizer）

- [~] **M1-02-05** ~~非流式 `chat()` 与流式共用 loop~~ — **Meek 跳过**（仅 `chatStream`）



## M1-03 System Tools

> **Meek**：01～06 在 `@meek/agent-core`（M1-01）；07 为 Web BFF 路由。

- [x] **M1-03-01** `SystemToolRegistry` 注册表（`system-tools/system-tool-registry.ts`）

- [x] **M1-03-02** `todo-tool`（计划浮层 + transcript 治理）

- [x] **M1-03-03** `read-persisted-output` + `path-safety`

- [x] **M1-03-04** `ToolExecutor`：统一 execute + 错误包装（`tool-executor.ts` → `ToolExecutor.normalizeResult`）

- [x] **M1-03-05** `streaming-tool-scheduler`（并行 tool 调度）

- [x] **M1-03-06** 权限 ask 流程（`permission-gate` + Redis `permission-pending`）

- [x] **M1-03-07** `POST /api/chat/permission-resolve`



## M1-04 上下文压缩与恢复

> **Meek**：01～02、04～05 在 `@meek/agent-core`；03 为 Web BFF；06 为 Worker 启动任务。

- [x] **M1-04-01** Token 估算 / 消息计数（`context-budget`）

- [x] **M1-04-02** 三层压缩策略完整实现（microCompact / compactHistory / applyContextBeforeLlm）

- [x] **M1-04-03** `POST /api/chat/compact`

- [x] **M1-04-04** 大 tool output 落盘 + Artifact 可读回（`materializeToolOutput` + `read_persisted_output`）

- [x] **M1-04-05** LLM 瞬态错误退避重试（`llm-retry.ts`）

- [x] **M1-04-06** Agent output 过期清理任务（Worker 启动 `cleanupExpiredAgentOutputs`）



## M1-05 Hook（参考 `hook-*.ts`、`chat-persist-hook.ts`、`memory-retain-hook.ts`）



- [ ] **M1-05-01** `hook-runner.ts` + `hook-config-loader.ts`

- [ ] **M1-05-02** `hook-builtin.ts`

- [ ] **M1-05-03** `chat-persist-hook.ts`

- [ ] **M1-05-04** `memory-retain-hook.ts`



## M1-06 聊天 API（BFF）



> **SSE**：对外事件格式对齐 `web-channel.adapter.ts` + `stream-handler.js`；**禁止** `createAgentUIStreamResponse` 内联 Agent。



- [~] **M1-06-01** ~~`POST /api/chat` 非流式~~ — **Meek 跳过**（仅 `POST /api/chat/stream`）

- [ ] **M1-06-02** `POST /api/chat/stream` — `registerSink` → `publishInbound`（**必须走队列**）

- [ ] **M1-06-03** `POST /api/chat/context-preview`

- [ ] **M1-06-04** `GET /api/tools/list`

- [ ] **M1-06-05** `runtime=nodejs`、`maxDuration=300`

- [ ] **M1-06-06** 请求体对齐 `normalize-web-inbound.ts`



## M1-07 Message Bus — Web 最小路径（原 M5 子集，MS1 前置）



> Web 与 IM 共用 Envelope + Worker；**禁止** Web 直连 Agent 绕过 BullMQ。



- [ ] **M1-07-01** `inbound-queue.ts` / `publishInbound` + `inbound-worker.ts`（消费 web envelope）

- [ ] **M1-07-02** `outbound-router.ts` / `outbound-sink-registry.ts`

- [ ] **M1-07-03** `web-channel.adapter.ts` — SSE `begin|chunk|usage|context_compacted|done|error`

- [ ] **M1-07-04** `normalize-web-inbound.ts` + `session-key.ts`（web 前缀）

- [ ] **M1-07-05** `inbound-envelope.ts` 类型（web channel）

- [ ] **M1-07-06** worker 内执行 `agent-core` loop；web Route 仅 Auth + 挂 SSE Sink



## M1-08 配置与特性开关



- [ ] **M1-08-01** `GET /api/config/features`

- [ ] **M1-08-02** Feature flags 类型（`packages/shared`）

- [ ] **M1-08-03** `GET /api/config/quick-messages`（种子只读）



## M1-09 聊天 UI 基线（`/ai`）



> **O10**：保留参考 SSE 协议；React 移植 `stream-handler` / `sse-parse`（`fetch` + `ReadableStream`，不用 `useChat`）。



- [ ] **M1-09-01** `fetch` + `ReadableStream` SSE 客户端 + 消息列表最小渲染

- [ ] **M1-09-02** 发送 / 停止 / 错误态

- [ ] **M1-09-03** Tool 卡片最小可视（对齐 `tool-cards.js` 状态，M3 补全样式）



---



## 完成检查清单



- [ ] `publishInbound` 可在日志中追踪（对照参考 `ai.controller.ts:212`）

- [ ] 10+ 轮 tool call 上下文不断

- [ ] 审计链可对照 `audit.ts` + `logs/app.log`

- [ ] SSE 事件类型与 `web-channel.adapter.ts` 一致

- [ ] 权限 ask 流程可打断并 resume

- [ ] 三层压缩与 compact API 可用



## 参考对照



| 参考文件 | 对齐点 |

|----------|--------|

| `agent-loop.ts` | 循环上限、hook 点 |

| `ai.controller.ts` | chatStream 队列入站 |

| `web-channel.adapter.ts` | SSE 出站格式 |

| `stream-handler.js` | 前端解析 |


