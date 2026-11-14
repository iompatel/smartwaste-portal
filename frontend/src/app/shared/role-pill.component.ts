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
        min-height: 28px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .admin,
      .worker,
      .user {
        background: var(--bg);
        border-color: var(--border);
        color: var(--text);
      }
    `,
  ],
})
export class RolePillComponent {
  @Input({ required: true }) role: UserRole = 'user';
}
