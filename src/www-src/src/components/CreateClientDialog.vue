<script setup>
import { ref, watch, computed } from 'vue';
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
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  UserAdd01Icon, SlidersHorizontalIcon, ArrowDown01Icon, ArrowRight01Icon,
  Add01Icon, Cancel01Icon,
} from '@hugeicons/core-free-icons';

const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['update:open', 'create']);

const name = ref('');
const showAdvanced = ref(false);
const enabled = ref(true);
const address = ref('');
const maxDevices = ref(0);
const bandwidthLimit = ref(0);
const loggingEnabled = ref(false);
const allowedSourceIps = ref([]);
const cidrDraft = ref('');

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

const cidrValid = computed(() => cidrDraft.value.trim().length > 0 && isValidCidr(cidrDraft.value.trim()));
const cidrDup = computed(() => {
  const v = cidrDraft.value.trim();
  return v && (allowedSourceIps.value.includes(v) || allowedSourceIps.value.includes(`${v}/32`));
});

watch(() => props.open, (v) => {
  if (v) {
    name.value = '';
    showAdvanced.value = false;
    enabled.value = true;
    address.value = '';
    maxDevices.value = 0;
    bandwidthLimit.value = 0;
    loggingEnabled.value = false;
    allowedSourceIps.value = [];
    cidrDraft.value = '';
  }
});

function setOpen(v) { emit('update:open', v); }

function addCidr() {
  const v = cidrDraft.value.trim();
  if (!v || !isValidCidr(v) || allowedSourceIps.value.length >= 50) return;
  const normalized = v.includes('/') ? v : `${v}/32`;
  if (allowedSourceIps.value.includes(normalized)) return;
  allowedSourceIps.value.push(normalized);
  cidrDraft.value = '';
}

function removeCidr(i) {
  allowedSourceIps.value.splice(i, 1);
}

function clampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < min) return min;
  return Math.min(n, max);
}

function submit() {
  const trimmed = name.value.trim();
  if (!trimmed) return;
  const payload = { name: trimmed };
  if (!enabled.value) payload.enabled = false;
  if (address.value.trim()) payload.address = address.value.trim();
  if (maxDevices.value > 0) payload.maxDevices = clampInt(maxDevices.value, 0, 99);
  if (bandwidthLimit.value > 0) payload.bandwidthLimit = clampInt(bandwidthLimit.value, 0, 10000);
  if (loggingEnabled.value) payload.loggingEnabled = true;
  if (allowedSourceIps.value.length > 0) payload.allowedSourceIps = allowedSourceIps.value.slice();
  emit('create', payload);
}
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="UserAdd01Icon" :size="20" :stroke-width="2" />
          New client
        </DialogTitle>
        <DialogDescription>Add a new WireGuard peer. Keypair and IP are generated automatically; advanced settings are optional.</DialogDescription>
      </DialogHeader>

      <form class="grid gap-3" @submit.prevent="submit">
        <div class="grid gap-2">
          <Label for="client-name">Name</Label>
          <Input id="client-name" v-model="name" placeholder="e.g. phone, laptop" autofocus />
        </div>

        <button
          type="button"
          class="-mx-1 mt-1 flex items-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          @click="showAdvanced = !showAdvanced">
          <HugeiconsIcon :icon="showAdvanced ? ArrowDown01Icon : ArrowRight01Icon" :size="14" :stroke-width="2" />
          <HugeiconsIcon :icon="SlidersHorizontalIcon" :size="14" :stroke-width="2" />
          Advanced settings
        </button>

        <div v-if="showAdvanced" class="grid gap-3 rounded-md border bg-muted/20 p-3">
          <div class="flex items-center justify-between">
            <Label class="text-sm">Enabled on create</Label>
            <Switch v-model="enabled" />
          </div>

          <div class="grid gap-1.5">
            <Label for="client-addr" class="text-xs">Tunnel address (IPv4)</Label>
            <Input id="client-addr" v-model="address" placeholder="auto (e.g. 10.8.0.42)" class="h-8 font-mono text-sm" />
            <p class="text-[11px] text-muted-foreground">Leave empty to auto-allocate the next free IP in the subnet.</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="grid gap-1.5">
              <Label for="client-maxdev" class="text-xs">Max devices</Label>
              <Input id="client-maxdev" type="number" min="0" max="99" v-model.number="maxDevices" class="h-8" />
              <p class="text-[11px] text-muted-foreground">0 = unlimited</p>
            </div>
            <div class="grid gap-1.5">
              <Label for="client-bw" class="text-xs">Bandwidth (Mbps)</Label>
              <Input id="client-bw" type="number" min="0" max="10000" v-model.number="bandwidthLimit" class="h-8" />
              <p class="text-[11px] text-muted-foreground">0 = unlimited</p>
            </div>
          </div>

          <div class="flex items-start justify-between gap-3">
            <div>
              <Label class="text-sm">Logging</Label>
              <p class="text-[11px] text-muted-foreground">Capture connection metadata (DNS / SNI / Host). Privacy-sensitive.</p>
            </div>
            <Switch v-model="loggingEnabled" />
          </div>

          <Separator />

          <div class="grid gap-1.5">
            <Label class="text-xs">Allowed source IPs (CIDR)</Label>
            <div class="flex items-center gap-2">
              <Input v-model="cidrDraft" placeholder="e.g. 203.0.113.5 or 192.168.1.0/24"
                     class="h-8 font-mono text-sm" @keyup.enter.prevent="addCidr" />
              <Button type="button" variant="outline" size="sm" :disabled="!cidrValid || cidrDup" @click="addCidr">
                <HugeiconsIcon :icon="Add01Icon" :size="14" :stroke-width="2" />
                Add
              </Button>
            </div>
            <p v-if="cidrDraft && !cidrValid" class="text-[11px] text-destructive">Invalid IPv4/CIDR.</p>
            <p v-else-if="cidrDup" class="text-[11px] text-amber-700 dark:text-amber-400">Already in the list.</p>

            <ul v-if="allowedSourceIps.length" class="rounded-md border divide-y bg-background max-h-32 overflow-y-auto">
              <li v-for="(entry, i) in allowedSourceIps" :key="entry"
                  class="flex items-center justify-between px-2.5 py-1.5 text-xs">
                <code class="font-mono">{{ entry }}</code>
                <button type="button" class="text-muted-foreground hover:text-destructive" @click="removeCidr(i)">
                  <HugeiconsIcon :icon="Cancel01Icon" :size="12" :stroke-width="2" />
                </button>
              </li>
            </ul>
            <p class="text-[11px] text-muted-foreground">Empty list = no source-IP restriction.</p>
          </div>

          <p class="text-[11px] text-muted-foreground border-t pt-2">
            Schedule must be configured from the client card after creation.
          </p>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="setOpen(false)">Cancel</Button>
        <Button :disabled="!name.trim()" @click="submit">Create client</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
