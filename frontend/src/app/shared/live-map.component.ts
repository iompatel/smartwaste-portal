import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

declare const L: any;

@Component({
  selector: 'app-live-map',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative size-full overflow-hidden select-none bg-muted/40">
      <!-- Leaflet Map Container -->
      <div #mapContainer class="size-full z-0"></div>

      <!-- Map Overlay Controls -->
      <div class="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-between px-3 sm:px-4 z-10">
        <!-- Live Status Badge -->
        <div class="pointer-events-auto flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-1.5 shadow-md backdrop-blur-md">
          <span class="relative flex size-2.5">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
          </span>
          <span class="text-xs font-medium text-foreground tracking-tight">
            {{ etaText() }}
          </span>
          @if (distanceText()) {
            <span class="text-xs text-muted-foreground">· {{ distanceText() }}</span>
          }
        </div>

        <!-- Recenter Action Button -->
        <button
          type="button"
          (click)="recenter()"
          title="Recenter route view"
          aria-label="Recenter live map view"
          class="pointer-events-auto flex size-9 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-md backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <app-icon name="navigation" class="size-4 text-brand"></app-icon>
        </button>
      </div>

      <!-- Offline / No GPS State Banner -->
      @if (!hasWorkerCoordinates()) {
        <div class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm px-6 text-center">
          <div class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <app-icon name="map-pin-off" class="size-6"></app-icon>
          </div>
          <p class="text-sm font-medium text-foreground">Waiting for worker's live GPS</p>
          <p class="text-xs text-muted-foreground max-w-xs">
            Coordinates will update dynamically as soon as the assigned collection operative begins their route.
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    ::ng-deep .zomato-truck-marker {
      background: transparent;
      border: none;
    }

    ::ng-deep .zomato-dest-marker {
      background: transparent;
      border: none;
    }

    ::ng-deep .leaflet-container {
      font-family: inherit;
      width: 100%;
      height: 100%;
      background: #0f172a;
    }

    ::ng-deep .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(0, 0, 0, 0.4) !important;
      color: rgba(255, 255, 255, 0.5) !important;
      padding: 0 4px !important;
      border-radius: 4px;
      margin: 4px !important;
    }

    ::ng-deep .leaflet-control-attribution a {
      color: rgba(255, 255, 255, 0.7) !important;
      text-decoration: none;
    }
  `],
})
export class LiveMapComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  @Input() workerLat: number | null | undefined = null;
  @Input() workerLng: number | null | undefined = null;
  @Input() workerHeading: number | null | undefined = null;
  @Input() workerName: string = 'Field Operative';

  @Input() destLat: number | null | undefined = null;
  @Input() destLng: number | null | undefined = null;
  @Input() destAddress: string = 'Collection destination';

  @Input() polyline: [number, number][] = [];
  @Input() etaMinutes: number | null | undefined = null;
  @Input() distanceMeters: number | null | undefined = null;

  etaText = signal<string>('Live GPS Active');
  distanceText = signal<string>('');
  hasWorkerCoordinates = signal<boolean>(false);

  private map: any = null;
  private workerMarker: any = null;
  private destMarker: any = null;
  private routeLine: any = null;
  private routeGlowLine: any = null;
  private accuracyCircle: any = null;

  private currentWorkerLat = 0;
  private currentWorkerLng = 0;
  private targetWorkerLat = 0;
  private targetWorkerLng = 0;
  private animFrameId?: number;
  private animStartTime = 0;
  private animDuration = 2800;
  private isDestroyed = false;
  private hasInitializedBounds = false;

  async ngOnInit() {
    if (typeof window === 'undefined') return;
    await this.initializeMap();
    this.updateData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.map) {
      this.updateData();
    }
  }

  private async initializeMap() {
    try {
      const leaflet = await import('leaflet');
      const LInstance = (leaflet as any).default || leaflet;

      if (this.isDestroyed || !this.mapContainer?.nativeElement) return;

      const initialLat = this.workerLat ?? this.destLat ?? 23.0225;
      const initialLng = this.workerLng ?? this.destLng ?? 72.5714;

      this.map = LInstance.map(this.mapContainer.nativeElement, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });

      // CartoDB Voyager raster tiles for clean street and road contrast with CARTO API key
      const cartoKey =
        (typeof window !== 'undefined' && (window as any).__SWMS_CONFIG__?.CARTO_KEY) ||
        'cb1_5cbq_1_5bc9df9be5c6d78bf30d1a09';
      const tileUrl = cartoKey
        ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      LInstance.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.map);

      // Add zoom control at bottom right to avoid blocking top badges
      LInstance.control.zoom({ position: 'bottomright' }).addTo(this.map);
    } catch (err) {
      console.warn('[live-map] Could not initialize Leaflet map:', err);
    }
  }

  updateData() {
    const hasWorker = Number.isFinite(this.workerLat) && Number.isFinite(this.workerLng);
    const hasDest = Number.isFinite(this.destLat) && Number.isFinite(this.destLng);
    this.hasWorkerCoordinates.set(hasWorker);

    // Update status pill text
    if (this.etaMinutes && this.etaMinutes > 0) {
      this.etaText.set(`Arriving in ~${this.etaMinutes} min`);
    } else if (this.distanceMeters !== null && this.distanceMeters !== undefined) {
      this.etaText.set(this.distanceMeters <= 250 ? 'Arriving shortly' : 'Operative En Route');
    } else {
      this.etaText.set(hasWorker ? 'Live tracking active' : 'Waiting for GPS fix');
    }

    if (this.distanceMeters !== null && this.distanceMeters !== undefined) {
      this.distanceText.set(
        this.distanceMeters < 1000
          ? `${this.distanceMeters} m away`
          : `${(this.distanceMeters / 1000).toFixed(1)} km away`
      );
    } else {
      this.distanceText.set('');
    }

    if (!this.map || typeof window === 'undefined') return;

    // 1. Destination Marker
    if (hasDest) {
      const destCoords: [number, number] = [Number(this.destLat), Number(this.destLng)];
      if (!this.destMarker) {
        import('leaflet').then((leaflet) => {
          const LInstance = (leaflet as any).default || leaflet;
          const icon = LInstance.divIcon({
            className: 'zomato-dest-marker',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            html: `
              <div class="relative flex size-9 items-center justify-center">
                <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/30"></span>
                <span class="relative flex size-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </span>
              </div>
            `,
          });
          this.destMarker = LInstance.marker(destCoords, { icon }).addTo(this.map);
          this.destMarker.bindTooltip(this.destAddress, { direction: 'top', offset: [0, -32] });
        });
      } else {
        this.destMarker.setLatLng(destCoords);
      }
    }

    // 2. Smooth Gliding Worker Vehicle Marker
    if (hasWorker) {
      const nextLat = Number(this.workerLat);
      const nextLng = Number(this.workerLng);
      const heading = this.workerHeading ?? 0;

      if (!this.workerMarker) {
        this.currentWorkerLat = nextLat;
        this.currentWorkerLng = nextLng;
        this.targetWorkerLat = nextLat;
        this.targetWorkerLng = nextLng;

        import('leaflet').then((leaflet) => {
          const LInstance = (leaflet as any).default || leaflet;
          const icon = this.createVehicleIcon(LInstance, heading);
          this.workerMarker = LInstance.marker([nextLat, nextLng], { icon, zIndexOffset: 1000 }).addTo(this.map);
          this.workerMarker.bindTooltip(`${this.workerName} (Live)`, { direction: 'top', offset: [0, -24] });
        });
      } else {
        // Start smooth 60fps linear interpolation from current to target
        this.startMarkerGlide(nextLat, nextLng, heading);
      }
    }

    // 3. Route Polyline
    this.updateRoutePolyline();

    // 4. Initial viewport bounds fitting
    if (!this.hasInitializedBounds && (hasWorker || hasDest)) {
      this.recenter();
      this.hasInitializedBounds = true;
    }
  }

  private createVehicleIcon(LInstance: any, heading: number) {
    return LInstance.divIcon({
      className: 'zomato-truck-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `
        <div class="relative flex size-11 items-center justify-center transition-transform duration-300" style="transform: rotate(${heading}deg);">
          <!-- Pulse halo -->
          <span class="absolute size-9 rounded-full bg-emerald-500/20 animate-pulse"></span>
          <!-- Vehicle container -->
          <div class="relative flex size-10 items-center justify-center rounded-full bg-slate-900 border-2 border-emerald-400 text-white shadow-xl">
            <!-- Waste Collection Truck SVG -->
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>
          </div>
          <!-- Direction heading triangle pointer -->
          <div class="absolute -top-1.5 flex justify-center">
            <span class="size-0 border-x-4 border-x-transparent border-b-6 border-b-emerald-400"></span>
          </div>
        </div>
      `,
    });
  }

  private startMarkerGlide(targetLat: number, targetLng: number, heading: number) {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }

    const startLat = this.currentWorkerLat;
    const startLng = this.currentWorkerLng;
    this.targetWorkerLat = targetLat;
    this.targetWorkerLng = targetLng;
    this.animStartTime = performance.now();

    // Update vehicle rotation icon
    if (this.workerMarker) {
      import('leaflet').then((leaflet) => {
        const LInstance = (leaflet as any).default || leaflet;
        this.workerMarker.setIcon(this.createVehicleIcon(LInstance, heading));
      });
    }

    const animate = (now: number) => {
      if (this.isDestroyed || !this.workerMarker) return;
      const elapsed = now - this.animStartTime;
      const progress = Math.min(1, elapsed / this.animDuration);

      // Smooth cubic ease-out interpolation
      const ease = 1 - Math.pow(1 - progress, 3);
      this.currentWorkerLat = startLat + (targetLat - startLat) * ease;
      this.currentWorkerLng = startLng + (targetLng - startLng) * ease;

      this.workerMarker.setLatLng([this.currentWorkerLat, this.currentWorkerLng]);

      if (progress < 1) {
        this.animFrameId = requestAnimationFrame(animate);
      }
    };

    this.animFrameId = requestAnimationFrame(animate);
  }

  private updateRoutePolyline() {
    if (!this.map) return;

    const coords: [number, number][] = (this.polyline && this.polyline.length > 0)
      ? this.polyline
      : (Number.isFinite(this.workerLat) && Number.isFinite(this.workerLng) && Number.isFinite(this.destLat) && Number.isFinite(this.destLng))
        ? [[Number(this.workerLat), Number(this.workerLng)], [Number(this.destLat), Number(this.destLng)]]
        : [];

    if (coords.length < 2) {
      if (this.routeLine) {
        this.map.removeLayer(this.routeLine);
        this.routeLine = null;
      }
      if (this.routeGlowLine) {
        this.map.removeLayer(this.routeGlowLine);
        this.routeGlowLine = null;
      }
      return;
    }

    import('leaflet').then((leaflet) => {
      const LInstance = (leaflet as any).default || leaflet;

      // Glow casing layer
      if (!this.routeGlowLine) {
        this.routeGlowLine = LInstance.polyline(coords, {
          color: '#059669',
          weight: 8,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(this.map);
      } else {
        this.routeGlowLine.setLatLngs(coords);
      }

      // Main crisp polyline layer
      if (!this.routeLine) {
        this.routeLine = LInstance.polyline(coords, {
          color: '#10b981',
          weight: 4,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: '6, 8',
        }).addTo(this.map);
      } else {
        this.routeLine.setLatLngs(coords);
      }
    });
  }

  recenter() {
    if (!this.map) return;

    const points: [number, number][] = [];
    if (Number.isFinite(this.workerLat) && Number.isFinite(this.workerLng)) {
      points.push([Number(this.workerLat), Number(this.workerLng)]);
    }
    if (Number.isFinite(this.destLat) && Number.isFinite(this.destLng)) {
      points.push([Number(this.destLat), Number(this.destLng)]);
    }

    if (points.length === 2) {
      import('leaflet').then((leaflet) => {
        const LInstance = (leaflet as any).default || leaflet;
        const bounds = LInstance.latLngBounds(points);
        this.map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
        });
      });
    } else if (points.length === 1) {
      this.map.setView(points[0], 16);
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
