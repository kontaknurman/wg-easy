<script setup>
import { ref, onMounted, onUnmounted, reactive, inject, computed } from 'vue';
import { api } from '@/api/client';
import { toastError, toast } from '@/lib/toast';
import AppHeader from '@/components/AppHeader.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import Button from '@/components/ui/Button.vue';
import ClientCard from '@/components/ClientCard.vue';
import CreateClientDialog from '@/components/CreateClientDialog.vue';
import DeleteClientDialog from '@/components/DeleteClientDialog.vue';
import ScheduleDialog from '@/components/ScheduleDialog.vue';
import DeviceLimitDialog from '@/components/DeviceLimitDialog.vue';
import BandwidthLimitDialog from '@/components/BandwidthLimitDialog.vue';
import QrDialog from '@/components/QrDialog.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import { UserAdd01Icon, UserMultiple02Icon } from '@hugeicons/core-free-icons';

const session = inject('session');
const requiresPassword = computed(() => session.value?.requiresPassword || false);

const clients = ref([]);
const loading = ref(true);
const transferState = reactive({});

const createOpen = ref(false);
const deleteClient = ref(null);
const scheduleClient = ref(null);
const deviceLimitClient = ref(null);
const bandwidthLimitClient = ref(null);
const qrClient = ref(null);

let pollTimer = null;

async function refresh() {
  try {
    const data = await api.getClients();
    for (const c of data) {
      if (!transferState[c.id]) {
        transferState[c.id] = { txPrev: c.transferTx || 0, rxPrev: c.transferRx || 0, txCurrent: 0, rxCurrent: 0 };
      } else {
        const s = transferState[c.id];
        s.txCurrent = Math.max(0, (c.transferTx || 0) - s.txPrev);
        s.rxCurrent = Math.max(0, (c.transferRx || 0) - s.rxPrev);
        s.txPrev = c.transferTx || 0;
        s.rxPrev = c.transferRx || 0;
      }
      c.transferTxCurrent = transferState[c.id].txCurrent;
      c.transferRxCurrent = transferState[c.id].rxCurrent;
    }
    clients.value = data;
  } catch (err) {
    toastError(err);
  } finally {
    loading.value = false;
  }
}

async function createClient(name) {
  try {
    await api.createClient({ name });
    createOpen.value = false;
    toast({ title: 'Client created', description: `"${name}" is ready to connect.` });
    await refresh();
  } catch (err) { toastError(err); }
}

async function confirmDelete() {
  if (!deleteClient.value) return;
  try {
    await api.deleteClient({ clientId: deleteClient.value.id });
    toast({ title: 'Client deleted' });
    deleteClient.value = null;
    await refresh();
  } catch (err) { toastError(err); }
}

async function saveSchedule(schedule) {
  if (!scheduleClient.value) return;
  try {
    await api.updateClientSchedule({ clientId: scheduleClient.value.id, schedule });
    toast({ title: 'Schedule saved' });
    scheduleClient.value = null;
    await refresh();
  } catch (err) { toastError(err); }
}

async function saveDeviceLimit(maxDevices) {
  if (!deviceLimitClient.value) return;
  try {
    await api.updateClientMaxDevices({ clientId: deviceLimitClient.value.id, maxDevices });
    toast({
      title: maxDevices > 0 ? 'Device limit saved' : 'Device limit removed',
      description: maxDevices > 0 ? `Max ${maxDevices} concurrent device${maxDevices === 1 ? '' : 's'}.` : undefined,
    });
    deviceLimitClient.value = null;
    await refresh();
  } catch (err) { toastError(err); }
}

async function saveBandwidthLimit(bandwidthLimit) {
  if (!bandwidthLimitClient.value) return;
  try {
    await api.updateClientBandwidthLimit({ clientId: bandwidthLimitClient.value.id, bandwidthLimit });
    toast({
      title: bandwidthLimit > 0 ? 'Bandwidth limit saved' : 'Bandwidth limit removed',
      description: bandwidthLimit > 0 ? `Capped at ${bandwidthLimit} Mbps.` : undefined,
    });
    bandwidthLimitClient.value = null;
    await refresh();
  } catch (err) { toastError(err); }
}

onMounted(() => {
  refresh();
  pollTimer = setInterval(refresh, 2000);
});
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader :requires-password="requiresPassword" @logged-out="clients = []" />

    <main class="container mx-auto max-w-5xl px-4 py-8">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Clients</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Manage WireGuard peers, schedules and configuration.
          </p>
        </div>
        <Button @click="createOpen = true">
          <HugeiconsIcon :icon="UserAdd01Icon" :size="16" :stroke-width="2" />
          New client
        </Button>
      </div>

      <Card>
        <CardHeader class="flex-row items-center justify-between space-y-0 pb-4">
          <div class="flex items-center gap-2">
            <HugeiconsIcon :icon="UserMultiple02Icon" :size="18" :stroke-width="2" class="text-muted-foreground" />
            <CardTitle class="text-base">All peers</CardTitle>
            <span class="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {{ clients.length }}
            </span>
          </div>
        </CardHeader>

        <div v-if="loading" class="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading…</div>
        <div v-else-if="clients.length === 0" class="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HugeiconsIcon :icon="UserMultiple02Icon" :size="22" :stroke-width="1.5" />
          </div>
          <div>
            <p class="text-sm font-medium">No clients yet</p>
            <CardDescription>Create one to start handing out WireGuard configs.</CardDescription>
          </div>
          <Button size="sm" @click="createOpen = true">
            <HugeiconsIcon :icon="UserAdd01Icon" :size="14" :stroke-width="2" />
            New client
          </Button>
        </div>
        <div v-else class="border-t">
          <ClientCard
            v-for="client in clients" :key="client.id" :client="client"
            @changed="refresh" @schedule="scheduleClient = $event"
            @device-limit="deviceLimitClient = $event"
            @bandwidth-limit="bandwidthLimitClient = $event"
            @delete="deleteClient = $event" @qr="qrClient = $event"
            @error="toastError" />
        </div>
      </Card>
    </main>

    <CreateClientDialog v-model:open="createOpen" @create="createClient" />
    <DeleteClientDialog
      :open="!!deleteClient" :client="deleteClient"
      @update:open="(v) => { if (!v) deleteClient = null }" @confirm="confirmDelete" />
    <ScheduleDialog
      :open="!!scheduleClient" :client="scheduleClient"
      @update:open="(v) => { if (!v) scheduleClient = null }" @save="saveSchedule" />
    <DeviceLimitDialog
      :open="!!deviceLimitClient" :client="deviceLimitClient"
      @update:open="(v) => { if (!v) deviceLimitClient = null }" @save="saveDeviceLimit" />
    <BandwidthLimitDialog
      :open="!!bandwidthLimitClient" :client="bandwidthLimitClient"
      @update:open="(v) => { if (!v) bandwidthLimitClient = null }" @save="saveBandwidthLimit" />
    <QrDialog
      :open="!!qrClient" :client="qrClient"
      @update:open="(v) => { if (!v) qrClient = null }" />
  </div>
</template>
