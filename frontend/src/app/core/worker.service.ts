import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BackendTicket, LeaveApplication } from './api.types';

@Injectable({
  providedIn: 'root',
})
export class WorkerService {
  constructor(private api: ApiService) {}

  async applyLeave(payload: {
    startDate: string;
    endDate: string;
    leaveType?: string;
    reason: string;
  }): Promise<LeaveApplication> {
    return this.api.request<LeaveApplication>('/api/worker/leaves', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLeaves(): Promise<LeaveApplication[]> {
    return this.api.request<LeaveApplication[]>('/api/worker/leaves');
  }

  async cancelTicket(ticketId: number, reason: string): Promise<BackendTicket> {
    return this.api.request<BackendTicket>(`/api/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled', reason }),
    });
  }

  async setAvailability(online: boolean): Promise<any> {
    return this.api.request('/api/workers/me/availability', {
      method: 'PUT',
      body: JSON.stringify({ online }),
    });
  }

  async sendHeartbeat(): Promise<any> {
    return this.api.request('/api/workers/me/heartbeat', {
      method: 'POST',
    });
  }

  async updateLocation(
    latitude: number,
    longitude: number,
    accuracy: number = 10,
    sampledAt?: number,
    heading?: number | null,
    speed?: number | null,
  ): Promise<any> {
    return this.api.request('/api/workers/me/location', {
      method: 'PUT',
      body: JSON.stringify({
        latitude,
        longitude,
        accuracy,
        ...(sampledAt ? { sampledAt: new Date(sampledAt).toISOString() } : {}),
        ...(heading !== undefined && heading !== null ? { heading } : {}),
        ...(speed !== undefined && speed !== null ? { speed } : {}),
      }),
    });
  }
}
