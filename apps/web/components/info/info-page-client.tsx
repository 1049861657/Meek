'use client';

import { Suspense } from 'react';
import { InfoRouteLoading } from '@/components/info/info-route-loading';
import { InfoMainViews } from '@/components/info/info-main-views';
import { ServerSidebar } from '@/components/info/server-sidebar';
import { ToolTestDrawer } from '@/components/info/tool-test-drawer';
import { useInfoApp } from '@/hooks/use-info-app';
import { isServerConnected, MCP_STATUS } from '@/lib/info/mcp-status';

function InfoPageContent(): React.ReactElement {
  const app = useInfoApp();
  const {
    loading,
    loadError,
    shellReady,
    currentData,
    searchQuery,
    connectionPending,
    testTarget,
    setSearchQuery,
    refreshList,
    selectServer,
    connectServer,
    disconnectServer,
    authorizeServer,
    openAddForm,
    closeToolTest,
    retryLoad,
  } = app;

  if (loadError && !shellReady) {
    return (
      <div className="info-loading">
        <div className="error-panel">
          <p>获取服务信息失败: {loadError}</p>
          <button type="button" className="btn btn-primary" onClick={retryLoad}>
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!shellReady && loading) {
    return <InfoRouteLoading />;
  }

  const handleQuickConnect = (serverId: string, status: string): void => {
    if (isServerConnected(status)) {
      void disconnectServer(serverId);
    } else if (status === MCP_STATUS.NeedsAuth) {
      void authorizeServer(serverId);
    } else {
      void connectServer(serverId);
    }
  };

  return (
    <>
      <div className={`shell${shellReady ? '' : ' hidden'}`} id="app-shell">
        <ServerSidebar
          servers={currentData?.availableServers ?? []}
          currentServerId={currentData?.currentServerId}
          searchQuery={searchQuery}
          connectionPending={connectionPending}
          onSearchChange={setSearchQuery}
          onRefresh={() => void refreshList()}
          onSelectServer={(serverId) => void selectServer(serverId)}
          onQuickConnect={handleQuickConnect}
          onAddServer={openAddForm}
        />
        <div className="main">
          <InfoMainViews app={app} />
        </div>
      </div>
      {loading && shellReady ? (
        <div className="info-loading info-loading--overlay" aria-hidden="true">
          <InfoRouteLoading />
        </div>
      ) : null}
      <ToolTestDrawer target={testTarget} onClose={closeToolTest} />
    </>
  );
}

export function InfoPageClient(): React.ReactElement {
  return (
    <main className="info-page">
      <Suspense fallback={<InfoRouteLoading />}>
        <InfoPageContent />
      </Suspense>
    </main>
  );
}
