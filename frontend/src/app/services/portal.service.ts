import { Injectable } from '@angular/core';

import {
  AdminActivity,
  AppNotification,
  DashboardSummary,
  HireRequest,
  Ticket,
  User,
} from '../models/types';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class PortalService {
  constructor(private readonly api: ApiService) {}

  getSummary() {
    return this.api.get<DashboardSummary>('/dashboard/summary');
  }

  getUsers() {
    return this.api.get<User[]>('/users');
  }

  createUser(payload: Record<string, unknown>) {
    return this.api.post<User>('/users', payload);
  }

  updateUser(userId: number, payload: Partial<User>) {
    return this.api.put<User>(`/users/${userId}`, payload);
  }

  deleteUser(userId: number) {
    return this.api.delete<{ message: string }>(`/users/${userId}`);
  }

  getTickets() {
    return this.api.get<Ticket[]>('/tickets');
  }

  createTicket(payload: Record<string, unknown>) {
    return this.api.post<Ticket>('/tickets', payload);
  }

  updateTicket(ticketId: number, payload: Partial<Ticket>) {
    return this.api.put<Ticket>(`/tickets/${ticketId}`, payload);
  }

  deleteTicket(ticketId: number) {
    return this.api.delete<{ message: string }>(`/tickets/${ticketId}`);
  }

  getHireRequests() {
    return this.api.get<HireRequest[]>('/hire-requests');
  }

  createHireRequest(payload: { title: string; purpose: string; workAddress?: string }) {
    return this.api.post<HireRequest>('/hire-requests', payload);
  }

  assignHireRequest(requestId: number, workerId: number) {
    return this.api.put<HireRequest>(`/hire-requests/${requestId}/assign`, { workerId });
  }

  completeHireRequest(requestId: number) {
    return this.api.put<HireRequest>(`/hire-requests/${requestId}/complete`, {});
  }

  deleteHireRequest(requestId: number) {
    return this.api.delete<{ message: string }>(`/hire-requests/${requestId}`);
  }

  getNotifications() {
    return this.api.get<AppNotification[]>('/notifications');
  }

  markNotificationRead(notificationId: number) {
    return this.api.put<AppNotification>(`/notifications/${notificationId}/read`, {});
  }

  markAllNotificationsRead() {
    return this.api.put<{ message: string; updated: number }>(`/notifications/read-all`, {});
  }

  getAdminActivities() {
    return this.api.get<AdminActivity[]>('/admin-activities');
  }

  sendNotification(payload: { title: string; message: string; userId?: number | null }) {
    return this.api.post<{ message: string }>('/notifications', payload);
  }
}
