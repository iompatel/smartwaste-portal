import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrowserNotificationService {
  async requestPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }

    const result = await Notification.requestPermission();
    return result;
  }

  notify(title: string, body: string) {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    new Notification(title, { body });
    return true;
  }
}
