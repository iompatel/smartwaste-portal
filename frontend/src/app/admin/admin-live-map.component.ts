import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { WorkerLiveLocation } from '../core/api.types';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { SectionHeaderComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';
import { LiveMapComponent } from '../shared/live-map.component';

@Component({
  selector: 'app-admin-live-map',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonDirective, SectionHeaderComponent, SurfaceComponent, LiveMapComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header eyebrow="Field operations" title="Live worker map" description="Latest shared worker locations, refreshed every 3 seconds.">
        <button action type="button" appButton variant="outline" [disabled]="loading()" (click)="refresh()">Refresh</button>
      </app-section-header>
      @if (error()) { <p role="alert" class="rounded-xl bg-danger/10 p-3 text-sm text-danger">{{ error() }}</p> }
      <div class="grid grid-cols-3 gap-3">
        <app-surface class="p-4"><p class="text-xs text-muted-foreground">Workers online</p><strong class="mt-2 block text-2xl">{{ onlineCount() }}</strong></app-surface>
        <app-surface class="p-4"><p class="text-xs text-muted-foreground">Sharing location</p><strong class="mt-2 block text-2xl text-brand">{{ trackedCount() }}</strong></app-surface>
        <app-surface class="p-4"><p class="text-xs text-muted-foreground">Last refresh</p><strong class="mt-2 block text-sm tabular-nums">{{ updatedAt() ? (updatedAt() | date:'HH:mm:ss') : 'Waiting' }}</strong></app-surface>
      </div>
      <div class="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <app-surface class="p-4">
          <label for="map-worker-search" class="mb-2 block text-xs font-medium">Find a worker</label>
          <input id="map-worker-search" [(ngModel)]="search" placeholder="Name or worker ID" [class]="inputCls" />
          <div class="mt-4 flex max-h-[520px] flex-col gap-2 overflow-y-auto">
            @for (worker of filteredWorkers(); track worker.workerId) {
              <button type="button" [attr.aria-pressed]="selectedId() === worker.workerId" (click)="selectWorker(worker.workerId)"
                class="rounded-xl border p-3 text-left transition-colors"
                [ngClass]="selectedId() === worker.workerId ? 'border-brand bg-brand/10' : 'border-border hover:bg-muted'">
                <span class="flex items-center justify-between gap-2"><span class="text-sm font-medium">{{ worker.firstName }} {{ worker.lastName }}</span><span class="size-2 rounded-full" [ngClass]="worker.workerOnline ? 'bg-brand' : 'bg-muted-foreground'"></span></span>
                <span class="mt-1 block text-xs text-muted-foreground">Worker #{{ worker.workerId }} · {{ worker.workerOnline ? 'Online' : 'Offline' }}</span>
                <span class="mt-2 block text-xs" [class.text-brand]="worker.location">{{ worker.location ? 'Location shared' : 'Location unavailable' }}</span>
              </button>
            } @empty { <p class="py-6 text-center text-xs text-muted-foreground">{{ loading() ? 'Loading workers...' : 'No workers found.' }}</p> }
          </div>
        </app-surface>
        <app-surface class="min-w-0 overflow-hidden">
          <div class="flex items-center justify-between gap-3 border-b border-border p-4">
            <span class="flex items-center gap-2 text-sm font-medium"><app-icon name="map-pin" class="size-4 text-brand"></app-icon>Live Operative Map</span>
          </div>
          <div class="relative h-[430px] sm:h-[520px]">
            @if (selectedWorker()?.location; as loc) {
              <app-live-map
                [workerLat]="loc.latitude"
                [workerLng]="loc.longitude"
                [workerHeading]="loc.heading"
                [workerName]="selectedWorker()!.firstName + ' ' + selectedWorker()!.lastName"
                [destLat]="selectedWorker()?.activeTickets?.[0]?.locationLatitude"
                [destLng]="selectedWorker()?.activeTickets?.[0]?.locationLongitude"
                [destAddress]="selectedWorker()?.activeTickets?.[0]?.locationAddress || 'Active Route Stop'"
              ></app-live-map>
            } @else {
              <div class="flex size-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center">
                <app-icon name="map-pin" class="size-8 text-muted-foreground"></app-icon>
                <p class="text-sm font-medium">Waiting for a shared location</p>
                <p class="max-w-sm text-xs leading-5 text-muted-foreground">Select an online worker who has allowed location sharing. Offline and expired locations are hidden.</p>
              </div>
            }
          </div>
          @if (selectedWorker(); as worker) {
            <div class="border-t border-border p-4 sm:p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><h3 class="text-sm font-semibold">{{ worker.firstName }} {{ worker.lastName }} · #{{ worker.workerId }}</h3>
                  <p class="mt-1 text-xs text-muted-foreground">{{ worker.workerOnline ? 'Online' : 'Offline' }} · {{ worker.activeTickets.length }} active tickets</p></div>
                @if (worker.location) { <a [href]="directionsUrl(worker)" target="_blank" rel="noopener noreferrer" appButton variant="outline">Open in Google Maps</a> }
              </div>
              @if (worker.location; as location) {
                <p class="mt-3 text-xs text-muted-foreground">GPS accuracy: {{ location.accuracy | number:'1.0-0' }} m · Last fix: {{ location.updatedAt | date:'medium' }}</p>
              } @else { <p class="mt-3 text-xs text-muted-foreground">No fresh GPS location is available for this worker.</p> }
              @for (ticket of worker.activeTickets; track ticket.id) {
                <p class="mt-3 border-t border-border/50 pt-3 text-xs"><span class="font-medium">{{ ticket.ticketCode }}</span> · {{ ticket.status.replace('_', ' ') }}<span class="mt-1 block text-muted-foreground">{{ ticket.locationAddress }}</span></p>
              }
            </div>
          }
        </app-surface>
      </div>
    </div>
  `,
})
export class AdminLiveMapComponent implements OnInit, OnDestroy {
  readonly inputCls = inputClassName;
  workers = signal<WorkerLiveLocation[]>([]);
  selectedId = signal<number | null>(null);
  updatedAt = signal<string>('');
  loading = signal(false);
  error = signal('');
  mapPreview = signal<SafeResourceUrl | null>(null);
  search = '';
  onlineCount = computed(() => this.workers().filter((worker) => worker.workerOnline).length);
  trackedCount = computed(() => this.workers().filter((worker) => worker.location).length);
  selectedWorker = computed(() => this.workers().find((worker) => worker.workerId === this.selectedId()) ?? null);
  private timer?: number;
  private destroyed = false;
  private previewCoordinates = '';

  constructor(private admin: AdminService, private sanitizer: DomSanitizer) {}

  filteredWorkers(): WorkerLiveLocation[] {
    const query = this.search.trim().toLowerCase();
    return this.workers().filter((worker) => `${worker.firstName} ${worker.lastName} ${worker.workerId}`.toLowerCase().includes(query));
  }

  async ngOnInit() {
    await this.refresh();
    if (!this.destroyed) this.timer = window.setInterval(() => { if (!document.hidden) void this.refresh(); }, 3000);
  }

  async refresh() {
    if (this.loading() || this.destroyed) return;
    this.loading.set(true);
    try {
      const snapshot = await this.admin.getWorkerLocations();
      if (this.destroyed) return;
      this.workers.set(snapshot.workers);
      this.updatedAt.set(snapshot.updatedAt);
      this.error.set('');
      if (!snapshot.workers.some((worker) => worker.workerId === this.selectedId())) {
        this.selectedId.set(snapshot.workers.find((worker) => worker.location)?.workerId ?? snapshot.workers[0]?.workerId ?? null);
      }
      this.updatePreview();
    } catch (error: any) {
      if (!this.destroyed) {
        this.error.set(error?.message || 'Could not refresh worker locations.');
        this.workers.update((workers) => workers.map((worker) => ({ ...worker, location: null })));
        this.updatePreview();
      }
    } finally { this.loading.set(false); }
  }

  selectWorker(id: number) {
    this.selectedId.set(id);
    this.previewCoordinates = '';
    this.updatePreview();
  }

  private hasValidLocation(location?: { latitude?: number; longitude?: number } | null): boolean {
    return typeof location?.latitude === 'number' && Number.isFinite(location.latitude)
      && typeof location?.longitude === 'number' && Number.isFinite(location.longitude);
  }

  private updatePreview() {
    const worker = this.selectedWorker();
    if (!worker?.location || !this.hasValidLocation(worker.location)) {
      this.previewCoordinates = '';
      this.mapPreview.set(null);
      return;
    }
    const coordinates = `${worker.location.latitude},${worker.location.longitude}`;
    if (coordinates !== this.previewCoordinates) {
      this.previewCoordinates = coordinates;
      this.mapPreview.set(this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.google.com/maps?q=${encodeURIComponent(coordinates)}&z=16&output=embed`));
    }
  }

  directionsUrl(worker: WorkerLiveLocation): string {
    return worker.location && this.hasValidLocation(worker.location)
      ? `https://www.google.com/maps/search/?api=1&query=${worker.location.latitude},${worker.location.longitude}`
      : 'https://www.google.com/maps';
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
  }
}
