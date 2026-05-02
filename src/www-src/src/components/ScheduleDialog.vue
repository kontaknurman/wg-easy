<script setup>
import { ref, reactive, watch, computed } from 'vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import { Clock01Icon, Globe02Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import Dialog from '@/components/ui/Dialog.vue';
import DialogContent from '@/components/ui/DialogContent.vue';
import DialogHeader from '@/components/ui/DialogHeader.vue';
import DialogTitle from '@/components/ui/DialogTitle.vue';
import DialogDescription from '@/components/ui/DialogDescription.vue';
import DialogFooter from '@/components/ui/DialogFooter.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Switch from '@/components/ui/Switch.vue';
import Label from '@/components/ui/Label.vue';
import Select from '@/components/ui/Select.vue';
import Separator from '@/components/ui/Separator.vue';
import { defaultSchedule, listTimezones, SCHEDULE_DAY_KEYS, SCHEDULE_DAY_LABELS } from '@/lib/utils';

const props = defineProps({
  open: { type: Boolean, default: false },
  client: { type: Object, default: null },
});
const emit = defineEmits(['update:open', 'save']);

const schedule = reactive(defaultSchedule());
const allHours = reactive({ start: '08:00', end: '17:00' });

const timezoneOptions = computed(() => listTimezones().map(tz => ({ value: tz, label: tz })));
const dayList = computed(() => SCHEDULE_DAY_KEYS.map(key => ({ key, label: SCHEDULE_DAY_LABELS[key] })));

const allDaysActive = computed({
  get() {
    return SCHEDULE_DAY_KEYS.every(k => schedule.days[k]?.active);
  },
  set(value) {
    for (const k of SCHEDULE_DAY_KEYS) schedule.days[k].active = !!value;
  },
});

watch(
  [() => props.open, () => props.client?.id],
  () => {
    if (!props.open || !props.client) return;
    const incoming = props.client.schedule || defaultSchedule();
    schedule.enabled = !!incoming.enabled;
    schedule.timezone = incoming.timezone || 'UTC';
    if (timezoneOptions.value.findIndex(o => o.value === schedule.timezone) === -1) {
      try {
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezoneOptions.value.findIndex(o => o.value === browserTz) !== -1) {
          schedule.timezone = browserTz;
        }
      } catch { /* ignore */ }
    }
    for (const k of SCHEDULE_DAY_KEYS) {
      const d = incoming.days?.[k];
      schedule.days[k] = {
        active: d ? !!d.active : false,
        start: d?.start || '00:00',
        end: d?.end || '23:59',
      };
    }
    allHours.start = '08:00';
    allHours.end = '17:00';
  },
  { immediate: true },
);

function applyAllHours() {
  for (const k of SCHEDULE_DAY_KEYS) {
    schedule.days[k].start = allHours.start;
    schedule.days[k].end = allHours.end;
  }
}

function save() {
  emit('save', JSON.parse(JSON.stringify(schedule)));
}

function setOpen(v) { emit('update:open', v); }
</script>

<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <HugeiconsIcon :icon="Clock01Icon" :size="20" :stroke-width="2" />
          Schedule
        </DialogTitle>
        <DialogDescription v-if="client">
          Restrict <span class="font-medium text-foreground">{{ client.name }}</span> to specific hours per day.
          Outside the active window the peer is removed from WireGuard.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-5 py-2">
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div class="space-y-0.5">
            <Label class="text-base">Enable schedule</Label>
            <p class="text-xs text-muted-foreground">When off, the client follows only the master enable flag.</p>
          </div>
          <Switch v-model="schedule.enabled" />
        </div>

        <div class="grid gap-2">
          <Label class="flex items-center gap-2">
            <HugeiconsIcon :icon="Globe02Icon" :size="14" :stroke-width="2" />
            Timezone
          </Label>
          <Select v-model="schedule.timezone" :options="timezoneOptions" placeholder="Select timezone…" />
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <Label class="text-base">All days</Label>
              <p class="text-xs text-muted-foreground">Toggle activates or deactivates every day at once.</p>
            </div>
            <Switch v-model="allDaysActive" />
          </div>

          <div class="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <span class="w-20 text-sm text-muted-foreground">Set hours</span>
            <Input v-model="allHours.start" type="time" class="h-8 w-28" />
            <span class="text-muted-foreground">–</span>
            <Input v-model="allHours.end" type="time" class="h-8 w-28" />
            <Button variant="outline" size="sm" @click="applyAllHours">Apply</Button>
          </div>
        </div>

        <div class="space-y-2">
          <div v-for="day in dayList" :key="day.key"
               class="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/40 transition-colors">
            <Switch v-model="schedule.days[day.key].active" />
            <span class="w-24 text-sm font-medium">{{ day.label }}</span>
            <Input
              v-model="schedule.days[day.key].start" type="time"
              :disabled="!schedule.days[day.key].active"
              class="h-8 w-28" />
            <span class="text-muted-foreground">–</span>
            <Input
              v-model="schedule.days[day.key].end" type="time"
              :disabled="!schedule.days[day.key].active"
              class="h-8 w-28" />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="setOpen(false)">Cancel</Button>
        <Button @click="save">
          <HugeiconsIcon :icon="CheckmarkCircle02Icon" :size="16" :stroke-width="2" />
          Save schedule
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
