# 迁移交付模板

## 自检表（migrate 批次）

| # | 项 | 通过 |
|---|-----|------|
| 1 | 每条改动有现查得到的 `MCP-Client/` 参考路径 | |
| 2 | 无参考代码不存在的新功能 | |
| 3 | API/存储契约未擅自变更 | |
| 4 | 仅改本批次 Meek todos 范围 | |
| 5 | pnpm build / 约定验证已跑 | |
| 6 | Meek todos 子项已勾选 | |
| 7 | optimize 模式已写差异表（若适用） | |

## 交付正文（三节）

```markdown
## 做了什么
（本批次完成的 Meek 能力，对应 Mx-yy）

## 参考源码
- MCP-Client/...
- MCP-Client/...

## 优化差异
（仅 optimize 模式；无则写「无，纯 parity migrate」）
```

禁止：用 MCP-Client todos 勾选证明完成度。
