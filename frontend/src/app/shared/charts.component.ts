import { Component, computed, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ActivityDataPoint {
  day: string;
  reports: number;
  completed: number;
}

export interface CategoryDataPoint {
  name: string;
  value: number;
  fill: string;
}

@Component({
  selector: 'app-activity-area-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="relative flex h-full w-full select-none flex-col" (mouseleave)="hoverIndex.set(null)">
      <svg
        class="min-h-0 w-full flex-1 overflow-visible"
        viewBox="0 0 500 200"
        preserveAspectRatio="none"
        (mousemove)="onMouseMove($event)"
      >
        <defs>
          <linearGradient id="reportsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.25" />
            <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0.0" />
          </linearGradient>
          <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-2)" stop-opacity="0.2" />
            <stop offset="100%" stop-color="var(--chart-2)" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Horizontal grid lines -->
        @for (y of gridYLines(); track y) {
          <line
            x1="30"
            [attr.y1]="y"
            x2="485"
            [attr.y2]="y"
            stroke="currentColor"
            class="text-border/50"
            stroke-dasharray="3 3"
            stroke-width="1"
          />
        }

        <!-- Area fills -->
        <path [attr.d]="reportsAreaPath()" fill="url(#reportsGrad)" />
        <path [attr.d]="completedAreaPath()" fill="url(#completedGrad)" />

        <!-- Line strokes -->
        <path
          [attr.d]="reportsLinePath()"
          fill="none"
          stroke="var(--chart-1)"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          [attr.d]="completedLinePath()"
          fill="none"
          stroke="var(--chart-2)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Hover line and dots -->
        @if (hoveredPoint(); as hp) {
          <line
            [attr.x1]="hp.x"
            y1="15"
            [attr.x2]="hp.x"
            y2="175"
            stroke="currentColor"
            class="text-border"
            stroke-width="1"
            stroke-dasharray="2 2"
          />
          <circle [attr.cx]="hp.x" [attr.cy]="hp.reportsY" r="4" fill="var(--chart-1)" class="stroke-background stroke-2" />
          <circle [attr.cx]="hp.x" [attr.cy]="hp.completedY" r="4" fill="var(--chart-2)" class="stroke-background stroke-2" />
        }
      </svg>

      <!-- X-Axis Labels -->
      <div class="mt-2 flex justify-between px-6 text-[11px] text-muted-foreground">
        @for (item of data(); track item.day) {
          <span>{{ item.day }}</span>
        }
      </div>

      <!-- Floating Tooltip -->
      @if (hoveredPoint(); as hp) {
        <div
          class="pointer-events-none absolute z-10 grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl transition-all duration-75"
          [style.left.px]="tooltipX()"
          [style.top.px]="30"
        >
          <div class="font-medium text-foreground">{{ hp.item.day }}</div>
          <div class="grid gap-1">
            <div class="flex items-center justify-between gap-3 text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-primary"></span>
                Reports
              </span>
              <span class="font-mono font-medium text-foreground tabular-nums">{{ hp.item.reports }}</span>
            </div>
            <div class="flex items-center justify-between gap-3 text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-brand"></span>
                Completed
              </span>
              <span class="font-mono font-medium text-foreground tabular-nums">{{ hp.item.completed }}</span>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ActivityAreaChartComponent {
  data = input.required<ActivityDataPoint[]>();
  hoverIndex = signal<number | null>(null);

  private readonly minX = 35;
  private readonly maxX = 480;
  private readonly minY = 20;
  private readonly maxY = 170;
  private readonly maxVal = 60;

  gridYLines = computed(() => [
    this.minY,
    this.minY + (this.maxY - this.minY) * 0.33,
    this.minY + (this.maxY - this.minY) * 0.66,
    this.maxY
  ]);

  points = computed(() => {
    const list = this.data();
    if (!list.length) return [];
    const step = (this.maxX - this.minX) / (list.length - 1);
    return list.map((item, index) => {
      const x = this.minX + index * step;
      const reportsY = this.maxY - (item.reports / this.maxVal) * (this.maxY - this.minY);
      const completedY = this.maxY - (item.completed / this.maxVal) * (this.maxY - this.minY);
      return { x, reportsY, completedY, item, index };
    });
  });

  private buildCurvedPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  reportsLinePath = computed(() => {
    const pts = this.points().map((p) => ({ x: p.x, y: p.reportsY }));
    return this.buildCurvedPath(pts);
  });

  completedLinePath = computed(() => {
    const pts = this.points().map((p) => ({ x: p.x, y: p.completedY }));
    return this.buildCurvedPath(pts);
  });

  reportsAreaPath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const line = this.reportsLinePath();
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${this.maxY} L ${first.x} ${this.maxY} Z`;
  });

  completedAreaPath = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    const line = this.completedLinePath();
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${this.maxY} L ${first.x} ${this.maxY} Z`;
  });

  hoveredPoint = computed(() => {
    const idx = this.hoverIndex();
    if (idx === null) return null;
    return this.points()[idx] || null;
  });

  tooltipX = computed(() => {
    const hp = this.hoveredPoint();
    if (!hp) return 0;
    // Map SVG 0-500 to percentage-based or pixel approximation
    return Math.max(10, Math.min(320, (hp.x / 500) * 380 - 40));
  });

  onMouseMove(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const pts = this.points();
    if (!pts.length) return;
    const approxIndex = Math.round(ratio * (pts.length - 1));
    const clamped = Math.max(0, Math.min(pts.length - 1, approxIndex));
    this.hoverIndex.set(clamped);
  }
}

@Component({
  selector: 'app-waste-pie-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="relative mx-auto flex h-[190px] w-full items-center justify-center select-none" (mouseleave)="hoverItem.set(null)">
      <svg class="size-[190px] overflow-visible" viewBox="-100 -100 200 200">
        @for (seg of segments(); track seg.name) {
          <path
            [attr.d]="seg.path"
            [attr.fill]="seg.fill"
            class="transition-transform duration-200 cursor-pointer hover:opacity-90"
            (mouseenter)="hoverItem.set(seg)"
          />
        }
      </svg>
      <!-- Center Info -->
      <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        @if (hoverItem(); as item) {
          <span class="text-[24px] font-semibold tracking-[-0.06em] text-foreground">{{ item.value }}%</span>
          <span class="text-[10px] text-muted-foreground">{{ item.name }}</span>
        } @else if (centerValue()) {
          <span class="text-[26px] font-semibold tracking-[-0.06em] text-foreground">{{ centerValue() }}</span>
          <span class="text-[10px] text-muted-foreground">reports</span>
        }
      </div>
    </div>
  `
})
export class WastePieChartComponent {
  data = input.required<CategoryDataPoint[]>();
  centerValue = input<number | string>('');
  hoverItem = signal<CategoryDataPoint | null>(null);

  private readonly innerR = 57;
  private readonly outerR = 78;
  private readonly gap = 0.04; // rad gap between slices

  segments = computed(() => {
    const items = this.data();
    const total = items.reduce((sum, item) => sum + item.value, 0) || 100;
    let currentAngle = -Math.PI / 2; // start from top

    return items.map((item) => {
      const sliceAngle = (item.value / total) * (2 * Math.PI);
      const startAngle = currentAngle + this.gap / 2;
      const endAngle = currentAngle + sliceAngle - this.gap / 2;
      currentAngle += sliceAngle;

      const x1 = Math.cos(startAngle) * this.outerR;
      const y1 = Math.sin(startAngle) * this.outerR;
      const x2 = Math.cos(endAngle) * this.outerR;
      const y2 = Math.sin(endAngle) * this.outerR;

      const ix1 = Math.cos(endAngle) * this.innerR;
      const iy1 = Math.sin(endAngle) * this.innerR;
      const ix2 = Math.cos(startAngle) * this.innerR;
      const iy2 = Math.sin(startAngle) * this.innerR;

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
        `A ${this.outerR} ${this.outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
        `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
        `A ${this.innerR} ${this.innerR} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
        'Z'
      ].join(' ');

      return {
        ...item,
        path
      };
    });
  });
}
