import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Ticket, TicketPriority, TicketStatus } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { BrowserNotificationService } from '../../services/browser-notification.service';
import { PortalService } from '../../services/portal.service';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusBadgeComponent],
  templateUrl: './tickets.component.html',
  styleUrl: './tickets.component.scss',
})
export class TicketsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly portalService = inject(PortalService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(BrowserNotificationService);

  @ViewChild('cameraVideo') private readonly cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') private readonly cameraCanvas?: ElementRef<HTMLCanvasElement>;

  tickets: Ticket[] = [];
  loading = true;
  saving = false;
  error = '';

  isFormOpen = false;
  editingTicket: Ticket | null = null;
  mediaPreview: string | null = null;
  cameraOpen = false;
  cameraError = '';
  private cameraStream: MediaStream | null = null;

  readonly priorities: TicketPriority[] = ['low', 'medium', 'high'];
  readonly wasteTypes: string[] = [
    'Dry Waste',
    'Wet Waste',
    'Mixed Waste',
    'Plastic Waste',
    'Paper Waste',
    'Glass Waste',
    'Metal Waste',
    'Organic Waste',
    'Medical Waste',
    'E-Waste',
    'Hazardous Waste',
    'Construction & Debris',
  ];

  readonly form = this.fb.nonNullable.group({
    wasteType: ['', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    locationAddress: ['', [Validators.required]],
    priority: ['medium' as TicketPriority, [Validators.required]],
  });

  get user() {
    return this.authService.currentUser;
  }

  get isAdmin() {
    return this.user?.role === 'admin';
  }

  get isWorker() {
    return this.user?.role === 'worker';
  }

  get canCreateTickets() {
    return this.user?.role === 'user';
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.stopCameraStream();
  }

  loadData() {
    this.loading = true;
    this.error = '';

    this.portalService.getTickets().subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Failed to load tickets.';
      },
    });
  }

  openCreate() {
    if (!this.canCreateTickets) {
      this.error = 'Admin can only review ticket status or delete tickets.';
      return;
    }

    this.editingTicket = null;
    this.form.reset({
      wasteType: '',
      description: '',
      locationAddress: this.user?.address ?? '',
      priority: 'medium',
    });
    this.mediaPreview = null;
    this.closeCamera();
    this.isFormOpen = true;
  }

  openEdit(ticket: Ticket) {
    if (this.user?.role !== 'user') {
      this.error = this.isAdmin
        ? 'Admin can only review ticket status or delete tickets.'
        : 'Worker cannot edit tickets.';
      return;
    }

    this.editingTicket = ticket;
    this.form.reset({
      wasteType: ticket.wasteType,
      description: ticket.description,
      locationAddress: ticket.locationAddress,
      priority: ticket.priority,
    });
    this.mediaPreview = ticket.mediaData;
    this.closeCamera();
    this.isFormOpen = true;
  }

  cancelForm() {
    this.isFormOpen = false;
    this.editingTicket = null;
    this.mediaPreview = null;
    this.closeCamera();
  }

  saveTicket() {
    if (this.user?.role !== 'user') {
      this.error = 'Only users can create or edit tickets.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = '';
    const value = this.form.getRawValue();

    const payload = {
      wasteType: value.wasteType,
      description: value.description,
      locationAddress: value.locationAddress,
      priority: value.priority,
      mediaData: this.mediaPreview,
    };

    const request = this.editingTicket
      ? this.portalService.updateTicket(this.editingTicket.id, payload)
      : this.portalService.createTicket(payload);

    request.subscribe({
      next: (ticket) => {
        this.saving = false;
        this.isFormOpen = false;
        this.editingTicket = null;
        this.mediaPreview = null;

        this.notificationService.notify('Ticket Saved', `${ticket.ticketCode} saved successfully.`);
        this.loadData();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message ?? 'Unable to save ticket.';
      },
    });
  }

  deleteTicket(ticket: Ticket) {
    if (!confirm(`Delete ticket ${ticket.ticketCode}?`)) {
      return;
    }

    this.portalService.deleteTicket(ticket.id).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Delete failed.';
      },
    });
  }

  quickStatusUpdate(ticket: Ticket, status: TicketStatus) {
    if (!this.isWorker) {
      this.error = 'Only workers can update ticket status.';
      return;
    }

    this.portalService.updateTicket(ticket.id, { status }).subscribe({
      next: (updated) => {
        this.notificationService.notify('Ticket Status', `${updated.ticketCode} is now ${status}.`);
        this.loadData();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Status update failed.';
      },
    });
  }

  onMediaSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.mediaPreview = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  }

  async openCamera() {
    this.cameraError = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError = 'Camera is not supported in this browser.';
      return;
    }

    try {
      // Start stream first; we will bind it after overlay renders.
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });

      this.cameraOpen = true;
      await new Promise((resolve) => setTimeout(resolve, 0));

      const video = this.cameraVideo?.nativeElement;
      if (!video) {
        this.cameraError = 'Unable to open camera preview.';
        this.stopCameraStream();
        this.cameraOpen = false;
        return;
      }

      video.srcObject = this.cameraStream;
      video.setAttribute('playsinline', 'true');
      await video.play();
    } catch (err) {
      this.cameraError = err instanceof Error ? err.message : 'Camera permission denied or unavailable.';
      this.stopCameraStream();
      this.cameraOpen = false;
    }
  }

  captureFromCamera() {
    const video = this.cameraVideo?.nativeElement;
    const canvas = this.cameraCanvas?.nativeElement;
    if (!video || !canvas) {
      this.cameraError = 'Unable to capture photo.';
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.cameraError = 'Canvas not available.';
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    this.mediaPreview = canvas.toDataURL('image/jpeg', 0.9);
    this.closeCamera();
  }

  closeCamera() {
    this.cameraOpen = false;
    this.cameraError = '';
    this.stopCameraStream();
  }

  private stopCameraStream() {
    if (this.cameraStream) {
      for (const track of this.cameraStream.getTracks()) {
        track.stop();
      }
      this.cameraStream = null;
    }
  }

  openDirections(ticket: Ticket) {
    const destination = encodeURIComponent(ticket.locationAddress ?? '');
    if (!destination) {
      this.notificationService.notify('Directions', 'Ticket location address is missing.');
      return;
    }

    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  }

  canEdit(ticket: Ticket) {
    if (!this.user) {
      return false;
    }
    return this.user.role === 'user' && ticket.userId === this.user.id;
  }

  canDelete(ticket: Ticket) {
    if (!this.user) {
      return false;
    }
    return this.user.role === 'admin' || ticket.userId === this.user.id;
  }
}
