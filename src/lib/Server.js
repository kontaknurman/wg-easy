'use strict';

const path = require('path');

const express = require('express');
const expressSession = require('express-session');
const debug = require('debug')('Server');

const Util = require('./Util');
const ServerError = require('./ServerError');
const WireGuard = require('../services/WireGuard');
const buildOpenApi = require('./openapi');

const {
  PORT,
  RELEASE,
  PASSWORD,
} = require('../config');

module.exports = class Server {

  constructor() {
    // Express
    this.app = express()
      .disable('etag')
      .use('/', express.static(path.join(__dirname, '..', 'www')))
      .use(express.json())
      .use(expressSession({
        secret: String(Math.random()),
        resave: true,
        saveUninitialized: true,
      }))

      .get('/api/release', (Util.promisify(async () => {
        return RELEASE;
      })))
      .get('/api/openapi.json', Util.promisify(async () => {
        const settings = await WireGuard.getSettings();
        return buildOpenApi(settings);
      }))
      .get('/api/settings', Util.promisify(async () => {
        return WireGuard.getSettings();
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
      .post('/api/session', Util.promisify(async req => {
        const {
          password,
        } = req.body;

        if (typeof password !== 'string') {
          throw new ServerError('Missing: Password', 401);
        }

        if (password !== PASSWORD) {
          throw new ServerError('Incorrect Password', 401);
        }

        req.session.authenticated = true;
        req.session.save();

        debug(`New Session: ${req.session.id}`);
      }))

      // WireGuard
      .use((req, res, next) => {
        if (!PASSWORD) {
          return next();
        }

        if (req.session && req.session.authenticated) {
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
      .get('/api/wireguard/client/:clientId/qrcode.svg', Util.promisify(async (req, res) => {
        const { clientId } = req.params;
        const svg = await WireGuard.getClientQRCodeSVG({ clientId });
        res.header('Content-Type', 'image/svg+xml');
        res.send(svg);
      }))
      .get('/api/wireguard/client/:clientId/configuration', Util.promisify(async (req, res) => {
        const { clientId } = req.params;
        const client = await WireGuard.getClient({ clientId });
        const config = await WireGuard.getClientConfiguration({ clientId });
        const configName = client.name
          .replace(/[^a-zA-Z0-9_=+.-]/g, '-')
          .replace(/(-{2,}|-$)/g, '-')
          .replace(/-$/, '')
          .substring(0, 32);
        res.header('Content-Disposition', `attachment; filename="${configName || clientId}.conf"`);
        res.header('Content-Type', 'text/plain');
        res.send(config);
      }))
      .post('/api/wireguard/client', Util.promisify(async req => {
        const { name } = req.body;
        return WireGuard.createClient({ name });
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
        const { name } = req.body;
        return WireGuard.updateClientName({ clientId, name });
      }))
      .put('/api/wireguard/client/:clientId/address', Util.promisify(async req => {
        const { clientId } = req.params;
        const { address } = req.body;
        return WireGuard.updateClientAddress({ clientId, address });
      }))
      .put('/api/wireguard/client/:clientId/schedule', Util.promisify(async req => {
        const { clientId } = req.params;
        const { schedule } = req.body;
        return WireGuard.updateClientSchedule({ clientId, schedule });
      }))
      .put('/api/wireguard/client/:clientId/max-devices', Util.promisify(async req => {
        const { clientId } = req.params;
        const { maxDevices } = req.body;
        return WireGuard.updateClientMaxDevices({ clientId, maxDevices });
      }))
      .put('/api/wireguard/client/:clientId/bandwidth-limit', Util.promisify(async req => {
        const { clientId } = req.params;
        const { bandwidthLimit } = req.body;
        return WireGuard.updateClientBandwidthLimit({ clientId, bandwidthLimit });
      }))
      .put('/api/wireguard/client/:clientId/logging', Util.promisify(async req => {
        const { clientId } = req.params;
        const { loggingEnabled } = req.body;
        return WireGuard.updateClientLogging({ clientId, loggingEnabled });
      }))
      .put('/api/wireguard/client/:clientId/allowed-source-ips', Util.promisify(async req => {
        const { clientId } = req.params;
        const { allowedSourceIps } = req.body;
        return WireGuard.updateClientAllowedSourceIps({ clientId, allowedSourceIps });
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

          const buffered = WireGuard.getClientLogBuffer(clientId);
          for (const event of buffered) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }

          const unsubscribe = WireGuard.subscribeClientLog(clientId, event => {
            try {
              res.write(`data: ${JSON.stringify(event)}\n\n`);
            } catch { /* ignore */ }
          });

          const keepalive = setInterval(() => {
            try {
              res.write(': ping\n\n');
            } catch { /* ignore */ }
          }, 20000);

          const cleanup = () => {
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
      // so vue-router (history mode) can handle /docs, /login, etc.
      .get(/^\/(?!api\/).*/, (req, res, next) => {
        if (req.method !== 'GET') return next();
        return res.sendFile(path.join(__dirname, '..', 'www', 'index.html'));
      })

      .listen(PORT, () => {
        debug(`Listening on http://0.0.0.0:${PORT}`);
      });

    WireGuard.startScheduler();
  }

};
