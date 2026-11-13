import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';

import {
  Ticket,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  User,
  WorkerLocation,
} from '../../models/types';
import { formatTimeAgo } from '../../core/time.utils';
import { BrowserNotificationService } from '../../services/browser-notification.service';
import { PortalService } from '../../services/portal.service';
import { SESSION_SERVICE } from '../../services/session';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { FileUploadComponent } from '../../shared/file-upload/file-upload.component';
import { HelpfulRatingComponent } from '../../shared/helpful-rating/helpful-rating.component';
import { TearButtonComponent } from '../../shared/tear-button/tear-button.component';
import { LoaderComponent } from '../../shared/loader/loader.component';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    StatusBadgeComponent,
    FileUploadComponent,
    HelpfulRatingComponent,
    TearButtonComponent,
    LoaderComponent,
  ],
  templateUrl: './tickets.component.html',
  styleUrl: './tickets.component.scss',
})
export class TicketsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly portalService = inject(PortalService);
  private readonly authService = inject(SESSION_SERVICE);
  private readonly notificationService = inject(BrowserNotificationService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('cameraVideo') private readonly cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('cameraCanvas') private readonly cameraCanvas?: ElementRef<HTMLCanvasElement>;

  tickets: Ticket[] = [];
  workers: User[] = [];
  loading = true;
  saving = false;
  error = '';

  isFormOpen = false;
  editingTicket: Ticket | null = null;
  mediaPreview: string | null = null;
  cameraOpen = false;
  cameraError = '';
  searchTerm = '';
  statusFilter: 'all' | TicketStatus = 'all';
  priorityFilter: 'all' | TicketPriority = 'all';
  selectedWorkerId: Partial<Record<number, number>> = {};
  completionCode: Partial<Record<number, string>> = {};
  completionMedia: Partial<Record<number, string | null>> = {};
  chatOpen: Partial<Record<number, boolean>> = {};
  chatDraft: Partial<Record<number, string>> = {};
  messages: Partial<Record<number, TicketMessage[]>> = {};
  sendingMessage: Partial<Record<number, boolean>> = {};
  reviewRating: Partial<Record<number, number>> = {};
  reviewComment: Partial<Record<number, string>> = {};
  workerLocations: Partial<Record<number, WorkerLocation>> = {};
  workerMapUrls: Partial<Record<number, SafeResourceUrl>> = {};
  workerMapKeys: Partial<Record<number, string>> = {};
  nowTimestamp = Date.now();

  private cameraStream: MediaStream | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private locationTimer: ReturnType<typeof setInterval> | null = null;
  private chatPollTimer: ReturnType<typeof setInterval> | null = null;
  private liveClockTimer: ReturnType<typeof setInterval> | null = null;

  readonly statuses: TicketStatus[] = [
    'pending',
    'assigned',
    'accepted',
    'in_progress',
    'completed',
    'cancelled',
  ];
  readonly priorities: TicketPriority[] = ['low', 'medium', 'high'];
  readonly wasteTypes = [
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

  get filteredTickets() {
    const query = this.searchTerm.trim().toLowerCase();
    return this.tickets.filter((ticket) => {
      if (this.statusFilter !== 'all' && ticket.status !== this.statusFilter) return false;
      if (this.priorityFilter !== 'all' && ticket.priority !== this.priorityFilter) return false;
      if (!query) return true;
      return [ticket.ticketCode, ticket.wasteType, ticket.description, ticket.locationAddress]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  ngOnInit() {
    this.loadData();
    this.refreshTimer = setInterval(() => {
      if (!this.isFormOpen && !this.cameraOpen) this.loadData(true);
    }, 8_000);
    this.locationTimer = setInterval(() => this.refreshLiveLocations(), 6_000);
    this.liveClockTimer = setInterval(() => {
      this.nowTimestamp = Date.now();
    }, 5_000);
  }

  ngOnDestroy() {
    this.stopCameraStream();
    this.stopChatPolling();
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.locationTimer) clearInterval(this.locationTimer);
    if (this.liveClockTimer) clearInterval(this.liveClockTimer);
  }

  loadData(silent = false) {
    if (!silent) {
      this.loading = true;
      this.error = '';
    }
    const onError = (err: any) => {
      this.loading = false;
      if (!silent) this.error = err?.error?.message ?? 'Failed to load tickets.';
    };
    if (this.isAdmin) {
      forkJoin({ tickets: this.portalService.getTickets(), users: this.portalService.getUsers() }).subscribe({
        next: ({ tickets, users }) => {
          this.tickets = tickets;
          this.workers = users.filter((user) => user.role === 'worker');
          this.loading = false;
          this.refreshLiveLocations();
        },
        error: onError,
      });
      return;
    }
    this.portalService.getTickets().subscribe({
      next: (tickets) => {
        this.tickets = tickets;
        this.workers = [];
        this.loading = false;
        this.refreshLiveLocations();
      },
      error: onError,
    });
  }

  openCreate(source?: Ticket) {
    if (!this.canCreateTickets) return;
    this.editingTicket = null;
    this.form.reset({
      wasteType: source?.wasteType ?? '',
      description: source?.description ?? '',
      locationAddress: source?.locationAddress ?? this.user?.address ?? '',
      priority: source?.priority ?? 'medium',
    });
    this.mediaPreview = null;
    this.closeCamera();
    this.isFormOpen = true;
  }

  openEdit(ticket: Ticket) {
    if (!this.canEdit(ticket)) return;
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
    if (this.saving) return;
    if (!this.canCreateTickets || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.error = '';
    const payload = { ...this.form.getRawValue(), mediaData: this.mediaPreview };
    const request = this.editingTicket
      ? this.portalService.updateTicket(this.editingTicket.id, payload)
      : this.portalService.createTicket(payload);
    request.subscribe({
      next: (ticket) => {
        this.saving = false;
        this.cancelForm();
        this.notificationService.notify('Ticket Saved', `${ticket.ticketCode} saved successfully.`);
        this.loadData();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message ?? 'Unable to save ticket.';
      },
    });
  }

  assignTicket(ticket: Ticket) {
    const workerId = Number(this.selectedWorkerId[ticket.id] ?? 0);
    if (!workerId) {
      this.error = 'Select a worker first.';
      return;
    }
    this.portalService.assignTicket(ticket.id, workerId).subscribe({
      next: () => this.loadData(),
      error: (err) => (this.error = err?.error?.message ?? 'Unable to assign ticket.'),
    });
  }

  updateStatus(ticket: Ticket, status: TicketStatus) {
    this.portalService.updateTicketStatus(ticket.id, { status }).subscribe({
      next: (updated) => {
        this.notificationService.notify('Ticket Status', `${updated.ticketCode} is now ${status}.`);
        this.loadData(true);
      },
      error: (err) => (this.error = err?.error?.message ?? 'Status update failed.'),
    });
  }

  completeTicket(ticket: Ticket) {
    const completionCode = String(this.completionCode[ticket.id] ?? '').trim();
    const completionMediaData = this.completionMedia[ticket.id] ?? null;
    if (!/^\d{6}$/.test(completionCode) || !completionMediaData) {
      this.error = 'Enter the 6-digit completion code and attach an after-photo.';
      return;
    }
    this.portalService
      .updateTicketStatus(ticket.id, { status: 'completed', completionCode, completionMediaData })
      .subscribe({
        next: () => {
          delete this.completionCode[ticket.id];
          delete this.completionMedia[ticket.id];
          this.loadData();
        },
        error: (err) => (this.error = err?.error?.message ?? 'Unable to complete ticket.'),
      });
  }

  cancelTicket(ticket: Ticket) {
    if (!confirm(`Cancel ticket ${ticket.ticketCode}?`)) return;
    this.portalService.cancelTicket(ticket.id, 'Cancelled from the portal.').subscribe({
      next: () => this.loadData(),
      error: (err) => (this.error = err?.error?.message ?? 'Unable to cancel ticket.'),
    });
  }

  deleteTicket(ticket: Ticket) {
    if (!confirm(`Delete ticket ${ticket.ticketCode}?`)) return;
    this.portalService.deleteTicket(ticket.id).subscribe({
      next: () => this.loadData(),
      error: (err) => (this.error = err?.error?.message ?? 'Delete failed.'),
    });
  }

  toggleChat(ticket: Ticket) {
    this.chatOpen[ticket.id] = !this.chatOpen[ticket.id];
    if (this.chatOpen[ticket.id]) {
      this.loadMessages(ticket.id, false);
      this.startChatPolling();
    } else {
      const anyOpen = Object.values(this.chatOpen).some(Boolean);
      if (!anyOpen) this.stopChatPolling();
    }
  }

  loadMessages(ticketId: number, silent = false) {
    this.portalService.getTicketMessages(ticketId).subscribe({
      next: (messages) => {
        const prevCount = this.messages[ticketId]?.length ?? 0;
        this.messages[ticketId] = messages;
        if (messages.length > prevCount) {
          setTimeout(() => this.scrollChatToBottom(ticketId), 60);
        }
      },
      error: (err) => {
        if (!silent) {
          this.error = err?.error?.message ?? 'Unable to load conversation.';
        }
      },
    });
  }

  sendMessage(ticket: Ticket) {
    const message = String(this.chatDraft[ticket.id] ?? '').trim();
    if (!message || this.sendingMessage[ticket.id]) return;

    this.sendingMessage[ticket.id] = true;
    this.portalService.sendTicketMessage(ticket.id, message).subscribe({
      next: () => {
        this.chatDraft[ticket.id] = '';
        this.sendingMessage[ticket.id] = false;
        this.loadMessages(ticket.id, true);
        setTimeout(() => this.scrollChatToBottom(ticket.id), 80);
      },
      error: (err) => {
        this.sendingMessage[ticket.id] = false;
        this.error = err?.error?.message ?? 'Unable to send message.';
      },
    });
  }

  private startChatPolling() {
    if (this.chatPollTimer) return;
    this.chatPollTimer = setInterval(() => {
      if (document.hidden) return;
      Object.keys(this.chatOpen).forEach((idStr) => {
        const ticketId = Number(idStr);
        if (this.chatOpen[ticketId]) {
          this.loadMessages(ticketId, true);
        }
      });
    }, 2500);
  }

  private stopChatPolling() {
    if (this.chatPollTimer) {
      clearInterval(this.chatPollTimer);
      this.chatPollTimer = null;
    }
  }

  private scrollChatToBottom(ticketId: number) {
    const container = document.getElementById(`chat-scroll-${ticketId}`);
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }

  getTimeAgo(date: string | Date | null | undefined): string {
    return formatTimeAgo(date, this.nowTimestamp);
  }

  isSendingMessage(ticketId: number): boolean {
    return Boolean(this.sendingMessage[ticketId]);
  }

  submitReview(ticket: Ticket) {
    const rating = Number(this.reviewRating[ticket.id] ?? 0);
    const comment = String(this.reviewComment[ticket.id] ?? '').trim();
    this.portalService.reviewTicket(ticket.id, rating, comment).subscribe({
      next: () => this.loadData(),
      error: (err) => (this.error = err?.error?.message ?? 'Unable to submit rating.'),
    });
  }

  onFileUploadSelected(mediaData: string | null) {
    this.mediaPreview = mediaData;
  }

  onCompletionFileUploadSelected(mediaData: string | null, ticketId: number) {
    this.completionMedia[ticketId] = mediaData;
  }

  onMediaSelected(event: Event, completionTicketId?: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_500_000) {
      this.error = 'Choose a JPEG, PNG, or WebP image under 1.5 MB.';
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? '');
      if (completionTicketId) this.completionMedia[completionTicketId] = value;
      else this.mediaPreview = value;
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
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      this.cameraOpen = true;
      await new Promise((resolve) => setTimeout(resolve, 0));
      const video = this.cameraVideo?.nativeElement;
      if (!video) throw new Error('Unable to open camera preview.');
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
    if (!video || !canvas) return;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, width, height);
    this.mediaPreview = canvas.toDataURL('image/jpeg', 0.82);
    this.closeCamera();
  }

  closeCamera() {
    this.cameraOpen = false;
    this.cameraError = '';
    this.stopCameraStream();
  }

  private stopCameraStream() {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
  }

  openDirections(ticket: Ticket) {
    const destination = encodeURIComponent(ticket.locationAddress ?? '');
    if (destination) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
        '_blank',
        'noopener',
      );
    }
  }

  canEdit(ticket: Ticket) {
    return this.user?.role === 'user' && ['pending', 'assigned'].includes(ticket.status);
  }

  canCancel(ticket: Ticket) {
    return this.isAdmin
      ? !['completed', 'cancelled'].includes(ticket.status)
      : this.user?.role === 'user' && ['pending', 'assigned'].includes(ticket.status);
  }

  canDelete(ticket: Ticket) {
    return this.isAdmin || (this.user?.role === 'user' && ['pending', 'cancelled'].includes(ticket.status));
  }

  isOverdue(ticket: Ticket) {
    return Boolean(ticket.slaOverdue);
  }

  ticketTimeline(ticket: Ticket) {
    return ticket.statusHistory?.length
      ? ticket.statusHistory
      : [{ status: ticket.status, actorId: null, actorRole: null, note: null, createdAt: ticket.updatedAt }];
  }

  private refreshLiveLocations() {
    if (this.isWorker) return;
    const activeIds = new Set(
      this.tickets
        .filter((ticket) => ['accepted', 'in_progress'].includes(ticket.status) && ticket.workerId)
        .map((ticket) => ticket.id),
    );
    for (const id of Object.keys(this.workerLocations).map(Number)) {
      if (!activeIds.has(id)) {
        delete this.workerLocations[id];
        delete this.workerMapUrls[id];
        delete this.workerMapKeys[id];
      }
    }
    for (const ticketId of activeIds) {
      this.portalService.getWorkerLocation(ticketId).subscribe({
        next: (location) => {
          this.workerLocations[ticketId] = location;
          if (location.available && location.latitude !== undefined && location.longitude !== undefined) {
            const lat = location.latitude;
            const lng = location.longitude;
            // Only rebuild the iframe when the marker moves ~100 m, otherwise it reloads every poll.
            const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
            if (this.workerMapKeys[ticketId] === key) return;
            this.workerMapKeys[ticketId] = key;
            const delta = 0.005;
            const src =
              `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}` +
              `&layer=mapnik&marker=${lat}%2C${lng}`;
            this.workerMapUrls[ticketId] = this.sanitizer.bypassSecurityTrustResourceUrl(src);
          } else {
            delete this.workerMapUrls[ticketId];
            delete this.workerMapKeys[ticketId];
          }
        },
        error: () => {
          this.workerLocations[ticketId] = { available: false };
          delete this.workerMapUrls[ticketId];
          delete this.workerMapKeys[ticketId];
        },
      });
    }
  }
}
