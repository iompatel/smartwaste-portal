import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface ApiClient {
  get<T>(path: string, authenticated?: boolean): Observable<T>;
  post<T>(path: string, body: unknown, authenticated?: boolean): Observable<T>;
  put<T>(path: string, body: unknown, authenticated?: boolean): Observable<T>;
  delete<T>(path: string, authenticated?: boolean): Observable<T>;
}

export const API_CLIENT = new InjectionToken<ApiClient>('API_CLIENT');
