'use client';

import { Button } from '@/components/ui/button';
import type { UseInfoAppResult } from '@/hooks/use-info-app';

export interface ServerFormViewProps {
  app: UseInfoAppResult;
}

export function ServerFormView({ app }: ServerFormViewProps): React.ReactElement {
  const {
    formState,
    closeForm,
    updateForm,
    addHeaderRow,
    updateHeaderRow,
    removeHeaderRow,
    submitForm,
  } = app;

  const isStdio = formState.connectionType === 'STDIO';

  return (
    <div className="content">
      <div className="form-view">
        <button type="button" className="form-back" onClick={closeForm}>
          ← 返回
        </button>
        <h1 id="form-h">
          {formState.mode === 'add' ? '新增服务器' : `编辑 · ${formState.name}`}
        </h1>
        <form
          className="form-card"
          data-requires-auth
          onSubmit={(event) => {
            event.preventDefault();
            void submitForm();
          }}
        >
          <div className="field">
            <label htmlFor="f-name">显示名称</label>
            <input
              type="text"
              id="f-name"
              required
              placeholder="例如：大文件"
              value={formState.name}
              onChange={(event) => updateForm({ name: event.target.value })}
            />
          </div>

          <div className="field">
            <span className="label">连接类型</span>
            <div className="type-pick">
              <label>
                <input
                  type="radio"
                  name="connection-type"
                  value="STDIO"
                  checked={isStdio}
                  onChange={() => updateForm({ connectionType: 'STDIO' })}
                />{' '}
                <strong>Stdio</strong>
                <span> 本地进程</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="connection-type"
                  value="HTTP"
                  checked={!isStdio}
                  onChange={() => updateForm({ connectionType: 'HTTP' })}
                />{' '}
                <strong>HTTP</strong>
                <span> 远程端点</span>
              </label>
            </div>
          </div>

          <div className={`block${isStdio ? ' on' : ''}`} id="b-stdio">
            <div className="field">
              <label htmlFor="f-cmd">命令</label>
              <input
                type="text"
                id="f-cmd"
                placeholder="node"
                value={formState.command}
                onChange={(event) => updateForm({ command: event.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="f-args">参数</label>
              <input
                type="text"
                id="f-args"
                placeholder="dist/mcp-servers/large-json-mcp.js"
                value={formState.args}
                onChange={(event) => updateForm({ args: event.target.value })}
              />
              <p className="hint">多个参数用英文逗号分隔</p>
            </div>
          </div>

          <div className={`block${!isStdio ? ' on' : ''}`} id="b-http">
            <div className="field">
              <label htmlFor="f-url">MCP 端点 URL</label>
              <input
                type="text"
                id="f-url"
                placeholder="https://example.com/mcp"
                value={formState.mcpUrl}
                onChange={(event) => updateForm({ mcpUrl: event.target.value })}
              />
            </div>
            <div className="field">
              <span className="label">请求头（可选）</span>
              <div id="headers-rows">
                {formState.headers.map((row, index) => (
                  <div className="hdr-row" key={`hdr-${index}`}>
                    <input
                      type="text"
                      className="header-row-key"
                      placeholder="名称"
                      value={row.key}
                      onChange={(event) =>
                        updateHeaderRow(index, { key: event.target.value })
                      }
                    />
                    <input
                      type="text"
                      className="header-row-value"
                      placeholder="值"
                      value={row.value}
                      onChange={(event) =>
                        updateHeaderRow(index, { value: event.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="icon-btn hdr-remove"
                      title="删除"
                      onClick={() => removeHeaderRow(index)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="link-btn" onClick={addHeaderRow}>
                + 添加请求头
              </button>
            </div>
          </div>

          <div className="form-footer">
            <Button type="button" variant="secondary" onClick={closeForm}>
              取消
            </Button>
            <Button type="submit" variant="primary">
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
