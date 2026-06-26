# Optimize 模式

> **读者 = 父 agent**。仅在用户**明确**要求优化/改进/重构时启用；否则全程 migrate。

## 何时进入 optimize

| 触发 | 行为 |
|------|------|
| 用户说「优化」「改进」「重构」等 | 可超出任务书字面实现更好结构 |
| 门禁 proposals（migrate 批内） | **仅建议**；终裁仍按 [delivery.md](./delivery.md) 决策树 |
| 用户说「仅 migrate」 | proposals **全拒绝**或「写入 todos」本批完成；**仍须填裁决表** |

## 提案遇到禁优化项时（决策树）

```
proposal 是否触及下方「禁优化」表？
├─ 是，且用户未授权破坏性变更
│    → 终裁「拒绝」或标「需用户授权」；禁「本批采纳」
└─ 否
     → 可按 delivery.md 选「本批采纳」或「写入 todos」
```

## 禁优化（默认 migrate 也适用）

除非用户**明确授权破坏性变更**，禁止：

| 类别 | 示例 |
|------|------|
| HTTP 契约 | 改 `/api/*` 路径、请求/响应形 |
| 存储契约 | 改 `storage-contract` 键名 |
| 消息架构 | 绕过 BullMQ 直调 worker 队列 |
| AI SDK | 引入 `ai` / `@ai-sdk/*`（ADR-006） |
| README 禁止项 | 限流、Langfuse 等任务书未列能力 |

门禁 subagent 标出上表项 → 父 agent 默认**拒绝**「本批采纳」。

## 交付时怎么写（与 delivery.md 配合）

| 情况 | 用户回复章节 |
|------|----------------|
| 有 proposal 被「本批采纳」 | 「优化差异」列出路径与摘要 |
| 有 proposal 被拒绝 / 写入 todos | 「优化建议（门禁）」裁决表 |
| 无 proposal 且无代码优化 | 写 `parity migrate` |
