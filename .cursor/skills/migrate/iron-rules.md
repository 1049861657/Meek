# Migrate 编码铁律

migrate 默认；optimize 叠加 [optimize.md](./optimize.md)。

| 做 | 不做 |
|----|------|
| 对照参考重写 | 拷文件进 Meek |
| 契约与参考一致 | 新 API / 新 storage 键 |
| 最小 diff、扩包 | 平行重复实现 |
| throw / 边界明确错误 | 空 catch、静默 fallback |

**编码前**：Glob/Read 参考 · 对齐 reference-map · **参考无则停、问用户** · API/storage 不改名 · 复用 `packages/*`

**技术**：Node ≥24 · Next App Router + `nodejs` runtime · Worker stdio/BullMQ · agent-harness · import `.js` + 命名导出

**验证**：API→routes.ts · 前端键→storage-contract.js · 批末 `pnpm build`
