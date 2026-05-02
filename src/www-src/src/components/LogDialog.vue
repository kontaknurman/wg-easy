<script setup>
import {
  ref, watch, computed, onUnmounted,
} from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  EyeIcon, AlertCircleIcon, PauseIcon, PlayIcon, EraserIcon, GlobeIcon,
} from '@hugeicons/core-free-icons';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import Button from '@/components/ui/Button.vue';
import Switch from '@/components/ui/Switch.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Badge from '@/components/ui/Badge.vue';
import Select from '@/components/ui/Select.vue';
import { api } from '@/api/client';
import { toast, toastError } from '@/lib/toast';
import { formatTimeOnly, listTimezones } from '@/lib/utils';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'changed']);

const enabled = ref(false);
const events = ref([]);
const paused = ref(false);
const filter = ref('');
const streamState = ref('idle'); // 'idle' | 'connecting' | 'open' | 'reconnecting' | 'failed'
const mode = ref('live'); // 'live' | 'history'
const retentionDraft = ref(0);
const historyEvents = ref([]);
const historyLoading = ref(false);
const historyRange = ref('24h'); // '1h' | '24h' | '7d' | '30d' | 'custom'
const historyFrom = ref('');
const historyTo = ref('');
const displayTz = ref('');
let evtSource = null;

const peerTimezone = computed(() => props.client?.schedule?.timezone || 'UTC');
// Effective timezone applied to clock formatting + history API requests.
// Falls back to the peer's schedule timezone when the user hasn't picked one.
const timezone = computed(() => displayTz.value || peerTimezone.value);
const timezoneOptions = computed(() => listTimezones().map(tz => ({ value: tz, label: tz })));

function setOpen(v) { emit('update:open', v); }

function closeStream() {
  if (evtSource) {
    try { evtSource.close(); } catch { /* ignore */ }
    evtSource = null;
  }
  streamState.value = 'idle';
}

function openStream() {
  closeStream();
  if (!props.client) return;
  if (typeof window === 'undefined' || !window.EventSource) return;
  const url = api.logStreamUrl({ clientId: props.client.id });
  streamState.value = 'connecting';
  evtSource = new EventSource(url);
  evtSource.onopen = () => { streamState.value = 'open'; };
  evtSource.onmessage = (e) => {
    streamState.value = 'open';
    if (paused.value) return;
    try {
      const event = JSON.parse(e.data);
      events.value.push(event);
      if (events.value.length > 1000) events.value.splice(0, events.value.length - 1000);
    } catch { /* ignore */ }
  };
  evtSource.onerror = () => {
    // EventSource auto-reconnects unless readyState becomes CLOSED.
    if (evtSource && evtSource.readyState === 2 /* CLOSED */) {
      streamState.value = 'failed';
    } else {
      streamState.value = 'reconnecting';
    }
  };
}

// Reset list state when the peer changes (or the dialog reopens for a new
// peer). NOT triggered by mere prop refreshes — earlier this watcher used to
// fire whenever logRetentionDays / loggingEnabled flipped, wiping events and
// snapping the user back to the live tab while they were reading history.
watch(
  () => props.client?.id,
  () => {
    events.value = [];
    historyEvents.value = [];
    mode.value = 'live';
    paused.value = false;
    filter.value = '';
    displayTz.value = '';
  },
);

// Stream lifecycle reacts to dialog open + logging toggle without touching
// the user's view state (mode, events, filter, picked timezone).
watch(
  [
    () => props.open,
    () => props.client?.id,
    () => props.client?.loggingEnabled,
    () => props.client?.logRetentionDays,
  ],
  () => {
    if (!props.open || !props.client) {
      closeStream();
      return;
    }
    enabled.value = !!props.client.loggingEnabled;
    retentionDraft.value = props.client.logRetentionDays || 0;
    if (enabled.value && !evtSource) openStream();
    if (!enabled.value) closeStream();
  },
  { immediate: true },
);

onUnmounted(() => closeStream());

async function setLoggingEnabled(v) {
  if (!props.client) return;
  try {
    await api.updateClientLogging({ clientId: props.client.id, loggingEnabled: v });
    enabled.value = v;
    if (v) {
      openStream();
      toast({ title: 'Logging enabled', description: 'Capturing connection metadata for this peer.' });
    } else {
      closeStream();
      events.value = [];
      toast({ title: 'Logging disabled' });
    }
    emit('changed');
  } catch (err) {
    toastError(err);
  }
}

function clearEvents() { events.value = []; }
function togglePause() { paused.value = !paused.value; }

async function saveRetention() {
  if (!props.client) return;
  const days = Math.max(0, Math.min(365, parseInt(retentionDraft.value, 10) || 0));
  retentionDraft.value = days;
  try {
    await api.updateClientLogRetention({ clientId: props.client.id, logRetentionDays: days });
    toast({
      title: days > 0 ? 'Retention saved' : 'Retention disabled',
      description: days > 0 ? `Persisting events for ${days} day${days === 1 ? '' : 's'}.` : 'On-disk log file removed.',
    });
    emit('changed');
  } catch (err) { toastError(err); }
}

function rangeToBounds(r) {
  const now = Date.now();
  switch (r) {
    case '1h': return { from: new Date(now - 60 * 60 * 1000), to: new Date(now) };
    case '24h': return { from: new Date(now - 24 * 60 * 60 * 1000), to: new Date(now) };
    case '7d': return { from: new Date(now - 7 * 24 * 60 * 60 * 1000), to: new Date(now) };
    case '30d': return { from: new Date(now - 30 * 24 * 60 * 60 * 1000), to: new Date(now) };
    case 'custom': {
      const f = historyFrom.value ? new Date(historyFrom.value) : null;
      const t = historyTo.value ? new Date(historyTo.value) : null;
      return { from: f, to: t };
    }
    default: return {};
  }
}

async function loadHistory() {
  if (!props.client) return;
  historyLoading.value = true;
  try {
    const { from, to } = rangeToBounds(historyRange.value);
    const r = await api.getClientLogHistory({
      clientId: props.client.id, from, to, limit: 5000, tz: timezone.value || undefined,
    });
    historyEvents.value = (r.events || []);
  } catch (err) {
    toastError(err);
  } finally {
    historyLoading.value = false;
  }
}

watch(mode, (m) => {
  if (m === 'history' && historyEvents.value.length === 0) loadHistory();
});

const sourceEvents = computed(() => (mode.value === 'history' ? historyEvents.value : events.value));

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  const base = sourceEvents.value;
  if (!q) return base;
  return base.filter(e => (e.hostname || '').toLowerCase().includes(q)
    || (e.dstIp || '').includes(q)
    || (e.type || '').includes(q));
});

function fmtTime(ts) {
  return formatTimeOnly(ts, timezone.value);
}

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

function reconnect() {
  if (!enabled.value) return;
  events.value = [];
  openStream();
}

function badgeVariant(type) {
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
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="EyeIcon" :size="20" :stroke-width="2" />
          Connection log
        </DialogTitle>
        <DialogDescription v-if="client">
          Real-time connection metadata for <span class="font-medium text-foreground">{{ client.name }}</span>.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-3">
        <div class="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <HugeiconsIcon :icon="AlertCircleIcon" :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-amber-600" />
          <div class="text-amber-700 dark:text-amber-300">
            <p class="font-medium">Privacy notice</p>
            <p class="opacity-90">
              Captures destination IP, port, and hostname (DNS / TLS SNI / HTTP Host).
              <strong>No URL paths, no payloads, no HTTPS bodies.</strong> Buffer is in-memory only and lost on
              restart. Use only on systems you own and inform your users.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg border p-3">
          <div class="space-y-0.5">
            <Label class="text-base">Enable logging</Label>
            <p class="text-xs text-muted-foreground">
              Spawns conntrack + tshark globally on first enable. Only this peer's events are recorded.
            </p>
          </div>
          <Switch :model-value="enabled" @update:model-value="setLoggingEnabled" />
        </div>

        <div v-if="enabled" class="grid gap-2 rounded-lg border p-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <Label class="text-sm">Persist to disk</Label>
              <p class="text-[11px] text-muted-foreground">
                Days to keep on-disk history (0 = memory only, max 365). Hourly pruner trims older entries.
              </p>
            </div>
            <div class="flex items-center gap-1">
              <Input v-model.number="retentionDraft" type="number" min="0" max="365" class="h-8 w-20 text-right" />
              <span class="text-xs text-muted-foreground">days</span>
              <Button size="sm" variant="outline" @click="saveRetention">Save</Button>
            </div>
          </div>
        </div>

        <div v-if="enabled" class="flex items-center gap-1 rounded-md border bg-muted/30 p-1 text-xs">
          <button type="button"
                  :class="['flex-1 rounded px-2 py-1 transition-colors', mode === 'live' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground']"
                  @click="mode = 'live'">Live stream</button>
          <button type="button"
                  :class="['flex-1 rounded px-2 py-1 transition-colors', mode === 'history' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground']"
                  @click="mode = 'history'">History</button>
        </div>

        <div v-if="enabled" class="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs">
          <span class="text-muted-foreground">Display timezone:</span>
          <Select v-model="displayTz" :options="timezoneOptions" :placeholder="`(peer: ${peerTimezone})`"
                  class="min-w-[12rem]" trigger-class="h-7 w-56" />
          <button v-if="displayTz" type="button" class="text-muted-foreground hover:text-foreground" @click="displayTz = ''">
            reset
          </button>
        </div>

        <div v-if="enabled && mode === 'live'" class="grid gap-2">
          <div class="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs">
            <div class="flex items-center gap-2">
              <span :class="['inline-block h-2 w-2 rounded-full', streamDotClass]"></span>
              <span class="font-medium">{{ streamLabel }}</span>
            </div>
            <button v-if="streamState === 'failed' || streamState === 'reconnecting'"
                    type="button"
                    class="text-primary hover:underline" @click="reconnect">Reconnect</button>
          </div>
          <div class="flex items-center gap-2">
            <Input v-model="filter" placeholder="Filter by hostname, IP, or type…" class="h-8" />
            <Button variant="outline" size="sm" :title="paused ? 'Resume' : 'Pause'" @click="togglePause">
              <HugeiconsIcon :icon="paused ? PlayIcon : PauseIcon" :size="14" :stroke-width="2" />
              {{ paused ? 'Resume' : 'Pause' }}
            </Button>
            <Button variant="outline" size="sm" title="Clear list" @click="clearEvents">
              <HugeiconsIcon :icon="EraserIcon" :size="14" :stroke-width="2" />
              Clear
            </Button>
          </div>
        </div>

        <div v-if="enabled && mode === 'history'" class="grid gap-2">
          <div class="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
            <span class="text-xs text-muted-foreground">Range:</span>
            <button v-for="r in ['1h', '24h', '7d', '30d', 'custom']" :key="r"
                    type="button"
                    :class="['rounded px-2 py-1 text-xs', historyRange === r ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground']"
                    @click="historyRange = r">{{ r }}</button>
            <template v-if="historyRange === 'custom'">
              <Input v-model="historyFrom" type="datetime-local" class="h-7 w-44 text-xs" />
              <span class="text-muted-foreground text-xs">→</span>
              <Input v-model="historyTo" type="datetime-local" class="h-7 w-44 text-xs" />
            </template>
            <Button size="sm" variant="outline" :disabled="historyLoading" @click="loadHistory">
              {{ historyLoading ? 'Loading…' : 'Load' }}
            </Button>
            <Input v-model="filter" placeholder="Filter…" class="ml-auto h-7 w-48 text-xs" />
          </div>
          <p v-if="(props.client?.logRetentionDays || 0) === 0"
             class="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
            Retention is disabled — set a non-zero "Persist to disk" value above to keep events for later viewing.
          </p>
        </div>

        <div v-if="enabled" class="rounded-md border bg-muted/30 max-h-[420px] overflow-y-auto font-mono text-xs">
          <div v-if="filtered.length === 0" class="p-6 text-center text-muted-foreground">
            <p v-if="mode === 'live' && events.length === 0 && (streamState === 'connecting' || streamState === 'reconnecting')">
              Connecting…
            </p>
            <p v-else-if="mode === 'live' && events.length === 0 && streamState === 'failed'">
              Stream disconnected. Click Reconnect above.
            </p>
            <p v-else-if="mode === 'live' && events.length === 0">No events captured yet — generate some traffic.</p>
            <p v-else-if="mode === 'history' && historyEvents.length === 0">No events in this range.</p>
            <p v-else>No events match the filter.</p>
          </div>
          <div v-for="e in filtered" :key="`${e.ts}-${e.type}-${e.hostname || e.dstIp}-${e.dstPort}`"
               class="flex items-start gap-2 border-b border-border/50 px-3 py-2 last:border-b-0">
            <span class="text-muted-foreground tabular-nums">{{ fmtTime(e.ts) }}</span>
            <Badge :variant="badgeVariant(e.type)" class="shrink-0 uppercase font-mono text-[10px]">{{ e.type }}</Badge>
            <span v-if="e.hostname" class="flex-1 truncate flex items-center gap-1">
              <HugeiconsIcon :icon="GlobeIcon" :size="11" :stroke-width="2" class="text-muted-foreground shrink-0" />
              <span class="truncate">{{ e.hostname }}</span>
            </span>
            <span v-else class="flex-1 truncate text-muted-foreground">{{ e.dstIp }}</span>
            <span class="text-muted-foreground shrink-0">
              {{ e.protocol ? e.protocol + '/' : '' }}{{ e.dstPort || '?' }}
            </span>
          </div>
        </div>
        <p v-if="enabled" class="text-xs text-muted-foreground text-right">
          <template v-if="mode === 'live'">{{ filtered.length }} / {{ events.length }} events {{ paused ? '· paused' : '' }}</template>
          <template v-else>{{ filtered.length }} / {{ historyEvents.length }} events from disk</template>
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
