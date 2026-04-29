<script setup>
import { ref, watch } from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  FlashIcon, CheckmarkCircle02Icon, AlertCircleIcon,
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

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'save']);

const enabled = ref(false);
const limit = ref(10);

watch(
  () => [props.open, props.client?.id],
  () => {
    if (!props.open || !props.client) return;
    const cap = props.client.bandwidthLimit || 0;
    enabled.value = cap > 0;
    limit.value = cap > 0 ? cap : 10;
  },
  { immediate: true },
);

const presets = [1, 5, 10, 25, 50, 100];

function setOpen(v) { emit('update:open', v); }

function clamp(v) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.min(n, 10000);
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
          <HugeiconsIcon :icon="FlashIcon" :size="20" :stroke-width="2" />
          Bandwidth limit
        </DialogTitle>
        <DialogDescription v-if="client">
          Cap traffic for <span class="font-medium text-foreground">{{ client.name }}</span> using Linux Traffic Control on the WireGuard interface.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-2">
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div class="space-y-0.5">
            <Label class="text-base">Enforce limit</Label>
            <p class="text-xs text-muted-foreground">When off, the peer is uncapped.</p>
          </div>
          <Switch v-model="enabled" />
        </div>

        <div :class="['grid gap-2 transition-opacity', enabled ? '' : 'pointer-events-none opacity-50']">
          <Label for="bw-limit">Maximum throughput</Label>
          <div class="flex items-center gap-2">
            <Input id="bw-limit" type="number" min="1" max="10000" :model-value="limit" @input="onLimitInput" class="w-28" />
            <span class="text-sm text-muted-foreground">Mbps</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <Button v-for="p in presets" :key="p" size="sm"
              :variant="limit === p ? 'default' : 'outline'"
              @click="limit = p">{{ p }} Mbps</Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Applied symmetrically: download (server → client) is shaped via HTB on
            <code class="rounded bg-muted px-1 py-0.5 text-[11px]">wg0</code> egress, upload is enforced via an
            ingress <code class="rounded bg-muted px-1 py-0.5 text-[11px]">police</code> filter that drops excess.
          </p>
        </div>

        <div class="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <HugeiconsIcon :icon="AlertCircleIcon" :size="16" :stroke-width="2" class="mt-0.5 shrink-0" />
          <p>
            Requires <code class="rounded bg-background px-1 py-0.5 text-[11px]">tc</code>
            (<code class="rounded bg-background px-1 py-0.5 text-[11px]">iproute2-tc</code>) on the host. Limits do
            not survive interface restart unless the panel is the one bringing it up — rules are reapplied on every
            config change and on the schedule ticker.
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
