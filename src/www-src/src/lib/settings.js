import { reactive, watch } from 'vue';
import { api } from '@/api/client';

const DEFAULTS = {
  siteName: 'VPN Panel',
  tagline: 'Manage your WireGuard peers',
  loginTitle: '',
  loginSubtitle: 'Sign in to continue',
  showApiDocs: true,
  footerText: '',
};

export const settings = reactive({ ...DEFAULTS });

export async function loadSettings() {
  try {
    const fresh = await api.getSettings();
    Object.assign(settings, { ...DEFAULTS, ...fresh });
  } catch (err) {
    // keep defaults silently — settings endpoint is public so failure is unusual
    // eslint-disable-next-line no-console
    console.warn('settings load failed', err && err.message);
  }
}

export async function saveSettings(patch) {
  const updated = await api.updateSettings(patch);
  Object.assign(settings, { ...DEFAULTS, ...updated });
  return updated;
}

export function siteName() {
  return settings.siteName || DEFAULTS.siteName;
}

watch(
  () => settings.siteName,
  (v) => {
    if (typeof document !== 'undefined') {
      document.title = v || DEFAULTS.siteName;
    }
  },
  { immediate: true },
);
