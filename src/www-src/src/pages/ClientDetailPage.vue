<script setup>
import {
  ref, computed, onMounted, onUnmounted, watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { attachLogStream, detachLogStream } from '@/lib/logStream';
import { toast, toastError } from '@/lib/toast';
import {
  formatBytes, formatDateTime, formatRelative, formatInTimezone,
} from '@/lib/utils';
import AppHeader from '@/components/AppHeader.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Switch from '@/components/ui/Switch.vue';
import Input from '@/components/ui/Input.vue';
import Separator from '@/components/ui/Separator.vue';
import ScheduleDialog from '@/components/ScheduleDialog.vue';
import DeviceLimitDialog from '@/components/DeviceLimitDialog.vue';
import BandwidthLimitDialog from '@/components/BandwidthLimitDialog.vue';
import SourceIpDialog from '@/components/SourceIpDialog.vue';
import BlockedDomainsDialog from '@/components/BlockedDomainsDialog.vue';
import LogDialog from '@/components/LogDialog.vue';
import QrDialog from '@/components/QrDialog.vue';
import DeleteClientDialog from '@/components/DeleteClientDialog.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  ArrowLeft01Icon, UserCircleIcon, Edit02Icon, Clock01Icon,
  Shield01Icon, FlashIcon, EyeIcon, InternetIcon, QrCode01Icon,
  Download04Icon, Delete02Icon, ArrowDown01Icon, ArrowUp01Icon,
  Wifi01Icon, WifiDisconnected01Icon, RefreshIcon, AlertCircleIcon,
  GlobeIcon, BlockedIcon,
} from '@hugeicons/core-free-icons';

const route = useRoute();
const router = useRouter();

const client = ref(null);
const loading = ref(true);
const events = ref([]);
const eventsLoading = ref(false);
const editingName = ref(false);
const nameDraft = ref('');

const scheduleOpen = ref(false);
const deviceLimitOpen = ref(false);
const bandwidthOpen = ref(false);
const sourceIpOpen = ref(false);
const blockedDomainsOpen = ref(false);
const logOpen = ref(false);
const qrOpen = ref(false);
const deleteOpen = ref(false);

let pollTimer = null;
let eventsTimer = null;

const clientId = computed(() => route.params.id);

async function refresh() {
  if (!clientId.value) return;
  try {
    const all = await api.getClients();
    const found = all.find(c => c.id === clientId.value);
    if (!found) {
      toast({ title: 'Client not found', variant: 'destructive' });
      router.push('/');
      return;
    }
    client.value = found;
  } catch (err) {
    toastError(err);
  } finally {
    loading.value = false;
  }
}

async function refreshEvents() {
  if (!clientId.value) return;
  eventsLoading.value = true;
  try {
    const tz = client.value?.schedule?.timezone || undefined;
    const r = await api.getClientConnections({ clientId: clientId.value, tz });
    events.value = r.events.slice().reverse();
  } catch { /* ignore */ } finally {
    eventsLoading.value = false;
  }
}

watch(clientId, () => {
  refresh();
  refreshEvents();
}, { immediate: false });

onMounted(() => {
  refresh();
  refreshEvents();
  pollTimer = setInterval(refresh, 3000);
  eventsTimer = setInterval(refreshEvents, 5000);
});
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (eventsTimer) clearInterval(eventsTimer);
  if (attachedLiveId) {
    detachLogStream(attachedLiveId);
    attachedLiveId = null;
  }
});

const isOnline = computed(() => {
  if (!client.value || !client.value.latestHandshakeAt) return false;
  return Date.now() - new Date(client.value.latestHandshakeAt).getTime() < 1000 * 60 * 3;
});

const scheduleEnabled = computed(() => client.value?.schedule?.enabled);
const scheduleActive = computed(() => client.value?.scheduleActive !== false);
const deviceLimitOn = computed(() => (client.value?.maxDevices || 0) > 0);
const deviceLimitTripped = computed(() => !!client.value?.deviceLimitExceededAt);
const bandwidthOn = computed(() => (client.value?.bandwidthLimit || 0) > 0);
const sourceIpOn = computed(() => Array.isArray(client.value?.allowedSourceIps) && client.value.allowedSourceIps.length > 0);
const sourceIpDenied = computed(() => !!client.value?.sourceIpDeniedAt && !client.value?.enabled);
const blockedDomainsOn = computed(() => Array.isArray(client.value?.blockedDomains) && client.value.blockedDomains.length > 0);
const loggingOn = computed(() => !!client.value?.loggingEnabled);

function startEditName() {
  nameDraft.value = client.value.name;
  editingName.value = true;
}
async function saveName() {
  const v = nameDraft.value.trim();
  editingName.value = false;
  if (!v || v === client.value.name) return;
  try {
    await api.updateClientName({ clientId: client.value.id, name: v });
    await refresh();
    toast({ title: 'Renamed' });
  } catch (err) { toastError(err); }
}

async function setEnabled(value) {
  if (!client.value) return;
  try {
    if (value) await api.enableClient({ clientId: client.value.id });
    else await api.disableClient({ clientId: client.value.id });
    await refresh();
  } catch (err) { toastError(err); }
}

async function saveSchedule(schedule) {
  try {
    await api.updateClientSchedule({ clientId: client.value.id, schedule });
    toast({ title: 'Schedule saved' });
    scheduleOpen.value = false;
    await refresh();
  } catch (err) { toastError(err); }
}
async function saveDeviceLimit(maxDevices) {
  try {
    await api.updateClientMaxDevices({ clientId: client.value.id, maxDevices });
    toast({ title: maxDevices > 0 ? `Max ${maxDevices} device(s)` : 'Limit removed' });
    deviceLimitOpen.value = false;
    await refresh();
  } catch (err) { toastError(err); }
}
async function saveBandwidth(bandwidthLimit) {
  try {
    await api.updateClientBandwidthLimit({ clientId: client.value.id, bandwidthLimit });
    toast({ title: bandwidthLimit > 0 ? `Capped at ${bandwidthLimit} Mbps` : 'Cap removed' });
    bandwidthOpen.value = false;
    await refresh();
  } catch (err) { toastError(err); }
}
async function saveSourceIp(allowedSourceIps) {
  try {
    await api.updateClientAllowedSourceIps({ clientId: client.value.id, allowedSourceIps });
    toast({ title: 'Source IP allow-list saved' });
    sourceIpOpen.value = false;
    await refresh();
  } catch (err) { toastError(err); }
}
async function saveBlockedDomains(blockedDomains) {
  try {
    await api.updateClientBlockedDomains({ clientId: client.value.id, blockedDomains });
    toast({ title: blockedDomains.length > 0 ? 'Blocked websites saved' : 'Block-list cleared' });
    blockedDomainsOpen.value = false;
    await refresh();
  } catch (err) { toastError(err); }
}

const retentionDraft = ref(0);
const retentionSaving = ref(false);

watch(
  () => client.value?.id,
  () => { retentionDraft.value = client.value?.logRetentionDays || 0; },
);
watch(
  () => client.value?.logRetentionDays,
  (v) => { retentionDraft.value = v || 0; },
);

async function setLoggingEnabled(value) {
  if (!client.value) return;
  try {
    await api.updateClientLogging({ clientId: client.value.id, loggingEnabled: value });
    toast({ title: value ? 'Logging enabled' : 'Logging disabled' });
    await refresh();
  } catch (err) { toastError(err); }
}

async function saveRetention() {
  if (!client.value) return;
  retentionSaving.value = true;
  try {
    const days = Math.max(0, Math.min(365, parseInt(retentionDraft.value, 10) || 0));
    retentionDraft.value = days;
    await api.updateClientLogRetention({ clientId: client.value.id, logRetentionDays: days });
    toast({
      title: days > 0 ? 'Retention saved' : 'Retention disabled',
      description: days > 0 ? `Persisting events for ${days} day${days === 1 ? '' : 's'}.` : 'On-disk log file removed.',
    });
    await refresh();
  } catch (err) { toastError(err); } finally { retentionSaving.value = false; }
}
async function confirmDelete() {
  try {
    await api.deleteClient({ clientId: client.value.id });
    toast({ title: 'Client deleted' });
    router.push('/');
  } catch (err) { toastError(err); }
}

function eventVariant(type) {
  return type === 'connected' ? 'success' : 'secondary';
}

const dayLabels = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const scheduleSummary = computed(() => {
  const s = client.value?.schedule;
  if (!s || !s.enabled) return 'No schedule (always allowed)';
  const days = Object.entries(s.days || {})
    .filter(([, d]) => d.active)
    .map(([k, d]) => `${dayLabels[k]} ${d.start}–${d.end}`);
  if (days.length === 0) return 'Enabled but no active day';
  return `${days.join(' · ')} (${s.timezone})`;
});

const sourceIpSummary = computed(() => {
  if (!sourceIpOn.value) return 'No restriction';
  const list = client.value.allowedSourceIps;
  return list.length === 1 ? list[0] : `${list.length} entries`;
});

const timezone = computed(() => client.value?.schedule?.timezone || 'UTC');

function fmtEventTime(ts) {
  return formatInTimezone(ts, timezone.value);
}

// ---------- Inline log stream (compact preview) ----------
// Uses the shared `logStream` store so the EventSource is identical to (and
// shared with) the one read by the "Open full log" dialog. Without sharing,
// two separate EventSources to the same path occasionally diverged: the
// inline kept receiving events while the dialog stopped.
const liveStore = ref(null);
const liveEvents = computed(() => (liveStore.value ? liveStore.value.events.value : []));
const streamState = computed(() => (liveStore.value ? liveStore.value.streamState.value : 'idle'));

const visibleLiveEvents = computed(() => liveEvents.value.slice(-10).reverse());

let attachedLiveId = null;

function syncLiveSubscription() {
  const wantId = (loggingOn.value && client.value) ? client.value.id : null;
  if (wantId === attachedLiveId) return;
  if (attachedLiveId) {
    detachLogStream(attachedLiveId);
    attachedLiveId = null;
    liveStore.value = null;
  }
  if (wantId) {
    liveStore.value = attachLogStream(wantId);
    attachedLiveId = wantId;
  }
}

function reconnectLogStream() {
  if (liveStore.value) liveStore.value.reconnect();
}

watch([loggingOn, () => client.value?.id], syncLiveSubscription, { immediate: true });

const streamLabel = computed(() => {
  switch (streamState.value) {
    case 'open': return 'Live';
    case 'connecting': return 'Connecting…';
    case 'reconnecting': return 'Reconnecting…';
    case 'failed': return 'Disconnected';
    default: return 'Idle';
  }
});
const streamDotClass = computed(() => {
  switch (streamState.value) {
    case 'open': return 'bg-emerald-500';
    case 'connecting':
    case 'reconnecting': return 'bg-amber-500 animate-pulse';
    case 'failed': return 'bg-destructive';
    default: return 'bg-muted-foreground/40';
  }
});
function eventTypeVariant(type) {
  switch (type) {
    case 'tls': return 'success';
    case 'dns': return 'default';
    case 'http': return 'warning';
    case 'connection': return 'secondary';
    default: return 'outline';
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader />

    <main class="container mx-auto max-w-5xl px-4 py-8">
      <Button variant="ghost" size="sm" class="mb-2 -ml-3" @click="router.push('/')">
        <HugeiconsIcon :icon="ArrowLeft01Icon" :size="14" :stroke-width="2" />
        Dashboard
      </Button>

      <div v-if="loading" class="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>

      <div v-else-if="client" class="space-y-6">

        <!-- Hero / status bar -->
        <Card>
          <CardContent class="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div class="flex items-center gap-4 min-w-0 flex-1">
              <div class="relative shrink-0">
                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <HugeiconsIcon :icon="UserCircleIcon" :size="26" :stroke-width="1.5" />
                </div>
                <span v-if="isOnline" class="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
                  <span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card"></span>
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <Input v-if="editingName" v-model="nameDraft"
                         @keyup.enter="saveName" @keyup.escape="editingName = false" @blur="saveName"
                         autofocus class="h-8 max-w-[16rem]" />
                  <h1 v-else class="text-2xl font-bold tracking-tight truncate">{{ client.name }}</h1>
                  <button v-if="!editingName" @click="startEditName"
                          class="text-muted-foreground hover:text-foreground" title="Rename">
                    <HugeiconsIcon :icon="Edit02Icon" :size="14" :stroke-width="2" />
                  </button>
                  <Badge v-if="!client.enabled" variant="secondary">Disabled</Badge>
                  <Badge v-else-if="scheduleEnabled && !scheduleActive" variant="warning">Off-hours</Badge>
                  <Badge v-else-if="isOnline" variant="success">Online</Badge>
                  <Badge v-else variant="outline">Offline</Badge>
                  <Badge v-if="deviceLimitTripped && client.enabled" variant="warning">Multi-device detected</Badge>
                </div>
                <div class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  <span class="font-mono">{{ client.address }}</span>
                  <span v-if="client.latestHandshakeAt">Last handshake: {{ formatRelative(client.latestHandshakeAt) }}</span>
                  <span v-if="client.transferTx">↓ {{ formatBytes(client.transferTx) }}</span>
                  <span v-if="client.transferRx">↑ {{ formatBytes(client.transferRx) }}</span>
                  <button class="hover:text-foreground hover:underline" :title="`Timestamps shown in ${timezone}. Click to change.`"
                          @click="scheduleOpen = true">
                    TZ: {{ timezone }}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Switch :model-value="client.enabled" @update:model-value="setEnabled" />
              <span class="text-sm text-muted-foreground">{{ client.enabled ? 'Enabled' : 'Disabled' }}</span>

              <Button variant="outline" size="sm" @click="qrOpen = true">
                <HugeiconsIcon :icon="QrCode01Icon" :size="14" :stroke-width="2" />
                QR
              </Button>
              <Button variant="outline" size="sm" :as="'a'" :href="api.configurationUrl({ clientId: client.id })">
                <HugeiconsIcon :icon="Download04Icon" :size="14" :stroke-width="2" />
                .conf
              </Button>
              <Button variant="ghost" size="icon" class="text-muted-foreground hover:text-destructive" title="Delete" @click="deleteOpen = true">
                <HugeiconsIcon :icon="Delete02Icon" :size="16" :stroke-width="2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Connection history -->
        <Card>
          <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
            <div class="flex items-center gap-2">
              <HugeiconsIcon :icon="Wifi01Icon" :size="18" :stroke-width="2" class="text-muted-foreground" />
              <CardTitle class="text-base">Connection history</CardTitle>
            </div>
            <Button variant="ghost" size="icon" class="h-8 w-8" :disabled="eventsLoading" title="Refresh" @click="refreshEvents">
              <HugeiconsIcon :icon="RefreshIcon" :size="14" :stroke-width="2" />
            </Button>
          </CardHeader>
          <CardContent>
            <div v-if="eventsLoading && events.length === 0" class="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            <div v-else-if="events.length === 0" class="py-6 text-center text-sm text-muted-foreground">
              No connection events recorded yet. Events are tracked from when the panel started.
            </div>
            <ul v-else class="divide-y rounded-md border">
              <li v-for="(e, i) in events" :key="i"
                  class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div class="flex items-center gap-2 min-w-0">
                  <HugeiconsIcon :icon="e.type === 'connected' ? Wifi01Icon : WifiDisconnected01Icon"
                    :size="16" :stroke-width="2"
                    :class="e.type === 'connected' ? 'text-emerald-600' : 'text-muted-foreground'" />
                  <Badge :variant="eventVariant(e.type)" class="font-mono text-[10px]">{{ e.type }}</Badge>
                  <code v-if="e.endpoint" class="font-mono text-xs">{{ e.endpoint }}</code>
                  <span v-if="e.reason === 'replaced'" class="text-[10px] uppercase text-amber-700 dark:text-amber-400">replaced</span>
                </div>
                <div class="text-right text-xs shrink-0 text-muted-foreground tabular-nums">
                  <div :title="fmtEventTime(e.ts)">{{ formatRelative(e.ts) }}</div>
                  <div class="text-[10px] opacity-70">{{ fmtEventTime(e.ts) }}</div>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <!-- Per-feature settings grid -->
        <div class="grid gap-4 lg:grid-cols-2">
          <!-- Schedule -->
          <Card>
            <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
              <div class="flex items-center gap-2">
                <HugeiconsIcon :icon="Clock01Icon" :size="18" :stroke-width="2" class="text-muted-foreground" />
                <CardTitle class="text-base">Schedule</CardTitle>
                <Badge v-if="scheduleEnabled" variant="success">on</Badge>
              </div>
              <Button variant="outline" size="sm" @click="scheduleOpen = true">Edit</Button>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">{{ scheduleSummary }}</CardContent>
          </Card>

          <!-- Device limit -->
          <Card>
            <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
              <div class="flex items-center gap-2">
                <HugeiconsIcon :icon="Shield01Icon" :size="18" :stroke-width="2" class="text-muted-foreground" />
                <CardTitle class="text-base">Device limit</CardTitle>
                <Badge v-if="deviceLimitOn" variant="success">on</Badge>
              </div>
              <Button variant="outline" size="sm" @click="deviceLimitOpen = true">Edit</Button>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              <div v-if="!deviceLimitOn">No limit (any number of devices)</div>
              <div v-else>
                Max <span class="font-medium text-foreground">{{ client.maxDevices }}</span>
                · currently tracked: <span class="tabular-nums">{{ client.activeDeviceCount || 0 }}</span>
              </div>
              <p v-if="deviceLimitTripped && client.enabled" class="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Multiple endpoints detected recently. Connection is not blocked — WireGuard automatically routes to the latest handshake.
              </p>
            </CardContent>
          </Card>

          <!-- Bandwidth -->
          <Card>
            <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
              <div class="flex items-center gap-2">
                <HugeiconsIcon :icon="FlashIcon" :size="18" :stroke-width="2" class="text-muted-foreground" />
                <CardTitle class="text-base">Bandwidth limit</CardTitle>
                <Badge v-if="bandwidthOn" variant="success">on</Badge>
              </div>
              <Button variant="outline" size="sm" @click="bandwidthOpen = true">Edit</Button>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              <span v-if="!bandwidthOn">Unlimited</span>
              <span v-else>Capped at <span class="font-medium text-foreground">{{ client.bandwidthLimit }} Mbps</span> (symmetric)</span>
            </CardContent>
          </Card>

          <!-- Blocked websites -->
          <Card>
            <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
              <div class="flex items-center gap-2">
                <HugeiconsIcon :icon="BlockedIcon" :size="18" :stroke-width="2" class="text-muted-foreground" />
                <CardTitle class="text-base">Blocked websites</CardTitle>
                <Badge v-if="blockedDomainsOn" variant="success">on</Badge>
              </div>
              <Button variant="outline" size="sm" @click="blockedDomainsOpen = true">Edit</Button>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              <div v-if="!blockedDomainsOn">No domains blocked</div>
              <div v-else>
                <span class="font-medium text-foreground">{{ client.blockedDomains.length }}</span> pattern(s) active
                <ul v-if="client.blockedDomains.length <= 5" class="mt-1 space-y-0.5 font-mono text-xs">
                  <li v-for="d in client.blockedDomains" :key="d">{{ d }}</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <!-- Source IP -->
          <Card>
            <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
              <div class="flex items-center gap-2">
                <HugeiconsIcon :icon="InternetIcon" :size="18" :stroke-width="2" class="text-muted-foreground" />
                <CardTitle class="text-base">Source IP allow-list</CardTitle>
                <Badge v-if="sourceIpOn" variant="success">on</Badge>
                <Badge v-if="sourceIpDenied" variant="destructive">denied</Badge>
              </div>
              <Button variant="outline" size="sm" @click="sourceIpOpen = true">Edit</Button>
            </CardHeader>
            <CardContent class="text-sm text-muted-foreground">
              <div>{{ sourceIpSummary }}</div>
              <ul v-if="sourceIpOn && client.allowedSourceIps.length <= 5" class="mt-1 space-y-0.5 font-mono text-xs">
                <li v-for="cidr in client.allowedSourceIps" :key="cidr">{{ cidr }}</li>
              </ul>
            </CardContent>
          </Card>

          <!-- Logging (inline live stream) -->
          <Card class="lg:col-span-2">
            <CardHeader class="flex-row items-center justify-between space-y-0 pb-3">
              <div class="flex items-center gap-2 flex-wrap">
                <HugeiconsIcon :icon="EyeIcon" :size="18" :stroke-width="2" class="text-muted-foreground" />
                <CardTitle class="text-base">Connection log (URL / DNS / TLS metadata)</CardTitle>
                <Badge v-if="loggingOn" variant="success">recording</Badge>
                <span v-if="loggingOn" class="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span :class="['inline-block h-2 w-2 rounded-full', streamDotClass]"></span>
                  {{ streamLabel }}
                  <button v-if="streamState === 'failed' || streamState === 'reconnecting'"
                          type="button" class="text-primary hover:underline" @click="reconnectLogStream">
                    Reconnect
                  </button>
                </span>
              </div>
              <Button variant="outline" size="sm" @click="logOpen = true">Open full log</Button>
            </CardHeader>
            <CardContent class="text-sm space-y-3">
              <!-- Settings row: enable + retention -->
              <div class="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div class="flex items-center gap-2">
                  <Switch :model-value="loggingOn" @update:model-value="setLoggingEnabled" />
                  <span class="text-sm">Enable</span>
                </div>
                <span class="h-5 w-px bg-border"></span>
                <div :class="['flex items-center gap-2 text-sm', loggingOn ? '' : 'pointer-events-none opacity-50']">
                  <span class="text-muted-foreground">Persist on disk:</span>
                  <Input v-model.number="retentionDraft" type="number" min="0" max="365" class="h-7 w-16 text-right" />
                  <span class="text-muted-foreground">days</span>
                  <Button size="sm" variant="outline" :disabled="retentionSaving || (retentionDraft === (client.logRetentionDays || 0))" @click="saveRetention">
                    {{ retentionSaving ? 'Saving…' : 'Save' }}
                  </Button>
                  <span v-if="(client.logRetentionDays || 0) === 0" class="text-[11px] text-muted-foreground">
                    (memory only)
                  </span>
                </div>
              </div>

              <!-- Live preview -->
              <p v-if="!loggingOn" class="text-muted-foreground">
                Logging disabled — toggle on to capture destination IP/port and hostname (DNS / TLS SNI / HTTP Host).
              </p>
              <template v-else>
                <div v-if="visibleLiveEvents.length === 0"
                     class="rounded-md border bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                  Waiting for traffic…
                </div>
                <ul v-else class="rounded-md border divide-y bg-muted/20 max-h-72 overflow-y-auto font-mono text-xs">
                  <li v-for="(e, i) in visibleLiveEvents" :key="i"
                      class="flex items-center gap-2 px-3 py-1.5">
                    <span class="text-muted-foreground tabular-nums shrink-0">{{ fmtEventTime(e.ts).split(', ').pop() }}</span>
                    <Badge :variant="eventTypeVariant(e.type)" class="shrink-0 uppercase font-mono text-[10px]">{{ e.type }}</Badge>
                    <span v-if="e.hostname" class="flex items-center gap-1 truncate">
                      <HugeiconsIcon :icon="GlobeIcon" :size="11" :stroke-width="2" class="text-muted-foreground shrink-0" />
                      <span class="truncate">{{ e.hostname }}</span>
                    </span>
                    <span v-else class="truncate text-muted-foreground">{{ e.dstIp }}</span>
                    <span class="ml-auto text-muted-foreground shrink-0">
                      {{ e.protocol ? e.protocol + '/' : '' }}{{ e.dstPort || '?' }}
                    </span>
                  </li>
                </ul>
                <p class="mt-1 text-[11px] text-muted-foreground text-right">
                  Showing latest {{ visibleLiveEvents.length }} of {{ liveEvents.length }} buffered ·
                  <button class="hover:underline text-primary" @click="logOpen = true">open full log</button>
                  for filter, pause, and history.
                </p>
              </template>
            </CardContent>
          </Card>
        </div>

      </div>
    </main>

    <ScheduleDialog v-model:open="scheduleOpen" :client="client" @save="saveSchedule" />
    <DeviceLimitDialog v-model:open="deviceLimitOpen" :client="client" @save="saveDeviceLimit" />
    <BandwidthLimitDialog v-model:open="bandwidthOpen" :client="client" @save="saveBandwidth" />
    <SourceIpDialog v-model:open="sourceIpOpen" :client="client" @save="saveSourceIp" />
    <BlockedDomainsDialog v-model:open="blockedDomainsOpen" :client="client" @save="saveBlockedDomains" />
    <LogDialog v-model:open="logOpen" :client="client" @changed="refresh" />
    <QrDialog v-model:open="qrOpen" :client="client" />
    <DeleteClientDialog v-model:open="deleteOpen" :client="client" @confirm="confirmDelete" />
  </div>
</template>
