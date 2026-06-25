import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/** Info 页 stdio：command=node，args=dist/mcp-servers/echo-mcp.js（相对 worker cwd） */

/** P2-02 info 页探针：固定 URI，仅用于 Resources 列表/预览自测，非业务数据 */
const ECHO_PROBE_RESOURCE_URI = 'echo://probe/note';

/**
 * 创建并配置 MCP 服务器
 */
const server = new McpServer({
  name: 'Echo',
  version: '1.0.0',
});

server.registerTool(
  'echo',
  {
    description: '输出一个复读机',
    inputSchema: {
      message: z.string().describe('字符串'),
    },
  },
  async (params) => ({
    content: [{ type: 'text', text: `Tool echo: ${params.message}` }],
  })
);

server.registerResource(
  'echo-probe-note',
  ECHO_PROBE_RESOURCE_URI,
  {
    title: 'Echo 探针资源',
    description: '临时：P2-02 Resources 列表与 read 预览',
    mimeType: 'text/plain',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'text/plain',
        text: 'Echo resource probe — 复读机固定文本，仅供 info 页预览，不进聊天。',
      },
    ],
  })
);

server.registerPrompt(
  'echo-probe-greet',
  {
    description: '临时：P2-02 Prompts 列表与 get 预览',
    argsSchema: {
      name: z.string().describe('称呼'),
    },
  },
  async ({ name }) => ({
    description: 'Echo prompt probe',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `【Echo prompt 探针】请用一句话向「${name}」问好（仅 info 预览，不进 Agent）。`,
        },
      },
    ],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
