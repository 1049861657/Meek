# Migrate 编码铁律

适用 **migrate 模式**（默认）。optimize 模式叠加 [optimize.md](./optimize.md)。

## 原则

| 做 | 不做 |
|----|------|
| 对照参考源码重写 | 拷贝 `MCP-Client` 文件进 Meek |
| 对外契约与参考运行时一致 | 新 API、新页面、新 localStorage 键 |
| 最小 diff，扩展现有包 | 平行实现同一能力 |
| 失败 throw；边界层返回明确错误 | 空 catch、静默 fallback |
| pnpm workspace 约定 | default export、跨层堆逻辑 |

## 编码前六问

| # | 问 | 不过则 |
|---|-----|--------|
| 0 | 本批次是否已 Glob/Read 参考目录（见 M*.md 现查）？ | 先查再写 |
| 1 | 参考文件路径是否已 Read？ | 先读再写 |
| 2 | Meek 落点目录是否已存在约定？ | 先对齐 reference-map |
| 3 | 是否引入参考代码没有的行为？ | 停，问用户 |
| 4 | API/存储键是否与 `routes.ts` / `storage-contract.js` 一致？ | 不改名 |
| 5 | 能否复用已有 `packages/*` 而非新包？ | 禁重复轮子 |

## 技术约束（Meek）

- **Node** >= 24（与参考一致）
- **Web**：Next.js App Router、`runtime = 'nodejs'`（MCP/Prisma 不进 Edge）
- **Worker**：stdio MCP、BullMQ、渠道监听
- **Agent**：移植 `agent-harness` + `openai` + `@modelcontextprotocol/sdk`（ADR-006）
- **import**：相对路径带 `.js`；命名导出；显式返回类型

## 验证最低线

| 改动类型 | 验证 |
|----------|------|
| API | 路径/方法对齐 `MCP-Client/src/api/routes.ts` |
| 前端契约 | 键名对齐 `frontend/src/chat/storage-contract.js` |
| Harness | 关键路径可读参考 `agent-loop.ts` 行为 |
| 全批结束 | `pnpm build`（monorepo 可 build 时） |
