import type { AIProviderConfig, AIProvidersConfigType } from '@meek/agent-core/provider';

const MODELS_TIMEOUT_MS = 4_000;
const COMPLETION_TIMEOUT_MS = 6_000;

export type ProviderProbeLevel = 'ok' | 'fail';

export interface ProviderProbeResult {
  level: ProviderProbeLevel;
  message: string;
  providerName: string;
  model: string;
  method?: 'models' | 'completion';
}

interface ProbeHttpOutcome {
  ok: boolean;
  status: number;
  errorKind?: 'auth' | 'not_found' | 'timeout' | 'network';
}

function joinApiPath(apiUrl: string, path: string): string {
  const base = apiUrl.trim().replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function classifyFetchError(error: unknown): ProbeHttpOutcome['errorKind'] {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'timeout';
    }
  }
  return 'network';
}

function mapStatusToError(status: number): ProbeHttpOutcome['errorKind'] | undefined {
  if (status === 401 || status === 403) {
    return 'auth';
  }
  if (status === 404) {
    return 'not_found';
  }
  return undefined;
}

function shouldFallbackFromModels(status: number): boolean {
  return status === 404 || status === 405 || status === 501;
}

function errorMessage(kind: ProbeHttpOutcome['errorKind'], status: number): string {
  if (kind === 'auth') {
    return 'API Key 无效或无权访问';
  }
  if (kind === 'not_found') {
    return '接口不存在，请检查 API URL 是否正确';
  }
  if (kind === 'timeout') {
    return '连接超时，请检查 API URL 与网络';
  }
  if (kind === 'network') {
    return '无法连接服务器，请检查 API URL';
  }
  if (status > 0) {
    return `服务返回 HTTP ${status}`;
  }
  return '连通检测失败';
}

async function probeModelsEndpoint(apiUrl: string, apiKey: string): Promise<ProbeHttpOutcome> {
  try {
    const response = await fetch(joinApiPath(apiUrl, '/models'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
    });

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    return {
      ok: false,
      status: response.status,
      errorKind: mapStatusToError(response.status),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      errorKind: classifyFetchError(error),
    };
  }
}

async function probeCompletionEndpoint(
  apiUrl: string,
  apiKey: string,
  model: string,
): Promise<ProbeHttpOutcome> {
  try {
    const response = await fetch(joinApiPath(apiUrl, '/chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(COMPLETION_TIMEOUT_MS),
    });

    if (response.ok) {
      return { ok: true, status: response.status };
    }

    return {
      ok: false,
      status: response.status,
      errorKind: mapStatusToError(response.status),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      errorKind: classifyFetchError(error),
    };
  }
}

export function resolveDefaultProbeTarget(
  config: AIProvidersConfigType,
): { provider: AIProviderConfig; model: string } | null {
  const providerName =
    (config.defaultProvider ?? '').trim() || (config.providers[0]?.name ?? '').trim();
  if (!providerName) {
    return null;
  }

  const provider =
    config.providers.find((row) => row.name === providerName) ?? config.providers[0];
  if (!provider) {
    return null;
  }

  const model =
    (provider.defaultModel ?? '').trim() ||
    (provider.models[0]?.value ?? '').trim() ||
    '';
  if (!model) {
    return null;
  }

  return { provider, model };
}

export async function probeProviderModel(
  provider: AIProviderConfig,
  model: string,
): Promise<ProviderProbeResult> {
  const base: Pick<ProviderProbeResult, 'providerName' | 'model'> = {
    providerName: provider.name,
    model,
  };

  const apiUrl = provider.apiUrl.trim();
  const apiKey = provider.apiKey.trim();
  if (!apiUrl || !apiKey) {
    return {
      ...base,
      level: 'fail',
      message: 'API URL 或 API Key 为空',
    };
  }

  const modelsProbe = await probeModelsEndpoint(apiUrl, apiKey);

  if (modelsProbe.ok) {
    return {
      ...base,
      level: 'ok',
      message: '连通正常',
      method: 'models',
    };
  }

  if (modelsProbe.errorKind === 'auth') {
    return {
      ...base,
      level: 'fail',
      message: errorMessage('auth', modelsProbe.status),
      method: 'models',
    };
  }

  const shouldTryCompletion =
    shouldFallbackFromModels(modelsProbe.status) ||
    modelsProbe.errorKind === 'network' ||
    modelsProbe.errorKind === 'timeout' ||
    modelsProbe.errorKind === 'not_found';

  if (!shouldTryCompletion) {
    return {
      ...base,
      level: 'fail',
      message: errorMessage(modelsProbe.errorKind, modelsProbe.status),
      method: 'models',
    };
  }

  const completionProbe = await probeCompletionEndpoint(apiUrl, apiKey, model);
  if (completionProbe.ok) {
    return {
      ...base,
      level: 'ok',
      message: '连通正常',
      method: 'completion',
    };
  }

  return {
    ...base,
    level: 'fail',
    message: errorMessage(completionProbe.errorKind, completionProbe.status),
    method: 'completion',
  };
}
