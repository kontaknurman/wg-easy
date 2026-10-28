# VPN Panel

Self-hosted WireGuard administration panel. List, create, edit, schedule,
rate-limit and monitor WireGuard peers from a web UI.

## Features

- Vue 3 dashboard with shadcn-style UI and dark mode.
- Per-peer schedule (Mon–Sun + per-day active hours, IANA timezone).
- Per-peer max-devices detection (flags peers used from too many endpoints).
- Per-peer bandwidth limit via Linux Traffic Control (`tc` HTB, uploads shaped through an IFB device).
- Per-peer website blocking (TLS SNI / HTTP Host / DNS) and source-IP allow-list.
- Per-peer connection log (DNS / TLS / HTTP hostnames + new connections), live and on disk.
- QR-code download, raw `.conf` download, live transfer counters.
- Site settings page to brand the panel (site name, tagline, login copy, footer).
- OpenAPI 3.0 spec at `/api/openapi.json` and an in-app docs page.
- Cookie-based auth via `PASSWORD` env (optional), with login rate limiting.

## Requirements

- Linux host with WireGuard kernel support (any modern kernel), **or** a TUN
  device for the bundled userspace fallback (`wireguard-go`, e.g. OpenVZ / LXC VPS).
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
  --log-opt max-size=10m --log-opt max-file=3 \
  --restart unless-stopped \
  vpn-panel
```

No WireGuard kernel module (OpenVZ / LXC)? Add `--device /dev/net/tun` and
the panel uses the bundled `wireguard-go` automatically.

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

## Running on a small VPS

The panel is tuned for 1 vCPU / 512 MB machines:

- **Idle cost is near zero.** The once-a-minute schedule check compares the
  desired WireGuard peers, `tc` rules and firewall rules with what is applied
  and only touches them when something changed (a peer is edited, or a
  schedule window opens/closes). `wg show` runs at most once per second no
  matter how many browser tabs are open, and the dashboard stops polling while
  its tab is hidden.
- **The connection log is the expensive feature.** While any peer has logging
  enabled, `tshark` uses roughly 65 MB of RAM (flat, it no longer grows). It
  only receives DNS queries and the first bytes of each connection of the
  logged peers (NFLOG), so heavy traffic does not cost CPU. Enable logging only
  for the peers that need it; with logging off nothing extra runs.
- **The web UI is pre-compressed** (brotli/gzip at build time) and its assets
  are cached by the browser, so page loads cost the server almost nothing.
- **Container logs**: keep the `--log-opt` (or the `logging:` block in
  `docker-compose.yml`) so logs cannot fill a small disk.
- **MTU**: TCP MSS is clamped automatically on the tunnel. If some sites still
  hang on a client behind PPPoE or a mobile network, set `WG_MTU=1280`.
- **Userspace fallback**: `wireguard-go` works everywhere but uses more CPU
  than the kernel module; prefer a VPS (KVM) with kernel WireGuard support.

## Architecture

- **Backend**: Node.js 22 + Express. Source under `src/lib/` and `src/services/`. State persisted to `wg0.json` (atomic writes).
- **Frontend**: Vue 3 + Vite + Tailwind 3 + reka-ui + HugeIcons. Source under `src/www-src/`, built bundle under `src/www/`.
- **Traffic shaping**: bandwidth limits use `tc` HTB on `wg0` egress (downloads) and on an IFB device fed from `wg0` ingress (uploads), with `fq_codel` leaves. Kernels without IFB fall back to an ingress `police` filter.
- **Schedule enforcement**: a ticker aligned to each minute recomputes the active peers and applies only the differences; a 10-second ticker watches `wg show wg0 dump` for the device-limit and source-IP checks.

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
cd src/www-src && npm run build   # writes hashed + pre-compressed assets to ../www/
```

## License

GPL-2.0-or-later.
