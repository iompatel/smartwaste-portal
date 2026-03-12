import { Injectable } from '@angular/core';

import { THEME_KEY } from '../core/constants';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private mode: ThemeMode = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'light';

  constructor() {
    this.apply(this.mode);
  }

  get currentMode() {
    return this.mode;
  }

  toggle() {
    this.mode = this.mode === 'light' ? 'dark' : 'light';
    this.apply(this.mode);
    return this.mode;
  }

  apply(mode: ThemeMode) {
    this.mode = mode;
    document.body.classList.toggle('theme-dark', mode === 'dark');
    localStorage.setItem(THEME_KEY, mode);
  }
}
