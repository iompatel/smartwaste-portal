import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { API_BASE_URL } from '../app/core/constants';
import { ApiClient } from '../app/services/api-client';
import { ADMIN_CSRF_KEY } from './admin.constants';

@Injectable()
export class AdminApiService implements ApiClient {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, _authenticated = true) {
    return this.http.get<T>(`${API_BASE_URL}${path}`, { withCredentials: true });
  }

  post<T>(path: string, body: unknown, authenticated = true) {
    return this.http.post<T>(`${API_BASE_URL}${path}`, body, {
      headers: this.headers(authenticated),
      withCredentials: true,
    });
  }

  put<T>(path: string, body: unknown, authenticated = true) {
    return this.http.put<T>(`${API_BASE_URL}${path}`, body, {
      headers: this.headers(authenticated),
      withCredentials: true,
    });
  }

  delete<T>(path: string, authenticated = true) {
    return this.http.delete<T>(`${API_BASE_URL}${path}`, {
      headers: this.headers(authenticated),
      withCredentials: true,
    });
  }

  private headers(authenticated: boolean) {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const csrfToken = authenticated ? sessionStorage.getItem(ADMIN_CSRF_KEY) : null;
    if (csrfToken) {
      headers = headers.set('X-Admin-CSRF', csrfToken);
    }
    return headers;
  }
}
