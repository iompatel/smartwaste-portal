import { Injectable } from '@angular/core';
import {
  BackendAdminActivity,
  BackendHireRequest,
  BackendNotification,
  BackendTicket,
  BackendUser,
  DashboardSummary,
  TicketMessage,
} from './api.types';
import { Booking, Priority, Ticket, TicketStatus } from '../smartwaste/data';

const TOKEN_KEY = 'swms_auth_token';
const CSRF_KEY = 'swms_csrf_token';
const USER_KEY = 'swms_user';
const ROLE_KEY = 'swms_active_role';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiBase = '';

  constructor() {
    // If runtime config was injected (e.g. on Render), use it
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as any).__SWMS_CONFIG__;
      if (runtimeConfig?.API_BASE_URL) {
        this.apiBase = runtimeConfig.API_BASE_URL.replace(/\/api\/?$/, '');
      } else {
        const port = window.location.port;
        // When served on 4200 directly without proxy, target localhost:4000
        this.apiBase = port === '4000' ? '' : 'http://localhost:4000';
      }
    }
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

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const csrf = this.getCsrf();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (csrf) {
      headers['X-Admin-CSRF'] = csrf;
    }

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.apiBase}${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        let msg = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          msg = body.message || msg;
        } catch {
          // ignore
        }
        const error: any = new Error(msg);
        error.status = response.status;
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return {} as T;
    } catch (err: any) {
      // If fetching from localhost:4000 directly failed with connection error, try relative path (/api)
      if (this.apiBase && err.message?.includes('fetch')) {
        const response = await fetch(path, {
          ...options,
          headers,
          credentials: 'include',
        });
        if (!response.ok) {
          let msg = `Request failed (${response.status})`;
          try {
            const body = await response.json();
            msg = body.message || msg;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }
        return (await response.json()) as T;
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
      cancelled: 'Completed',
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
      eta:
        t.status === 'in_progress'
          ? 'Collection in progress'
          : t.status === 'assigned'
            ? 'Assigned to route'
            : undefined,
      description: t.description,
      mediaData: t.mediaData,
      raw: t,
    };
  }

  // Map Backend HireRequest to UI Booking
  mapHireToUi(h: BackendHireRequest): Booking {
    const statusMap: Record<string, 'Confirmed' | 'Pending' | 'Completed'> = {
      pending: 'Pending',
      assigned: 'Confirmed',
      completed: 'Completed',
      cancelled: 'Completed',
    };

    const workerName = h.assignedWorker
      ? `${h.assignedWorker.firstName} ${h.assignedWorker.lastName}`.trim()
      : 'Awaiting operative';

    const priceMap: Record<string, string> = {
      'Home cleaning': '$48',
      'Garden cleanup': '$36',
      'Bulk waste pickup': '$64',
      'Balcony deep clean': '$48',
      'Garage clear-out': '$72',
    };

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
      price: priceMap[h.title] || '$48',
      purpose: h.purpose,
      address: h.workAddress,
      raw: h,
    };
  }
}
