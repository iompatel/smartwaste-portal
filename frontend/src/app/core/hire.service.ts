import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BackendHireRequest } from './api.types';

@Injectable({
  providedIn: 'root',
})
export class HireService {
  constructor(private api: ApiService) {}

  async getHireRequests(): Promise<BackendHireRequest[]> {
    return this.api.request<BackendHireRequest[]>('/api/hire-requests');
  }

  async createHireRequest(payload: {
    title: string;
    purpose: string;
    workAddress: string;
  }): Promise<BackendHireRequest> {
    return this.api.request<BackendHireRequest>('/api/hire-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async completeHireRequest(id: number): Promise<BackendHireRequest> {
    return this.api.request<BackendHireRequest>(`/api/hire-requests/${id}/complete`, {
      method: 'PUT',
    });
  }

  async assignWorker(id: number, workerId: number): Promise<BackendHireRequest> {
    return this.api.request<BackendHireRequest>(`/api/hire-requests/${id}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ workerId }),
    });
  }

  async deleteHireRequest(id: number): Promise<void> {
    await this.api.request(`/api/hire-requests/${id}`, {
      method: 'DELETE',
    });
  }
}
