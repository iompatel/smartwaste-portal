import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; callback: () => void };
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = computed(() => this._toasts());

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  show(toast: Omit<Toast, 'id'>): string {
    const id = this.generateId();
    const newToast: Toast = { ...toast, id };
    this._toasts.update((t) => [...t, newToast]);

    const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 5000);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  success(title: string, message?: string, options?: Partial<Toast>): string {
    return this.show({ type: 'success', title, message, ...options });
  }

  error(title: string, message?: string, options?: Partial<Toast>): string {
    return this.show({ type: 'error', title, message, duration: 8000, ...options });
  }

  warning(title: string, message?: string, options?: Partial<Toast>): string {
    return this.show({ type: 'warning', title, message, ...options });
  }

  info(title: string, message?: string, options?: Partial<Toast>): string {
    return this.show({ type: 'info', title, message, ...options });
  }

  dismiss(id: string): void {
    this._toasts.update((t) => t.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}