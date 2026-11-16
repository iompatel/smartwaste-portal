import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root',
})
export class WorkerService {
  constructor(private api: ApiService) {}

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
  ): Promise<any> {
    return this.api.request('/api/workers/me/location', {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude, accuracy, ...(sampledAt ? { sampledAt: new Date(sampledAt).toISOString() } : {}) }),
    });
  }

  async getWorkerLocation(ticketId: number): Promise<any> {
    return this.api.request(`/api/tickets/${ticketId}/worker-location`);
  }
}
