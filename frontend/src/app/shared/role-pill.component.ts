import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { UserRole } from '../models/types';

@Component({
  selector: 'app-role-pill',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="pill" [ngClass]="role">{{ role }}</span>`,
  styles: [
    `
      .pill {
        text-transform: capitalize;
        border: 1px solid transparent;
        border-radius: var(--radius-pill);
        padding: 0.32rem 0.72rem;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .admin {
        background: var(--danger-soft);
        color: var(--danger);
      }
      .worker {
        background: var(--accent-soft);
        color: var(--accent-deep);
      }
      .user {
        background: var(--success-soft);
        color: var(--success);
      }
    `,
  ],
})
export class RolePillComponent {
  @Input({ required: true }) role: UserRole = 'user';
}
