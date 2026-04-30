'use strict';

const { release } = require('../package.json');

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    stack: { type: 'string' },
  },
  required: ['error'],
};

const scheduleDaySchema = {
  type: 'object',
  properties: {
    active: { type: 'boolean', description: 'Whether the client is allowed to connect on this day.' },
    start: {
      type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '08:00', description: 'Start of active window (HH:MM, 24h).',
    },
    end: {
      type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '17:00', description: 'End of active window (HH:MM, 24h). When end < start, the window wraps past midnight.',
    },
  },
  required: ['active', 'start', 'end'],
};

const scheduleSchema = {
  type: 'object',
  description: 'Per-client connection schedule. When `enabled` is true, the peer is only present in `wg0.conf` while the current time (in `timezone`) falls within an `active` day\'s start/end window.',
  properties: {
    enabled: { type: 'boolean', description: 'Master toggle. When false, the schedule is ignored and the client follows the normal `enabled` flag.' },
    timezone: { type: 'string', example: 'Asia/Jakarta', description: 'IANA timezone identifier used to evaluate the schedule. Defaults to "UTC".' },
    days: {
      type: 'object',
      properties: {
        monday: { $ref: '#/components/schemas/ScheduleDay' },
        tuesday: { $ref: '#/components/schemas/ScheduleDay' },
        wednesday: { $ref: '#/components/schemas/ScheduleDay' },
        thursday: { $ref: '#/components/schemas/ScheduleDay' },
        friday: { $ref: '#/components/schemas/ScheduleDay' },
        saturday: { $ref: '#/components/schemas/ScheduleDay' },
        sunday: { $ref: '#/components/schemas/ScheduleDay' },
      },
      required: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
  },
  required: ['enabled', 'timezone', 'days'],
};

const clientSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    enabled: { type: 'boolean', description: 'Manual master enable flag. If false, the peer is never in `wg0.conf`.' },
    address: { type: 'string', example: '10.8.0.2', description: 'IPv4 assigned inside the WireGuard tunnel.' },
    publicKey: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    persistentKeepalive: { type: ['string', 'null'], description: 'Reported by `wg show dump`. May be null when the peer has never connected.' },
    latestHandshakeAt: { type: ['string', 'null'], format: 'date-time' },
    transferRx: { type: ['integer', 'null'], description: 'Bytes received from the peer (server upload).' },
    transferTx: { type: ['integer', 'null'], description: 'Bytes sent to the peer (server download).' },
    schedule: { $ref: '#/components/schemas/Schedule' },
    scheduleActive: { type: 'boolean', description: 'Computed: whether the schedule currently allows the peer right now. True when `schedule.enabled` is false (no schedule restriction).' },
    maxDevices: {
      type: 'integer', minimum: 0, maximum: 99, description: 'Maximum concurrent devices that may share this config. 0 disables the limit (default).',
    },
    activeDeviceCount: { type: 'integer', description: 'Distinct WireGuard endpoints with a fresh handshake (last ~3 minutes) currently using this config.' },
    deviceLimitExceededAt: { type: ['string', 'null'], format: 'date-time', description: 'Set when the peer was auto-disabled because more than `maxDevices` endpoints were detected. Null when never tripped or after manual re-enable.' },
    bandwidthLimit: {
      type: 'integer', minimum: 0, maximum: 10000, description: 'Per-peer bandwidth cap in Mbps applied symmetrically (download via egress HTB on wg0, upload via ingress police). 0 disables the cap.',
    },
    loggingEnabled: { type: 'boolean', description: 'When true, the server captures connection events (conntrack) and hostname events (DNS / TLS SNI / HTTP Host via tshark) for this peer and exposes them on the SSE stream.' },
    logBufferSize: { type: 'integer', description: 'Number of recent log events held in the in-memory ring buffer (max ~500).' },
  },
  required: ['id', 'name', 'enabled', 'address', 'publicKey', 'createdAt', 'updatedAt'],
};

function buildSpec(settings = {}) {
  const siteName = settings.siteName || 'VPN Panel';
  return {
    openapi: '3.0.3',
    info: {
      title: `${siteName} API`,
      version: String(release),
      description: `Self-hosted WireGuard administration API for ${siteName}. All \`/api/wireguard/**\` endpoints require an authenticated session when \`PASSWORD\` is set on the server.`,
    },
    servers: [
      { url: '/', description: 'Same origin' },
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Express session cookie. Obtain by `POST /api/session` with the configured password.',
        },
      },
      schemas: {
        Error: errorSchema,
        ScheduleDay: scheduleDaySchema,
        Schedule: scheduleSchema,
        Client: clientSchema,
        Session: {
          type: 'object',
          properties: {
            requiresPassword: { type: 'boolean', description: 'True when the server is started with the `PASSWORD` env set.' },
            authenticated: { type: 'boolean', description: 'True when the current session has been logged in. Always true when `requiresPassword` is false.' },
          },
          required: ['requiresPassword', 'authenticated'],
        },
        Settings: {
          type: 'object',
          description: 'Public site branding shown in the panel UI.',
          properties: {
            siteName: { type: 'string', maxLength: 60, description: 'Brand name shown in the header, login page, browser tab title, and docs.' },
            tagline: { type: 'string', maxLength: 200, description: 'Short tagline shown under the dashboard heading.' },
            loginTitle: { type: 'string', maxLength: 60, description: 'Override for the login page title. When empty, falls back to siteName.' },
            loginSubtitle: { type: 'string', maxLength: 200, description: 'Subtitle shown under the login title.' },
            showApiDocs: { type: 'boolean', description: 'When false, hides the API docs link from the header (the page itself remains reachable).' },
            footerText: { type: 'string', maxLength: 500, description: 'Optional footer text shown below the dashboard.' },
          },
        },
      },
    },
    paths: {
      '/api/release': {
        get: {
          tags: ['Meta'],
          summary: 'Get the current server release number',
          responses: {
            200: {
              description: 'Numeric release identifier (matches `release` in package.json).',
              content: { 'application/json': { schema: { type: 'integer' }, example: release } },
            },
          },
        },
      },
      '/api/openapi.json': {
        get: {
          tags: ['Meta'],
          summary: 'OpenAPI 3.0 specification for this API',
          responses: {
            200: {
              description: 'OpenAPI document.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/settings': {
        get: {
          tags: ['Settings'],
          summary: 'Get site branding/settings',
          description: 'Public — fetched by the SPA on every page load to render the brand name, login page copy, and toggle the API docs link.',
          security: [],
          responses: {
            200: {
              description: 'Current site settings.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Settings' } } },
            },
          },
        },
        put: {
          tags: ['Settings'],
          summary: 'Update site branding/settings',
          description: 'Partial update: any fields you omit keep their current value. All fields are sanitized server-side (control characters stripped, max-length clamped).',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Settings' } } },
          },
          responses: {
            200: { description: 'Updated settings.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Settings' } } } },
            401: { description: 'Not logged in.' },
          },
        },
      },
      '/api/session': {
        get: {
          tags: ['Session'],
          summary: 'Get current session state',
          security: [],
          responses: {
            200: {
              description: 'Session state',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Session' } } },
            },
          },
        },
        post: {
          tags: ['Session'],
          summary: 'Login with password',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { password: { type: 'string' } },
                  required: ['password'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Login successful. A `connect.sid` cookie is set on the response.' },
            401: { description: 'Missing or incorrect password.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          tags: ['Session'],
          summary: 'Logout (destroy session)',
          responses: {
            204: { description: 'Session destroyed.' },
            401: { description: 'Not logged in.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/wireguard/client': {
        get: {
          tags: ['Client'],
          summary: 'List all clients with live transfer stats',
          responses: {
            200: {
              description: 'Array of clients.',
              content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Client' } } } },
            },
            401: { description: 'Not logged in.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        post: {
          tags: ['Client'],
          summary: 'Create a new client',
          description: 'Generates a new WireGuard keypair and PSK, allocates the next free IPv4 in the tunnel subnet, defaults `enabled=true`, and creates an empty disabled schedule.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                  required: ['name'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Client created. The full server-side client record (including `privateKey` and `preSharedKey`) is returned.',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            400: { description: 'Invalid input.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            401: { description: 'Not logged in.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        delete: {
          tags: ['Client'],
          summary: 'Delete a client',
          responses: {
            204: { description: 'Client removed (or did not exist).' },
            401: { description: 'Not logged in.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/enable': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        post: {
          tags: ['Client'],
          summary: 'Enable a client (sets `enabled=true`)',
          description: 'The peer will only actually be added to `wg0.conf` if the schedule (when enabled) allows the current time.',
          responses: {
            204: { description: 'Client enabled.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/disable': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        post: {
          tags: ['Client'],
          summary: 'Disable a client (sets `enabled=false`)',
          responses: {
            204: { description: 'Client disabled. Peer removed from `wg0.conf`.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/name': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        put: {
          tags: ['Client'],
          summary: 'Rename a client',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                  required: ['name'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Client renamed.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/address': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        put: {
          tags: ['Client'],
          summary: 'Change a client IPv4 address inside the tunnel',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { address: { type: 'string', example: '10.8.0.2' } },
                  required: ['address'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Address updated.' },
            400: { description: 'Address is not a valid IPv4.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/schedule': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        put: {
          tags: ['Schedule'],
          summary: 'Set the per-day connection schedule',
          description: 'Replaces the entire schedule. Missing days are filled with `{ active: false, start: "00:00", end: "23:59" }`. The server normalizes time strings to `HH:MM` and rejects unknown timezones (falls back to "UTC"). A 60-second background ticker rebuilds `wg0.conf` so peers are removed/restored as schedule boundaries pass.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { schedule: { $ref: '#/components/schemas/Schedule' } },
                  required: ['schedule'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Schedule saved.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/max-devices': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        put: {
          tags: ['Limits'],
          summary: 'Set the maximum concurrent devices allowed for this config',
          description: 'WireGuard cannot natively reject a second device using the same key. The server detects concurrent use by polling `wg show wg0 dump` every 10 seconds and tracking distinct peer endpoints with a fresh handshake (within the last ~3 minutes). If the count exceeds `maxDevices`, the peer is auto-disabled and `deviceLimitExceededAt` is set. Setting `maxDevices = 0` disables the limit. Re-enabling the client manually clears the tracking.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { maxDevices: { type: 'integer', minimum: 0, maximum: 99 } },
                  required: ['maxDevices'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Limit saved.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/bandwidth-limit': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        put: {
          tags: ['Limits'],
          summary: 'Set the bandwidth cap (Mbps) for this peer',
          description: 'Applies a symmetric bandwidth cap using Linux Traffic Control on the `wg0` interface. Download (server → client) is shaped via HTB classes on egress; upload (client → server) is enforced via an ingress `police` filter that drops excess. Setting `bandwidthLimit = 0` removes the cap. Rules are rebuilt every save and on the schedule ticker so they follow enable/schedule changes. Requires `tc` (`iproute2-tc`) on the host.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    bandwidthLimit: {
                      type: 'integer', minimum: 0, maximum: 10000, description: 'Mbps',
                    },
                  },
                  required: ['bandwidthLimit'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Bandwidth limit saved.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/logging': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        put: {
          tags: ['Logging'],
          summary: 'Enable or disable per-peer connection logging',
          description: 'Captures **connection metadata only** — destination IP, port, and (when available) hostname extracted from DNS queries, TLS SNI, and HTTP Host headers. Backed by `conntrack -E` (every new TCP/UDP connection) and `tshark` (hostname events) running globally; events are filtered to enabled peers and held in an in-memory ring buffer (~500 per peer). **No payload, no URLs paths, no HTTPS bodies are captured.** Reading other peoples traffic metadata is sensitive — use only on systems you own.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { loggingEnabled: { type: 'boolean' } },
                  required: ['loggingEnabled'],
                },
              },
            },
          },
          responses: {
            204: { description: 'Setting saved.' },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/log/stream': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        get: {
          tags: ['Logging'],
          summary: 'Server-Sent Events stream of connection log events',
          description: 'Returns `text/event-stream`. The current ring buffer is replayed first, then new events are streamed as they happen. Each `data:` frame is a JSON object with `ts`, `type` (`connection` | `dns` | `tls` | `http`), `srcIp`, `dstIp`, `dstPort`, `protocol`, and an optional `hostname`. A keep-alive comment line is sent every 20s.',
          responses: {
            200: {
              description: 'Event stream.',
              content: { 'text/event-stream': { schema: { type: 'string' } } },
            },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/qrcode.svg': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        get: {
          tags: ['Client'],
          summary: 'Render the client configuration as a QR code SVG',
          responses: {
            200: {
              description: 'SVG image (512×512).',
              content: { 'image/svg+xml': { schema: { type: 'string' } } },
            },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
      '/api/wireguard/client/{clientId}/configuration': {
        parameters: [
          {
            name: 'clientId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' },
          },
        ],
        get: {
          tags: ['Client'],
          summary: 'Download the WireGuard client `.conf` file',
          responses: {
            200: {
              description: 'Plain text WireGuard config. Includes `Content-Disposition: attachment` so browsers download it.',
              content: { 'text/plain': { schema: { type: 'string' } } },
            },
            401: { description: 'Not logged in.' },
            404: { description: 'Client not found.' },
          },
        },
      },
    },
    security: [{ sessionCookie: [] }],
    tags: [
      { name: 'Meta', description: 'Server metadata and discovery.' },
      { name: 'Session', description: 'Authentication.' },
      { name: 'Client', description: 'WireGuard peer management.' },
      { name: 'Schedule', description: 'Per-day active hours per client.' },
      { name: 'Limits', description: 'Per-config limits such as max concurrent devices.' },
      { name: 'Logging', description: 'Per-peer connection metadata logging (DNS / TLS SNI / HTTP Host).' },
      { name: 'Settings', description: 'Site branding and panel-wide settings.' },
    ],
  };
}

module.exports = buildSpec;
