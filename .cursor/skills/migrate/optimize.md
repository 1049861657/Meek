# 按需优化（Optimize 模式）

## 两种入口

| 入口 | 谁触发 | 做什么 |
|------|--------|--------|
| **用户明确 optimize** | 用户说优化/改进/重构 | 本批可直接实现超任务书改动 |
| **门禁 Optimization proposals** | 交付门禁 subagent 每批 PASS 后提出 | **仅建议**；主 AI 裁决后决定是否实现 / 写 todos |

门禁阶段信息最全（Diff + 参考 + 任务书），**应在此提议**；不要在编码中途默默扩 scope。

migrate 默认只执行任务书（任务书内已含 TS strict、RSC 壳、storage-contract 单模块等，仍算 migrate 而非 optimize）。

## 主 AI 裁决（见 delivery.md）

- **本批采纳** → 本批实现 + 交付「优化差异」
- **写入 todos** → 后续批次做
- **拒绝** → 不本批做，交付注明理由

用户说「严格 migrate、不要优化」→ 跳过全部 proposals。

## 禁止优化（除非用户明确允许破坏性变更）

- 修改 `/api/*` 路径或请求/响应字段  
- 修改 storage 键名  
- Web 绕过 BullMQ  
- 引入 `ai` / `@ai-sdk/*`  
- 引入 README 禁止项（Rate limit、Langfuse 等）  

门禁 proposals 触及上表须标 **需用户授权**，不得默认采纳。

## 交付

- 本批已采纳的超任务书改动 → 「优化差异」节（必填）
- 仅 proposals 未采纳 → 「优化建议（门禁）」表 + 裁决列
- 纯任务书、无采纳 → 「无，纯 parity migrate」
