import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { TicketStatus } from '../models/types';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="badge" [ngClass]="status">{{ label }}</span>`,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        border: 1px solid transparent;
        border-radius: var(--radius-pill);
        min-height: 28px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-transform: capitalize;
      }
      .pending,
      .assigned {
        background: var(--warning-soft);
        color: var(--warning);
      }
      .accepted,
      .in_progress {
        background: var(--accent-soft);
        color: var(--accent-deep);
      }
      .completed {
        background: var(--success-soft);
        color: var(--success);
      }
      .cancelled {
        background: var(--danger-soft);
        color: var(--danger);
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status: TicketStatus = 'pending';

  get label() {
    return this.status.replace('_', ' ');
  }
}
