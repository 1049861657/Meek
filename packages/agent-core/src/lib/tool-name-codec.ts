/**
 * MCP 工具名称编解码（Chat Completions function name 兼容格式）
 *
 * ## 编码格式
 *   `mcp__h{serverHash6}__{toolName}`
 *
 *   - `mcp__`        固定前缀（5 字符）
 *   - `h{serverHash6}` 服务器标识：FNV-1a 32-bit 哈希取低 24 位转 6 位 hex，
 *                     `h` 前缀保证字母开头；纯函数，无副作用
 *   - `__{toolName}` 工具名**原样**嵌入，decode 无需任何存储
 *
 * ## 设计约束
 *   - toolName 必须符合 OpenAI function name 规范：`[a-zA-Z_][a-zA-Z0-9_]*`，≤50 字符
 *   - 违反约束时直接抛出错误，由 MCP 服务端负责修正命名，客户端不做静默兜底
 *
 * ## 性能
 *   encode / decode 均为纯同步函数，O(1)，零 DB 依赖，零 I/O
 */
export class ToolNameCodec {
  private static readonly PREFIX = 'mcp';
  // 64（OpenAI 上限） - len('mcp__h000000__') = 64 - 14 = 50
  private static readonly TOOL_MAX_LEN = 50;

  /**
   * FNV-1a 32-bit 哈希，分布均匀，雪崩性好
   */
  private static fnv32a(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /**
   * 服务器标识符：`h` + FNV-1a 低 24 位的 6 位 hex
   * 相同 serverId 永远得到相同结果（对 ≤1000 台服务器碰撞概率 < 0.13%）
   */
  private static serverIdent(serverId: string): string {
    const hash = this.fnv32a(serverId) & 0xffffff;
    return 'h' + hash.toString(16).padStart(6, '0');
  }

  /**
   * 将工具名编码为 OpenAI function name
   *
   * @param toolName MCP 工具名，必须符合 `[a-zA-Z_][a-zA-Z0-9_]*` 且 ≤50 字符
   * @param serverId 服务器 ID，用于区分跨服务器同名工具
   * @returns `mcp__h{serverHash6}__{toolName}`
   * @throws 工具名不合规时抛出错误
   */
  public static encode(toolName: string, serverId?: string): string {
    if (toolName.length > this.TOOL_MAX_LEN) {
      throw new Error(
        `工具名 "${toolName}" 超过最大长度 ${this.TOOL_MAX_LEN}，请在 MCP 服务端修正命名`
      );
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(toolName)) {
      throw new Error(
        `工具名 "${toolName}" 含非法字符，OpenAI function name 仅允许 [a-zA-Z0-9_] 且首字符为字母或下划线，请在 MCP 服务端修正命名`
      );
    }

    const sIdent = serverId ? this.serverIdent(serverId) : 'hunknown';
    return `${this.PREFIX}__${sIdent}__${toolName}`;
  }

  /**
   * 将 function name 解码为原始 MCP 工具名
   * 纯字符串解析，无 DB 查询，O(1)
   *
   * @param codeName 编码后的 function name
   * @returns 原始工具名
   * @throws codeName 格式不合法时抛出错误
   */
  public static decode(codeName: string): string {
    const firstSep = codeName.indexOf('__');
    const secondSep = firstSep !== -1 ? codeName.indexOf('__', firstSep + 2) : -1;

    if (secondSep === -1) {
      throw new Error(`codeName "${codeName}" 格式不合法，无法解码`);
    }

    return codeName.substring(secondSep + 2);
  }
}
