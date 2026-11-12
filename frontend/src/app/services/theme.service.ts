import { Injectable } from '@angular/core';

import { THEME_KEY } from '../core/constants';

export type ThemeMode = 'light' | 'dark';

export function storedTheme(value: string | null): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private mode: ThemeMode = storedTheme(localStorage.getItem(THEME_KEY));

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
