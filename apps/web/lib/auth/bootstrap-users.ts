import { SUPERADMIN_ROLE, USER_ROLE } from '@/lib/auth/constants';
import { auth } from '@/lib/auth';
import { ensureSeedFollowDefault } from '@meek/config-plane';
import { prisma } from '@meek/db';

const DEFAULT_PASSWORD = '12345678';

interface BootstrapUserSpec {
  username: string;
  role: string;
}

const BOOTSTRAP_USERS: BootstrapUserSpec[] = [
  { username: 'admin', role: SUPERADMIN_ROLE },
  { username: 'seed', role: USER_ROLE },
];

async function ensureBootstrapUser(spec: BootstrapUserSpec): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { username: spec.username } });
  if (existing) {
    return;
  }

  await auth.api.signUpEmail({
    body: {
      email: `${spec.username}@local.dev`,
      password: DEFAULT_PASSWORD,
      name: spec.username,
      username: spec.username,
    },
  });

  await prisma.user.update({
    where: { username: spec.username },
    data: { role: spec.role },
  });

  console.info(
    `[BOOTSTRAP] 创建初始账号 ${spec.username}（${spec.role}），初密 ${DEFAULT_PASSWORD}`,
  );
}

/** 启动幂等创建 admin / seed 账号；已存在则不改密码与角色 */
export async function bootstrapUsers(): Promise<void> {
  for (const spec of BOOTSTRAP_USERS) {
    await ensureBootstrapUser(spec);
  }
  await ensureSeedFollowDefault();
}
