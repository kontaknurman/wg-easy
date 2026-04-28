'use strict';

const fs = require('fs').promises;
const path = require('path');

const debug = require('debug')('WireGuard');
const uuid = require('uuid');
const QRCode = require('qrcode');

const Util = require('./Util');
const ServerError = require('./ServerError');

const {
  WG_PATH,
  WG_HOST,
  WG_PORT,
  WG_MTU,
  WG_DEFAULT_DNS,
  WG_DEFAULT_ADDRESS,
  WG_PERSISTENT_KEEPALIVE,
  WG_ALLOWED_IPS,
  WG_PRE_UP,
  WG_POST_UP,
  WG_PRE_DOWN,
  WG_POST_DOWN,
} = require('../config');

const SCHEDULE_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function defaultSchedule() {
  const days = {};
  for (const k of SCHEDULE_DAYS) {
    days[k] = { active: false, start: '00:00', end: '23:59' };
  }
  return { enabled: false, timezone: 'UTC', days };
}

function validateTime(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return fallback;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function validateTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch (err) {
    return 'UTC';
  }
}

function normalizeSchedule(input) {
  const result = defaultSchedule();
  if (!input || typeof input !== 'object') return result;
  result.enabled = !!input.enabled;
  result.timezone = validateTimezone(input.timezone);
  if (input.days && typeof input.days === 'object') {
    for (const k of SCHEDULE_DAYS) {
      const d = input.days[k];
      if (!d) continue;
      result.days[k] = {
        active: !!d.active,
        start: validateTime(d.start, '00:00'),
        end: validateTime(d.end, '23:59'),
      };
    }
  }
  return result;
}

function timeToMinutes(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return fallback;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function isClientActiveBySchedule(client, now = new Date()) {
  const sched = client && client.schedule;
  if (!sched || !sched.enabled) return true;

  const tz = sched.timezone || 'UTC';
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch (err) {
    return true;
  }

  let weekday = '';
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value.toLowerCase();
    else if (p.type === 'hour') hour = parseInt(p.value, 10) || 0;
    else if (p.type === 'minute') minute = parseInt(p.value, 10) || 0;
  }
  if (hour === 24) hour = 0;

  const day = sched.days && sched.days[weekday];
  if (!day || !day.active) return false;

  const cur = hour * 60 + minute;
  const startMin = timeToMinutes(day.start, 0);
  const endMin = timeToMinutes(day.end, 24 * 60 - 1);

  if (startMin <= endMin) {
    return cur >= startMin && cur <= endMin;
  }
  return cur >= startMin || cur <= endMin;
}

const MAX_DEVICES_CAP = 99;
const DEVICE_HANDSHAKE_FRESH_MS = 3 * 60 * 1000;
const DEVICE_ENDPOINT_TTL_MS = 3 * 60 * 1000;

function normalizeMaxDevices(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, MAX_DEVICES_CAP);
}

module.exports = class WireGuard {

  async getConfig() {
    if (!this.__configPromise) {
      this.__configPromise = Promise.resolve().then(async () => {
        if (!WG_HOST) {
          throw new Error('WG_HOST Environment Variable Not Set!');
        }

        debug('Loading configuration...');
        let config;
        try {
          config = await fs.readFile(path.join(WG_PATH, 'wg0.json'), 'utf8');
          config = JSON.parse(config);
          debug('Configuration loaded.');
        } catch (err) {
          const privateKey = await Util.exec('wg genkey');
          const publicKey = await Util.exec(`echo ${privateKey} | wg pubkey`, {
            log: 'echo ***hidden*** | wg pubkey',
          });
          const address = WG_DEFAULT_ADDRESS.replace('x', '1');

          config = {
            server: {
              privateKey,
              publicKey,
              address,
            },
            clients: {},
          };
          debug('Configuration generated.');
        }

        let migrated = false;
        if (config.clients) {
          for (const client of Object.values(config.clients)) {
            if (!client.schedule) {
              client.schedule = defaultSchedule();
              migrated = true;
            } else {
              const normalized = normalizeSchedule(client.schedule);
              if (JSON.stringify(normalized) !== JSON.stringify(client.schedule)) {
                client.schedule = normalized;
                migrated = true;
              }
            }
            if (client.maxDevices === undefined) {
              client.maxDevices = 0;
              migrated = true;
            } else {
              const m = normalizeMaxDevices(client.maxDevices);
              if (m !== client.maxDevices) {
                client.maxDevices = m;
                migrated = true;
              }
            }
          }
        }
        if (migrated) debug('Migrated existing clients to include schedule + maxDevices.');

        await this.__saveConfig(config);
        await Util.exec('wg-quick down wg0').catch(() => { });
        await Util.exec('wg-quick up wg0').catch(err => {
          if (err && err.message && err.message.includes('Cannot find device "wg0"')) {
            throw new Error('WireGuard exited with the error: Cannot find device "wg0"\nThis usually means that your host\'s kernel does not support WireGuard!');
          }

          throw err;
        });
        // await Util.exec(`iptables -t nat -A POSTROUTING -s ${WG_DEFAULT_ADDRESS.replace('x', '0')}/24 -o eth0 -j MASQUERADE`);
        // await Util.exec('iptables -A INPUT -p udp -m udp --dport 51820 -j ACCEPT');
        // await Util.exec('iptables -A FORWARD -i wg0 -j ACCEPT');
        // await Util.exec('iptables -A FORWARD -o wg0 -j ACCEPT');
        await this.__syncConfig();

        return config;
      });
    }

    return this.__configPromise;
  }

  async saveConfig() {
    const config = await this.getConfig();
    await this.__saveConfig(config);
    await this.__syncConfig();
  }

  __buildWgConfText(config) {
    let result = `
# Note: Do not edit this file directly.
# Your changes will be overwritten!

# Server
[Interface]
PrivateKey = ${config.server.privateKey}
Address = ${config.server.address}/24
ListenPort = 51820
PreUp = ${WG_PRE_UP}
PostUp = ${WG_POST_UP}
PreDown = ${WG_PRE_DOWN}
PostDown = ${WG_POST_DOWN}
`;

    for (const [clientId, client] of Object.entries(config.clients)) {
      if (!client.enabled) continue;
      if (!isClientActiveBySchedule(client)) continue;

      result += `

# Client: ${client.name} (${clientId})
[Peer]
PublicKey = ${client.publicKey}
PresharedKey = ${client.preSharedKey}
AllowedIPs = ${client.address}/32`;
    }

    return result;
  }

  async __saveConfig(config) {
    const result = this.__buildWgConfText(config);

    debug('Config saving...');
    await fs.writeFile(path.join(WG_PATH, 'wg0.json'), JSON.stringify(config, false, 2), {
      mode: 0o660,
    });
    await fs.writeFile(path.join(WG_PATH, 'wg0.conf'), result, {
      mode: 0o600,
    });
    debug('Config saved.');
  }

  async __syncConfig() {
    debug('Config syncing...');
    await Util.exec('wg syncconf wg0 <(wg-quick strip wg0)');
    debug('Config synced.');
  }

  async refreshScheduledPeers() {
    const config = await this.getConfig();
    const result = this.__buildWgConfText(config);
    await fs.writeFile(path.join(WG_PATH, 'wg0.conf'), result, {
      mode: 0o600,
    });
    await this.__syncConfig();
  }

  startScheduler() {
    if (this.__schedulerStarted) return;
    this.__schedulerStarted = true;
    setInterval(() => {
      this.refreshScheduledPeers().catch(err => {
        debug(`Schedule tick error: ${err && err.message ? err.message : err}`);
      });
    }, 60 * 1000);
    setInterval(() => {
      this.monitorDeviceConnections().catch(err => {
        debug(`Device monitor tick error: ${err && err.message ? err.message : err}`);
      });
    }, 10 * 1000);
    debug('Schedule (60s) and device monitor (10s) tickers started.');
  }

  async getClients() {
    const config = await this.getConfig();
    const clients = Object.entries(config.clients).map(([clientId, client]) => {
      const tracking = this.__deviceTracking && this.__deviceTracking[clientId];
      const activeDeviceCount = tracking ? Object.keys(tracking.endpoints).length : 0;
      return {
        id: clientId,
        name: client.name,
        enabled: client.enabled,
        address: client.address,
        publicKey: client.publicKey,
        createdAt: new Date(client.createdAt),
        updatedAt: new Date(client.updatedAt),
        allowedIPs: client.allowedIPs,
        schedule: client.schedule || defaultSchedule(),
        scheduleActive: isClientActiveBySchedule(client),
        maxDevices: client.maxDevices || 0,
        activeDeviceCount,
        deviceLimitExceededAt: client.deviceLimitExceededAt ? new Date(client.deviceLimitExceededAt) : null,

        persistentKeepalive: null,
        latestHandshakeAt: null,
        transferRx: null,
        transferTx: null,
      };
    });

    // Loop WireGuard status
    const dump = await Util.exec('wg show wg0 dump', {
      log: false,
    });
    dump
      .trim()
      .split('\n')
      .slice(1)
      .forEach(line => {
        const [
          publicKey,
          preSharedKey, // eslint-disable-line no-unused-vars
          endpoint, // eslint-disable-line no-unused-vars
          allowedIps, // eslint-disable-line no-unused-vars
          latestHandshakeAt,
          transferRx,
          transferTx,
          persistentKeepalive,
        ] = line.split('\t');

        const client = clients.find(client => client.publicKey === publicKey);
        if (!client) return;

        client.latestHandshakeAt = latestHandshakeAt === '0'
          ? null
          : new Date(Number(`${latestHandshakeAt}000`));
        client.transferRx = Number(transferRx);
        client.transferTx = Number(transferTx);
        client.persistentKeepalive = persistentKeepalive;
      });

    return clients;
  }

  async getClient({ clientId }) {
    const config = await this.getConfig();
    const client = config.clients[clientId];
    if (!client) {
      throw new ServerError(`Client Not Found: ${clientId}`, 404);
    }

    return client;
  }

  async getClientConfiguration({ clientId }) {
    const config = await this.getConfig();
    const client = await this.getClient({ clientId });

    return `
[Interface]
PrivateKey = ${client.privateKey}
Address = ${client.address}/24
${WG_DEFAULT_DNS ? `DNS = ${WG_DEFAULT_DNS}` : ''}
${WG_MTU ? `MTU = ${WG_MTU}` : ''}

[Peer]
PublicKey = ${config.server.publicKey}
PresharedKey = ${client.preSharedKey}
AllowedIPs = ${WG_ALLOWED_IPS}
PersistentKeepalive = ${WG_PERSISTENT_KEEPALIVE}
Endpoint = ${WG_HOST}:${WG_PORT}`;
  }

  async getClientQRCodeSVG({ clientId }) {
    const config = await this.getClientConfiguration({ clientId });
    return QRCode.toString(config, {
      type: 'svg',
      width: 512,
    });
  }

  async createClient({ name }) {
    if (!name) {
      throw new Error('Missing: Name');
    }

    const config = await this.getConfig();

    const privateKey = await Util.exec('wg genkey');
    const publicKey = await Util.exec(`echo ${privateKey} | wg pubkey`);
    const preSharedKey = await Util.exec('wg genpsk');

    // Calculate next IP
    let address;
    for (let i = 2; i < 255; i++) {
      const client = Object.values(config.clients).find(client => {
        return client.address === WG_DEFAULT_ADDRESS.replace('x', i);
      });

      if (!client) {
        address = WG_DEFAULT_ADDRESS.replace('x', i);
        break;
      }
    }

    if (!address) {
      throw new Error('Maximum number of clients reached.');
    }

    // Create Client
    const clientId = uuid.v4();
    const client = {
      name,
      address,
      privateKey,
      publicKey,
      preSharedKey,

      createdAt: new Date(),
      updatedAt: new Date(),

      enabled: true,
      schedule: defaultSchedule(),
      maxDevices: 0,
      deviceLimitExceededAt: null,
    };

    config.clients[clientId] = client;

    await this.saveConfig();

    return client;
  }

  async deleteClient({ clientId }) {
    const config = await this.getConfig();

    if (config.clients[clientId]) {
      delete config.clients[clientId];
      if (this.__deviceTracking) delete this.__deviceTracking[clientId];
      await this.saveConfig();
    }
  }

  async enableClient({ clientId }) {
    const client = await this.getClient({ clientId });

    client.enabled = true;
    client.updatedAt = new Date();
    client.deviceLimitExceededAt = null;
    if (this.__deviceTracking) delete this.__deviceTracking[clientId];

    await this.saveConfig();
  }

  async disableClient({ clientId }) {
    const client = await this.getClient({ clientId });

    client.enabled = false;
    client.updatedAt = new Date();

    await this.saveConfig();
  }

  async updateClientName({ clientId, name }) {
    const client = await this.getClient({ clientId });

    client.name = name;
    client.updatedAt = new Date();

    await this.saveConfig();
  }

  async updateClientAddress({ clientId, address }) {
    const client = await this.getClient({ clientId });

    if (!Util.isValidIPv4(address)) {
      throw new ServerError(`Invalid Address: ${address}`, 400);
    }

    client.address = address;
    client.updatedAt = new Date();

    await this.saveConfig();
  }

  async updateClientSchedule({ clientId, schedule }) {
    const client = await this.getClient({ clientId });

    client.schedule = normalizeSchedule(schedule);
    client.updatedAt = new Date();

    await this.saveConfig();
  }

  async updateClientMaxDevices({ clientId, maxDevices }) {
    const client = await this.getClient({ clientId });

    client.maxDevices = normalizeMaxDevices(maxDevices);
    client.updatedAt = new Date();
    client.deviceLimitExceededAt = null;
    if (this.__deviceTracking) delete this.__deviceTracking[clientId];

    await this.saveConfig();
  }

  async monitorDeviceConnections() {
    const config = await this.getConfig();

    let dump;
    try {
      dump = await Util.exec('wg show wg0 dump', { log: false });
    } catch (err) {
      debug(`Device monitor: failed to read wg dump: ${err && err.message}`);
      return;
    }

    if (!this.__deviceTracking) this.__deviceTracking = {};
    const now = Date.now();
    let changed = false;

    const clientByPublicKey = {};
    for (const [clientId, client] of Object.entries(config.clients)) {
      clientByPublicKey[client.publicKey] = { clientId, client };
    }

    const lines = String(dump).trim().split('\n').slice(1);
    for (const line of lines) {
      const cols = line.split('\t');
      const publicKey = cols[0];
      const endpoint = cols[2];
      const latestHandshakeAt = cols[4];
      if (!publicKey || !endpoint || endpoint === '(none)') continue;

      const handshakeMs = parseInt(latestHandshakeAt, 10) * 1000;
      if (!handshakeMs || (now - handshakeMs) > DEVICE_HANDSHAKE_FRESH_MS) continue;

      const entry = clientByPublicKey[publicKey];
      if (!entry) continue;
      const { clientId, client } = entry;
      if (!client.maxDevices || client.maxDevices <= 0) continue;

      let tracking = this.__deviceTracking[clientId];
      if (!tracking) {
        tracking = { endpoints: {} };
        this.__deviceTracking[clientId] = tracking;
      }
      tracking.endpoints[endpoint] = now;

      for (const ep of Object.keys(tracking.endpoints)) {
        if (now - tracking.endpoints[ep] > DEVICE_ENDPOINT_TTL_MS) {
          delete tracking.endpoints[ep];
        }
      }

      const count = Object.keys(tracking.endpoints).length;
      if (count > client.maxDevices && client.enabled) {
        debug(`Device limit exceeded for ${client.name} (${count} > ${client.maxDevices}). Disabling peer.`);
        client.enabled = false;
        client.updatedAt = new Date();
        client.deviceLimitExceededAt = new Date();
        changed = true;
      }
    }

    if (changed) {
      await this.saveConfig();
    }
  }

};
