<script setup>
import { ref, computed, nextTick } from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  UserCircleIcon, Edit02Icon, Clock01Icon, QrCode01Icon, Download04Icon,
  Delete02Icon, ArrowDown01Icon, ArrowUp01Icon, Shield01Icon, FlashIcon,
  EyeIcon, InternetIcon,
} from '@hugeicons/core-free-icons';
import Switch from '@/components/ui/Switch.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Badge from '@/components/ui/Badge.vue';
import { api } from '@/api/client';
import { formatBytes, formatDateTime, formatRelative } from '@/lib/utils';

const props = defineProps({
  client: { type: Object, required: true },
});
const emit = defineEmits(['changed', 'schedule', 'qr', 'delete', 'device-limit', 'bandwidth-limit', 'log', 'source-ip', 'error']);

const editingName = ref(false);
const editingAddress = ref(false);
const nameDraft = ref('');
const addressDraft = ref('');
const nameInput = ref(null);
const addressInput = ref(null);

const isOnline = computed(() => {
  if (!props.client.latestHandshakeAt) return false;
  return Date.now() - new Date(props.client.latestHandshakeAt).getTime() < 1000 * 60 * 3;
});

const scheduleEnabled = computed(() => props.client.schedule?.enabled);
const scheduleActive = computed(() => props.client.scheduleActive !== false);
const deviceLimitOn = computed(() => (props.client.maxDevices || 0) > 0);
const deviceLimitTripped = computed(() => !!props.client.deviceLimitExceededAt && !props.client.enabled);
const bandwidthLimitOn = computed(() => (props.client.bandwidthLimit || 0) > 0);
const loggingOn = computed(() => !!props.client.loggingEnabled);
const sourceIpRestrictOn = computed(() => Array.isArray(props.client.allowedSourceIps) && props.client.allowedSourceIps.length > 0);
const sourceIpDenied = computed(() => !!props.client.sourceIpDeniedAt && !props.client.enabled);

async function startEditName() {
  nameDraft.value = props.client.name;
  editingName.value = true;
  await nextTick();
  nameInput.value?.$el?.focus?.();
  nameInput.value?.$el?.select?.();
}
async function startEditAddress() {
  addressDraft.value = props.client.address;
  editingAddress.value = true;
  await nextTick();
  addressInput.value?.$el?.focus?.();
  addressInput.value?.$el?.select?.();
}

async function saveName() {
  const v = nameDraft.value.trim();
  editingName.value = false;
  if (!v || v === props.client.name) return;
  try {
    await api.updateClientName({ clientId: props.client.id, name: v });
    emit('changed');
  } catch (err) { emit('error', err); }
}
async function saveAddress() {
  const v = addressDraft.value.trim();
  editingAddress.value = false;
  if (!v || v === props.client.address) return;
  try {
    await api.updateClientAddress({ clientId: props.client.id, address: v });
    emit('changed');
  } catch (err) { emit('error', err); }
}

async function toggleEnabled(value) {
  try {
    if (value) await api.enableClient({ clientId: props.client.id });
    else await api.disableClient({ clientId: props.client.id });
    emit('changed');
  } catch (err) { emit('error', err); }
}
</script>

<template>
  <div class="group relative flex flex-col gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4">

    <div class="flex items-center gap-3 sm:flex-1 min-w-0">
      <div class="relative shrink-0">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon :icon="UserCircleIcon" :size="22" :stroke-width="1.5" />
        </div>
        <span v-if="isOnline" class="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
          <span class="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"></span>
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <Input v-if="editingName" ref="nameInput" v-model="nameDraft"
            @keyup.enter="saveName" @keyup.escape="editingName = false" @blur="saveName"
            class="h-7 max-w-[12rem] text-sm" />
          <template v-else>
            <router-link :to="`/clients/${client.id}`"
              :title="'Open details · created ' + formatDateTime(client.createdAt)"
              class="truncate text-base font-medium text-foreground hover:underline">{{ client.name }}</router-link>
            <button class="text-muted-foreground/50 hover:text-foreground"
              title="Rename" @click="startEditName">
              <HugeiconsIcon :icon="Edit02Icon" :size="13" :stroke-width="2" />
            </button>
          </template>
          <Badge v-if="!client.enabled" variant="secondary" class="shrink-0">Disabled</Badge>
          <Badge v-else-if="scheduleEnabled && !scheduleActive" variant="warning" class="shrink-0">Off-hours</Badge>
          <Badge v-else-if="sourceIpDenied" variant="destructive" class="shrink-0">IP denied</Badge>
          <Badge v-else-if="deviceLimitTripped" variant="warning" class="shrink-0">Multi-device</Badge>
          <Badge v-else-if="scheduleEnabled && scheduleActive" variant="success" class="shrink-0">Scheduled</Badge>
          <Badge v-if="deviceLimitOn" variant="outline" class="shrink-0">
            <HugeiconsIcon :icon="Shield01Icon" :size="11" :stroke-width="2" class="mr-1" />
            Max {{ client.maxDevices }}
          </Badge>
          <Badge v-if="bandwidthLimitOn" variant="outline" class="shrink-0">
            <HugeiconsIcon :icon="FlashIcon" :size="11" :stroke-width="2" class="mr-1" />
            {{ client.bandwidthLimit }} Mbps
          </Badge>
          <Badge v-if="sourceIpRestrictOn && !sourceIpDenied" variant="outline" class="shrink-0">
            <HugeiconsIcon :icon="InternetIcon" :size="11" :stroke-width="2" class="mr-1" />
            {{ client.allowedSourceIps.length }} IP{{ client.allowedSourceIps.length === 1 ? '' : 's' }}
          </Badge>
        </div>

        <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <Input v-if="editingAddress" ref="addressInput" v-model="addressDraft"
            @keyup.enter="saveAddress" @keyup.escape="editingAddress = false" @blur="saveAddress"
            class="h-6 max-w-[8rem] text-xs" />
          <button v-else class="group/edit flex items-center gap-1 hover:text-foreground" @click="startEditAddress">
            <span class="font-mono">{{ client.address }}</span>
            <HugeiconsIcon :icon="Edit02Icon" :size="11" :stroke-width="2"
              class="opacity-0 group-hover/edit:opacity-60" />
          </button>

          <span v-if="client.transferTx" class="flex items-center gap-1" :title="'Total down: ' + formatBytes(client.transferTx)">
            <HugeiconsIcon :icon="ArrowDown01Icon" :size="11" :stroke-width="2" />
            {{ formatBytes(client.transferTxCurrent || 0) }}/s
          </span>
          <span v-if="client.transferRx" class="flex items-center gap-1" :title="'Total up: ' + formatBytes(client.transferRx)">
            <HugeiconsIcon :icon="ArrowUp01Icon" :size="11" :stroke-width="2" />
            {{ formatBytes(client.transferRxCurrent || 0) }}/s
          </span>
          <span v-if="client.latestHandshakeAt" :title="'Last seen ' + formatDateTime(client.latestHandshakeAt)">
            · {{ formatRelative(client.latestHandshakeAt) }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1.5 self-end sm:self-center">
      <Switch :model-value="client.enabled" @update:model-value="toggleEnabled" />

      <Button variant="ghost" size="icon" :title="scheduleEnabled ? (scheduleActive ? 'Schedule active' : 'Outside scheduled hours') : 'Schedule'"
        class="relative h-8 w-8" @click="$emit('schedule', client)">
        <HugeiconsIcon :icon="Clock01Icon" :size="16" :stroke-width="2" />
        <span v-if="scheduleEnabled" :class="['absolute right-1 top-1 h-1.5 w-1.5 rounded-full', scheduleActive ? 'bg-emerald-500' : 'bg-muted-foreground/40']"></span>
      </Button>

      <Button variant="ghost" size="icon"
        :title="deviceLimitOn ? `Device limit: ${client.maxDevices} (${client.activeDeviceCount || 0} tracked)` : 'Device limit'"
        class="relative h-8 w-8" @click="$emit('device-limit', client)">
        <HugeiconsIcon :icon="Shield01Icon" :size="16" :stroke-width="2" />
        <span v-if="deviceLimitTripped" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive"></span>
        <span v-else-if="deviceLimitOn" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
      </Button>

      <Button variant="ghost" size="icon"
        :title="bandwidthLimitOn ? `Bandwidth: ${client.bandwidthLimit} Mbps` : 'Bandwidth limit'"
        class="relative h-8 w-8" @click="$emit('bandwidth-limit', client)">
        <HugeiconsIcon :icon="FlashIcon" :size="16" :stroke-width="2" />
        <span v-if="bandwidthLimitOn" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
      </Button>

      <Button variant="ghost" size="icon"
        :title="loggingOn ? 'Connection log (active)' : 'Connection log'"
        class="relative h-8 w-8" @click="$emit('log', client)">
        <HugeiconsIcon :icon="EyeIcon" :size="16" :stroke-width="2" />
        <span v-if="loggingOn" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
      </Button>

      <Button variant="ghost" size="icon"
        :title="sourceIpRestrictOn ? `Source IP restriction (${client.allowedSourceIps.length} entries)` : 'Source IP restriction'"
        class="relative h-8 w-8" @click="$emit('source-ip', client)">
        <HugeiconsIcon :icon="InternetIcon" :size="16" :stroke-width="2" />
        <span v-if="sourceIpDenied" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive"></span>
        <span v-else-if="sourceIpRestrictOn" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
      </Button>

      <Button variant="ghost" size="icon" class="h-8 w-8" title="QR code" @click="$emit('qr', client)">
        <HugeiconsIcon :icon="QrCode01Icon" :size="16" :stroke-width="2" />
      </Button>

      <Button variant="ghost" size="icon" class="h-8 w-8" title="Download .conf" :as="'a'" :href="api.configurationUrl({ clientId: client.id })">
        <HugeiconsIcon :icon="Download04Icon" :size="16" :stroke-width="2" />
      </Button>

      <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete" @click="$emit('delete', client)">
        <HugeiconsIcon :icon="Delete02Icon" :size="16" :stroke-width="2" />
      </Button>
    </div>
  </div>
</template>
