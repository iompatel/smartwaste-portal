import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { GoogleMapsService } from '../core/google-maps.service';
import { WorkerLiveLocation } from '../core/api.types';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { SectionHeaderComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';

@Component({
  selector: 'app-admin-live-map',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonDirective, SectionHeaderComponent, SurfaceComponent],
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
            <span class="flex items-center gap-2 text-sm font-medium"><app-icon name="map-pin" class="size-4 text-brand"></app-icon>Google Maps</span>
            @if (interactive()) { <label class="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" [(ngModel)]="followWorker" />Follow selected worker</label> }
          </div>
          <div class="relative h-[430px] sm:h-[520px]">
            <div #mapCanvas class="size-full" [class.hidden]="!interactive()"></div>
            @if (!interactive()) {
              @if (mapPreview(); as preview) {
                <iframe title="Selected worker's current location on Google Maps" [src]="preview" class="size-full border-0" referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>
              } @else {
                <div class="flex size-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center">
                  <app-icon name="map-pin" class="size-8 text-muted-foreground"></app-icon>
                  <p class="text-sm font-medium">Waiting for a shared location</p>
                  <p class="max-w-sm text-xs leading-5 text-muted-foreground">Select an online worker who has allowed location sharing. Offline and expired locations are hidden.</p>
                </div>
              }
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
export class AdminLiveMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas') canvas!: ElementRef<HTMLDivElement>;
  readonly inputCls = inputClassName;
  workers = signal<WorkerLiveLocation[]>([]);
  selectedId = signal<number | null>(null);
  updatedAt = signal<string>('');
  loading = signal(false);
  error = signal('');
  interactive = signal(false);
  mapPreview = signal<SafeResourceUrl | null>(null);
  search = '';
  followWorker = true;
  onlineCount = computed(() => this.workers().filter((worker) => worker.workerOnline).length);
  trackedCount = computed(() => this.workers().filter((worker) => worker.location).length);
  selectedWorker = computed(() => this.workers().find((worker) => worker.workerId === this.selectedId()) ?? null);
  private timer?: number;
  private destroyed = false;
  private map: any;
  private maps: any;
  private markers = new Map<number, any>();
  private previewCoordinates = '';

  constructor(private admin: AdminService, private googleMaps: GoogleMapsService, private sanitizer: DomSanitizer) {
    effect(() => {
      if (this.googleMaps.authFailed() && !this.destroyed) { this.interactive.set(false); this.updateMap(); }
    });
  }

  filteredWorkers(): WorkerLiveLocation[] {
    const query = this.search.trim().toLowerCase();
    return this.workers().filter((worker) => `${worker.firstName} ${worker.lastName} ${worker.workerId}`.toLowerCase().includes(query));
  }

  async ngAfterViewInit() {
    if (this.googleMaps.configured) void this.initializeMap();
    await this.refresh();
    if (!this.destroyed) this.timer = window.setInterval(() => { if (!document.hidden) void this.refresh(); }, 3000);
  }

  private async initializeMap() {
    try {
      this.maps = await this.googleMaps.load();
      if (this.destroyed) return;
      this.interactive.set(true);
      this.map = new this.maps.Map(this.canvas.nativeElement, { center: { lat: 22.3, lng: 72.6 }, zoom: 12, renderingType: this.maps.RenderingType.RASTER, mapTypeControl: false, streetViewControl: false });
      requestAnimationFrame(() => {
        if (!this.destroyed) { this.maps.event.trigger(this.map, 'resize'); this.updateMap(); }
      });
    } catch {
      // The keyless Google Maps preview remains available if the SDK cannot load.
      this.interactive.set(false);
      this.updateMap();
    }
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
      this.updateMap();
    } catch (error: any) {
      if (!this.destroyed) {
        this.error.set(error?.message || 'Could not refresh worker locations.');
        this.workers.update((workers) => workers.map((worker) => ({ ...worker, location: null })));
        this.updateMap();
      }
    } finally { this.loading.set(false); }
  }

  selectWorker(id: number) {
    this.selectedId.set(id);
    this.previewCoordinates = '';
    this.updateMap();
  }

  private updateMap() {
    const worker = this.selectedWorker();
    if (this.map && this.maps) {
      const visible = new Set<number>();
      for (const item of this.workers()) {
        if (!item.location) continue;
        visible.add(item.workerId);
        const position = { lat: item.location.latitude, lng: item.location.longitude };
        let marker = this.markers.get(item.workerId);
        if (!marker) {
          marker = new this.maps.Marker({ map: this.map, position, title: `${item.firstName} ${item.lastName} (#${item.workerId})`, label: { text: String(item.workerId), color: '#ffffff', fontSize: '11px' }, icon: { path: this.maps.SymbolPath.CIRCLE, scale: 15, fillColor: '#16856d', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 } });
          marker.addListener('click', () => this.selectWorker(item.workerId));
          this.markers.set(item.workerId, marker);
        } else marker.setPosition(position);
      }
      for (const [id, marker] of this.markers) {
        if (!visible.has(id)) { marker.setMap(null); this.markers.delete(id); }
      }
      if (this.followWorker && worker?.location) this.map.panTo({ lat: worker.location.latitude, lng: worker.location.longitude });
    }
    if (!worker?.location) {
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
    return worker.location ? `https://www.google.com/maps/search/?api=1&query=${worker.location.latitude},${worker.location.longitude}` : 'https://www.google.com/maps';
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
    for (const marker of this.markers.values()) { this.maps?.event.clearInstanceListeners(marker); marker.setMap(null); }
    this.markers.clear();
    if (this.map) this.maps?.event.clearInstanceListeners(this.map);
  }
}
