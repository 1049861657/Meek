import type { McpToolPreferencesStore } from '../mcp-types.js';

let store: McpToolPreferencesStore = {};

export function setToolPreferencesStore(next: McpToolPreferencesStore): void {
  store = next;
}

export function getToolPreferencesService(): {
  getAll(): Promise<McpToolPreferencesStore>;
} {
  return {
    async getAll() {
      return store;
    },
  };
}
