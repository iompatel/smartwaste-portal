import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import {
  BackendAdminActivity,
  BackendNotification,
  BackendUser,
  DashboardSummary,
} from './api.types';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  constructor(private api: ApiService) {}

  async getSummary(): Promise<DashboardSummary> {
    return this.api.request<DashboardSummary>('/api/dashboard/summary');
  }

  async getUsers(): Promise<BackendUser[]> {
    return this.api.request<BackendUser[]>('/api/users');
  }

  async createUser(payload: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    password: string;
    role: 'admin' | 'worker' | 'user';
    address: string;
    gender?: string;
  }): Promise<BackendUser> {
    return this.api.request<BackendUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUser(
    id: number,
    payload: Partial<BackendUser>
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
