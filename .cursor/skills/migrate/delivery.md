# 迁移交付

> 流程见 [SKILL.md](./SKILL.md)。门禁 subagent · proposals 裁决 · 交付模板。

## 硬规则

- 门禁：`generalPurpose` + `readonly`，**禁 Bugbot**
- Findings → BLOCK；proposals **不** BLOCK
- 审阅范围 =「本批变更清单」路径，**禁**工作区全量 diff
- **勾选任务书 ≠ 交付**；PASS 后须裁决 proposals（含「无」）方能对用户说完成

## 交付前自检

build · 本批 `M*.md` 勾选 · `README` 进度 · 门禁 PASS · proposals 已裁决（无则注明）· `写入 todos` 已 `Grep` `Mx-yy-Dnn` · 回复含裁决表

## 变更清单（启门禁前，边编码边记）

```markdown
Batch: M3-04 | 新增/修改/删除/不属于本批/超任务书（无则写无）
| 路径 | 摘要 |
```

## 门禁 subagent

`generalPurpose` · `readonly` · `run_in_background: false` · `Migrate delivery gate`

**Prompt**（填实参路径）：

```text
Meek: … | 参考: … | Batch: …
本批变更清单: <上表>
Read: delivery.md, optimize.md

任务 A — 仅清单内文件，对照参考 + routes.ts + storage-contract + README 禁止项 + 任务书；超任务书已落地无说明 → BLOCK。
核对：①参考映射 ②无禁项新能力 ③API/存储键 ④清单=实现 ⑤build ⑥todo 勾选一致 ⑦未授权 optimize。

任务 B — 不 BLOCK：| # | 类型 | 建议 | 理由 | 影响 | 建议处置 |（本批采纳|写入 todos|拒绝）

输出：## Verdict ## Findings ## Optimization proposals（无则写无）## Notes
```

| Verdict | 动作 |
|---------|------|
| BLOCK | 修 Findings → build → 重跑（≤2 次） |
| PASS | 裁决 proposals → 交付 |

## Proposals 裁决

子 agent「建议处置」≠ 终裁。`无` / `已跳过` 也须在裁决表占一行。

| 终裁 | 动作 |
|------|------|
| 本批采纳 | 改代码 →「优化差异」 |
| 写入 todos | `todos/M*.md` 该节末：`### 门禁待办（deferred）— Mx-yy` + `- [ ] **Mx-yy-D01** （门禁 #n）简述` → Grep 确认 |
| 拒绝 | 表内写理由 |

触 optimize 禁止项 / API·存储键 / BullMQ → 禁「本批采纳」。子 agent「写入 todos」→ 禁跳过。用户「仅 migrate」→ 全拒绝或 deferred，**仍填表**。

## 用户回复（PASS 后）

做了什么 · 本批变更表 · 参考路径 · 优化差异（无则 parity migrate）· **优化建议（门禁）**`| # | 建议 | 裁决 | 落点 |` · `门禁 PASS · deferred: … / 无`
