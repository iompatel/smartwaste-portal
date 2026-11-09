import { Injectable } from '@angular/core';

import { COMPACT_LAYOUT_KEY, THEME_KEY } from '../core/constants';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private mode: ThemeMode = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'light';
  private compact = localStorage.getItem(COMPACT_LAYOUT_KEY) === 'true';

  constructor() {
    this.apply(this.mode);
    this.applyCompact(this.compact);
  }

  get currentMode() {
    return this.mode;
  }

  toggle() {
    this.mode = this.mode === 'light' ? 'dark' : 'light';
    this.apply(this.mode);
    return this.mode;
  }

  get compactLayout() {
    return this.compact;
  }

  toggleCompact() {
    this.applyCompact(!this.compact);
    return this.compact;
  }

  apply(mode: ThemeMode) {
    this.mode = mode;
    document.body.classList.toggle('theme-dark', mode === 'dark');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#000000' : '#f5f5f7');
    localStorage.setItem(THEME_KEY, mode);
  }

  private applyCompact(compact: boolean) {
    this.compact = compact;
    document.body.classList.toggle('layout-compact', compact);
    localStorage.setItem(COMPACT_LAYOUT_KEY, String(compact));
  }
}
