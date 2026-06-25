# 迁移交付

## 交付流程（顺序固定）

```
编码完成 → pnpm build → 勾选 todos → 启动交付门禁 subagent → PASS 后主 AI 裁决优化建议 → 交付正文
```

**禁止**用 Bugbot / `bugbot` subagent 代替本门禁。  
**禁止**门禁 BLOCK 时仍向用户宣称批次完成。  
**禁止**因「优化建议」本身 BLOCK；建议与门禁分离。

---

## 交付门禁 subagent（必过）

编码与 `pnpm build` 通过后、写交付正文前，**必须**启动 **1 个** readonly subagent。

| 项 | 值 |
|----|-----|
| `subagent_type` | `generalPurpose`（**不是** `bugbot`） |
| `readonly` | `true` |
| `run_in_background` | `false` |
| `description` | `Migrate delivery gate` |

此时 subagent 同时掌握 **Diff + 参考源码 + 任务书**，信息最全——除硬性门禁外，**应主动提出优化建议**（见下），供主 AI 裁决；subagent **不得**自行改代码或 todos。门禁默认对照工作区未提交变更（`Diff: uncommitted changes`），勿因无 commit 拒审。

### 传给 subagent 的 prompt 模板

```text
Full Repository Path: D:\gitProject\Meek
Reference Repository Path: D:\gitProject\MCP-Client
Batch: <Mx / Mx-yy 节，如 M3-00>
Diff: uncommitted changes
（若本批已 commit 未 push，可改为 branch changes）

Read:
- Meek/.cursor/skills/migrate/delivery.md（门禁 + 优化建议）
- Meek/.cursor/skills/migrate/optimize.md（禁止项）

任务 A — 硬性门禁（只读）：对照 Diff 与参考，逐条判定；不过则 Verdict=BLOCK。

门禁清单：
1. 每条改动能指向现查得到的 MCP-Client/ 参考路径（或任务书已声明的 Meek 独有落点）
2. 无参考代码不存在的新功能（对照 todos/README.md 禁止项）
3. API 路径/方法与 routes.ts 一致；storage 键与 storage-contract.js 一致（migrate 未擅自改名）
4. 改动范围在本批次 todos/M*.md 内，无无关文件
5. 本批涉及 web/packages 时，pnpm build 应有通过依据（父 agent 可提供结论）
6. 本批次 Meek todos 子项与实现一致
7. 若 Diff 含**已落地**的超任务书改动：交付须备差异说明；未说明且非用户授权的 optimize → BLOCK

任务 B — 优化建议（不阻塞 PASS）：在通过门禁的前提下，基于当前 Diff+参考+任务书，列出**可选**改进。
- 类型：parity 缺口 / 结构简化 / 性能 / 可维护性 / 任务书补项
- 遵守 optimize.md 禁止项；触及禁止项的只能标为「需用户授权」
- 每条须说明：现状、建议、理由、影响面、是否建议写入 todos

输出格式（严格遵守）：
## Verdict
PASS | BLOCK

## Findings
（BLOCK：| # | 门禁项 | 位置 | 说明 |；PASS：无）

## Optimization proposals
（无建议写「无」；有则表格 | # | 类型 | 建议 | 理由 | 影响 | 建议处置 |）
建议处置枚举：本批采纳 | 写入 todos | 拒绝

## Notes
（参考路径摘要、M4/M6 门控补验提示）
```

### 主 AI 处理 Verdict

| Verdict | 动作 |
|---------|------|
| **PASS** | 进入「优化建议裁决」（下节），再写交付正文 |
| **BLOCK** | 只修 Findings → 重跑 build → 重跑门禁（同批最多 **2** 次） |

### 主 AI 处理 Optimization proposals（PASS 后必做）

| 建议处置 | 主 AI 动作 |
|----------|------------|
| **本批采纳** | 用户未禁止则实现 → 视为 optimize → 交付写「优化差异」→ 必要时更新 todos |
| **写入 todos** | 在对应 `M*.md` 增子项；交付「待办优化」列出 |
| **拒绝** | 不实现；交付一句话理由（可写在 Notes） |

**默认**：未触及禁止项、改动小 → 主 AI 可自行「本批采纳」或「写入 todos」；触及 API/存储键/BullMQ 等 → **必须**问用户或标「需用户授权」。

用户说「就按任务书、不要优化」→ 忽略 proposals，交付写「优化建议：已跳过（用户仅 migrate）」。

---

## 交付正文（门禁 PASS + 建议裁决后）

```markdown
## 做了什么
（本批次，对应 Mx-yy）

## 参考源码
- MCP-Client/...

## 优化差异
（本批已采纳的超任务书改动；无则「无，纯 parity migrate」）

## 优化建议（门禁）
| # | 建议 | 裁决 |
（无则「门禁未提出」或「已跳过」）

## 门禁
Migrate delivery gate: PASS
```

---

## 与 optimize 模式的关系

| 概念 | 含义 |
|------|------|
| **migrate（默认）** | 只实现任务书；门禁仍可**提议**优化，但不自动做 |
| **optimize（用户明确说）** | 允许超任务书实现；交付必须有「优化差异」 |
| **门禁 Optimization proposals** | 每批 PASS 后的**建议池**；做不做由**主 AI + 用户**定 |

禁止：用 MCP-Client todos 证明完成度；未 PASS 不得写「门禁: PASS」。
