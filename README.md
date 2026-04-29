# VPN Panel

Self-hosted WireGuard administration panel. List, create, edit, schedule,
rate-limit and monitor WireGuard peers from a web UI.

## Features

- Vue 3 dashboard with shadcn-style UI and dark mode.
- Per-peer schedule (Mon–Sun + per-day active hours, IANA timezone).
- Per-peer max-devices detection (auto-disables peers used from too many endpoints).
- Per-peer bandwidth limit via Linux Traffic Control (`tc` HTB + ingress police).
- QR-code download, raw `.conf` download, live transfer counters.
- Site settings page to brand the panel (site name, tagline, login copy, footer).
- OpenAPI 3.0 spec at `/api/openapi.json` and an in-app docs page.
- Cookie-based auth via `PASSWORD` env (optional).

## Requirements

- Linux host with WireGuard kernel support (any modern kernel).
- Docker.

## Run

```bash
docker build -t vpn-panel .

docker run -d \
  --name=vpn-panel \
  -e WG_HOST=YOUR_SERVER_IP \
  -e PASSWORD=YOUR_ADMIN_PASSWORD \
  -v ~/.vpn-panel:/etc/wireguard \
  -p 51820:51820/udp \
  -p 51821:51821/tcp \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  --sysctl="net.ipv4.conf.all.src_valid_mark=1" \
  --sysctl="net.ipv4.ip_forward=1" \
  --restart unless-stopped \
  vpn-panel
```

Web UI: `http://YOUR_SERVER_IP:51821`. Configuration is persisted in `~/.vpn-panel/wg0.json`.

## Environment variables

| Env | Default | Example | Description |
| - | - | - | - |
| `PASSWORD` | - | `foobar123` | Required password for the Web UI. When unset, the API is open. |
| `WG_HOST` | - | `vpn.example.com` | Public hostname or IP advertised in client configs. |
| `WG_DEVICE` | `eth0` | `ens6f0` | Egress interface for masquerading. |
| `WG_PORT` | `51820` | `12345` | Public UDP port. WireGuard always listens on `51820` inside the container. |
| `WG_MTU` | `null` | `1420` | Client MTU. Server uses default. |
| `WG_PERSISTENT_KEEPALIVE` | `0` | `25` | Seconds. `0` disables keepalive. |
| `WG_DEFAULT_ADDRESS` | `10.8.0.x` | `10.6.0.x` | Tunnel subnet template. |
| `WG_DEFAULT_DNS` | `1.1.1.1` | `8.8.8.8, 8.8.4.4` | DNS pushed to clients. |
| `WG_ALLOWED_IPS` | `0.0.0.0/0, ::/0` | `192.168.15.0/24` | AllowedIPs in client configs. |
| `WG_PRE_UP` / `WG_POST_UP` / `WG_PRE_DOWN` / `WG_POST_DOWN` | see `src/config.js` | shell snippets | Hooks injected into `wg0.conf`. |

If you change `WG_PORT`, also change the exposed Docker port.

## Architecture

- **Backend**: Node.js 18 + Express. Source under `src/lib/` and `src/services/`. State persisted to `wg0.json`.
- **Frontend**: Vue 3 + Vite + Tailwind 3 + reka-ui + HugeIcons. Source under `src/www-src/`, built bundle under `src/www/`.
- **Traffic shaping**: bandwidth limits use `tc` HTB on `wg0` egress and `tc` `police` on ingress.
- **Schedule enforcement**: a 60-second ticker rebuilds `wg0.conf` so peers come and go with their active windows; a 10-second ticker watches `wg show wg0 dump` for the device-limit check.

## Development

```bash
# Backend
cd src
npm install
npm run serve   # or `npm run serve-with-password`

# Frontend (separate terminal)
cd src/www-src
npm install
npm run dev     # vite dev server, /api proxied to localhost:51821

# Production build
cd src/www-src && npm run build   # writes hashed assets to ../www/
```

## License

GPL-2.0-or-later.
