import { Inject, Injectable } from '@angular/core';

import {
  AdminActivity,
  AppNotification,
  DashboardSummary,
  HireRequest,
  Review,
  Ticket,
  TicketMessage,
  User,
  WorkerReviewSummary,
} from '../models/types';
import { API_CLIENT, ApiClient } from './api-client';

@Injectable({ providedIn: 'root' })
export class PortalService {
  constructor(@Inject(API_CLIENT) private readonly api: ApiClient) {}

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

  assignTicket(ticketId: number, workerId: number) {
    return this.api.put<Ticket>(`/tickets/${ticketId}/assign`, { workerId });
  }

  updateTicketStatus(
    ticketId: number,
    payload: { status: Ticket['status']; completionCode?: string; completionMediaData?: string | null },
  ) {
    return this.api.put<Ticket>(`/tickets/${ticketId}/status`, payload);
  }

  cancelTicket(ticketId: number, reason = '') {
    return this.api.put<Ticket>(`/tickets/${ticketId}/cancel`, { reason });
  }

  deleteTicket(ticketId: number) {
    return this.api.delete<{ message: string }>(`/tickets/${ticketId}`);
  }

  getTicketMessages(ticketId: number) {
    return this.api.get<TicketMessage[]>(`/tickets/${ticketId}/messages`);
  }

  sendTicketMessage(ticketId: number, message: string) {
    return this.api.post<TicketMessage>(`/tickets/${ticketId}/messages`, { message });
  }

  reviewTicket(ticketId: number, rating: number, comment: string) {
    return this.api.post<Review>(`/tickets/${ticketId}/review`, { rating, comment });
  }

  getWorkerReviews(workerId: number) {
    return this.api.get<WorkerReviewSummary>(`/workers/${workerId}/reviews`);
  }

  setWorkerAvailability(online: boolean) {
    return this.api.put<User>('/workers/me/availability', { online });
  }

  sendWorkerHeartbeat() {
    return this.api.post<{ online: boolean }>('/workers/me/heartbeat', {});
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
