import { loadRootEnv } from '@meek/shared';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

loadRootEnv();
import { PrismaClient } from './generated/prisma/client';

class PrismaInstance {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaInstance.instance) {
      const adapter = new PrismaBetterSqlite3({
        url: process.env.DATABASE_URL!,
      });
      PrismaInstance.instance = new PrismaClient({ adapter });
    }
    return PrismaInstance.instance;
  }
}

export const prisma = PrismaInstance.getInstance();

export { PrismaClient } from './generated/prisma/client';
