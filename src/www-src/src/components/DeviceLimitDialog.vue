<script setup>
import { ref, watch, computed } from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  Shield01Icon, UserMultiple02Icon, AlertCircleIcon, CheckmarkCircle02Icon,
} from '@hugeicons/core-free-icons';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import DialogFooter from '@/components/ui/DialogFooter.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Switch from '@/components/ui/Switch.vue';
import Separator from '@/components/ui/Separator.vue';
import { formatDateTime } from '@/lib/utils';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'save']);

const enabled = ref(false);
const limit = ref(1);

watch(
  () => [props.open, props.client?.id],
  () => {
    if (!props.open || !props.client) return;
    const max = props.client.maxDevices || 0;
    enabled.value = max > 0;
    limit.value = max > 0 ? max : 1;
  },
  { immediate: true },
);

const presets = [1, 2, 3, 5];

const exceededAt = computed(() => props.client?.deviceLimitExceededAt);
const activeCount = computed(() => props.client?.activeDeviceCount || 0);

function setOpen(v) { emit('update:open', v); }

function clamp(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.min(n, 99);
}

function onLimitInput(e) {
  limit.value = clamp(e.target.value);
}

function save() {
  emit('save', enabled.value ? clamp(limit.value) : 0);
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="Shield01Icon" :size="20" :stroke-width="2" />
          Device limit
        </DialogTitle>
        <DialogDescription v-if="client">
          Auto-disable <span class="font-medium text-foreground">{{ client.name }}</span> if more than the allowed number of distinct devices use this config concurrently.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-2">
        <div v-if="exceededAt"
             class="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <HugeiconsIcon :icon="AlertCircleIcon" :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p class="font-medium text-amber-700 dark:text-amber-300">Auto-disabled previously</p>
            <p class="text-xs text-muted-foreground">
              Multiple devices were detected on {{ formatDateTime(exceededAt) }}. Re-enable the client (toggle in the
              dashboard) to allow connections again. Tracking is reset on every re-enable or limit change.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg border p-3">
          <div class="space-y-0.5">
            <Label class="text-base">Enforce limit</Label>
            <p class="text-xs text-muted-foreground">When off, any number of devices may use this config.</p>
          </div>
          <Switch v-model="enabled" />
        </div>

        <div :class="['grid gap-2 transition-opacity', enabled ? '' : 'pointer-events-none opacity-50']">
          <Label for="device-limit">Maximum concurrent devices</Label>
          <div class="flex items-center gap-2">
            <Input id="device-limit" type="number" min="1" max="99" :model-value="limit" @input="onLimitInput" class="w-24" />
            <div class="flex gap-1">
              <Button v-for="p in presets" :key="p" size="sm"
                :variant="limit === p ? 'default' : 'outline'"
                @click="limit = p">{{ p }}</Button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            Detection runs every 10 seconds via <code class="rounded bg-muted px-1 py-0.5 text-[11px]">wg show wg0 dump</code>;
            distinct peer endpoints with a fresh handshake within ~3 minutes count as concurrent devices.
          </p>
        </div>

        <Separator v-if="enabled" />

        <div v-if="enabled" class="rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-muted-foreground">
              <HugeiconsIcon :icon="UserMultiple02Icon" :size="14" :stroke-width="2" />
              Currently tracked
            </span>
            <span class="font-medium tabular-nums">{{ activeCount }} / {{ limit }}</span>
          </div>
          <p v-if="activeCount > 0" class="mt-1 text-xs text-muted-foreground">
            Endpoints seen recently. Cleared when the client is re-enabled or the limit is updated.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="setOpen(false)">Cancel</Button>
        <Button @click="save">
          <HugeiconsIcon :icon="CheckmarkCircle02Icon" :size="16" :stroke-width="2" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
