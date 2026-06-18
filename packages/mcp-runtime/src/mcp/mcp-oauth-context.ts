/** 单次 OAuth authorize 流程内由 Web 注入的 redirect origin */
let pendingRedirectOrigin: string | undefined;

export function setMcpOAuthRedirectOrigin(origin: string): void {
  pendingRedirectOrigin = origin.replace(/\/$/, '');
}

export function getMcpOAuthRedirectOrigin(): string | undefined {
  return pendingRedirectOrigin;
}

export function clearMcpOAuthRedirectOrigin(): void {
  pendingRedirectOrigin = undefined;
}
