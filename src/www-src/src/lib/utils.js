import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes, decimals = 2) {
  if (!bytes || Number.isNaN(bytes)) return '0 B';
  const k = 1000;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(value));
}

export function formatInTimezone(value, timezone) {
  if (!value) return '';
  const date = new Date(value);
  const opts = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  if (timezone && timezone !== 'UTC') opts.timeZoneName = 'short';
  if (timezone) opts.timeZone = timezone;
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  }
}

export function formatTimeOnly(value, timezone) {
  if (!value) return '';
  const date = new Date(value);
  const opts = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  if (timezone) opts.timeZone = timezone;
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  }
}

export function formatRelative(value) {
  if (!value) return 'never';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 0) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.round(diffMonth / 12)}y ago`;
}

export const SCHEDULE_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const SCHEDULE_DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export function defaultSchedule() {
  const days = {};
  for (const k of SCHEDULE_DAY_KEYS) days[k] = { active: false, start: '00:00', end: '23:59' };
  return { enabled: false, timezone: 'UTC', days };
}

export function listTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch { /* ignore */ }
  return [
    'UTC',
    'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura',
    'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Hong_Kong',
    'Asia/Tokyo', 'Asia/Seoul', 'Asia/Manila', 'Asia/Kolkata', 'Asia/Dubai',
    'Asia/Shanghai', 'Asia/Taipei',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
    'Europe/Madrid', 'Europe/Moscow',
    'America/New_York', 'America/Chicago', 'America/Denver',
    'America/Los_Angeles', 'America/Sao_Paulo',
    'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland',
  ];
}
