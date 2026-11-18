import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AddressSuggestion, BackendTicket, TicketMessage, TicketTrackingSnapshot } from './api.types';

@Injectable({
  providedIn: 'root',
})
export class TicketService {
  constructor(private api: ApiService) {}

  async getTickets(): Promise<BackendTicket[]> {
    return this.api.request<BackendTicket[]>('/api/tickets');
  }

  async createTicket(payload: {
    wasteType: string;
    description: string;
    locationAddress: string;
    locationLatitude?: number | null;
    locationLongitude?: number | null;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    mediaData?: string | null;
  }): Promise<BackendTicket> {
    return this.api.request<BackendTicket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateWorkerStatus(
    ticketId: number,
    status: 'accepted' | 'in_progress' | 'completed',
    extra: { completionCode?: string; completionMediaData?: string | null } = {}
  ): Promise<BackendTicket> {
    return this.api.request<BackendTicket>(`/api/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, ...extra }),
    });
  }

  async assignTicket(ticketId: number, workerId: number): Promise<BackendTicket> {
    return this.api.request<BackendTicket>(`/api/tickets/${ticketId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ workerId }),
    });
  }

  async cancelTicket(ticketId: number, reason?: string): Promise<BackendTicket> {
    return this.api.request<BackendTicket>(`/api/tickets/${ticketId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason: reason || 'Ticket cancelled by user.' }),
    });
  }

  async getMessages(ticketId: number): Promise<TicketMessage[]> {
    return this.api.request<TicketMessage[]>(`/api/tickets/${ticketId}/messages`);
  }

  async getTracking(ticketId: number): Promise<TicketTrackingSnapshot> {
    return this.api.request<TicketTrackingSnapshot>(`/api/tickets/${ticketId}/worker-location`);
  }

  async searchAddresses(query: string): Promise<AddressSuggestion[]> {
    const response = await this.api.request<{ suggestions: AddressSuggestion[] }>(
      `/api/locations/search?q=${encodeURIComponent(query)}`,
    );
    return response.suggestions ?? [];
  }

  async sendMessage(ticketId: number, message: string): Promise<TicketMessage> {
    return this.api.request<TicketMessage>(`/api/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async submitReview(ticketId: number, rating: number, comment?: string): Promise<any> {
    return this.api.request(`/api/tickets/${ticketId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  }
}
