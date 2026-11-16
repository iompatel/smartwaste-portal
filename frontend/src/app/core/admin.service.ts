import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import {
  BackendAdminActivity,
  BackendNotification,
  BackendUser,
  DashboardSummary,
  AccountPayload,
  ActivityFilters,
  ActivityPage,
  WorkerLocationSnapshot,
} from './api.types';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  constructor(private api: ApiService) {}

  async getSummary(): Promise<DashboardSummary> {
    return this.api.request<DashboardSummary>('/api/dashboard/summary');
  }

  async getUsers(role?: 'user' | 'worker'): Promise<BackendUser[]> {
    return this.api.request<BackendUser[]>(`/api/users${role ? `?role=${role}` : ''}`);
  }

  async createUser(payload: AccountPayload): Promise<BackendUser> {
    return this.api.request<BackendUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUser(
    id: number,
    payload: Partial<AccountPayload>
  ): Promise<BackendUser> {
    return this.api.request<BackendUser>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteUser(id: number): Promise<void> {
    await this.api.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getActivities(): Promise<BackendAdminActivity[]> {
    return this.api.request<BackendAdminActivity[]>('/api/admin-activities');
  }

  async getAccountActivities(filters: ActivityFilters = {}): Promise<ActivityPage> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') {
        query.set(key === 'actorRole' ? 'role' : key, String(value));
      }
    }
    return this.api.request<ActivityPage>(`/api/activity?${query}`);
  }

  async getWorkerLocations(): Promise<WorkerLocationSnapshot> {
    return this.api.request<WorkerLocationSnapshot>('/api/admin/worker-locations', { cache: 'no-store' });
  }

  async downloadAccountReport(
    role: 'users' | 'workers',
    filters: { from?: string; to?: string } = {},
  ): Promise<void> {
    const query = new URLSearchParams();
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    const blob = await this.api.requestBlob(`/api/admin/reports/${role}?${query}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-waste-${role}-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async getNotifications(): Promise<BackendNotification[]> {
    return this.api.request<BackendNotification[]>('/api/notifications');
  }

  async sendBroadcast(payload: {
    title: string;
    message: string;
    targetRole?: 'user' | 'worker' | 'admin';
    userId?: number;
  }): Promise<{ message: string }> {
    return this.api.request<{ message: string }>('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async markNotificationRead(id: number): Promise<void> {
    await this.api.request(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.api.request('/api/notifications/read-all', {
      method: 'PUT',
    });
  }
}
