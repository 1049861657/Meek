import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/** Info 页 stdio：command=node，args=dist/mcp-servers/large-json-mcp.js（相对 worker cwd） */

/** 默认条目数：序列化后约 35k+ 字符，可触发 Client 侧 materializeToolOutput（阈值 30000） */
const DEFAULT_ITEM_COUNT = 180;

const server = new McpServer({
  name: 'LargeJson',
  version: '1.0.0'
});

server.registerTool(
  'largeJson',
  {
    description:
      '返回指定条目数的大 JSON 数组（用于测试 Agent 大 tool 输出落盘与 read_persisted_output 读回）',
    inputSchema: {
      itemCount: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .optional()
        .describe(`数组条目数，默认 ${DEFAULT_ITEM_COUNT}（约超过 30000 字符）`),
      message: z
        .string()
        .optional()
        .describe('写入每条记录的备注文本，默认 filler')
    }
  },
  async (params) => {
    const itemCount = params.itemCount ?? DEFAULT_ITEM_COUNT;
    const note = params.message ?? 'large-json-smoke-filler';
    const items = Array.from({ length: itemCount }, (_, index) => ({
      id: index,
      label: `record-${index}`,
      note,
      nested: {
        index,
        hash: `item-${index}-${note.length}`
      }
    }));

    const payload = {
      tool: 'largeJson',
      itemCount,
      charHint: 'intentionally large for tool output artifact smoke test',
      generatedAt: new Date().toISOString(),
      items
    };

    const text = JSON.stringify(payload, null, 2);
    return {
      content: [
        {
          type: 'text',
          text: `[largeJson] items=${itemCount}, bytes=${Buffer.byteLength(text, 'utf8')}\n${text}`
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
