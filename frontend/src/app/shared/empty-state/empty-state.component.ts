import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface EmptyStateAction {
  label: string;
  callback: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: string;
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state" [class.centered]="centered">
      @if (icon) {
        <div class="empty-state-icon" [innerHTML]="icon"></div>
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
              @if (action.icon) {
                <span class="btn-icon" [innerHTML]="action.icon"></span>
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
      opacity: 0.5;
      display: flex;
      align-items: center;
      justify-content: center;
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
    }
  `],
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() message = '';
  @Input() icon = '';
  @Input() actions: EmptyStateAction[] = [];
  @Input() centered = true;
  @Input() disabled = false;
}