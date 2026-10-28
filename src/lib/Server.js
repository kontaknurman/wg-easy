'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const express = require('express');
const expressSession = require('express-session');
const debug = require('debug')('Server');

const Util = require('./Util');
const ServerError = require('./ServerError');
const SessionStore = require('./SessionStore');
const WireGuard = require('../services/WireGuard');
const buildOpenApi = require('./openapi');
const { compileCidrList, ipMatchesCompiled, isPrivateAddress } = require('./cidr');
const CLOUDFLARE_RANGES = require('./cloudflareIps');

const WWW_DIR = path.join(__dirname, '..', 'www');
const ASSETS_DIR = path.join(WWW_DIR, 'assets');
const CLOUDFLARE_COMPILED = compileCidrList(CLOUDFLARE_RANGES);

const API_PATH = /^\/api(\/|$)/i;

const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const LOGIN_TRACKED_IPS_MAX = 10000;

const ASSET_TYPES = {
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=UTF-8',
};

function stripIpv4Prefix(ip) {
  if (typeof ip !== 'string') return '';
  return ip.replace(/^::ffff:/, '');
}

function extractClientIp(req, mode) {
  const direct = stripIpv4Prefix((req.socket && req.socket.remoteAddress) || '');
  const cfHeader = req.headers && req.headers['cf-connecting-ip'];
  const xff = req.headers && req.headers['x-forwarded-for'];

  if (mode === 'cf-connecting-ip' && cfHeader) {
    return stripIpv4Prefix(String(cfHeader).trim());
  }
  if (mode === 'x-forwarded-for' && xff) {
    return stripIpv4Prefix(String(xff).split(',')[0].trim());
  }
  if (mode === 'auto') {
    if (cfHeader && ipMatchesCompiled(direct, CLOUDFLARE_COMPILED)) {
      return stripIpv4Prefix(String(cfHeader).trim());
    }
  }
  return direct;
}

// The frontend build writes .br / .gz siblings next to every hashed asset.
// Serving those costs no CPU per request (nothing is compressed on the fly)
// and cuts what a browser downloads on first load by roughly 70%.
function precompressedAssets() {
  const variants = new Map();
  try {
    for (const name of fs.readdirSync(ASSETS_DIR)) {
      if (!ASSET_TYPES[path.extname(name)]) continue;
      const br = fs.existsSync(path.join(ASSETS_DIR, `${name}.br`));
      const gzip = fs.existsSync(path.join(ASSETS_DIR, `${name}.gz`));
      if (br || gzip) variants.set(`/${name}`, { br, gzip });
    }
  } catch { /* no build output (development) */ }

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const available = variants.get(req.path);
    if (!available) return next();
    res.setHeader('Vary', 'Accept-Encoding');
    const accept = String(req.headers['accept-encoding'] || '');
    let encoding = null;
    if (available.br && /\bbr\b/.test(accept)) encoding = 'br';
    else if (available.gzip && /\bgzip\b/.test(accept)) encoding = 'gzip';
    if (!encoding) return next();
    res.setHeader('Content-Encoding', encoding);
    res.setHeader('Content-Type', ASSET_TYPES[path.extname(req.path)]);
    return res.sendFile(path.join(ASSETS_DIR, `${req.path.slice(1)}.${encoding === 'br' ? 'br' : 'gz'}`), {
      maxAge: '1y',
      immutable: true,
      acceptRanges: false,
    }, err => {
      if (!err || res.headersSent) return;
      res.removeHeader('Content-Encoding');
      res.removeHeader('Content-Type');
      next();
    });
  };
}

function staticHeaders(res, filePath) {
  if (filePath.startsWith(`${ASSETS_DIR}${path.sep}`)) {
    // Content-hashed file names: safe to cache forever.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (filePath.endsWith('.html')) {
    // Always revalidate so a new deployment's asset names are picked up.
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Failed logins per client IP, fixed window. Stops password guessing from
// eating the CPU of a small server (and from succeeding).
const loginFailures = new Map();

// Rate-limit key for a client IP, or null when the source can't be told
// apart from other users: behind a reverse proxy on the same host or LAN
// every visitor arrives from the proxy's private address, and counting them
// together would let anyone lock the admin out. IPv6 clients usually own a
// whole /64, so they are counted per /64.
function loginLimitKey(ip) {
  if (!ip || isPrivateAddress(ip)) return null;
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return `${groups.slice(0, 4).map(g => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
}

function loginBlockedForMs(ip) {
  if (ip === null) return 0;
  const entry = loginFailures.get(ip);
  if (!entry) return 0;
  const now = Date.now();
  if (entry.resetAt <= now) {
    loginFailures.delete(ip);
    return 0;
  }
  return entry.count >= LOGIN_MAX_FAILURES ? entry.resetAt - now : 0;
}

function recordLoginFailure(ip) {
  if (ip === null) return;
  const now = Date.now();
  let entry = loginFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginFailures.delete(ip);
    loginFailures.set(ip, entry);
  }
  entry.count++;
  if (loginFailures.size > LOGIN_TRACKED_IPS_MAX) {
    for (const [key, value] of loginFailures) {
      if (value.resetAt <= now || loginFailures.size > LOGIN_TRACKED_IPS_MAX) loginFailures.delete(key);
    }
  }
}

const {
  PORT,
  RELEASE,
  PASSWORD,
} = require('../config');

function isAuthenticated(req) {
  if (!PASSWORD) return true;
  return !!(req.session && req.session.authenticated);
}

module.exports = class Server {

  constructor() {
    let gate = { settings: null, allowed: [] };

    // Express
    this.app = express()
      .disable('etag')
      .disable('x-powered-by')

      // API allow-list gate — runs before everything else so even static
      // assets and the login page are blocked from disallowed IPs.
      .use(async (req, res, next) => {
        let settings;
        try {
          settings = await WireGuard.getSettings();
        } catch {
          return next();
        }
        if (!settings.apiAllowedIpsEnabled || !settings.apiAllowedIps || settings.apiAllowedIps.length === 0) {
          return next();
        }
        // Parse the CIDR list once per settings change, not per request.
        if (gate.settings !== settings) {
          gate = { settings, allowed: compileCidrList(settings.apiAllowedIps) };
        }
        const ip = extractClientIp(req, settings.trustProxyHeader || 'auto');
        if (!ipMatchesCompiled(ip, gate.allowed)) {
          debug(`Blocked request from ${ip || 'unknown'} (not in apiAllowedIps).`);
          if (req.path && req.path.startsWith('/api/')) {
            return res.status(403).json({ error: `Forbidden (source IP ${ip || 'unknown'} not allowed).` });
          }
          return res.status(403).type('text/plain').send(`Forbidden (source IP ${ip || 'unknown'} not allowed).\n`);
        }
        return next();
      })

      .use('/assets', precompressedAssets())
      .use('/', express.static(WWW_DIR, { setHeaders: staticHeaders }))
      .use(express.json())
      .use(expressSession({
        secret: crypto.randomBytes(32).toString('hex'),
        store: new SessionStore({ ttlMs: SESSION_IDLE_TTL_MS }),
        // Only logged-in sessions are stored; anonymous requests (and bots)
        // no longer create a session entry each.
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          // Cross-site form posts (CSRF) don't carry the session cookie.
          sameSite: 'lax',
        },
      }))

      .get('/api/release', (Util.promisify(async () => {
        return RELEASE;
      })))
      .get('/api/openapi.json', Util.promisify(async () => {
        const settings = await WireGuard.getSettings();
        return buildOpenApi(settings);
      }))
      .get('/api/settings', Util.promisify(async req => {
        const settings = await WireGuard.getSettings();
        if (isAuthenticated(req)) return settings;
        // Branding is public (login page); the access-control part is not.
        const {
          apiAllowedIpsEnabled, apiAllowedIps, trustProxyHeader, ...publicSettings
        } = settings;
        return publicSettings;
      }))
      .get('/api/me/ip', Util.promisify(async req => {
        const settings = await WireGuard.getSettings();
        const ip = extractClientIp(req, settings.trustProxyHeader || 'auto');
        const direct = stripIpv4Prefix((req.socket && req.socket.remoteAddress) || '');
        return {
          ip,
          direct,
          trustProxyHeader: settings.trustProxyHeader || 'auto',
          fromCloudflare: ipMatchesCompiled(direct, CLOUDFLARE_COMPILED),
          cfConnectingIp: req.headers['cf-connecting-ip'] || null,
          xForwardedFor: req.headers['x-forwarded-for'] || null,
        };
      }))

      // Authentication
      .get('/api/session', Util.promisify(async req => {
        const requiresPassword = !!process.env.PASSWORD;
        const authenticated = requiresPassword
          ? !!(req.session && req.session.authenticated)
          : true;

        return {
          requiresPassword,
          authenticated,
        };
      }))
      .post('/api/session', Util.promisify(async (req, res) => {
        const {
          password,
        } = req.body || {};

        const settings = await WireGuard.getSettings();
        const ip = loginLimitKey(extractClientIp(req, settings.trustProxyHeader || 'auto'));
        const blockedMs = loginBlockedForMs(ip);
        if (blockedMs > 0) {
          res.setHeader('Retry-After', String(Math.ceil(blockedMs / 1000)));
          throw new ServerError(`Too many failed login attempts. Try again in ${Math.ceil(blockedMs / 60000)} minute(s).`, 429);
        }

        if (typeof password !== 'string') {
          throw new ServerError('Missing: Password', 401);
        }

        if (!PASSWORD || !safeEqual(password, PASSWORD)) {
          recordLoginFailure(ip);
          throw new ServerError('Incorrect Password', 401);
        }

        if (ip !== null) loginFailures.delete(ip);
        // New session id on login (no session fixation), persisted before
        // responding so the very next request is already authenticated.
        await new Promise((resolve, reject) => {
          req.session.regenerate(err => (err ? reject(err) : resolve()));
        });
        req.session.authenticated = true;
        await new Promise((resolve, reject) => {
          req.session.save(err => (err ? reject(err) : resolve()));
        });

        debug(`New Session: ${req.session.id}`);
      }))

      // WireGuard
      .use((req, res, next) => {
        if (isAuthenticated(req)) {
          return next();
        }
        // Only the API is protected. The SPA shell served for /login, /docs,
        // … is public — it used to get this JSON 401 when such a page was
        // reloaded or opened from a bookmark while logged out. Express
        // matches routes case-insensitively ("/API/…" reaches the "/api/…"
        // handlers), so this test must be case-insensitive too.
        if (!API_PATH.test(req.path)) {
          return next();
        }

        return res.status(401).json({
          error: 'Not Logged In',
        });
      })
      .delete('/api/session', Util.promisify(async req => {
        const sessionId = req.session.id;

        req.session.destroy();

        debug(`Deleted Session: ${sessionId}`);
      }))
      .get('/api/wireguard/client', Util.promisify(async req => {
        return WireGuard.getClients();
      }))
      .get('/api/wireguard/client/:clientId', Util.promisify(async req => {
        const { clientId } = req.params;
        return WireGuard.getClientSummary({ clientId });
      }))
      .get('/api/wireguard/client/:clientId/qrcode.svg', Util.promisify(async (req, res) => {
        const { clientId } = req.params;
        const svg = await WireGuard.getClientQRCodeSVG({ clientId });
        res.header('Content-Type', 'image/svg+xml');
        res.header('Cache-Control', 'no-store');
        res.send(svg);
      }))
      .get('/api/wireguard/client/:clientId/configuration', Util.promisify(async (req, res) => {
        const { clientId } = req.params;
        const client = await WireGuard.getClient({ clientId });
        const config = await WireGuard.getClientConfiguration({ clientId });
        const configName = String(client.name)
          .replace(/[^a-zA-Z0-9_=+.-]/g, '-')
          .replace(/(-{2,}|-$)/g, '-')
          .replace(/-$/, '')
          .substring(0, 32);
        res.header('Content-Disposition', `attachment; filename="${configName || clientId}.conf"`);
        res.header('Content-Type', 'text/plain');
        res.header('Cache-Control', 'no-store');
        res.send(config);
      }))
      .post('/api/wireguard/client', Util.promisify(async req => {
        const {
          name, enabled, address, schedule,
          maxDevices, bandwidthLimit, loggingEnabled, allowedSourceIps,
          blockedDomains,
        } = req.body || {};
        return WireGuard.createClient({
          name,
          enabled,
          address,
          schedule,
          maxDevices,
          bandwidthLimit,
          loggingEnabled,
          allowedSourceIps,
          blockedDomains,
        });
      }))
      .delete('/api/wireguard/client/:clientId', Util.promisify(async req => {
        const { clientId } = req.params;
        return WireGuard.deleteClient({ clientId });
      }))
      .post('/api/wireguard/client/:clientId/enable', Util.promisify(async req => {
        const { clientId } = req.params;
        return WireGuard.enableClient({ clientId });
      }))
      .post('/api/wireguard/client/:clientId/disable', Util.promisify(async req => {
        const { clientId } = req.params;
        return WireGuard.disableClient({ clientId });
      }))
      .put('/api/wireguard/client/:clientId/name', Util.promisify(async req => {
        const { clientId } = req.params;
        const { name } = req.body || {};
        return WireGuard.updateClientName({ clientId, name });
      }))
      .put('/api/wireguard/client/:clientId/address', Util.promisify(async req => {
        const { clientId } = req.params;
        const { address } = req.body || {};
        return WireGuard.updateClientAddress({ clientId, address });
      }))
      .put('/api/wireguard/client/:clientId/schedule', Util.promisify(async req => {
        const { clientId } = req.params;
        const { schedule } = req.body || {};
        return WireGuard.updateClientSchedule({ clientId, schedule });
      }))
      .put('/api/wireguard/client/:clientId/max-devices', Util.promisify(async req => {
        const { clientId } = req.params;
        const { maxDevices } = req.body || {};
        return WireGuard.updateClientMaxDevices({ clientId, maxDevices });
      }))
      .put('/api/wireguard/client/:clientId/bandwidth-limit', Util.promisify(async req => {
        const { clientId } = req.params;
        const { bandwidthLimit } = req.body || {};
        return WireGuard.updateClientBandwidthLimit({ clientId, bandwidthLimit });
      }))
      .put('/api/wireguard/client/:clientId/logging', Util.promisify(async req => {
        const { clientId } = req.params;
        const { loggingEnabled } = req.body || {};
        return WireGuard.updateClientLogging({ clientId, loggingEnabled });
      }))
      .put('/api/wireguard/client/:clientId/log-retention', Util.promisify(async req => {
        const { clientId } = req.params;
        const { logRetentionDays } = req.body || {};
        return WireGuard.updateClientLogRetention({ clientId, logRetentionDays });
      }))
      .get('/api/wireguard/client/:clientId/log/history', Util.promisify(async req => {
        const { clientId } = req.params;
        await WireGuard.getClient({ clientId });
        const {
          from, to, limit, tz,
        } = req.query;
        return WireGuard.getClientLogHistory(clientId, {
          from, to, limit, tz,
        });
      }))
      .put('/api/wireguard/client/:clientId/allowed-source-ips', Util.promisify(async req => {
        const { clientId } = req.params;
        const { allowedSourceIps } = req.body || {};
        return WireGuard.updateClientAllowedSourceIps({ clientId, allowedSourceIps });
      }))
      .put('/api/wireguard/client/:clientId/blocked-domains', Util.promisify(async req => {
        const { clientId } = req.params;
        const { blockedDomains } = req.body || {};
        return WireGuard.updateClientBlockedDomains({ clientId, blockedDomains });
      }))
      .get('/api/wireguard/client/:clientId/connections', Util.promisify(async req => {
        const { clientId } = req.params;
        await WireGuard.getClient({ clientId });
        const { tz } = req.query;
        return WireGuard.getConnectionEventsWithTz(clientId, tz);
      }))
      .get('/api/wireguard/capture-status', Util.promisify(async () => {
        return WireGuard.getCaptureStatus();
      }))
      .get('/api/wireguard/client/:clientId/log/stream', (req, res) => {
        const { clientId } = req.params;
        Promise.resolve(WireGuard.getClient({ clientId })).then(() => {
          res.set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.flushHeaders();
          // Cap socket-level buffering. Without this Node will queue
          // unbounded bytes for slow/stalled SSE clients, which on a
          // 2 GB host is enough to OOM. When the kernel buffer fills,
          // res.write returns false and we drop new events until drain.
          if (req.socket && typeof req.socket.setNoDelay === 'function') {
            req.socket.setNoDelay(true);
          }

          // Backpressure-aware writer: drop events while the underlying
          // socket buffer hasn't drained. Live captures are inherently
          // lossy on the network side already, so dropping a burst beats
          // pinning the process memory. Frames produced in the same tick
          // (a burst from one tshark read) go out in a single write.
          let backpressured = false;
          let closed = false;
          let pending = '';
          let flushScheduled = false;
          const flush = () => {
            flushScheduled = false;
            if (closed || backpressured || !pending) return;
            const chunk = pending;
            pending = '';
            if (!res.write(chunk)) {
              backpressured = true;
              res.once('drain', () => {
                backpressured = false;
              });
            }
          };
          const send = chunk => {
            if (closed || backpressured) return;
            pending += chunk;
            if (!flushScheduled) {
              flushScheduled = true;
              setImmediate(flush);
            }
          };
          const frame = (id, event) => `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`;

          // Every event carries an id, so when the browser reconnects on
          // its own it sends Last-Event-ID and only gets what it missed
          // instead of the whole buffer again (duplicate rows in the UI).
          const lastEventId = req.headers['last-event-id'] || req.query.lastEventId;
          for (const { id, event } of WireGuard.getClientLogReplay(clientId, lastEventId)) {
            send(frame(id, event));
          }

          const unsubscribe = WireGuard.subscribeClientLog(clientId, (event, id) => {
            send(frame(id, event));
          });

          const keepalive = setInterval(() => {
            send(': ping\n\n');
          }, 20000);

          const cleanup = () => {
            closed = true;
            clearInterval(keepalive);
            unsubscribe();
          };
          req.on('close', cleanup);
          req.on('error', cleanup);
        }).catch(err => {
          res.status(err && err.statusCode === 404 ? 404 : 500).json({
            error: err && err.message ? err.message : 'Stream failed',
          });
        });
      })
      .put('/api/settings', Util.promisify(async req => {
        return WireGuard.updateSettings(req.body || {});
      }))

      // SPA fallback: any non-API GET that isn't a static file falls back to index.html
      // so vue-router (history mode) can handle /docs, /login, etc. Missing
      // build assets get a real 404 instead of HTML served as JavaScript.
      .get(/^\/(?!api\/).*/i, (req, res) => {
        if (req.path.startsWith('/assets/')) {
          return res.status(404).type('text/plain').send('Not Found\n');
        }
        res.setHeader('Cache-Control', 'no-cache');
        return res.sendFile(path.join(WWW_DIR, 'index.html'));
      })

      .listen(PORT, () => {
        debug(`Listening on http://0.0.0.0:${PORT}`);
      });

    WireGuard.startScheduler();
  }

};
