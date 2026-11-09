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
        border-radius: 999px;
        padding: 0.32rem 0.72rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .admin {
        background: rgba(216, 67, 67, 0.1);
        border-color: rgba(216, 67, 67, 0.14);
        color: #a92a2a;
      }
      .worker {
        background: rgba(0, 113, 227, 0.1);
        border-color: rgba(0, 113, 227, 0.14);
        color: var(--accent-deep);
      }
      .user {
        background: rgba(52, 199, 89, 0.1);
        border-color: rgba(52, 199, 89, 0.14);
        color: #19713a;
      }
    `,
  ],
})
export class RolePillComponent {
  @Input({ required: true }) role: UserRole = 'user';
}
