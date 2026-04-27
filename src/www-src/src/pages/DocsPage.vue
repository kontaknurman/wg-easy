<script setup>
import AppHeader from '@/components/AppHeader.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Badge from '@/components/ui/Badge.vue';
import Separator from '@/components/ui/Separator.vue';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'auth', label: 'Authentication' },
  { id: 'meta', label: 'Meta' },
  { id: 'session', label: 'Session' },
  { id: 'clients', label: 'Clients' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'schemas', label: 'Schemas' },
];

const endpoints = {
  meta: [
    { method: 'GET', path: '/api/release', desc: 'Numeric release identifier (matches package.json).' },
    { method: 'GET', path: '/api/openapi.json', desc: 'Full OpenAPI 3.0 specification for this API.' },
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
          REST endpoints exposed by the wg-easy server. Machine-readable spec at
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
              <CardDescription>How to talk to wg-easy programmatically.</CardDescription>
            </CardHeader>
            <CardContent class="text-sm leading-relaxed text-muted-foreground space-y-3">
              <p>
                wg-easy exposes a small REST API for managing WireGuard peers. All paths are served from the same origin
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
