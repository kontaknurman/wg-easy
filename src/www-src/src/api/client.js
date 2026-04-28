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
    throw new Error(msg);
  }
  return data;
}

export const api = {
  getRelease: () => call({ method: 'GET', path: '/release' }),
  getOpenApi: () => call({ method: 'GET', path: '/openapi.json' }),

  getSession: () => call({ method: 'GET', path: '/session' }),
  createSession: ({ password }) => call({ method: 'POST', path: '/session', body: { password } }),
  deleteSession: () => call({ method: 'DELETE', path: '/session' }),

  getClients: async () => {
    const clients = await call({ method: 'GET', path: '/wireguard/client' });
    return clients.map(c => ({
      ...c,
      createdAt: c.createdAt ? new Date(c.createdAt) : null,
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : null,
      latestHandshakeAt: c.latestHandshakeAt ? new Date(c.latestHandshakeAt) : null,
    }));
  },
  createClient: ({ name }) => call({ method: 'POST', path: '/wireguard/client', body: { name } }),
  deleteClient: ({ clientId }) => call({ method: 'DELETE', path: `/wireguard/client/${clientId}` }),
  enableClient: ({ clientId }) => call({ method: 'POST', path: `/wireguard/client/${clientId}/enable` }),
  disableClient: ({ clientId }) => call({ method: 'POST', path: `/wireguard/client/${clientId}/disable` }),
  updateClientName: ({ clientId, name }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/name`, body: { name } }),
  updateClientAddress: ({ clientId, address }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/address`, body: { address } }),
  updateClientSchedule: ({ clientId, schedule }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/schedule`, body: { schedule } }),
  updateClientMaxDevices: ({ clientId, maxDevices }) => call({ method: 'PUT', path: `/wireguard/client/${clientId}/max-devices`, body: { maxDevices } }),
  qrCodeUrl: ({ clientId }) => `/api/wireguard/client/${clientId}/qrcode.svg`,
  configurationUrl: ({ clientId }) => `/api/wireguard/client/${clientId}/configuration`,
};
