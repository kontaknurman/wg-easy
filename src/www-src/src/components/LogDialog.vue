<script setup>
import {
  ref, shallowRef, watch, computed, onUnmounted,
} from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  EyeIcon, PauseIcon, PlayIcon, EraserIcon,
} from '@hugeicons/core-free-icons';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Badge from '@/components/ui/Badge.vue';
import Select from '@/components/ui/Select.vue';
import { api } from '@/api/client';
import { toastError } from '@/lib/toast';
import { listTimezones } from '@/lib/utils';
import { attachLogStream, detachLogStream } from '@/lib/logStream';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open']);

const HISTORY_CAP = 2000; // events fetched per History "Load"

// Shared per-peer log stream. shallowRef is REQUIRED here: a regular `ref`
// would wrap the assigned store object with `reactive()`, which auto-unwraps
// inner refs at top-level property access. That would turn
// `liveStore.value.events` into the raw array (instead of the inner ref),
// and `.value` on the array would be `undefined` — silently breaking the
// computed below.
const liveStore = shallowRef(null);
const events = computed(() => (liveStore.value ? liveStore.value.events.value : []));
const streamState = computed(() => (liveStore.value ? liveStore.value.streamState.value : 'idle'));

const paused = ref(false);
const filter = ref('');
// Multi-choice type filter. Empty = show all types.
const typeFilter = ref(new Set());
const TYPE_OPTIONS = [
  { key: 'dns', label: 'DNS' },
  { key: 'tls', label: 'TLS' },
  { key: 'http', label: 'HTTP' },
  { key: 'connection', label: 'CONN' },
];
function toggleType(key) {
  const next = new Set(typeFilter.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  typeFilter.value = next;
}
function clearTypeFilter() { typeFilter.value = new Set(); }
const mode = ref('live');
const historyEvents = ref([]);
const historyLoading = ref(false);
const historyRange = ref('24h');
const historyFrom = ref('');
const historyTo = ref('');
const displayTz = ref('');

// Tracks the peer id we currently hold a refcount for, so we can detach cleanly.
let attachedId = null;

const peerTimezone = computed(() => props.client?.schedule?.timezone || 'UTC');
const timezone = computed(() => displayTz.value || peerTimezone.value);
const timezoneOptions = computed(() => listTimezones().map(tz => ({ value: tz, label: tz })));

const TZ_STORAGE_PREFIX = 'logDialog.displayTz.';
function loadStoredTz(clientId) {
  if (!clientId || typeof window === 'undefined' || !window.localStorage) return '';
  try { return window.localStorage.getItem(TZ_STORAGE_PREFIX + clientId) || ''; } catch { return ''; }
}
function storeTz(clientId, tz) {
  if (!clientId || typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (tz) window.localStorage.setItem(TZ_STORAGE_PREFIX + clientId, tz);
    else window.localStorage.removeItem(TZ_STORAGE_PREFIX + clientId);
  } catch { /* ignore quota */ }
}

// Cached DateTimeFormat instance keyed by timezone string. Constructing
// `Intl.DateTimeFormat` is the slow part; reusing is cheap.
let fmtCache = { tz: '', fmt: null };
function fmtTime(ts) {
  if (!ts) return '';
  const t = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(t.getTime())) return '';
  const tz = timezone.value;
  if (fmtCache.tz !== tz) {
    fmtCache = {
      tz,
      fmt: new Intl.DateTimeFormat(undefined, {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz,
      }),
    };
  }
  return fmtCache.fmt.format(t);
}

function setOpen(v) { emit('update:open', v); }

// Sync subscription with the shared store. Attached when dialog open AND
// peer has logging enabled; detached otherwise. Detail-page inline preview
// holds its own ref count so the EventSource stays alive across dialog
// open/close cycles.
function syncSubscription() {
  const wantId = (props.open && props.client && props.client.loggingEnabled)
    ? props.client.id
    : null;
  if (wantId === attachedId) return;
  if (attachedId) {
    detachLogStream(attachedId);
    attachedId = null;
    liveStore.value = null;
  }
  if (wantId) {
    liveStore.value = attachLogStream(wantId);
    attachedId = wantId;
  }
}

watch(
  () => props.client?.id,
  (id) => {
    historyEvents.value = [];
    mode.value = 'live';
    paused.value = false;
    filter.value = '';
    displayTz.value = loadStoredTz(id);
    syncSubscription();
  },
  { immediate: true },
);

watch(displayTz, (v) => storeTz(props.client?.id, v));

watch(() => props.open, syncSubscription, { immediate: true });
watch(() => props.client?.loggingEnabled, syncSubscription);

onUnmounted(() => {
  if (attachedId) {
    detachLogStream(attachedId);
    attachedId = null;
  }
});

function clearEvents() {
  if (liveStore.value) liveStore.value.clear();
}
function togglePause() {
  paused.value = !paused.value;
}

function rangeToBounds(r) {
  const now = Date.now();
  switch (r) {
    case '1h': return { from: new Date(now - 3600_000), to: new Date(now) };
    case '24h': return { from: new Date(now - 86_400_000), to: new Date(now) };
    case '7d': return { from: new Date(now - 7 * 86_400_000), to: new Date(now) };
    case '30d': return { from: new Date(now - 30 * 86_400_000), to: new Date(now) };
    case 'custom': return {
      from: historyFrom.value ? new Date(historyFrom.value) : null,
      to: historyTo.value ? new Date(historyTo.value) : null,
    };
    default: return {};
  }
}

async function loadHistory() {
  if (!props.client) return;
  historyLoading.value = true;
  try {
    const { from, to } = rangeToBounds(historyRange.value);
    const r = await api.getClientLogHistory({
      clientId: props.client.id, from, to, limit: HISTORY_CAP, tz: timezone.value,
    });
    historyEvents.value = r.events || [];
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
  const types = typeFilter.value;
  const base = sourceEvents.value;
  const matched = base.filter((e) => {
    if (types.size > 0 && !types.has((e.type || '').toLowerCase())) return false;
    if (!q) return true;
    return (e.hostname || '').toLowerCase().includes(q)
      || (e.dstIp || '').includes(q)
      || (e.type || '').includes(q);
  });
  // Newest first for display.
  return matched.slice().reverse();
});

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
function badgeVariant(type) {
  switch (type) {
    case 'tls': return 'success';
    case 'dns': return 'default';
    case 'http': return 'warning';
    case 'connection': return 'secondary';
    default: return 'outline';
  }
}

function reconnect() {
  if (liveStore.value) liveStore.value.reconnect();
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-3xl flex flex-col p-0 max-h-[90vh] gap-0">

      <DialogHeader class="px-6 pt-5 pb-3 border-b shrink-0">
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="EyeIcon" :size="18" :stroke-width="2" />
          Connection log
          <span v-if="client" class="text-sm font-normal text-muted-foreground">· {{ client.name }}</span>
        </DialogTitle>
        <DialogDescription v-if="client" class="text-xs">
          Connection metadata only — destination IP/port + hostname (DNS / TLS SNI / HTTP Host).
          No URL paths, no payloads.
        </DialogDescription>
      </DialogHeader>

      <!-- Settings hint when logging is off -->
      <div v-if="!client?.loggingEnabled"
           class="px-6 py-8 text-center text-sm text-muted-foreground">
        Logging is disabled for this peer. Enable it from the dashboard card or the detail page to start capturing events.
      </div>

      <template v-else>
        <!-- Compact toolbar -->
        <div class="px-6 py-3 border-b shrink-0 flex flex-col gap-2">
          <!-- Tabs + status -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-1 rounded-md border bg-muted/30 p-1 text-xs">
              <button type="button"
                      :class="['rounded px-3 py-1 transition-colors', mode === 'live' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground']"
                      @click="mode = 'live'">Live</button>
              <button type="button"
                      :class="['rounded px-3 py-1 transition-colors', mode === 'history' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground']"
                      @click="mode = 'history'">History</button>
            </div>
            <div v-if="mode === 'live'" class="flex items-center gap-1.5 text-xs">
              <span :class="['inline-block h-2 w-2 rounded-full', streamDotClass]"></span>
              <span>{{ streamLabel }}</span>
              <button v-if="streamState === 'failed' || streamState === 'reconnecting'"
                      type="button" class="text-primary hover:underline" @click="reconnect">
                Reconnect
              </button>
            </div>
            <div v-if="mode === 'live'" class="ml-auto flex items-center gap-1">
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

          <!-- Filter + timezone -->
          <div class="flex flex-wrap items-center gap-2">
            <Input v-model="filter" placeholder="Filter hostname / IP / type…" class="h-8 flex-1 min-w-[10rem] text-xs" />
            <Select v-model="displayTz" :options="timezoneOptions" :placeholder="`tz: ${peerTimezone}`"
                    trigger-class="h-8 w-44 text-xs" />
            <button v-if="displayTz" type="button" class="text-xs text-muted-foreground hover:text-foreground" @click="displayTz = ''">
              reset tz
            </button>
          </div>

          <!-- Type chips (multi-select, empty = all) -->
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] text-muted-foreground">Types:</span>
            <button v-for="opt in TYPE_OPTIONS" :key="opt.key"
                    type="button"
                    :class="[
                      'rounded-md border px-2 py-0.5 text-[11px] font-mono uppercase transition-colors',
                      typeFilter.has(opt.key)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
                    ]"
                    @click="toggleType(opt.key)">
              {{ opt.label }}
            </button>
            <button v-if="typeFilter.size > 0" type="button"
                    class="text-[11px] text-muted-foreground hover:text-foreground"
                    @click="clearTypeFilter">
              clear
            </button>
            <span v-else class="text-[11px] text-muted-foreground">all</span>
          </div>

          <!-- History range -->
          <div v-if="mode === 'history'" class="flex flex-wrap items-center gap-2 text-xs">
            <span class="text-muted-foreground">Range:</span>
            <button v-for="r in ['1h', '24h', '7d', '30d', 'custom']" :key="r"
                    type="button"
                    :class="['rounded px-2 py-1', historyRange === r ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground']"
                    @click="historyRange = r">{{ r }}</button>
            <template v-if="historyRange === 'custom'">
              <Input v-model="historyFrom" type="datetime-local" class="h-7 w-44" />
              <span class="text-muted-foreground">→</span>
              <Input v-model="historyTo" type="datetime-local" class="h-7 w-44" />
            </template>
            <Button size="sm" variant="outline" :disabled="historyLoading" @click="loadHistory">
              {{ historyLoading ? 'Loading…' : 'Load' }}
            </Button>
            <span v-if="(client.logRetentionDays || 0) === 0" class="ml-auto text-amber-700 dark:text-amber-400">
              Retention is 0 — only memory buffer available.
            </span>
          </div>
        </div>

        <!-- Scrollable event list — fills available space -->
        <div class="flex-1 min-h-[200px] overflow-y-auto bg-muted/20 font-mono text-xs">
          <div v-if="filtered.length === 0" class="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
            <p v-if="mode === 'live' && events.length === 0 && (streamState === 'connecting' || streamState === 'reconnecting')">
              Connecting…
            </p>
            <p v-else-if="mode === 'live' && events.length === 0 && streamState === 'failed'">
              Stream disconnected. Click Reconnect.
            </p>
            <p v-else-if="mode === 'live' && events.length === 0">No events captured yet — generate some traffic.</p>
            <p v-else-if="mode === 'history' && historyEvents.length === 0">No events in this range.</p>
            <p v-else>No events match the filter.</p>
          </div>
          <div v-else>
            <div v-for="e in filtered" :key="`${e.ts}-${e.type}-${e.hostname || e.dstIp}-${e.dstPort}`"
                 class="flex items-center gap-2 border-b border-border/30 px-4 py-1.5 last:border-b-0">
              <span class="text-muted-foreground tabular-nums shrink-0 w-[5.5rem]">{{ fmtTime(e.ts) }}</span>
              <Badge :variant="badgeVariant(e.type)" class="shrink-0 uppercase font-mono text-[10px] w-14 justify-center">{{ e.type }}</Badge>
              <span class="flex-1 truncate">{{ e.hostname || e.dstIp || '?' }}</span>
              <span class="text-muted-foreground shrink-0 w-20 text-right">
                {{ e.protocol ? `${e.protocol}/` : '' }}{{ e.dstPort || '?' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-2 border-t shrink-0 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            <template v-if="mode === 'live'">
              {{ filtered.length }} / {{ events.length }} events
              <span v-if="paused" class="text-amber-700 dark:text-amber-400">· paused</span>
            </template>
            <template v-else>
              {{ filtered.length }} / {{ historyEvents.length }} events from disk
            </template>
          </span>
          <span>tz: {{ timezone }}</span>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
