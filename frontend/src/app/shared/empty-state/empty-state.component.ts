import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface EmptyStateAction {
  label: string;
  callback: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: string;
}

const DEFAULT_ICONS: Record<string, string> = {
  'empty-tickets': `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  'empty-hire': `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  'empty-hired': `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
  'add': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
};

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state" [class.centered]="centered">
      @if (safeIcon) {
        <div class="empty-state-icon" [innerHTML]="safeIcon"></div>
      }
      @if (title) {
        <h3 class="empty-state-title">{{ title }}</h3>
      }
      @if (message) {
        <p class="empty-state-message">{{ message }}</p>
      }
      @if (actions.length) {
        <div class="empty-state-actions">
          @for (action of actions; track action.label) {
            <button
              class="btn btn-{{ action.variant || 'primary' }}"
              (click)="action.callback()"
              [disabled]="disabled"
            >
              @if (safeActionIcon(action.icon)) {
                <span class="btn-icon" [innerHTML]="safeActionIcon(action.icon)"></span>
              }
              {{ action.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-state.centered {
      align-items: center;
    }

    .empty-state-icon {
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
      opacity: 0.7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary-600);
    }

    .empty-state-icon svg {
      width: 100%;
      height: 100%;
    }

    .empty-state-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-secondary);
      margin: 0 0 8px;
    }

    .empty-state-message {
      font-size: 15px;
      max-width: 320px;
      margin: 0 0 24px;
      line-height: 1.5;
      color: var(--text-muted);
    }

    .empty-state-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
      width: 100%;
    }

    .empty-state-actions button {
      min-width: 120px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  `],
})
export class EmptyStateComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() title = '';
  @Input() message = '';
  @Input() icon = '';
  @Input() actions: EmptyStateAction[] = [];
  @Input() centered = true;
  @Input() disabled = false;

  get safeIcon(): SafeHtml | null {
    if (!this.icon) return null;
    const svg = DEFAULT_ICONS[this.icon] || (this.icon.includes('<svg') ? this.icon : null);
    if (!svg) {
      return this.sanitizer.bypassSecurityTrustHtml(
        `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
      );
    }
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  safeActionIcon(actionIcon?: string): SafeHtml | null {
    if (!actionIcon) return null;
    const svg = DEFAULT_ICONS[actionIcon] || (actionIcon.includes('<svg') ? actionIcon : null);
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }
}
