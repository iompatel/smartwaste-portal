import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-dialog" [class.danger]="data.variant === 'danger'">
      <div class="dialog-header">
        @if (data.icon) {
          <div class="dialog-icon" [innerHTML]="data.icon"></div>
        }
        <h2 class="dialog-title">{{ data.title }}</h2>
      </div>
      <p class="dialog-message">{{ data.message }}</p>
      <div class="dialog-actions">
        <button class="btn btn-secondary" (click)="dialogRef.close(false)">
          {{ data.cancelLabel || 'Cancel' }}
        </button>
        <button class="btn btn-primary" [class.btn-danger]="data.variant === 'danger'" (click)="dialogRef.close(true)">
          {{ data.confirmLabel || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      min-width: 360px;
      max-width: 480px;
      padding: 0;
    }

    .dialog-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 24px 24px 16px;
    }

    .dialog-icon {
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: var(--brand-light);
      color: var(--brand);
    }

    .confirm-dialog.danger .dialog-icon {
      background: var(--danger-bg);
      color: var(--danger);
    }

    .dialog-icon svg {
      width: 24px;
      height: 24px;
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.3;
    }

    .dialog-message {
      padding: 0 24px 24px;
      margin: 0;
      font-size: 15px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px 24px;
      border-top: 1px solid var(--border);
    }

    .dialog-actions button {
      min-width: 100px;
    }
  `],
})
export class ConfirmDialogComponent {
  // This is a template for a dialog - actual implementation would use a dialog service
  // For now, this is a placeholder component
  dialogRef = { close: (value: boolean) => {} };
  data: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; variant?: 'default' | 'danger'; icon?: string } = { title: '', message: '' };
}