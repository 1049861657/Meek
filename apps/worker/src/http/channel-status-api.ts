import type { ServerResponse } from 'node:http';

import { getImChannelLinkStatusMap } from '../channels/bootstrap.js';

export function handleChannelStatusGet(res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getImChannelLinkStatusMap()));
}
