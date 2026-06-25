import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import { admin, multiSession, username } from 'better-auth/plugins';
import { adminAc, userAc } from 'better-auth/plugins/admin/access';
import { prisma } from '@meek/db';
import { resolveDefaultWebOrigin } from '@meek/shared';

import { hashPassword, verifyPassword } from './password-hasher';
import { SUPERADMIN_ROLE, USER_ROLE } from '@/lib/auth/constants';

export { SUPERADMIN_ROLE, USER_ROLE } from '@/lib/auth/constants';

export const auth = betterAuth({
  baseURL: {
    allowedHosts: ['localhost:*', '127.0.0.1:*', '*.vercel.app'],
    fallback: resolveDefaultWebOrigin(),
  },
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    password: { hash: hashPassword, verify: verifyPassword },
    revokeSessionsOnPasswordReset: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const existing = await prisma.user.count();
          return {
            data: { ...user, role: existing === 0 ? SUPERADMIN_ROLE : USER_ROLE },
          };
        },
      },
    },
  },
  plugins: [
    username(),
    admin({
      roles: { SUPERADMIN: adminAc, USER: userAc },
      defaultRole: USER_ROLE,
      adminRoles: [SUPERADMIN_ROLE],
    }),
    multiSession({ maximumSessions: 3 }),
  ],
});
