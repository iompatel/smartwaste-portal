import { Injectable } from '@angular/core';
import {
  BackendHireRequest,
  BackendTicket,
  BackendUser,
} from './api.types';
import { Booking, Priority, Ticket, TicketStatus } from '../smartwaste/data';

const TOKEN_KEY = 'swms_auth_token';
const CSRF_KEY = 'swms_csrf_token';
const USER_KEY = 'swms_user';
const ROLE_KEY = 'swms_active_role';
const BACKEND_WAKE_TIMEOUT_MS = 60_000;
const BACKEND_WAKING_MESSAGE = 'The admin service is still waking up. Please wait a few seconds and try again.';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiBase = '';
  private apiWakeUrl = '';
  private wakePromise: Promise<void> | null = null;

  constructor() {
    // If runtime config was injected (e.g. on Render), use it
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).__SWMS_CONFIG__;
      if (runtimeConfig?.API_BASE_URL) {
        this.apiBase = runtimeConfig.API_BASE_URL.replace(/\/api\/?$/, '');
      } else {
        const hostname = window.location.hostname || '';
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        if (isLocal) {
          const port = window.location.port;
          // When served on 4000 directly (e.g. unified SSR/backend), use relative path
          this.apiBase = port === '4000' ? '' : 'http://localhost:4000';
        } else {
          // Default to live production backend on non-localhost origins
          this.apiBase = 'https://smartwaste-backend-5zei.onrender.com';
        }
      }
      this.apiWakeUrl = String(runtimeConfig?.API_WAKE_URL || '').trim();
    }
  }

  private isSleepingBackend(response: Response): boolean {
    return response.status === 429 && response.headers.get('x-render-routing') === 'hibernate-rate-limited';
  }

  private async wakeBackend(): Promise<void> {
    if (!this.apiWakeUrl) return;
    if (this.wakePromise) return this.wakePromise;

    this.wakePromise = (async () => {
      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort(), BACKEND_WAKE_TIMEOUT_MS);
      try {
        await fetch(this.apiWakeUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal,
        });
      } catch {
        // The wake request can lose its response while Render starts. The
        // original request below still gets one retry through the gateway.
      } finally {
        globalThis.clearTimeout(timeoutId);
        this.wakePromise = null;
      }
    })();

    return this.wakePromise;
  }

  private async fetchWithWake(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let response = await fetch(input, init);
    if (this.isSleepingBackend(response) && this.apiWakeUrl) {
      await this.wakeBackend();
      response = await fetch(input, init);
    }
    return response;
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null): void {
    if (typeof window === 'undefined') return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  getCsrf(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CSRF_KEY);
  }

  setCsrf(csrf: string | null): void {
    if (typeof window === 'undefined') return;
    if (csrf) localStorage.setItem(CSRF_KEY, csrf);
    else localStorage.removeItem(CSRF_KEY);
  }

  getStoredUser(): BackendUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setStoredUser(user: BackendUser | null): void {
    if (typeof window === 'undefined') return;
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  getStoredRole(): 'citizen' | 'worker' | 'admin' | null {
    if (typeof window === 'undefined') return null;
    const role = localStorage.getItem(ROLE_KEY);
    if (role === 'admin' || role === 'worker' || role === 'citizen') return role;
    return null;
  }

  setStoredRole(role: 'citizen' | 'worker' | 'admin' | null): void {
    if (typeof window === 'undefined') return;
    if (role) localStorage.setItem(ROLE_KEY, role);
    else localStorage.removeItem(ROLE_KEY);
  }

  clearAuth(): void {
    this.setToken(null);
    this.setCsrf(null);
    this.setStoredUser(null);
    this.setStoredRole(null);
  }

  async requestBlob(endpoint: string): Promise<Blob> {
    const headers: Record<string, string> = { Accept: 'application/pdf' };
    const token = this.getToken();
    const csrf = this.getCsrf();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (csrf) headers['X-Admin-CSRF'] = csrf;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let response: Response;
    try {
      response = await this.fetchWithWake(`${this.apiBase}${path}`, { headers, credentials: 'include', cache: 'no-store' });
    } catch (error) {
      if (!this.apiBase || !(error instanceof TypeError)) throw error;
      response = await this.fetchWithWake(path, { headers, credentials: 'include', cache: 'no-store' });
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = this.isSleepingBackend(response)
        ? BACKEND_WAKING_MESSAGE
        : body?.message || `Report download failed (${response.status}).`;
      const error = new Error(message);
      Object.assign(error, { status: response.status });
      throw error;
    }
    if (!response.headers.get('content-type')?.includes('application/pdf')) {
      throw new Error('The report service returned an unexpected response. Please try again.');
    }
    return response.blob();
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const csrf = this.getCsrf();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (csrf) {
      headers['X-Admin-CSRF'] = csrf;
    }

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = this.apiBase ? `${this.apiBase}${path}` : path;
    // Never replay a write against the static origin: hosts answer unknown
    // POST/PUT paths with an empty 200, which would look like a success.
    const method = (options.method ?? 'GET').toUpperCase();
    const canRetryRelative = method === 'GET' || method === 'HEAD';

    const parseResponse = async (res: Response): Promise<{ body: any; isJson: boolean; rawText: string }> => {
      let rawText = '';
      try {
        rawText = await res.text();
      } catch {
        rawText = '';
      }

      let body: any = null;
      let isJson = false;
      if (rawText && rawText.trim()) {
        try {
          body = JSON.parse(rawText);
          isJson = true;
        } catch {
          body = null;
          isJson = false;
        }
      }
      return { body, isJson, rawText };
    };

    const buildError = (res: Response, body: any, _rawText: string): Error => {
      let msg = this.isSleepingBackend(res) ? BACKEND_WAKING_MESSAGE : body?.message;
      if (!msg) {
        if (res.status === 429) {
          msg = 'Too many login attempts. Please wait a moment and try again.';
        } else if (res.status === 401) {
          msg = 'Invalid operative credentials.';
        } else if (res.status === 403) {
          msg = 'Access denied. You do not have permission for this portal.';
        } else if (res.status >= 500) {
          msg = 'Server temporarily unavailable. Please try again shortly.';
        } else {
          msg = `Request failed (${res.status})`;
        }
      }
      const error: any = new Error(msg);
      error.status = res.status;
      if (body?.code) error.code = body.code;
      return error;
    };

    try {
      const response = await this.fetchWithWake(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const { body, isJson, rawText } = await parseResponse(response);

      if (!response.ok) {
        throw buildError(response, body, rawText);
      }

      // Detect SPA HTML rewrite responses (e.g. index.html returned instead of API JSON)
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('text/html') || rawText.trim().startsWith('<!doctype html') || rawText.trim().startsWith('<html')) {
        throw new Error('API server returned an unexpected response. Please ensure backend is reachable.');
      }

      if (isJson && body !== null) {
        return body as T;
      }
      if (path.startsWith('/api/') && !rawText.trim()) {
        throw new Error('The service returned an empty response. Check your connection and try again.');
      }
      return (body ?? {}) as T;
    } catch (err: any) {
      // If fetching from this.apiBase failed with network error, try fallback relative path if url was absolute
      if (this.apiBase && canRetryRelative && (err.name === 'TypeError' || err.message?.toLowerCase().includes('fetch'))) {
        try {
          const fallbackRes = await this.fetchWithWake(path, {
            ...options,
            headers,
            credentials: 'include',
          });

          const { body, isJson, rawText } = await parseResponse(fallbackRes);

          if (!fallbackRes.ok) {
            throw buildError(fallbackRes, body, rawText);
          }

          const fallbackCt = fallbackRes.headers.get('content-type') || '';
          if (fallbackCt.includes('text/html') || rawText.trim().startsWith('<!doctype html') || rawText.trim().startsWith('<html')) {
            throw new Error('Backend service is currently connecting. Please try again in a few seconds.');
          }

          if (isJson && body !== null) {
            return body as T;
          }
          if (path.startsWith('/api/') && !rawText.trim()) {
            throw new Error('The service returned an empty response. Check your connection and try again.');
          }
          return (body ?? {}) as T;
        } catch (fallbackErr: any) {
          throw fallbackErr;
        }
      }
      throw err;
    }
  }

  // Format date helper
  formatTimeAgo(dateStr?: string | Date | null): string {
    if (!dateStr) return 'Just now';
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    if (diffMs < 0) return 'Just now';

    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Map Backend Ticket to UI Ticket
  mapTicketToUi(t: BackendTicket): Ticket {
    const statusMap: Record<string, TicketStatus> = {
      pending: 'Pending',
      assigned: 'Scheduled',
      accepted: 'Scheduled',
      in_progress: 'In progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    const priorityMap: Record<string, Priority> = {
      critical: 'High',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    const workerName = t.assignedWorker
      ? `${t.assignedWorker.firstName} ${t.assignedWorker.lastName}`.trim()
      : undefined;

    return {
      id: t.ticketCode || `SW-${t.id}`,
      numericId: t.id,
      title: t.description
        ? t.description.length > 40
          ? t.description.slice(0, 40) + '...'
          : t.description
        : `${t.wasteType} collection`,
      category: t.wasteType,
      address: t.locationAddress,
      status: statusMap[t.status] || 'Pending',
      priority: priorityMap[t.priority] || 'Medium',
      time: this.formatTimeAgo(t.createdAt),
      code: t.completionCode || undefined,
      worker: workerName,
      workerId: t.assignedWorker?.id ?? t.workerId ?? undefined,
      workerMobile: t.assignedWorker?.mobile,
      eta:
        t.status === 'in_progress'
          ? 'Collection in progress'
          : t.status === 'assigned'
            ? 'Assigned to route'
            : undefined,
      description: t.description,
      mediaData: t.mediaData,
      scheduledFor: t.scheduledFor,
      scheduledSlot: t.scheduledSlot,
      cancellationReason: t.cancellationReason,
      raw: t,
    };
  }

  // Map Backend HireRequest to UI Booking
  mapHireToUi(h: BackendHireRequest): Booking {
    const statusMap: Record<string, Booking['status']> = {
      pending: 'Pending',
      assigned: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    const workerName = h.assignedWorker
      ? `${h.assignedWorker.firstName} ${h.assignedWorker.lastName}`.trim()
      : 'Awaiting operative';

    return {
      id: h.requestCode || `BK-${h.id}`,
      numericId: h.id,
      title: h.title || 'Personal Work',
      worker: workerName,
      date: new Date(h.createdAt).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      status: statusMap[h.status] || 'Pending',
      purpose: h.purpose,
      address: h.workAddress,
      scheduledFor: h.scheduledFor,
      scheduledSlot: h.scheduledSlot,
      raw: h,
    };
  }
}
