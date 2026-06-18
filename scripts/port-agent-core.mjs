import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const meekRoot = join(__dirname, '..');
const mcpRoot = join(meekRoot, '..', 'MCP-Client');
const destRoot = join(meekRoot, 'packages', 'agent-core', 'src');

const harnessSrc = join(mcpRoot, 'src', 'core', 'agent-harness');

/** @param {string} srcDir @param {string} destDir */
function copyDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.endsWith('.ts')) {
      let content = readFileSync(srcPath, 'utf8');
      content = transform(content, relative(destRoot, destPath).replace(/\\/g, '/'));
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, content);
    }
  }
}

/** @param {string} content @param {string} destRel */
function transform(content, destRel) {
  const depth = destRel.split('/').length - 1;
  const up = depth === 0 ? '.' : Array(depth).fill('..').join('/');

  let out = content;

  // Redis prefix
  out = out.replaceAll('mcp-client:perm:', 'meek:perm:');
  out = out.replaceAll("bankIdPrefix: 'mcp-client'", "bankIdPrefix: 'meek'");

  // Hook config paths
  out = out.replaceAll('.mcp-client/hooks.json', '.meek/hooks.json');

  // Logger
  out = out.replaceAll('../../utils/logger.js', `${up}/lib/logger.js`);
  out = out.replaceAll('../../../utils/logger.js', `${up}/lib/logger.js`);

  // Config
  out = out.replaceAll('../../config/feature-config.js', `${up}/config/feature-config.js`);
  out = out.replaceAll('../../../config/feature-config.js', `${up}/config/feature-config.js`);
  out = out.replaceAll('../../config/permission.types.js', `${up}/config/permission.types.js`);
  out = out.replaceAll('../../config/permission-defaults.js', `${up}/config/permission-defaults.js`);

  // Redis
  out = out.replaceAll(
    '../../message-bus/redis-connection.js',
    '@meek/shared'
  );
  out = out.replace(
    /import \{ getIdempotencyRedisConnection \} from '@meek\/shared';/g,
    "import { getIdempotencyRedisConnection } from '@meek/shared';"
  );

  // MCP client port
  out = out.replaceAll('../mcp/index.js', `${up}/ports/mcp-client-port.js`);
  out = out.replaceAll('../../core/mcp/index.js', `${up}/ports/mcp-client-port.js`);

  // Shared types
  out = out.replaceAll(
    '../../types/channel.types.js',
    '@meek/shared'
  );
  out = out.replaceAll(
    "import type { ChannelId } from '@meek/shared';",
    "import type { ChannelId, MemoryIdentityScope } from '@meek/shared';"
  );

  // ResolvedProfile (was ResolvedChatProfile)
  out = out.replaceAll('ResolvedChatProfile', 'ResolvedProfile');
  out = out.replaceAll(
    '../../types/config-plane.types.js',
    '@meek/shared'
  );

  // MCP types -> local mcp-types
  out = out.replaceAll('../../types/mcp.types.js', `${up}/mcp-types.js`);
  out = out.replaceAll('../../../types/mcp.types.js', `${up}/mcp-types.js`);

  // tool-name-codec
  out = out.replaceAll('../../utils/tool-name-codec.js', `${up}/lib/tool-name-codec.js`);

  // tool-policy
  out = out.replaceAll('../../services/tool-policy.service.js', `${up}/services/tool-policy.service.js`);

  // Services removed -> ports
  out = out.replaceAll(
    '../../services/chat-store.service.js',
    `${up}/ports/chat-store-port.js`
  );
  out = out.replaceAll('ChatStore.', 'getChatStore().');
  out = out.replaceAll(
    "import { getChatStore } from '../../ports/chat-store-port.js';",
    `import { getChatStore } from '${up}/ports/chat-store-port.js';`
  );

  out = out.replaceAll(
    '../../services/mcp-context.service.js',
    `${up}/lib/mcp-pool-key.js`
  );
  out = out.replaceAll(
    '../services/mcp-context.service.js',
    `${up}/lib/mcp-pool-key.js`
  );

  // Memory
  out = out.replaceAll(
    '../memory/hindsight-memory-provider.js',
    `${up}/ports/memory-port.js`
  );
  out = out.replaceAll(
    '../../core/memory/hindsight-memory-provider.js',
    `${up}/ports/memory-port.js`
  );
  out = out.replaceAll(
    '../memory/memory-pipeline-context.js',
    `${up}/memory-pipeline-context.js`
  );
  out = out.replaceAll(
    '../../core/memory/memory-pipeline-context.js',
    `${up}/memory-pipeline-context.js`
  );

  // prompt-pipeline utils
  out = out.replaceAll(
    '../../utils/tool-schema-summary.js',
    `${up}/lib/tool-schema-summary.js`
  );

  // ConfigService -> settings port inline stub in prompt-pipeline handled separately
  out = out.replaceAll(
    '../../services/config.service.js',
    `${up}/ports/settings-port.js`
  );

  out = out.replaceAll(
    '../../services/mcp-connection.service.js',
    `${up}/ports/mcp-client-port.js`
  );
  out = out.replaceAll('McpConnectionService.', 'getMcpConnectionService().');

  out = out.replaceAll(
    '../../services/tool-preferences.service.js',
    `${up}/ports/tool-preferences-port.js`
  );
  out = out.replaceAll('ToolPreferencesService.', 'getToolPreferencesService().');

  out = out.replaceAll(
    '../../utils/llm-tools-debug.js',
    `${up}/lib/llm-tools-debug.js`
  );

  out = out.replaceAll(
    '../../types/config.types.js',
    `${up}/providers/provider-types.js`
  );

  return out;
}

// Copy harness
copyDir(harnessSrc, destRoot);

// Copy providers
mkdirSync(join(destRoot, 'providers'), { recursive: true });
for (const file of ['ai-provider.ts', 'ai-providers.ts']) {
  const src = join(mcpRoot, 'src', 'providers', file);
  const dest = join(destRoot, 'providers', file);
  let content = transform(readFileSync(src, 'utf8'), `providers/${file}`);
  // Fix harness imports in providers
  content = content.replaceAll('../core/agent-harness/', '../');
  writeFileSync(dest, content);
}

// Copy tool-policy (pure + we'll trim async deps manually)
mkdirSync(join(destRoot, 'services'), { recursive: true });
let toolPolicy = readFileSync(join(mcpRoot, 'src', 'services', 'tool-policy.service.ts'), 'utf8');
toolPolicy = transform(toolPolicy, 'services/tool-policy.service.ts');
writeFileSync(join(destRoot, 'services', 'tool-policy.service.ts'), toolPolicy);

// Copy tool-name-codec
mkdirSync(join(destRoot, 'lib'), { recursive: true });
copyFileSync(
  join(mcpRoot, 'src', 'utils', 'tool-name-codec.ts'),
  join(destRoot, 'lib', 'tool-name-codec.ts')
);

console.log('Port script completed');
