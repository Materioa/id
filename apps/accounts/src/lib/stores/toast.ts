import { writable } from 'svelte/store';

export type Toast = {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
};

export const toasts = writable<Toast[]>([]);

export function addToast(message: string, type: Toast['type'] = 'info', title?: string) {
  const id = Date.now();
  toasts.update(all => [...all, { id, type, message, title }]);
  setTimeout(() => removeToast(id), 4000);
}

export function removeToast(id: number) {
  toasts.update(all => all.filter(t => t.id !== id));
}
