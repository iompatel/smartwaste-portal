import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  private loading: Promise<any> | null = null;
  readonly authFailed = signal(false);

  get configured(): boolean {
    return Boolean((window as any).__SWMS_CONFIG__?.GOOGLE_MAPS_API_KEY);
  }

  load(): Promise<any> {
    const existing = (window as any).google?.maps;
    if (existing) return Promise.resolve(existing);
    if (this.loading) return this.loading;
    const key = String((window as any).__SWMS_CONFIG__?.GOOGLE_MAPS_API_KEY || '');
    if (!key) return Promise.reject(new Error('Google Maps is not configured.'));
    this.authFailed.set(false);
    (window as any).gm_authFailure = () => this.authFailed.set(true);

    this.loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const callback = '__swmsGoogleMapsReady';
      const cleanup = () => {
        clearTimeout(timeout);
        delete (window as any)[callback];
      };
      const fail = () => {
        cleanup();
        script.remove();
        this.loading = null;
        reject(new Error('Google Maps could not be loaded.'));
      };
      const timeout = window.setTimeout(fail, 20000);
      (window as any)[callback] = () => {
        cleanup();
        resolve((window as any).google.maps);
      };
      script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, callback, v: 'weekly', loading: 'async' })}`;
      script.async = true;
      script.onerror = fail;
      document.head.appendChild(script);
    });
    return this.loading;
  }
}
