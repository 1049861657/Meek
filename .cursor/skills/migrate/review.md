# 迁移评审（编码前）



## 第一步：现查参考源码（必做）



1. Read 锚点：`MCP-Client/src/api/routes.ts`、`frontend/src/chat/storage-contract.js`、`prisma/schema.prisma`

2. **Glob** 本批次目录（见 `todos/M*.md` 头部「现查」）

3. **Grep** 关键符号确认调用链



映射表中的参考路径 **必须来自本次现查**。



**禁止**用 `MCP-Client/todos/` 定范围。



---



## 第二步：输出参考映射表



用户未说「跳过评审」时给出：



```markdown

## 批次：M3-03



### 现查范围

- Glob: MCP-Client/frontend/src/chat/**



### 参考源码（来自现查）

| 参考路径 | 职责摘要 |

|----------|----------|



### Meek 落点

| 文件（计划） | 对应参考 |



### 契约检查

- [ ] API：对照 routes.ts

- [ ] 存储：对照 storage-contract.js

- [ ] 禁止项：对照 todos/README.md



### 不在参考代码中

- （Grep 确认）

```



---



## 双仓库路径



| 仓库 | 根路径 |

|------|--------|

| Meek | `D:\gitProject\Meek` |

| 参考 | `D:\gitProject\MCP-Client` |


