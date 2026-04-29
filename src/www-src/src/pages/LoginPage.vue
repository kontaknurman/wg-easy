<script setup>
import { ref, inject, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/client';
import { toastError } from '@/lib/toast';
import Card from '@/components/ui/Card.vue';
import CardHeader from '@/components/ui/CardHeader.vue';
import CardTitle from '@/components/ui/CardTitle.vue';
import CardDescription from '@/components/ui/CardDescription.vue';
import CardContent from '@/components/ui/CardContent.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';
import Label from '@/components/ui/Label.vue';
import { HugeiconsIcon } from '@hugeicons/vue';
import { ShieldEnergyIcon, LockKeyIcon } from '@hugeicons/core-free-icons';

const refreshSession = inject('refreshSession');
const settings = inject('settings');

const password = ref('');
const submitting = ref(false);
const router = useRouter();

const title = computed(() => settings?.loginTitle || settings?.siteName || 'VPN Panel');
const subtitle = computed(() => settings?.loginSubtitle || 'Sign in to continue');

async function login() {
  if (!password.value) return;
  submitting.value = true;
  try {
    await api.createSession({ password: password.value });
    if (refreshSession) await refreshSession();
    router.push('/');
  } catch (err) {
    toastError(err);
  } finally {
    submitting.value = false;
    password.value = '';
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <Card class="w-full max-w-sm">
      <CardHeader class="items-center text-center">
        <div class="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <HugeiconsIcon :icon="ShieldEnergyIcon" :size="24" :stroke-width="2" />
        </div>
        <CardTitle>{{ title }}</CardTitle>
        <CardDescription>{{ subtitle }}</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-3" @submit.prevent="login">
          <div class="grid gap-2">
            <Label for="password">Password</Label>
            <Input id="password" v-model="password" type="password" autofocus placeholder="••••••••" />
          </div>
          <Button type="submit" class="mt-2 w-full" :disabled="submitting || !password">
            <HugeiconsIcon :icon="LockKeyIcon" :size="16" :stroke-width="2" />
            {{ submitting ? 'Signing in…' : 'Sign in' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
