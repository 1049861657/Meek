# M5 — 消息总线与 IM 渠道

> **状态**：进行中（M5-01 已完成）  
> **周期**：2.5 ~ 3 人周（2 人）  
> **前置**：M1 + M2 + M4  
> **参考代码**：`MCP-Client/src/message-bus/`、`src/channels/`  
> **现查**：`src/message-bus/`、`src/channels/`

---

## 目标

等价实现 `startMessageBus()` + `startChannels()`（`src/app.ts`）所启用的全部入站/出站路径。

---

## M5-01 Envelope

- [x] **M5-01-01** `inbound-envelope.ts` 类型与校验
- [x] **M5-01-02** `session-key.ts`
- [x] **M5-01-03** `idempotency.ts`（Redis `mcp-client:*` 前缀 → Meek 等价键）
- [x] **M5-01-04** `normalize-web-inbound.ts`
- [x] **M5-01-05** `normalize-feishu-inbound.ts`
- [x] **M5-01-06** `normalize-dingtalk-inbound.ts`
- [x] **M5-01-07** `envelope-mapper.ts`
- [x] **M5-01-08** 三渠道 normalize **公共 Envelope 构建器**（web/飞书/钉钉只填差异字段）

## M5-02 Message Bus

- [x] **M5-02-01** 完善 M1-07 未覆盖项：`inbound-log.ts`、死信、并发配置
- [x] **M5-02-02** `idempotency.ts`（Redis 键前缀对齐参考）
- [x] **M5-02-03** `queue-names.ts` 生产参数
- [x] **M5-02-04** IM 渠道 envelope 入队（飞书/钉钉 normalize 完成后）

## M5-03 Web 渠道

- [x] **M5-03-01** 回归 M1-07 Web 路径与参考一致（无行为变更）
- [x] **M5-03-02** SSE 前端 `stream-handler` 全量行为（M3 补 UI）
- [x] **M5-03-03** Agent 无渠道分支（Worker 统一 Envelope）

## M5-04 飞书

- [x] **M5-04-01** `feishu-event-listener.ts`、`feishu-sdk.ts`
- [x] **M5-04-02** `feishu-channel.adapter.ts`
- [x] **M5-04-03** E2E：飞书消息 → Agent 回复（路径已通；手工验收：配置 `FEISHU_APP_ID`/`FEISHU_APP_SECRET` → @机器人发问 → 收 `message.reply`）

## M5-05 钉钉

- [ ] **M5-05-01** `dingtalk-stream-listener.ts`
- [ ] **M5-05-02** `dingtalk-channel.adapter.ts`、`format-dingtalk-markdown-outbound.ts`
- [ ] **M5-05-03** E2E：钉钉消息 → Agent 回复

## M5-06 Worker 整合

- [ ] **M5-06-01** `message-bus/bootstrap.ts` + `channels/bootstrap.ts`
- [ ] **M5-06-02** MCP Pool 与 Worker 同进程
- [ ] **M5-06-03** Web 仅 BFF

## M5-07 渠道配置

- [ ] **M5-07-01** `channel-config.service.ts` Admin 写入生效
- [ ] **M5-07-02** `channel-binding.service.ts` boundUserId
- [ ] **M5-07-03** IM `permissionMode`（`config-plane.types.ts`）

---

## 完成检查清单

- [ ] `src/message-bus/` 文件全覆盖
- [ ] `src/channels/` web/feishu/dingtalk 全覆盖
- [ ] 飞书、钉钉 E2E 通过

## 参考对照

| 参考目录 | Meek |
|----------|------|
| `src/message-bus/` | `apps/worker/message-bus/` |
| `src/channels/` | `apps/worker/channels/` |
