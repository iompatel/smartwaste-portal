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
        background: rgba(255, 204, 0, 0.14);
        border-color: rgba(255, 204, 0, 0.18);
        color: #9c6d00;
      }
      .in_progress {
        background: rgba(0, 113, 227, 0.1);
        border-color: rgba(0, 113, 227, 0.14);
        color: var(--accent-deep);
      }
      .completed {
        background: rgba(52, 199, 89, 0.12);
        border-color: rgba(52, 199, 89, 0.16);
        color: #19713a;
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
