import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { HireRequest, User } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { BrowserNotificationService } from '../../services/browser-notification.service';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-hire-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './hire-requests.component.html',
  styleUrl: './hire-requests.component.scss',
})
export class HireRequestsComponent implements OnInit {
  private readonly portalService = inject(PortalService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(BrowserNotificationService);

  requests: HireRequest[] = [];
  workers: User[] = [];

  loading = true;
  saving = false;
  error = '';

  selectedWorkerId: Record<number, number | undefined> = {};

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    purpose: ['', [Validators.required, Validators.minLength(4)]],
    workAddress: ['', [Validators.required]],
  });

  ngOnInit() {
    this.prefillWorkAddress();
    this.loadRequests();
    if (this.isAdmin) {
      this.loadWorkers();
    }
  }

  get user() {
    return this.authService.currentUser;
  }

  get isAdmin() {
    return this.user?.role === 'admin';
  }

  get isWorker() {
    return this.user?.role === 'worker';
  }

  get isUser() {
    return this.user?.role === 'user';
  }

  get needsProfileCompletion() {
    return this.authService.needsContactDetails(this.user);
  }

  prefillWorkAddress() {
    const address = String(this.user?.address ?? '').trim();
    if (address) {
      this.form.patchValue({ workAddress: address });
    }
  }

  loadWorkers() {
    this.portalService.getUsers().subscribe({
      next: (users) => {
        this.workers = users.filter((item) => item.role === 'worker');
      },
    });
  }

  get availableWorkers() {
    const busy = new Set(
      this.requests
        .filter((request) => request.status === 'assigned' && request.assignedWorkerId)
        .map((request) => request.assignedWorkerId as number),
    );

    return this.workers.filter((worker) => !busy.has(worker.id));
  }

  loadRequests() {
    this.loading = true;
    this.error = '';

    this.portalService.getHireRequests().subscribe({
      next: (requests) => {
        this.requests = requests;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Failed to load hire requests.';
      },
    });
  }

  createRequest() {
    if (!this.isUser) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';
    const value = this.form.getRawValue();

    this.portalService
      .createHireRequest({
        title: value.title,
        purpose: value.purpose,
        workAddress: value.workAddress,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.form.reset({
            title: '',
            purpose: '',
            workAddress: String(this.user?.address ?? '').trim(),
          });
          this.loadRequests();
        },
        error: (err) => {
          this.saving = false;
          this.error = err?.error?.message ?? 'Unable to submit hire request.';
        },
      });
  }

  assign(request: HireRequest) {
    if (!this.isAdmin) {
      return;
    }

    const workerId = Number(this.selectedWorkerId[request.id] ?? 0);
    if (!workerId) {
      this.error = 'Select a worker to assign.';
      return;
    }

    if (!this.availableWorkers.some((worker) => worker.id === workerId)) {
      this.error = 'Selected worker is not available.';
      return;
    }

    this.saving = true;
    this.error = '';

    this.portalService.assignHireRequest(request.id, workerId).subscribe({
      next: () => {
        this.saving = false;
        delete this.selectedWorkerId[request.id];
        this.loadRequests();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message ?? 'Assign failed.';
      },
    });
  }

  onWorkerSelected(requestId: number, event: Event) {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '0';
    this.selectedWorkerId[requestId] = Number(value || 0) || 0;
  }

  deleteRequest(request: HireRequest) {
    if (!this.isAdmin && !this.isUser) {
      return;
    }

    if (this.isUser && request.status !== 'pending') {
      this.error = 'Only pending hire requests can be deleted.';
      return;
    }

    if (!confirm(`Delete hire request ${request.requestCode}?`)) {
      return;
    }

    this.saving = true;
    this.error = '';

    this.portalService.deleteHireRequest(request.id).subscribe({
      next: () => {
        this.saving = false;
        this.loadRequests();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message ?? 'Delete failed.';
      },
    });
  }

  formatDate(value: string | null | undefined) {
    if (!value) {
      return '-';
    }
    return new Date(value).toLocaleString();
  }

  openDirections(request: HireRequest) {
    const destination = encodeURIComponent(String(request.workAddress ?? '').trim());
    if (!destination) {
      this.error = 'Work address is missing.';
      return;
    }

    const openUrl = (origin?: { lat: number; lng: number }) => {
      const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : '';
      const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destination}&travelmode=driving`;
      window.open(url, '_blank', 'noopener');
    };

    if (!navigator.geolocation) {
      openUrl();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        openUrl({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        // Fallback: open maps with destination only.
        openUrl();
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 },
    );
  }

  completeTask(request: HireRequest) {
    if (!this.isWorker) {
      return;
    }

    if (request.status !== 'assigned') {
      return;
    }

    if (!confirm(`Mark ${request.requestCode} as completed?`)) {
      return;
    }

    this.saving = true;
    this.error = '';
    this.portalService.completeHireRequest(request.id).subscribe({
      next: () => {
        this.saving = false;
        this.notificationService.notify('Task Completed', `${request.requestCode} completed.`);
        this.loadRequests();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message ?? 'Unable to complete task.';
      },
    });
  }

  workerLabel(workerId: number | null) {
    if (!workerId) {
      return 'Unassigned';
    }

    const worker = this.workers.find((item) => item.id === workerId);
    if (worker) {
      return `${worker.firstName} ${worker.lastName}`;
    }

    return `Worker #${workerId}`;
  }
}
