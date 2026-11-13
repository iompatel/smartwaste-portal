import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppNotification } from '../../models/types';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-admin-broadcast',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-broadcast.component.html',
  styleUrl: './admin-broadcast.component.scss',
})
export class AdminBroadcastComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly fb = inject(FormBuilder);

  notifications: AppNotification[] = [];
  loading = true;
  sending = false;
  error = '';
  success = '';

  readonly noticeForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    message: ['', [Validators.required]],
  });

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    this.loading = true;
    this.error = '';

    this.portalService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Unable to load broadcast history.';
      },
    });
  }

  sendNotification() {
    if (this.noticeForm.invalid) {
      this.noticeForm.markAllAsTouched();
      return;
    }

    this.sending = true;
    this.error = '';
    this.success = '';

    this.portalService.sendNotification(this.noticeForm.getRawValue()).subscribe({
      next: () => {
        this.sending = false;
        this.success = 'Broadcast sent successfully.';
        this.noticeForm.reset({
          title: '',
          message: '',
        });
        this.loadNotifications();
      },
      error: (err) => {
        this.sending = false;
        this.error = err?.error?.message ?? 'Unable to send broadcast.';
      },
    });
  }

  get recentBroadcasts() {
    return this.notifications.slice(0, 8);
  }
}
