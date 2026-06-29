import type { Metadata } from 'next';
import { AdminPageClient } from '@/components/admin/admin-page-client';

import './admin.css';

export const metadata: Metadata = {
  title: '系统管理',
};

/** RSC 壳：交互在 AdminPageClient（M3-00-04） */
export default function AdminPage(): React.ReactElement {
  return <AdminPageClient />;
}
