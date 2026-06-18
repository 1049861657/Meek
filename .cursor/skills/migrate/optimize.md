# 按需优化（Optimize 模式）

**仅当用户明确要求**、且超出 `todos/M*.md` 已写任务时使用。

migrate 默认按任务书执行（任务书里已含调研结论：TS strict、storage-contract 单模块、RSC 壳、公共 normalize 等）。

## 禁止优化（除非用户明确允许破坏性变更）

- 修改 `/api/*` 路径或请求/响应字段  
- 修改存储键名  
- Web 绕过 BullMQ  
- 引入 `ai` / `@ai-sdk/*`  
- 引入 README 禁止项（Rate limit、Langfuse 等）  

## 交付

有 optimize 差异时追加「相对参考的差异与理由」节；纯任务书实现可省略。
