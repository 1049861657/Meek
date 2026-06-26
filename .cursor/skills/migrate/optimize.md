# Optimize 模式

| 入口 | 行为 |
|------|------|
| 用户明确 optimize | 可超任务书实现 |
| 门禁 proposals | 仅建议；裁决见 [delivery.md](./delivery.md) |

用户说「仅 migrate」→ proposals 全拒绝或写入 todos，仍须裁决表。

## 禁优化（除非用户授权破坏性变更）

改 `/api/*` 契约 · storage 键名 · 绕过 BullMQ · `ai`/`@ai-sdk/*` · README 禁止项（限流、Langfuse 等）

触及上表：proposal 标「需用户授权」，禁默认「本批采纳」。

## 交付

已采纳 → 「优化差异」· 未采纳 → 「优化建议（门禁）」裁决表 · 纯任务书 → 「parity migrate」
