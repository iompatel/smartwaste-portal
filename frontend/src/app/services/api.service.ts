import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { API_BASE_URL, SESSION_TOKEN_KEY } from '../core/constants';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = API_BASE_URL;

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, authenticated = true) {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      headers: this.buildHeaders(authenticated),
    });
  }

  post<T>(path: string, body: unknown, authenticated = true) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildHeaders(authenticated),
    });
  }

  put<T>(path: string, body: unknown, authenticated = true) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, {
      headers: this.buildHeaders(authenticated),
    });
  }

  delete<T>(path: string, authenticated = true) {
    return this.http.delete<T>(`${this.baseUrl}${path}`, {
      headers: this.buildHeaders(authenticated),
    });
  }

  private buildHeaders(authenticated: boolean): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    if (authenticated) {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (token) {
        headers = headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }
}
