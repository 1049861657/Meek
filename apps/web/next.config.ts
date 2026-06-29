import { loadRootEnv } from '@meek/shared/root-env';
import type { NextConfig } from 'next';

loadRootEnv();

const nextConfig: NextConfig = {
  // Native addons used by @meek/db — must not be bundled into the server runtime.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  logging: false,
};

export default nextConfig;
