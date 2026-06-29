import type { Metadata } from 'next';
import { InfoPageClient } from '@/components/info/info-page-client';

import './info.css';

export const metadata: Metadata = {
  title: 'MCP服务',
};

/** RSC 壳：交互在 InfoPageClient（M3-00-04） */
export default function McpPage(): React.ReactElement {
  return <InfoPageClient />;
}
