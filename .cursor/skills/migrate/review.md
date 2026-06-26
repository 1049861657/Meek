# 迁移评审（编码前）

> **读者 = 步骤 2–3 的父 agent**。评审输出须**基于本次 Glob/Read**，禁抄旧会话或 `MCP-Client/todos/`。

## 何时做 / 何时跳过

| 条件 | 动作 |
|------|------|
| 用户未说「跳过评审」 | **必须**输出下方模板并等确认 |
| 用户明确「跳过评审」 | 可进入编码；仍须步骤 2 现查锚点 |

## 逐步执行

```
1. Read 锚点（顺序）：
   - MCP-Client/src/api/routes.ts
   - MCP-Client/frontend/src/chat/storage-contract.js
   - MCP-Client/prisma/schema.prisma

2. 按本批 M*.md「现查」节执行 Glob（例：frontend/src/chat/**）

3. Grep 本批关键符号（组件名、API 路径、storage 键）

4. 为每个参考文件填「Meek 落点」：
   - 先查 reference-map.md
   - 无表项 → 按职责推断 apps/web 或 packages/*，标注「待确认」

5. 核对契约：API routes · storage 键 · README 禁止项

6. 参考仓库 Grep 仍无 → 记入「参考无」，禁假装已实现
```

## 必输出模板（发给用户确认）

```markdown
## 批次：<Mx-yy>
### 现查
- Glob: …
- Read: …

### 映射（须来自本次现查）
| 参考路径 | 职责 | Meek 落点 |
|----------|------|-----------|
| … | … | … |

### 契约核对
- API routes: …
- storage 键: …
- README 禁止项: 未触及 / …

### 参考无（Grep 确认）
- 无 / 列表
```

## 仓库路径（填模板时用绝对路径）

| 角色 | 路径 |
|------|------|
| Meek | `D:\gitProject\Meek` |
| 参考 | `D:\gitProject\MCP-Client` |

## 禁止

- 用 `MCP-Client/todos/` 定本批范围或映射
- 映射表路径非本次 Glob/Read 结果
- 未等用户确认就进入编码（除非已跳过评审）
