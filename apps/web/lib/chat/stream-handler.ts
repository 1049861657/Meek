/**
 * SSE 流式解析门面 — 对齐 MCP-Client `frontend/src/chat/stream-handler.js` 导出。
 * 实现分布于 `process-sse-stream.ts`、`apply-stream-chunk.ts`、`sync-turn-collector.ts`。
 */

export { consumeSseStream, type ConsumeSseStreamResult, type SseStreamCallbacks, type StreamRuntime } from './process-sse-stream';
export { applyStreamChunk as applyStreamDataObject } from './apply-stream-chunk';
export { feedTurnCollectorFromPayload } from './sync-turn-collector';
