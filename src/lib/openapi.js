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
  },
  required: ['id', 'name', 'enabled', 'address', 'publicKey', 'createdAt', 'updatedAt'],
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'wg-easy API',
    version: String(release),
    description: 'Self-hosted WireGuard manager. All `/api/wireguard/**` endpoints require an authenticated session when `PASSWORD` is set on the server.',
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
  ],
};
