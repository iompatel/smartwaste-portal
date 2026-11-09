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
        border-radius: 999px;
        padding: 0.32rem 0.72rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .pending {
        background: var(--warning-soft);
        border-color: color-mix(in srgb, var(--warning) 25%, transparent);
        color: var(--warning);
      }
      .in_progress {
        background: rgba(0, 113, 227, 0.1);
        border-color: rgba(0, 113, 227, 0.14);
        color: var(--accent-deep);
      }
      .completed {
        background: var(--success-soft);
        border-color: color-mix(in srgb, var(--success) 25%, transparent);
        color: color-mix(in srgb, var(--success) 70%, var(--text));
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
