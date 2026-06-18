import { LogConfig } from '../config/feature-config.js';
import { Logger } from './logger.js';
import type { ChatTool } from '../types.js';

export function logLlmToolsIfEnabled(model: string, tools: readonly ChatTool[]): void {
  if (!LogConfig.debugLlmTools) {
    return;
  }
  Logger.debug(
    'OPENAI',
    `LLM tools model=${model} count=${tools.length} names=${tools.map((t) => t.function.name).join(',')}`
  );
}
