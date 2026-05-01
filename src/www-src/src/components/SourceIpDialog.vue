<script setup>
import { ref, watch, computed } from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  InternetIcon, Add01Icon, Cancel01Icon, AlertCircleIcon, CheckmarkCircle02Icon,
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
import { formatDateTime } from '@/lib/utils';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'save']);

const enabled = ref(false);
const list = ref([]);
const draft = ref('');

const cidrPattern = /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$/;

function isValidCidr(value) {
  if (!cidrPattern.test(value)) return false;
  const [ipPart, maskPart] = value.split('/');
  for (const block of ipPart.split('.')) {
    const n = parseInt(block, 10);
    if (Number.isNaN(n) || n < 0 || n > 255 || String(n) !== block) return false;
  }
  if (maskPart !== undefined) {
    const m = parseInt(maskPart, 10);
    if (Number.isNaN(m) || m < 0 || m > 32 || String(m) !== maskPart) return false;
  }
  return true;
}

const draftValid = computed(() => draft.value.trim().length > 0 && isValidCidr(draft.value.trim()));
const draftDuplicate = computed(() => list.value.includes(draft.value.trim()));
const deniedAt = computed(() => props.client?.sourceIpDeniedAt);

watch(
  () => [props.open, props.client?.id],
  () => {
    if (!props.open || !props.client) return;
    const incoming = Array.isArray(props.client.allowedSourceIps) ? props.client.allowedSourceIps : [];
    enabled.value = incoming.length > 0;
    list.value = incoming.slice();
    draft.value = '';
  },
  { immediate: true },
);

function setOpen(v) { emit('update:open', v); }

function add() {
  const v = draft.value.trim();
  if (!v || !isValidCidr(v) || list.value.includes(v) || list.value.length >= 50) return;
  // implicit /32 for plain IP entries
  const normalized = v.includes('/') ? v : `${v}/32`;
  if (list.value.includes(normalized)) {
    draft.value = '';
    return;
  }
  list.value.push(normalized);
  draft.value = '';
}

function remove(i) {
  list.value.splice(i, 1);
}

function save() {
  emit('save', enabled.value ? list.value.slice() : []);
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="InternetIcon" :size="20" :stroke-width="2" />
          Allowed source IPs
        </DialogTitle>
        <DialogDescription v-if="client">
          Restrict <span class="font-medium text-foreground">{{ client.name }}</span> to connect only from specific
          public IPv4 addresses or CIDRs.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-2">
        <div v-if="deniedAt"
             class="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <HugeiconsIcon :icon="AlertCircleIcon" :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p class="font-medium text-amber-700 dark:text-amber-300">Auto-disabled previously</p>
            <p class="text-xs text-muted-foreground">
              Blocked source endpoint detected on {{ formatDateTime(deniedAt) }}. Re-enable the client (toggle in
              dashboard) — or update the allow-list — to allow connections again.
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-lg border p-3">
          <div class="space-y-0.5">
            <Label class="text-base">Restrict source IPs</Label>
            <p class="text-xs text-muted-foreground">When off, the peer can connect from any public IP (default).</p>
          </div>
          <Switch v-model="enabled" />
        </div>

        <div :class="['grid gap-2 transition-opacity', enabled ? '' : 'pointer-events-none opacity-50']">
          <Label>Allow-list (IPv4 / CIDR)</Label>

          <div class="flex items-center gap-2">
            <Input v-model="draft" placeholder="e.g. 203.0.113.5 or 192.168.1.0/24"
                   class="font-mono text-sm h-8" @keyup.enter="add" />
            <Button variant="outline" size="sm" :disabled="!draftValid || draftDuplicate || list.length >= 50" @click="add">
              <HugeiconsIcon :icon="Add01Icon" :size="14" :stroke-width="2" />
              Add
            </Button>
          </div>
          <p v-if="draft && !draftValid" class="text-xs text-destructive">Not a valid IPv4 or CIDR.</p>
          <p v-else-if="draftDuplicate" class="text-xs text-amber-700 dark:text-amber-400">Already in the list.</p>

          <ul v-if="list.length" class="rounded-md border divide-y bg-muted/20 max-h-48 overflow-y-auto">
            <li v-for="(entry, i) in list" :key="entry" class="flex items-center justify-between px-3 py-1.5 text-sm">
              <code class="font-mono">{{ entry }}</code>
              <button class="text-muted-foreground hover:text-destructive" :title="`Remove ${entry}`" @click="remove(i)">
                <HugeiconsIcon :icon="Cancel01Icon" :size="14" :stroke-width="2" />
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-muted-foreground">No entries yet — peer will be auto-disabled until at least one CIDR is added (when restriction is on).</p>

          <p class="text-xs text-muted-foreground">
            Detection runs every 10 seconds via <code class="rounded bg-muted px-1 py-0.5 text-[11px]">wg show wg0 dump</code>.
            If the peer's current endpoint IP is not in the list, it is auto-disabled. Mobile clients roaming
            Wi-Fi/4G can trip this — list both networks if needed.
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
