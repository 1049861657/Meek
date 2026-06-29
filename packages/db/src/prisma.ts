import { getResolvedDatabaseUrl } from '@meek/shared/root-env';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaClient } from './generated/prisma/client.js';

const PKG_DIR = dirname(fileURLToPath(import.meta.url));

function getDatabaseUrl(): string {
  return getResolvedDatabaseUrl(PKG_DIR);
}

class PrismaInstance {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaInstance.instance) {
      const adapter = new PrismaBetterSqlite3({
        url: getDatabaseUrl(),
      });
      PrismaInstance.instance = new PrismaClient({ adapter });
    }
    return PrismaInstance.instance;
  }
}

export const prisma = PrismaInstance.getInstance();

export { PrismaClient } from './generated/prisma/client.js';
