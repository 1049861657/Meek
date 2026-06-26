'use client';

import { IconChevron, IconPlay } from '@/components/info/info-icons';
import { isToolEnabled } from '@/lib/info/tool-preferences';
import type { ToolInfo } from '@/lib/info/types';

export interface InfoToolsPanelProps {
  serverId: string;
  tools: ToolInfo[];
  preferences: Record<string, boolean>;
  expandedTools: Set<number>;
  onToggleExpanded: (index: number) => void;
  onPreferenceChange: (toolName: string, enabled: boolean) => void;
  onTestTool: (tool: ToolInfo) => void;
}

function ParamsBlock({ tool }: { tool: ToolInfo }): React.ReactElement {
  if (!tool.parameters?.length) {
    return <div className="param-empty">无参数</div>;
  }

  return (
    <table className="param-table">
      <thead>
        <tr>
          <th>参数</th>
          <th>类型</th>
          <th>说明</th>
          <th>必填</th>
        </tr>
      </thead>
      <tbody>
        {tool.parameters.map((param) => (
          <tr key={param.name}>
            <td>{param.name}</td>
            <td>
              <span className="type-tag">{param.type}</span>
            </td>
            <td>{param.description}</td>
            <td className={param.required ? 'param-required' : 'param-optional'}>
              {param.required ? '是' : '否'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InfoToolsPanel({
  tools,
  preferences,
  expandedTools,
  onToggleExpanded,
  onPreferenceChange,
  onTestTool,
}: InfoToolsPanelProps): React.ReactElement {
  if (!tools.length) {
    return <div className="void-box">该服务器未提供工具</div>;
  }

  return (
    <div className="tool-list" id="tools-body">
      {tools.map((tool, index) => {
        const enabled = isToolEnabled(preferences, tool.name);
        const isOpen = expandedTools.has(index);

        return (
          <article
            key={tool.name}
            className={`tool-card${enabled ? '' : ' off'}${isOpen ? ' expanded' : ''}`}
          >
            <div className="tool-card-head">
              <div className="tool-card-toggle">
                <label
                  className="sw"
                  data-requires-auth
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) =>
                      onPreferenceChange(tool.name, event.target.checked)
                    }
                  />
                  <span className="track" />
                </label>
              </div>
              <div
                className="tool-card-main"
                role="button"
                tabIndex={0}
                onClick={() => onToggleExpanded(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleExpanded(index);
                  }
                }}
              >
                <div className="tool-card-title">
                  <span className="tool-card-name">{tool.name}</span>
                  {tool.codeName ? <span className="tool-card-fn">{tool.codeName}</span> : null}
                </div>
                <p className="tool-card-desc">{tool.description}</p>
              </div>
              <div className="tool-card-actions">
                <button
                  type="button"
                  className="tool-action-btn test"
                  title="试运行"
                  aria-label="试运行"
                  data-requires-auth
                  onClick={(event) => {
                    event.stopPropagation();
                    onTestTool(tool);
                  }}
                >
                  <IconPlay />
                </button>
                <button
                  type="button"
                  className="tool-action-btn expand tool-expand-icon"
                  title="查看参数"
                  aria-label="查看参数"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpanded(index);
                  }}
                >
                  <IconChevron />
                </button>
              </div>
            </div>
            {isOpen ? (
              <div className="tool-card-body">
                <ParamsBlock tool={tool} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
