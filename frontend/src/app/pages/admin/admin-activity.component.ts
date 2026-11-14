import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';

import { AdminActivity } from '../../models/types';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-admin-activity',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-activity.component.html',
  styleUrl: './admin-activity.component.scss',
})
export class AdminActivityComponent implements OnInit {
  private readonly portalService = inject(PortalService);

  activities: AdminActivity[] = [];
  loading = true;
  error = '';

  ngOnInit() {
    this.loadActivities();
  }

  loadActivities() {
    this.loading = true;
    this.error = '';

    this.portalService.getAdminActivities().subscribe({
      next: (activities) => {
        this.activities = activities;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Failed to load admin activity.';
      },
    });
  }
}
