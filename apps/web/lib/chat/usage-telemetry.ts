/**
 * LLM token meter（纯数据层）— 对齐 usage-telemetry.js
 */

export interface TokenUsageSnapshot {
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface StepUsagePayload {
  round: number;
  step: TokenUsageSnapshot;
  cumulative: TokenUsageSnapshot;
}

export interface TokenUsageDisplay {
  totalTokens: number;
  promptTokens?: number;
  completionTokens?: number;
  stepDelta?: number;
  round?: number;
  phase: 'streaming' | 'done';
  title: string;
  showIncrement: boolean;
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return '0';
  }
  return Math.round(n).toLocaleString('en-US');
}

export function buildUsageTitle(usage: TokenUsageSnapshot | undefined): string {
  if (!usage?.totalTokens) {
    return '';
  }
  const parts: string[] = [];
  if (usage.promptTokens) {
    parts.push(`In ${formatTokenCount(usage.promptTokens)}`);
  }
  if (usage.completionTokens) {
    parts.push(`Out ${formatTokenCount(usage.completionTokens)}`);
  }
  if (parts.length === 0) {
    return `Total ${formatTokenCount(usage.totalTokens)} tokens`;
  }
  return `${parts.join(' · ')} · ${formatTokenCount(usage.totalTokens)} total`;
}

function buildStepTitle(round: number, stepTok: number): string {
  return `Model pass ${round} · +${formatTokenCount(stepTok)} tokens`;
}

export function mapStepUsageToDisplay(payload: StepUsagePayload): TokenUsageDisplay | null {
  if (!payload?.cumulative?.totalTokens) {
    return null;
  }

  const cumulative = payload.cumulative.totalTokens;
  const stepTok = payload.step?.totalTokens ?? 0;
  const round = payload.round;
  const title = buildUsageTitle(payload.cumulative);
  const showIncrement = round > 0 && stepTok > 0;

  return {
    totalTokens: cumulative,
    promptTokens: payload.cumulative.promptTokens,
    completionTokens: payload.cumulative.completionTokens,
    stepDelta: showIncrement ? stepTok : undefined,
    round: showIncrement ? round : undefined,
    phase: 'streaming',
    title: showIncrement ? buildStepTitle(round, stepTok) : title,
    showIncrement,
  };
}

export function mapFinalUsageToDisplay(
  usageData: TokenUsageSnapshot & { elapsedTime?: string | number }
): TokenUsageDisplay | null {
  if (!usageData?.totalTokens) {
    return null;
  }

  return {
    totalTokens: usageData.totalTokens,
    promptTokens: usageData.promptTokens,
    completionTokens: usageData.completionTokens,
    phase: 'done',
    title: buildUsageTitle(usageData),
    showIncrement: false,
  };
}

export function parseElapsedSecondsFromUsage(
  usageData: { elapsedTime?: string | number }
): number | undefined {
  const raw = usageData.elapsedTime;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = parseFloat(raw);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}
