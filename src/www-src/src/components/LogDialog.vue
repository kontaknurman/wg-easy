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
import { api } from '@/api/client';
import { toast, toastError } from '@/lib/toast';
import { formatTimeOnly } from '@/lib/utils';

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
let evtSource = null;

const timezone = computed(() => props.client?.schedule?.timezone || null);

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

watch(
  () => [props.open, props.client?.id, props.client?.loggingEnabled],
  () => {
    if (!props.open || !props.client) {
      closeStream();
      return;
    }
    enabled.value = !!props.client.loggingEnabled;
    events.value = [];
    if (enabled.value) openStream();
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

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return events.value;
  return events.value.filter(e =>
    (e.hostname || '').toLowerCase().includes(q)
    || (e.dstIp || '').includes(q)
    || (e.type || '').includes(q),
  );
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

        <div v-if="enabled" class="grid gap-2">
          <div class="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1 text-xs">
            <div class="flex items-center gap-2">
              <span :class="['inline-block h-2 w-2 rounded-full', streamDotClass]"></span>
              <span class="font-medium">{{ streamLabel }}</span>
              <span v-if="timezone" class="text-muted-foreground">· timezone: {{ timezone }}</span>
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

          <div class="rounded-md border bg-muted/30 max-h-[420px] overflow-y-auto font-mono text-xs">
            <div v-if="filtered.length === 0" class="p-6 text-center text-muted-foreground">
              <p v-if="events.length === 0">Waiting for traffic…</p>
              <p v-else>No events match the filter.</p>
            </div>
            <div v-for="(e, i) in filtered" :key="i"
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
          <p class="text-xs text-muted-foreground text-right">
            {{ filtered.length }} / {{ events.length }} events {{ paused ? '· paused' : '' }}
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
