<script setup>
import {
  ref, reactive, watch, inject, computed, onMounted,
} from 'vue';
import { useRouter } from 'vue-router';
import { saveSettings } from '@/lib/settings';
import { api } from '@/api/client';
import { toast, toastError } from '@/lib/toast';
import AppHeader from '@/components/AppHeader.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Switch from '@/components/ui/Switch.vue';
import Select from '@/components/ui/Select.vue';
import Separator from '@/components/ui/Separator.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  Settings02Icon, CheckmarkCircle02Icon, RefreshIcon, ArrowLeft01Icon,
  InternetIcon, AlertCircleIcon, Add01Icon, Cancel01Icon,
} from '@hugeicons/core-free-icons';

const settings = inject('settings');
const router = useRouter();
const submitting = ref(false);
const myIp = ref(null);

const form = reactive({
  siteName: '',
  tagline: '',
  loginTitle: '',
  loginSubtitle: '',
  showApiDocs: true,
  footerText: '',
  apiAllowedIpsEnabled: false,
  apiAllowedIps: [],
  trustProxyHeader: 'auto',
});

const cidrDraft = ref('');

const trustProxyOptions = [
  { value: 'auto', label: 'auto (recommended for Cloudflare)' },
  { value: 'cf-connecting-ip', label: 'Always trust CF-Connecting-IP' },
  { value: 'x-forwarded-for', label: 'Trust first X-Forwarded-For hop' },
  { value: 'none', label: 'Direct socket only' },
];

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

const draftValid = computed(() => cidrDraft.value.trim() && isValidCidr(cidrDraft.value.trim()));
const draftDup = computed(() => {
  const v = cidrDraft.value.trim();
  return v && (form.apiAllowedIps.includes(v) || form.apiAllowedIps.includes(`${v}/32`));
});

const myIpInList = computed(() => {
  if (!myIp.value || !myIp.value.ip) return false;
  return form.apiAllowedIps.some((cidr) => {
    const trimmed = cidr.trim();
    return trimmed === `${myIp.value.ip}/32` || trimmed === myIp.value.ip;
  });
});

const lockoutRisk = computed(() => form.apiAllowedIpsEnabled
  && form.apiAllowedIps.length > 0
  && myIp.value && myIp.value.ip
  && !myIpInList.value);

function syncFromStore() {
  form.siteName = settings.siteName || '';
  form.tagline = settings.tagline || '';
  form.loginTitle = settings.loginTitle || '';
  form.loginSubtitle = settings.loginSubtitle || '';
  form.showApiDocs = !!settings.showApiDocs;
  form.footerText = settings.footerText || '';
  form.apiAllowedIpsEnabled = !!settings.apiAllowedIpsEnabled;
  form.apiAllowedIps = Array.isArray(settings.apiAllowedIps) ? settings.apiAllowedIps.slice() : [];
  form.trustProxyHeader = settings.trustProxyHeader || 'auto';
}

watch(() => settings.siteName, syncFromStore, { immediate: true });

onMounted(async () => {
  try {
    myIp.value = await api.getMyIp();
  } catch { /* ignore */ }
});

function addCidr() {
  const v = cidrDraft.value.trim();
  if (!v || !isValidCidr(v) || form.apiAllowedIps.length >= 50) return;
  const normalized = v.includes('/') ? v : `${v}/32`;
  if (form.apiAllowedIps.includes(normalized)) {
    cidrDraft.value = '';
    return;
  }
  form.apiAllowedIps.push(normalized);
  cidrDraft.value = '';
}

function addMyIp() {
  if (!myIp.value || !myIp.value.ip) return;
  const entry = `${myIp.value.ip}/32`;
  if (!form.apiAllowedIps.includes(entry)) form.apiAllowedIps.push(entry);
}

function removeCidr(i) {
  form.apiAllowedIps.splice(i, 1);
}

async function submit() {
  if (lockoutRisk.value) {
    const ok = window.confirm(`Your current IP ${myIp.value.ip} is NOT in the allow-list. Saving will lock you out and require editing wg0.json on the host to recover. Continue?`);
    if (!ok) return;
  }
  submitting.value = true;
  try {
    await saveSettings({ ...form, apiAllowedIps: form.apiAllowedIps.slice() });
    toast({ title: 'Settings saved', description: 'Panel updated.' });
  } catch (err) {
    toastError(err);
  } finally {
    submitting.value = false;
  }
}

function reset() {
  syncFromStore();
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <AppHeader />

    <main class="container mx-auto max-w-3xl px-4 py-8">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" class="mb-2 -ml-3" @click="router.push('/')">
            <HugeiconsIcon :icon="ArrowLeft01Icon" :size="14" :stroke-width="2" />
            Dashboard
          </Button>
          <h1 class="text-3xl font-bold tracking-tight flex items-center gap-2">
            <HugeiconsIcon :icon="Settings02Icon" :size="26" :stroke-width="2" />
            Site settings
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Customize how the admin panel is branded — affects header, login page, browser tab, and API docs.
          </p>
        </div>
      </div>

      <form class="space-y-6" @submit.prevent="submit">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>The site name appears in the header, the browser tab title, the login page, and the API docs.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="grid gap-2">
              <Label for="siteName">Site name <span class="text-muted-foreground">(required)</span></Label>
              <Input id="siteName" v-model="form.siteName" maxlength="60" placeholder="VPN Panel" />
            </div>
            <div class="grid gap-2">
              <Label for="tagline">Tagline</Label>
              <Input id="tagline" v-model="form.tagline" maxlength="200" placeholder="Manage your WireGuard peers" />
              <p class="text-xs text-muted-foreground">Shown under the dashboard heading.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Login page</CardTitle>
            <CardDescription>Override the copy shown on the login screen. Leave the title empty to fall back to the site name.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="grid gap-2">
              <Label for="loginTitle">Login title</Label>
              <Input id="loginTitle" v-model="form.loginTitle" maxlength="60" placeholder="(falls back to site name)" />
            </div>
            <div class="grid gap-2">
              <Label for="loginSubtitle">Login subtitle</Label>
              <Input id="loginSubtitle" v-model="form.loginSubtitle" maxlength="200" placeholder="Sign in to continue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Panel options</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="flex items-center justify-between rounded-lg border p-3">
              <div class="space-y-0.5">
                <Label class="text-base">Show API docs link</Label>
                <p class="text-xs text-muted-foreground">When off, the link is hidden from the header. The page itself remains reachable at <code class="rounded bg-muted px-1 py-0.5 text-[11px]">/docs</code>.</p>
              </div>
              <Switch v-model="form.showApiDocs" />
            </div>
            <Separator />
            <div class="grid gap-2">
              <Label for="footerText">Footer text</Label>
              <Input id="footerText" v-model="form.footerText" maxlength="500" placeholder="(empty = no footer)" />
              <p class="text-xs text-muted-foreground">Optional text shown below the dashboard content.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <HugeiconsIcon :icon="InternetIcon" :size="18" :stroke-width="2" />
              API access control
            </CardTitle>
            <CardDescription>Restrict which public IPs can reach the API and the dashboard. Cloudflare-aware.</CardDescription>
          </CardHeader>
          <CardContent class="grid gap-4">
            <div class="flex items-center justify-between rounded-lg border p-3">
              <div class="space-y-0.5">
                <Label class="text-base">Restrict by source IP</Label>
                <p class="text-xs text-muted-foreground">When off, the panel accepts requests from any IP (default).</p>
              </div>
              <Switch v-model="form.apiAllowedIpsEnabled" />
            </div>

            <div :class="['grid gap-3 transition-opacity', form.apiAllowedIpsEnabled ? '' : 'pointer-events-none opacity-60']">
              <div class="grid gap-2">
                <Label>Trust mode</Label>
                <Select v-model="form.trustProxyHeader" :options="trustProxyOptions" />
                <p class="text-xs text-muted-foreground">
                  <strong>auto</strong> trusts <code class="rounded bg-muted px-1 py-0.5 text-[11px]">CF-Connecting-IP</code>
                  only when the connection arrives from a Cloudflare IP range — safe by default. Pick <strong>cf-connecting-ip</strong>
                  if you front the panel directly with Cloudflare and your network blocks non-Cloudflare reachability.
                </p>
              </div>

              <div v-if="myIp" class="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-muted-foreground">Your IP:</span>
                  <code class="font-mono">{{ myIp.ip || '?' }}</code>
                  <span v-if="myIp.fromCloudflare"
                        class="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">via Cloudflare</span>
                  <Button v-if="!myIpInList && myIp.ip" type="button" size="sm" variant="outline" class="ml-auto" @click="addMyIp">
                    <HugeiconsIcon :icon="Add01Icon" :size="13" :stroke-width="2" />
                    Add to allow-list
                  </Button>
                  <span v-else-if="myIpInList" class="ml-auto text-xs text-emerald-600 dark:text-emerald-400">In list</span>
                </div>
                <div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  <div>Direct: <code>{{ myIp.direct || '?' }}</code></div>
                  <div>Mode: <code>{{ myIp.trustProxyHeader }}</code></div>
                  <div v-if="myIp.cfConnectingIp">CF-Connecting-IP: <code>{{ myIp.cfConnectingIp }}</code></div>
                  <div v-if="myIp.xForwardedFor">X-Forwarded-For: <code>{{ myIp.xForwardedFor }}</code></div>
                </div>
              </div>

              <div class="grid gap-2">
                <Label>Allow-list (IPv4 / CIDR)</Label>
                <div class="flex items-center gap-2">
                  <Input v-model="cidrDraft" placeholder="e.g. 203.0.113.5 or 192.168.1.0/24"
                         class="font-mono text-sm h-8" @keyup.enter.prevent="addCidr" />
                  <Button type="button" variant="outline" size="sm" :disabled="!draftValid || draftDup" @click="addCidr">
                    <HugeiconsIcon :icon="Add01Icon" :size="14" :stroke-width="2" />
                    Add
                  </Button>
                </div>
                <p v-if="cidrDraft && !draftValid" class="text-xs text-destructive">Invalid IPv4 / CIDR.</p>
                <p v-else-if="draftDup" class="text-xs text-amber-700 dark:text-amber-400">Already in the list.</p>

                <ul v-if="form.apiAllowedIps.length" class="rounded-md border divide-y bg-background max-h-48 overflow-y-auto">
                  <li v-for="(entry, i) in form.apiAllowedIps" :key="entry"
                      class="flex items-center justify-between px-3 py-1.5 text-sm">
                    <code class="font-mono">{{ entry }}</code>
                    <button type="button" class="text-muted-foreground hover:text-destructive" @click="removeCidr(i)">
                      <HugeiconsIcon :icon="Cancel01Icon" :size="14" :stroke-width="2" />
                    </button>
                  </li>
                </ul>
                <p v-else class="text-xs text-muted-foreground">
                  No entries — gate stays off until at least one CIDR is added.
                </p>
              </div>

              <div v-if="lockoutRisk"
                   class="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <HugeiconsIcon :icon="AlertCircleIcon" :size="18" :stroke-width="2" class="mt-0.5 shrink-0 text-destructive" />
                <div>
                  <p class="font-medium text-destructive">Lock-out warning</p>
                  <p class="text-xs text-muted-foreground">
                    Your current IP <code class="rounded bg-background/40 px-1">{{ myIp?.ip }}</code> is not in the
                    allow-list. Saving will block this browser. Recovery requires editing
                    <code class="rounded bg-background/40 px-1">wg0.json</code> on the host to disable the gate.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div class="flex justify-end gap-2">
          <Button variant="outline" type="button" :disabled="submitting" @click="reset">
            <HugeiconsIcon :icon="RefreshIcon" :size="16" :stroke-width="2" />
            Reset
          </Button>
          <Button type="submit" :disabled="submitting || !form.siteName.trim()">
            <HugeiconsIcon :icon="CheckmarkCircle02Icon" :size="16" :stroke-width="2" />
            {{ submitting ? 'Saving…' : 'Save settings' }}
          </Button>
        </div>
      </form>
    </main>
  </div>
</template>
