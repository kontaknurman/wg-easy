<script setup>
import { inject, computed } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Separator from '@/components/ui/Separator.vue';

const settings = inject('settings');
const brand = computed(() => settings?.siteName || 'this server');

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Authentication' },
  { id: 'meta', label: 'Meta' },
  { id: 'session', label: 'Session' },
  { id: 'clients', label: 'Clients' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'limits', label: 'Limits' },
  { id: 'logging', label: 'Logging' },
  { id: 'schemas', label: 'Schemas' },
];

const endpoints = {
  meta: [
    { method: 'GET', path: '/api/release', desc: 'Numeric release identifier (matches package.json).' },
    { method: 'GET', path: '/api/openapi.json', desc: 'Full OpenAPI 3.0 specification for this API.' },
    { method: 'GET', path: '/api/me/ip', desc: 'Returns the resolved client IP, direct socket address, Cloudflare detection result, and raw forwarding headers.' },
  ],
  session: [
    { method: 'GET', path: '/api/session', desc: 'Current session state ({ requiresPassword, authenticated }).' },
    { method: 'POST', path: '/api/session', desc: 'Login with password. Sets connect.sid cookie.' },
    { method: 'DELETE', path: '/api/session', desc: 'Logout, destroying the session.' },
  ],
  clients: [
    { method: 'GET', path: '/api/wireguard/client', desc: 'List all clients with live transfer stats.' },
    { method: 'POST', path: '/api/wireguard/client', desc: 'Create a client. Body: { name }.' },
    { method: 'DELETE', path: '/api/wireguard/client/:id', desc: 'Delete a client.' },
    { method: 'POST', path: '/api/wireguard/client/:id/enable', desc: 'Set enabled=true.' },
    { method: 'POST', path: '/api/wireguard/client/:id/disable', desc: 'Set enabled=false.' },
    { method: 'PUT', path: '/api/wireguard/client/:id/name', desc: 'Rename. Body: { name }.' },
    { method: 'PUT', path: '/api/wireguard/client/:id/address', desc: 'Change tunnel IPv4. Body: { address }.' },
    { method: 'GET', path: '/api/wireguard/client/:id/qrcode.svg', desc: 'QR code SVG for the client config.' },
    { method: 'GET', path: '/api/wireguard/client/:id/configuration', desc: 'Download .conf file.' },
  ],
  schedule: [
    { method: 'PUT', path: '/api/wireguard/client/:id/schedule', desc: 'Replace per-day connection schedule.' },
  ],
  limits: [
    { method: 'PUT', path: '/api/wireguard/client/:id/max-devices', desc: 'Set the maximum concurrent devices. 0 disables enforcement. When exceeded, the peer is auto-disabled and deviceLimitExceededAt is set.' },
    { method: 'PUT', path: '/api/wireguard/client/:id/bandwidth-limit', desc: 'Set per-peer bandwidth cap in Mbps (0 = unlimited). Applied with Linux Traffic Control (tc HTB egress + ingress police).' },
    { method: 'PUT', path: '/api/wireguard/client/:id/allowed-source-ips', desc: 'Set per-peer public-IP allow-list (CIDR). Empty = no restriction. Endpoint outside the list auto-disables the peer.' },
  ],
  logging: [
    { method: 'PUT', path: '/api/wireguard/client/:id/logging', desc: 'Enable/disable per-peer connection metadata logging. Body: { loggingEnabled: bool }.' },
    { method: 'GET', path: '/api/wireguard/client/:id/log/stream', desc: 'Server-Sent Events stream of log events (replay buffer + live).' },
    { method: 'GET', path: '/api/wireguard/client/:id/connections', desc: 'In-memory ring buffer (~500 events) of session-level transitions: connect / disconnect / endpoint-replaced.' },
  ],
};

function methodVariant(m) {
  switch (m) {
    case 'GET': return 'success';
    case 'POST': return 'default';
    case 'PUT': return 'warning';
    case 'DELETE': return 'destructive';
    default: return 'secondary';
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader :requires-password="false" />

    <main class="container mx-auto max-w-5xl px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight">API documentation</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          REST endpoints exposed by {{ brand }}. Machine-readable spec at
          <a href="/api/openapi.json" class="font-mono text-primary hover:underline">/api/openapi.json</a>.
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav class="hidden lg:block">
          <Card class="sticky top-20">
            <CardHeader class="pb-3">
              <CardTitle class="text-sm">Contents</CardTitle>
            </CardHeader>
            <CardContent class="pt-0">
              <ul class="space-y-1 text-sm">
                <li v-for="s in sections" :key="s.id">
                  <a :href="`#${s.id}`" class="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">{{ s.label }}</a>
                </li>
              </ul>
            </CardContent>
          </Card>
        </nav>

        <div class="space-y-6">
          <Card id="overview">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>How to talk to the API programmatically.</CardDescription>
            </CardHeader>
            <CardContent class="text-sm leading-relaxed text-muted-foreground space-y-3">
              <p>
                The server exposes a small REST API for managing WireGuard peers. All paths are served from the same origin
                as the dashboard. JSON is used for request/response bodies; binary endpoints (QR, .conf download) return
                the appropriate <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">Content-Type</code>.
              </p>
              <p>
                All <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">/api/wireguard/**</code> endpoints
                require an authenticated session when the server is started with the
                <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">PASSWORD</code> environment variable.
                When unset, the API is open.
              </p>
            </CardContent>
          </Card>

          <Card id="auth">
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>Cookie-based via Express session.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm">
              <p class="text-muted-foreground">
                <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">POST /api/session</code> with a password
                sets a <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">connect.sid</code> cookie that
                subsequent requests must send. From <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">curl</code>,
                use a cookie jar:
              </p>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto"># Login (saves cookie)
curl -c cookies.txt -X POST http://localhost:51821/api/session \
  -H "Content-Type: application/json" \
  -d '{"password":"YOURPASS"}'

# Use the saved cookie
curl -b cookies.txt http://localhost:51821/api/wireguard/client</pre>
            </CardContent>
          </Card>

          <Card v-for="(group, key) in endpoints" :id="key" :key="key">
            <CardHeader>
              <CardTitle class="capitalize">{{ key }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-for="ep in group" :key="ep.method + ep.path" class="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40">
                <Badge :variant="methodVariant(ep.method)" class="w-16 justify-center font-mono text-[11px]">{{ ep.method }}</Badge>
                <div class="min-w-0 flex-1">
                  <code class="block break-all text-sm font-mono text-foreground">{{ ep.path }}</code>
                  <p class="mt-1 text-xs text-muted-foreground">{{ ep.desc }}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="api-access-detail">
            <CardHeader>
              <CardTitle>API access control</CardTitle>
              <CardDescription>Panel-wide IPv4 allow-list with Cloudflare-aware origin detection.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <p>
                When <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">apiAllowedIpsEnabled</code> is true and
                <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">apiAllowedIps</code> is non-empty, an
                early Express middleware checks every inbound request before the static handler and any API route. Requests
                from IPs outside the list get a 403 (JSON for API paths, plain text for static paths). The login page itself
                is gated, so disallowed IPs cannot even reach the password prompt.
              </p>
              <p>
                Origin IP resolution is controlled by <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">trustProxyHeader</code>:
              </p>
              <ul class="list-disc pl-5 space-y-1.5">
                <li><strong>auto</strong> (default): if the TCP source falls inside Cloudflare's published IPv4 ranges
                  (<a class="underline" target="_blank" rel="noopener" href="https://www.cloudflare.com/ips-v4/">cloudflare.com/ips-v4</a>),
                  use <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">CF-Connecting-IP</code>; otherwise use the direct socket address. Safe behind Cloudflare and works with bare connections.</li>
                <li><strong>cf-connecting-ip</strong>: always trust the header. Use only if your network blocks non-Cloudflare reachability — otherwise headers can be spoofed.</li>
                <li><strong>x-forwarded-for</strong>: trust the first hop in <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">X-Forwarded-For</code>. For generic reverse proxies.</li>
                <li><strong>none</strong>: always use the direct TCP source. Ignores all forwarding headers.</li>
              </ul>
              <p class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <strong>Lock-out recovery:</strong> if you accidentally exclude your own IP, edit
                <code class="rounded bg-background/40 px-1 py-0.5 text-[11px]">wg0.json</code> on the host
                (set <code class="rounded bg-background/40 px-1 py-0.5 text-[11px]">settings.apiAllowedIpsEnabled</code> to false) and restart the panel.
              </p>
              <p>The <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">GET /api/me/ip</code> endpoint reports
                how the panel sees the caller (direct address, resolved IP, whether the request arrives from Cloudflare,
                and the raw forwarding headers) — useful for verifying setup before enabling the gate.</p>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto">curl -b cookies.txt -X PUT http://localhost:51821/api/settings \
  -H "Content-Type: application/json" \
  -d '{"apiAllowedIpsEnabled": true, "trustProxyHeader": "auto",
       "apiAllowedIps": ["203.0.113.5/32", "192.168.1.0/24"]}'</pre>
            </CardContent>
          </Card>

          <Card id="logging-detail">
            <CardHeader>
              <CardTitle>Connection logging</CardTitle>
              <CardDescription>Per-peer real-time log of destination IPs, ports, and hostnames.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <p class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <strong>Privacy notice:</strong> when enabled per peer, the server captures connection metadata —
                destination IP/port plus hostname extracted from DNS queries, TLS SNI, and HTTP Host headers.
                <strong>No URL paths, no payloads, no HTTPS bodies are captured.</strong> Use only on systems you own
                and inform users.
              </p>
              <p>Two backends run when at least one peer has <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">loggingEnabled = true</code>:</p>
              <ul class="list-disc pl-5 space-y-1.5">
                <li><code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">conntrack -E -e NEW</code> — emits a <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">connection</code> event for each new TCP/UDP flow with src/dst IP and ports.</li>
                <li><code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">tshark</code> on <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg0</code> — emits <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">dns</code>, <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">tls</code>, or <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">http</code> events with extracted hostnames.</li>
              </ul>
              <p>Events are matched to a peer by source IP, deduped within a 30s window per (peer, host), and held in an in-memory ring buffer (~500 per peer). The SSE endpoint replays the buffer on connect, then streams new events live with a 20s keep-alive ping.</p>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto"># Enable logging
curl -b cookies.txt -X PUT http://localhost:51821/api/wireguard/client/CLIENT_ID/logging \
  -H "Content-Type: application/json" \
  -d '{"loggingEnabled": true}'

# Stream events
curl -N -b cookies.txt http://localhost:51821/api/wireguard/client/CLIENT_ID/log/stream</pre>
              <p class="text-xs">Requires <code class="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">conntrack-tools</code> and <code class="rounded bg-muted px-1 py-0.5 text-[11px] text-foreground">tshark</code> on the host (both are in the bundled Dockerfile).</p>
            </CardContent>
          </Card>

          <Card id="bandwidth-limit-detail">
            <CardHeader>
              <CardTitle>Bandwidth limit (per-peer Mbps)</CardTitle>
              <CardDescription>How the panel throttles a peer using Linux Traffic Control.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <p>
                For each peer with <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">bandwidthLimit &gt; 0</code> the server installs:
              </p>
              <ul class="list-disc pl-5 space-y-1.5">
                <li>An HTB class on <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg0</code> egress with <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">rate=ceil=Nmbit</code> matched on the peer's tunnel IP. This shapes server → client traffic (download for the client).</li>
                <li>An ingress <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">police</code> filter on <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg0</code> matched on source IP that drops packets above the configured rate. This caps client → server traffic (upload).</li>
                <li>An <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">sfq</code> child qdisc per class for fair queuing inside the limit.</li>
              </ul>
              <p>Rules are reapplied on every save and on the schedule ticker, so they follow enable/schedule/limit changes. Setting <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">bandwidthLimit = 0</code> removes the cap on the next save.</p>
              <p class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                Requires <code class="rounded bg-background/40 px-1 py-0.5 text-[11px]">tc</code> on the host
                (<code class="rounded bg-background/40 px-1 py-0.5 text-[11px]">iproute2-tc</code> on Alpine, included in the bundled Dockerfile). Without it the API still accepts the value but rules silently won't apply.
              </p>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto">curl -b cookies.txt -X PUT http://localhost:51821/api/wireguard/client/CLIENT_ID/bandwidth-limit \
  -H "Content-Type: application/json" \
  -d '{"bandwidthLimit": 25}'</pre>
            </CardContent>
          </Card>

          <Card id="source-ip-detail">
            <CardHeader>
              <CardTitle>Source IP allow-list</CardTitle>
              <CardDescription>Restrict which public IPs may use a config.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <p>
                WireGuard does not have a native "reject by source IP" hook — the protocol authenticates by key only. The
                panel approximates this restriction by polling <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg show wg0 dump</code>
                every 10 seconds, reading each peer's current <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">endpoint</code>,
                and matching the IP against the per-peer <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">allowedSourceIps</code> CIDR list.
              </p>
              <ul class="list-disc pl-5 space-y-1.5">
                <li>Empty list = no restriction (default).</li>
                <li>Endpoint outside any listed CIDR auto-disables the peer and timestamps <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">sourceIpDeniedAt</code>.</li>
                <li>Detection lag 10–60 s; not a real-time block. Connection completes once before the panel kicks the peer.</li>
                <li>Mobile peers roaming Wi-Fi/4G will trip this — list both networks if needed, or leave restriction off.</li>
                <li>IPv6 endpoints fail open (allowed) since the matcher is IPv4-only.</li>
              </ul>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto">curl -b cookies.txt -X PUT http://localhost:51821/api/wireguard/client/CLIENT_ID/allowed-source-ips \
  -H "Content-Type: application/json" \
  -d '{"allowedSourceIps": ["203.0.113.5/32", "192.168.1.0/24"]}'</pre>
            </CardContent>
          </Card>

          <Card id="device-limit-detail">
            <CardHeader>
              <CardTitle>Device limit (informational)</CardTitle>
              <CardDescription>Detect multiple devices sharing one config without blocking the peer.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <p>
                WireGuard authenticates by key and the kernel keeps at most one active endpoint per peer at any moment.
                When a new device handshakes with the same key, the kernel immediately switches the peer's endpoint to
                the new source — the previous device's traffic stops decrypting. <strong>"Reject old, accept new" is the
                native behaviour.</strong> The panel does not need to disable anything for this to work.
              </p>
              <p>What the device monitor actually does:</p>
              <ul class="list-disc pl-5 space-y-1.5">
                <li>Polls <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg show wg0 dump</code> every 10 seconds.</li>
                <li>Tracks distinct endpoints with fresh handshake (last ~3 minutes). When the kernel switches endpoint and the new one stays for &gt;30s, the previous entry is dropped from tracking — a normal reconnect from a new IP no longer counts as concurrent.</li>
                <li>If the rolling count exceeds <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">maxDevices</code>, sets <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">deviceLimitExceededAt</code> and shows a "Multi-device" badge. <strong>No auto-disable.</strong> The flag clears automatically once the count drops back below the limit.</li>
                <li><code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">maxDevices = 0</code> disables the counter entirely (default).</li>
              </ul>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto">curl -b cookies.txt -X PUT http://localhost:51821/api/wireguard/client/CLIENT_ID/max-devices \
  -H "Content-Type: application/json" \
  -d '{"maxDevices": 1}'</pre>
            </CardContent>
          </Card>

          <Card id="connections-detail">
            <CardHeader>
              <CardTitle>Connection history</CardTitle>
              <CardDescription>Per-peer session-level event log.</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3 text-sm text-muted-foreground">
              <p>The device monitor compares each tick's <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg show</code> snapshot to the previous one and records state transitions in an in-memory ring buffer (~500 events per peer):</p>
              <ul class="list-disc pl-5 space-y-1.5">
                <li><strong>connected</strong>: peer went from no-handshake to fresh-handshake.</li>
                <li><strong>disconnected</strong>: peer went from fresh-handshake to stale (no handshake for &gt;3 minutes) or vanished from the dump.</li>
                <li><strong>disconnected</strong> with <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">reason: "replaced"</code> followed by <strong>connected</strong> from a new IP: the kernel handed the peer to a different endpoint (most-recent handshake wins).</li>
              </ul>
              <p>Each event includes <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">ts</code>, <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">endpoint</code>, and <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">ip</code>. Buffer is wiped on server restart.</p>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto">curl -b cookies.txt http://localhost:51821/api/wireguard/client/CLIENT_ID/connections</pre>
            </CardContent>
          </Card>

          <Card id="schedule-detail">
            <CardHeader>
              <CardTitle>Schedule body example</CardTitle>
              <CardDescription>Full payload for PUT /api/wireguard/client/:id/schedule.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre class="rounded-lg bg-zinc-900 p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto">{
  "schedule": {
    "enabled": true,
    "timezone": "Asia/Jakarta",
    "days": {
      "monday":    { "active": true,  "start": "08:00", "end": "17:00" },
      "tuesday":   { "active": true,  "start": "08:00", "end": "17:00" },
      "wednesday": { "active": true,  "start": "08:00", "end": "17:00" },
      "thursday":  { "active": true,  "start": "08:00", "end": "17:00" },
      "friday":    { "active": true,  "start": "08:00", "end": "17:00" },
      "saturday":  { "active": false, "start": "00:00", "end": "23:59" },
      "sunday":    { "active": false, "start": "00:00", "end": "23:59" }
    }
  }
}</pre>
              <ul class="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc pl-5">
                <li>If <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">end &lt; start</code>, the active window wraps past midnight (e.g. 22:00 → 02:00).</li>
                <li>Time strings are normalized to <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">HH:MM</code>; unknown timezones fall back to <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">UTC</code>.</li>
                <li>A 60-second background ticker rebuilds <code class="rounded bg-muted px-1 py-0.5 text-xs text-foreground">wg0.conf</code> as boundaries pass.</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="schemas">
            <CardHeader>
              <CardTitle>Schemas</CardTitle>
            </CardHeader>
            <CardContent class="space-y-6 text-sm">
              <div>
                <h3 class="mb-2 font-semibold">Client</h3>
                <div class="overflow-hidden rounded-md border">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th class="px-3 py-2 text-left">Field</th><th class="px-3 py-2 text-left">Type</th><th class="px-3 py-2 text-left">Description</th></tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr><td class="px-3 py-2 font-mono text-xs">id</td><td class="px-3 py-2 text-muted-foreground">uuid</td><td class="px-3 py-2 text-muted-foreground">Client identifier.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">name</td><td class="px-3 py-2 text-muted-foreground">string</td><td class="px-3 py-2 text-muted-foreground">Display name.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">enabled</td><td class="px-3 py-2 text-muted-foreground">boolean</td><td class="px-3 py-2 text-muted-foreground">Manual master enable flag.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">address</td><td class="px-3 py-2 text-muted-foreground">IPv4</td><td class="px-3 py-2 text-muted-foreground">Tunnel IP.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">publicKey</td><td class="px-3 py-2 text-muted-foreground">string</td><td class="px-3 py-2 text-muted-foreground">WireGuard public key.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">schedule</td><td class="px-3 py-2 text-muted-foreground">Schedule</td><td class="px-3 py-2 text-muted-foreground">Per-day connection schedule.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">scheduleActive</td><td class="px-3 py-2 text-muted-foreground">boolean</td><td class="px-3 py-2 text-muted-foreground">True if schedule allows the peer right now.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">maxDevices</td><td class="px-3 py-2 text-muted-foreground">int (0–99)</td><td class="px-3 py-2 text-muted-foreground">Max concurrent devices; 0 disables the limit.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">activeDeviceCount</td><td class="px-3 py-2 text-muted-foreground">int</td><td class="px-3 py-2 text-muted-foreground">Distinct endpoints currently tracked.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">deviceLimitExceededAt</td><td class="px-3 py-2 text-muted-foreground">datetime|null</td><td class="px-3 py-2 text-muted-foreground">When the peer was last auto-disabled by the limit.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">bandwidthLimit</td><td class="px-3 py-2 text-muted-foreground">int (0–10000)</td><td class="px-3 py-2 text-muted-foreground">Per-peer bandwidth cap in Mbps; 0 = unlimited.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">loggingEnabled</td><td class="px-3 py-2 text-muted-foreground">boolean</td><td class="px-3 py-2 text-muted-foreground">When true, log connection metadata for this peer.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">allowedSourceIps</td><td class="px-3 py-2 text-muted-foreground">string[]</td><td class="px-3 py-2 text-muted-foreground">IPv4 / CIDR allow-list. Empty = no restriction.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">sourceIpDeniedAt</td><td class="px-3 py-2 text-muted-foreground">datetime|null</td><td class="px-3 py-2 text-muted-foreground">Last time the peer was auto-disabled by the IP allow-list.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">latestHandshakeAt</td><td class="px-3 py-2 text-muted-foreground">datetime|null</td><td class="px-3 py-2 text-muted-foreground">Last handshake timestamp.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">transferRx, transferTx</td><td class="px-3 py-2 text-muted-foreground">int|null</td><td class="px-3 py-2 text-muted-foreground">Cumulative bytes.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              <div>
                <h3 class="mb-2 font-semibold">Schedule</h3>
                <div class="overflow-hidden rounded-md border">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th class="px-3 py-2 text-left">Field</th><th class="px-3 py-2 text-left">Type</th><th class="px-3 py-2 text-left">Description</th></tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr><td class="px-3 py-2 font-mono text-xs">enabled</td><td class="px-3 py-2 text-muted-foreground">boolean</td><td class="px-3 py-2 text-muted-foreground">Master toggle. When false, the schedule is ignored.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">timezone</td><td class="px-3 py-2 text-muted-foreground">IANA TZ</td><td class="px-3 py-2 text-muted-foreground">Defaults to UTC.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">days</td><td class="px-3 py-2 text-muted-foreground">object</td><td class="px-3 py-2 text-muted-foreground">monday…sunday → ScheduleDay.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 class="mb-2 font-semibold">ScheduleDay</h3>
                <div class="overflow-hidden rounded-md border">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                      <tr><th class="px-3 py-2 text-left">Field</th><th class="px-3 py-2 text-left">Type</th><th class="px-3 py-2 text-left">Description</th></tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr><td class="px-3 py-2 font-mono text-xs">active</td><td class="px-3 py-2 text-muted-foreground">boolean</td><td class="px-3 py-2 text-muted-foreground">Whether the client is allowed on this day.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">start</td><td class="px-3 py-2 text-muted-foreground">HH:MM</td><td class="px-3 py-2 text-muted-foreground">Start of active window.</td></tr>
                      <tr><td class="px-3 py-2 font-mono text-xs">end</td><td class="px-3 py-2 text-muted-foreground">HH:MM</td><td class="px-3 py-2 text-muted-foreground">End of active window. Wraps if &lt; start.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>
