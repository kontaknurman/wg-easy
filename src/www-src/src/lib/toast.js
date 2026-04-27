import { reactive } from 'vue';

export const toasts = reactive([]);
let nextId = 0;

export function toast({ title, description, variant = 'default', duration = 4000 } = {}) {
  const id = ++nextId;
  toasts.push({ id, title, description, variant });
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
}

export function dismissToast(id) {
  const i = toasts.findIndex(t => t.id === id);
  if (i !== -1) toasts.splice(i, 1);
}

export function toastError(err) {
  toast({
    title: 'Error',
    description: (err && (err.message || err.toString())) || 'Something went wrong',
    variant: 'destructive',
  });
}
