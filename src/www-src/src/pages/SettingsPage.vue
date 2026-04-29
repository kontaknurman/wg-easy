<script setup>
import { ref, reactive, watch, inject } from 'vue';
import { useRouter } from 'vue-router';
import { saveSettings } from '@/lib/settings';
import { toast, toastError } from '@/lib/toast';
import AppHeader from '@/components/AppHeader.vue';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import CardFooter from '@/components/ui/CardFooter.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import Switch from '@/components/ui/Switch.vue';
import Separator from '@/components/ui/Separator.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import {
  Settings02Icon, CheckmarkCircle02Icon, RefreshIcon, ArrowLeft01Icon,
} from '@hugeicons/core-free-icons';

const settings = inject('settings');
const router = useRouter();
const submitting = ref(false);

const form = reactive({
  siteName: '',
  tagline: '',
  loginTitle: '',
  loginSubtitle: '',
  showApiDocs: true,
  footerText: '',
});

function syncFromStore() {
  form.siteName = settings.siteName || '';
  form.tagline = settings.tagline || '';
  form.loginTitle = settings.loginTitle || '';
  form.loginSubtitle = settings.loginSubtitle || '';
  form.showApiDocs = !!settings.showApiDocs;
  form.footerText = settings.footerText || '';
}

watch(() => settings.siteName, syncFromStore, { immediate: true });

async function submit() {
  submitting.value = true;
  try {
    await saveSettings({ ...form });
    toast({ title: 'Settings saved', description: 'Branding updated across the panel.' });
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
