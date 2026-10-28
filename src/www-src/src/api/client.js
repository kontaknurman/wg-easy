let unauthorizedHandler = null;

// Called when an API request comes back 401 (the server restarted, or the
// session expired) so the app can go to the login page instead of showing
// an error toast on every poll.
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

async function call({ method, path, body, raw = false }) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  if (raw) return res;
  if (res.status === 204) return undefined;

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Request failed';
    const err = new Error(msg);
    // 401 on /session is just a wrong password, shown on the login form.
    if (res.status === 401 && path !== '/session') {
      err.unauthorized = true;
      if (unauthorizedHandler) unauthorizedHandler();
    }
    throw err;
  }
  return data;
}

function normalizeClient(c) {
  return {
    ...c,
    createdAt: c.createdAt ? new Date(c.createdAt) : null,
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : null,
    latestHandshakeAt: c.latestHandshakeAt ? new Date(c.latestHandshakeAt) : null,
  };
}

export const api = {
  getRelease: () => call({ method: 'GET', path: '/release' }),
  getOpenApi: () => call({ method: 'GET', path: '/openapi.json' }),

  getSession: () => call({ method: 'GET', path: '/session' }),
  createSession: ({ password }) => call({ method: 'POST', path: '/session', body: { password } }),
  deleteSession: () => call({ method: 'DELETE', path: '/session' }),

  getClients: async () => {
    const clients = await call({ method: 'GET', path: '/wireguard/client' });
    return clients.map(normalizeClient);
  },
  getClient: async ({ clientId }) => normalizeClient(await call({ method: 'GET', path: `/wireguard/client/${clientId}` })),
  createClient: (payload) => call({ method: 'POST', path: '/wireguard/client', body: payload || {} }),
  deleteClient: ({ clientId }) => call({ method: 'DELETE', path: `/wireguard/client/${clientId}` }),
  enableClient: ({ clientId }) => call({ method: 'POST', path: `/wireguard/client/${clientId}/enable` }),
  disableClient: ({ clientId }) => call({ method: 'POST', path: `/wireguard/client/${clientId}/disable` }),
  updateClientName: ({ clientId, name }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/name`, body: { name } }),
  updateClientAddress: ({ clientId, address }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/address`, body: { address } }),
  updateClientSchedule: ({ clientId, schedule }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/schedule`, body: { schedule } }),
  updateClientMaxDevices: ({ clientId, maxDevices }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/max-devices`, body: { maxDevices } }),
  updateClientBandwidthLimit: ({ clientId, bandwidthLimit }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/bandwidth-limit`, body: { bandwidthLimit } }),
  updateClientLogging: ({ clientId, loggingEnabled }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/logging`, body: { loggingEnabled } }),
  updateClientLogRetention: ({ clientId, logRetentionDays }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/log-retention`, body: { logRetentionDays } }),
  getClientLogHistory: ({
    clientId, from, to, limit, tz,
  } = {}) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from instanceof Date ? from.toISOString() : from);
    if (to) qs.set('to', to instanceof Date ? to.toISOString() : to);
    if (limit) qs.set('limit', String(limit));
    if (tz) qs.set('tz', tz);
    const suffix = qs.toString() ? `?${qs}` : '';
    return call({ method: 'GET', path: `/wireguard/client/${clientId}/log/history${suffix}` });
  },
  getCaptureStatus: () => call({ method: 'GET', path: '/wireguard/capture-status' }),
  updateClientAllowedSourceIps: ({ clientId, allowedSourceIps }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/allowed-source-ips`, body: { allowedSourceIps } }),
  updateClientBlockedDomains: ({ clientId, blockedDomains }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/blocked-domains`, body: { blockedDomains } }),

  getClientConnections: ({ clientId, tz } = {}) => {
    const qs = tz ? `?tz=${encodeURIComponent(tz)}` : '';
    return call({ method: 'GET', path: `/wireguard/client/${clientId}/connections${qs}` }).then(r => ({
      events: (r.events || []).map(e => ({ ...e, ts: e.ts ? new Date(e.ts) : null })),
      timezone: r.timezone || null,
    }));
  },
  logStreamUrl: ({ clientId }) => `/api/wireguard/client/${clientId}/log/stream`,

  getSettings: () => call({ method: 'GET', path: '/settings' }),
  updateSettings: (patch) => call({ method: 'PUT', path: '/settings', body: patch }),
  getMyIp: () => call({ method: 'GET', path: '/me/ip' }),
  qrCodeUrl: ({ clientId }) => `/api/wireguard/client/${clientId}/qrcode.svg`,
  configurationUrl: ({ clientId }) => `/api/wireguard/client/${clientId}/configuration`,
};
