'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestInfoJson } from '@/lib/info/info-api';
import type { ToolInfo, ToolTestTarget } from '@/lib/info/types';

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok' | 'err'; ms: number; unified?: { preview?: string; structured?: unknown } };

function defaultFormValues(tool: ToolInfo): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of tool.parameters ?? []) {
    values[param.name] = param.type === 'object' ? '{}' : '';
  }
  return values;
}

function buildArguments(
  tool: ToolInfo,
  values: Record<string, string>,
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const param of tool.parameters ?? []) {
    const raw = (values[param.name] ?? '').trim();
    if (!raw && !param.required) {
      continue;
    }
    if (param.type === 'integer') {
      args[param.name] = raw === '' ? 0 : Number(raw);
      continue;
    }
    if (param.type === 'object') {
      args[param.name] = raw === '' ? {} : JSON.parse(raw);
      continue;
    }
    args[param.name] = raw;
  }
  return args;
}

function validateForm(tool: ToolInfo, values: Record<string, string>): string | null {
  for (const param of tool.parameters ?? []) {
    const raw = (values[param.name] ?? '').trim();
    if (param.required && !raw) {
      return `${param.name} 为必填项`;
    }
    if (param.type === 'object' && raw) {
      try {
        JSON.parse(raw);
      } catch {
        return `${param.name} 须为合法 JSON`;
      }
    }
  }
  return null;
}

export interface ToolTestDrawerProps {
  target: ToolTestTarget | null;
  onClose: () => void;
}

export function ToolTestDrawer({ target, onClose }: ToolTestDrawerProps): React.ReactElement | null {
  const [values, setValues] = useState<Record<string, string>>({});
  const [runState, setRunState] = useState<RunState>({ status: 'idle' });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    if (!target) {
      return;
    }
    setValues(defaultFormValues(target.tool));
    setRunState({ status: 'idle' });
  }, [target]);

  useEffect(() => {
    if (!target) {
      return;
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [target, onClose]);

  const runTest = useCallback(async () => {
    if (!target) {
      return;
    }

    const validationError = validateForm(target.tool, values);
    if (validationError) {
      setRunState({
        status: 'err',
        ms: 0,
        unified: { preview: validationError },
      });
      return;
    }

    abortController?.abort();
    const controller = new AbortController();
    setAbortController(controller);
    setRunState({ status: 'running' });

    try {
      const data = (await requestInfoJson(
        `/api/server/${encodeURIComponent(target.serverId)}/tools/call`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName: target.tool.name,
            arguments: buildArguments(target.tool, values),
          }),
          signal: controller.signal,
        },
      )) as {
        ok?: boolean;
        ms?: number;
        error?: string;
        unified?: { preview?: string; structured?: unknown };
      };
      const unified = data.unified ?? (data.error ? { preview: data.error } : undefined);
      setRunState({
        status: data.ok ? 'ok' : 'err',
        ms: data.ms ?? 0,
        unified,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setRunState({ status: 'idle' });
        return;
      }
      setRunState({
        status: 'err',
        ms: 0,
        unified: {
          preview: error instanceof Error ? error.message : '试运行失败',
        },
      });
    } finally {
      setAbortController(null);
    }
  }, [abortController, target, values]);

  if (!target) {
    return null;
  }

  const tool = target.tool;
  const running = runState.status === 'running';

  return (
    <div className="test-overlay open" aria-hidden="false">
      <div className="test-backdrop" onClick={onClose} />
      <aside className="test-drawer" role="dialog" aria-labelledby="test-drawer-title">
        <div className="test-drawer-head">
          <div>
            <h2 id="test-drawer-title">试运行</h2>
            <p className="test-drawer-sub" id="test-drawer-sub">
              {tool.name}
              {tool.codeName ? ` · ${tool.codeName}` : ''}
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="test-drawer-body" id="test-drawer-body">
          <div className="tool-panel">
            <div className="test-section">
              <div className="test-section-title">调用参数</div>
              {(tool.parameters ?? []).length ? (
                (tool.parameters ?? []).map((param) => (
                  <div className="test-field" key={param.name}>
                    <label>
                      <span>{param.name}</span>
                      <span className="type-tag">{param.type}</span>
                      {param.required ? <span className="req-mark">必填</span> : null}
                    </label>
                    {param.type === 'object' ? (
                      <textarea
                        data-field={param.name}
                        value={values[param.name] ?? ''}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [param.name]: event.target.value }))
                        }
                      />
                    ) : param.type === 'integer' ? (
                      <input
                        type="number"
                        data-field={param.name}
                        value={values[param.name] ?? ''}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [param.name]: event.target.value }))
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        data-field={param.name}
                        value={values[param.name] ?? ''}
                        onChange={(event) =>
                          setValues((prev) => ({ ...prev, [param.name]: event.target.value }))
                        }
                      />
                    )}
                    <p className="field-hint">{param.description}</p>
                  </div>
                ))
              ) : (
                <p className="test-no-params">此工具无参数，可直接试运行。</p>
              )}
            </div>

            <div className="test-actions">
              <Button
                variant="primary"
                className="test-run-btn"
                disabled={running}
                onClick={() => void runTest()}
              >
                {running ? '执行中…' : '试运行'}
              </Button>
              <Button
                variant="secondary"
                className="test-reset-btn"
                onClick={() => {
                  abortController?.abort();
                  setAbortController(null);
                  setValues(defaultFormValues(tool));
                  setRunState({ status: 'idle' });
                }}
              >
                重置
              </Button>
              {running ? (
                <Button
                  variant="secondary"
                  className="test-cancel-btn"
                  onClick={() => {
                    abortController?.abort();
                    setAbortController(null);
                    setRunState({ status: 'idle' });
                  }}
                >
                  取消
                </Button>
              ) : null}
            </div>

            {runState.status === 'running' ? (
              <div className="test-result">
                <div className="test-result-head">
                  <span>返回结果</span>
                  <span className="test-status-run">执行中</span>
                </div>
                <pre className="test-result-body">正在调用 MCP 工具…</pre>
              </div>
            ) : null}

            {runState.status === 'ok' || runState.status === 'err' ? (
              <div className="test-result">
                <div className="test-result-head">
                  <span>返回结果</span>
                  <div className="test-result-meta">
                    <span>{runState.ms} ms</span>
                    <span
                      className={runState.status === 'ok' ? 'test-status-ok' : 'test-status-err'}
                    >
                      {runState.status === 'ok' ? '成功' : '失败'}
                    </span>
                  </div>
                </div>
                <pre className={`test-result-body${runState.status === 'err' ? ' err' : ''}`}>
                  {runState.unified?.preview ?? ''}
                </pre>
                {runState.unified?.structured !== undefined ? (
                  <details className="test-structured">
                    <summary>structuredContent</summary>
                    <pre className="test-result-body">
                      {JSON.stringify(runState.unified.structured, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
