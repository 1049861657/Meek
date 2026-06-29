import type { Metadata } from 'next';
import { SettingsPageClient } from '@/components/settings/settings-page-client';

import './settings.css';

export const metadata: Metadata = {
  title: '模型配置',
};

/** RSC 壳：交互在 SettingsPageClient（M3-00-04） */
export default function SettingsPage(): React.ReactElement {
  return <SettingsPageClient />;
}
