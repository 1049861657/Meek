import nextEnv from '@next/env';
import { defineConfig, env } from 'prisma/config';

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  schema: 'packages/db/prisma/schema.prisma',
  migrations: {
    path: 'packages/db/prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
