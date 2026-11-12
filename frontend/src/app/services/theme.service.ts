import { Injectable, signal, computed } from '@angular/core';

import { THEME_KEY } from '../core/constants';

export type ThemeMode = 'light' | 'dark';

export function storedTheme(value: string | null): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(storedTheme(localStorage.getItem(THEME_KEY)));
  readonly currentMode = computed(() => this._mode());

  constructor() {
    this.apply(this._mode());
  }

  toggle(): ThemeMode {
    const newMode = this._mode() === 'light' ? 'dark' : 'light';
    this._mode.set(newMode);
    this.apply(newMode);
    return newMode;
  }

  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
    this.apply(mode);
  }

  private apply(mode: ThemeMode): void {
    document.body.classList.toggle('theme-dark', mode === 'dark');
    localStorage.setItem(THEME_KEY, mode);
  }
}