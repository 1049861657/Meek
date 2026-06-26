import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import {
  ChatIcon,
  CogIcon,
  LayoutIcon,
  LightningIcon,
  ShieldIcon,
  SlidersIcon,
} from './landing-icons';

interface FeatureItem {
  icon: ReactElement;
  title: string;
  description: string;
}

interface ModelItem {
  letter: string;
  name: string;
  model: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: <LightningIcon className="h-7 w-7" />,
    title: '多模型接入',
    description: '支持 DeepSeek、OpenRouter、火山引擎等多种供应商，灵活切换对话模型。',
  },
  {
    icon: <CogIcon className="h-7 w-7" />,
    title: '工具调用能力',
    description: '基于 MCP 协议，让模型调用外部工具完成复杂任务，扩展能力边界。',
  },
  {
    icon: <ChatIcon className="h-7 w-7" />,
    title: '交互式 AI 聊天',
    description: '流式对话与工具执行过程可视化，支持历史会话与上下文压缩。',
  },
  {
    icon: <LayoutIcon className="h-7 w-7" />,
    title: '服务状态监控',
    description: '查看 MCP 服务连接、可用工具列表与运行指标，保障系统稳定。',
  },
  {
    icon: <SlidersIcon className="h-7 w-7" />,
    title: '高度可扩展',
    description: '模块化架构，便于接入新工具、新模型与 IM 渠道配置。',
  },
  {
    icon: <ShieldIcon className="h-7 w-7" />,
    title: '安全可控',
    description: '工具调用权限与渠道配置分离管理，降低越权访问风险。',
  },
];

const MODELS: ModelItem[] = [
  { letter: 'D', name: 'DeepSeek', model: 'DeepSeek Chat' },
  { letter: 'Q', name: '千问', model: 'qwq-32b' },
  { letter: 'C', name: 'Claude', model: 'claude-3.7-sonnet' },
  { letter: 'H', name: '火山引擎', model: '豆包 1.5 Pro' },
];

function FeatureCard({ icon, title, description }: FeatureItem): ReactElement {
  return (
    <article className="landing-feature-card">
      <div className="landing-feature-card__icon">{icon}</div>
      <h3 className="landing-feature-card__title">{title}</h3>
      <p className="landing-feature-card__desc">{description}</p>
    </article>
  );
}

function ModelCard({ letter, name, model }: ModelItem): ReactElement {
  return (
    <div className="landing-model-card">
      <div className="landing-model-card__avatar">{letter}</div>
      <p className="landing-model-card__name">{name}</p>
      <p className="landing-model-card__model">{model}</p>
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      <h2 className="landing-section-heading">{children}</h2>
      <div className="landing-section-heading__bar" />
    </>
  );
}

/** Landing 首页（RSC）— 对照 MCP-Client frontend/index.html */
export function LandingPage(): ReactElement {
  return (
    <main className="landing-page bg-page-bg text-text antialiased">
      <section className="landing-hero">
        <div className="landing-hero__glow" aria-hidden="true" />
        <div className="landing-hero__inner">
          <p className="landing-hero__eyebrow">Model Context Protocol</p>
          <h1 className="landing-hero__title">MCP 工具调用平台</h1>
          <p className="landing-hero__subtitle">
            连接 AI 大模型与工具能力，释放智能应用潜力的桥梁
          </p>
          <div className="landing-hero__cta">
            <Link href="/ai" className="landing-cta landing-cta--primary">
              开始 AI 对话
            </Link>
            <Link href="/info" className="landing-cta landing-cta--secondary">
              查看服务状态
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-features">
        <SectionHeading>核心功能</SectionHeading>
        <div className="landing-features__grid">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <section className="landing-models">
        <div className="landing-models__inner">
          <SectionHeading>支持的 AI 模型与供应商</SectionHeading>
          <div className="landing-models__grid">
            {MODELS.map((model) => (
              <ModelCard key={model.name} {...model} />
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p className="landing-footer__text">我是页脚</p>
      </footer>
    </main>
  );
}
