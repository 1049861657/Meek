'use client';

import { useState } from 'react';
import { enqueueInputDialog } from '@/components/ui/confirm-dialog';
import { showToast } from '@/components/ui/toast';
import { IconCopy } from '@/components/info/info-icons';
import { requestInfoJson } from '@/lib/info/info-api';
import { showApiError } from '@/lib/api/fetch-json';
import type { McpPromptInfo, McpResourceInfo } from '@/lib/info/types';

type RpKind = 'prompts' | 'resources';

export interface InfoResourcesPanelProps {
  kind: RpKind;
  items: McpPromptInfo[] | McpResourceInfo[];
  serverId: string;
}

interface PreviewState {
  title: string;
  output: string;
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  showToast('已复制', 'success');
}

async function previewResource(serverId: string, uri: string): Promise<string> {
  const url = `/api/server/${encodeURIComponent(serverId)}/mcp-resources/preview?uri=${encodeURIComponent(uri)}`;
  const body = (await requestInfoJson(url)) as { output?: string };
  return body.output ?? '';
}

async function previewPrompt(
  serverId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const body = (await requestInfoJson(
    `/api/server/${encodeURIComponent(serverId)}/mcp-prompts/preview`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args }),
    },
  )) as { output?: string };
  return body.output ?? '';
}

async function collectPromptArguments(
  argDefs: NonNullable<McpPromptInfo['arguments']>,
): Promise<Record<string, unknown> | null> {
  const args: Record<string, unknown> = {};
  for (const def of argDefs) {
    const label = def.description ? `${def.name}（${def.description}）` : def.name;
    const raw = await enqueueInputDialog({
      title: 'Prompt 参数',
      label,
      placeholder: def.name,
    });
    if (raw === null) {
      return null;
    }
    if (def.required && raw.trim() === '') {
      showToast(`${def.name} 为必填`, 'error');
      return null;
    }
    if (raw.trim() !== '') {
      args[def.name] = raw;
    }
  }
  return args;
}

function PreviewModal({
  preview,
  onClose,
}: {
  preview: PreviewState;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      className="rp-preview-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="rp-preview-dialog" role="dialog" aria-modal="true">
        <div className="rp-preview-head">
          <h3>{preview.title}</h3>
          <button type="button" className="icon-btn rp-preview-close" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <pre className="rp-preview-body">{preview.output}</pre>
      </div>
    </div>
  );
}

export function InfoResourcesPanel({
  kind,
  items,
  serverId,
}: InfoResourcesPanelProps): React.ReactElement {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  if (!items.length) {
    return (
      <div className="rp-list">
        <div className="void-box">
          {kind === 'resources'
            ? '该服务器未暴露 MCP 资源，或尚未声明 resources 能力'
            : '该服务器未暴露 MCP Prompt，或尚未声明 prompts 能力'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rp-list" id={kind === 'prompts' ? 'prompts-body' : 'resources-body'}>
        {kind === 'resources'
          ? (items as McpResourceInfo[]).map((resource) => {
              const title = resource.name || resource.uri;
              const desc = resource.description || resource.mimeType || '';
              const itemKey = resource.uri;

              return (
                <article className="rp-item" key={itemKey}>
                  <div className="rp-item-head">
                    <div className="rp-item-title">{title}</div>
                    <div className="rp-item-actions">
                      <button
                        type="button"
                        className="bulk-btn rp-copy-uri"
                        title="复制 URI"
                        onClick={() => {
                          void copyText(resource.uri).catch(() => showToast('复制失败', 'error'));
                        }}
                      >
                        <IconCopy />
                      </button>
                      <button
                        type="button"
                        className="bulk-btn rp-preview-btn"
                        disabled={loadingKey === itemKey}
                        onClick={() => {
                          setLoadingKey(itemKey);
                          void previewResource(serverId, resource.uri)
                            .then((output) => {
                              setPreview({ title: `Resource: ${title}`, output });
                            })
                            .catch((error) => showApiError(error, '预览失败'))
                            .finally(() => setLoadingKey(null));
                        }}
                      >
                        {loadingKey === itemKey ? '加载中…' : '预览'}
                      </button>
                    </div>
                  </div>
                  <div className="rp-item-uri mono">{resource.uri}</div>
                  {desc ? <p className="rp-item-desc">{desc}</p> : null}
                </article>
              );
            })
          : (items as McpPromptInfo[]).map((prompt) => {
              const desc = prompt.description || '';
              const itemKey = prompt.name;

              return (
                <article className="rp-item" key={itemKey}>
                  <div className="rp-item-head">
                    <div className="rp-item-title mono">{prompt.name}</div>
                    <div className="rp-item-actions">
                      <button
                        type="button"
                        className="bulk-btn rp-copy-name"
                        title="复制名称"
                        onClick={() => {
                          void copyText(prompt.name).catch(() => showToast('复制失败', 'error'));
                        }}
                      >
                        <IconCopy />
                      </button>
                      <button
                        type="button"
                        className="bulk-btn rp-preview-btn"
                        disabled={loadingKey === itemKey}
                        onClick={() => {
                          void (async () => {
                            const argDefs = prompt.arguments ?? [];
                            const args =
                              argDefs.length > 0 ? await collectPromptArguments(argDefs) : {};
                            if (argDefs.length > 0 && (args === null || Object.keys(args).length === 0)) {
                              return;
                            }

                            setLoadingKey(itemKey);
                            try {
                              const output = await previewPrompt(
                                serverId,
                                prompt.name,
                                args ?? {},
                              );
                              setPreview({ title: `Prompt: ${prompt.name}`, output });
                            } catch (error) {
                              showApiError(error, '预览失败');
                            } finally {
                              setLoadingKey(null);
                            }
                          })();
                        }}
                      >
                        {loadingKey === itemKey ? '加载中…' : '预览'}
                      </button>
                    </div>
                  </div>
                  {desc ? <p className="rp-item-desc">{desc}</p> : null}
                </article>
              );
            })}
      </div>
      {preview ? <PreviewModal preview={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}
