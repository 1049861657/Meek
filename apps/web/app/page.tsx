import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing';

import './landing.css';

export const metadata: Metadata = {
  title: 'MCP客户端 - 模型上下文协议',
  description: '连接 AI 大模型与工具能力，释放智能应用潜力的桥梁',
};

/** RSC 壳：Landing 全静态（M3-00-04） */
export default function HomePage(): React.ReactElement {
  return <LandingPage />;
}
