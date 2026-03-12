import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { AuthService } from '../../services/auth.service';
import { AdminPanelComponent } from '../admin/admin-panel.component';
import { DashboardComponent } from './dashboard.component';

@Component({
  selector: 'app-dashboard-entry',
  standalone: true,
  imports: [CommonModule, DashboardComponent, AdminPanelComponent],
  template: `
    @if (isAdmin) {
      <app-admin-panel />
    } @else {
      <app-dashboard />
    }
  `,
})
export class DashboardEntryComponent {
  private readonly authService = inject(AuthService);

  get isAdmin() {
    return this.authService.currentUser?.role === 'admin';
  }
}
