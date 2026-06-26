# 迁移评审（编码前）

1. Read 锚点：`routes.ts`、`storage-contract.js`、`schema.prisma`
2. Glob 本批目录（`M*.md`「现查」）+ Grep 关键符号
3. 映射路径**必须来自本次现查**；禁 `MCP-Client/todos/` 定范围

用户未说「跳过评审」时输出：

```markdown
## 批次：M3-03
### 现查：Glob …
### 参考 → 职责 | Meek 落点 → 参考
### 契约：API routes · storage · README 禁止项
### 参考无：Grep 确认
```

仓库：`Meek` = `D:\gitProject\Meek` · 参考 = `D:\gitProject\MCP-Client`
