import { Component, Input } from '@angular/core';

let uid = 0;
/** Tiny area trend line — hand-built SVG, no chart dependency. */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    <figure class="sparkline">
      @if (peak > 0) {
        <div class="plot">
          <svg
            viewBox="0 0 100 36"
            preserveAspectRatio="none"
            role="img"
            [attr.aria-label]="label"
          >
            <defs>
              <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.28" />
                <stop offset="100%" [attr.stop-color]="color" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path class="area" [attr.d]="areaPath" [attr.fill]="'url(#' + gradientId + ')'" />
            <polyline
              class="line"
              pathLength="100"
              fill="none"
              [attr.points]="linePoints"
              [attr.stroke]="color"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <i
            class="end-dot"
            [style.left.%]="lastX"
            [style.top.%]="lastY * 100 / 36"
            [style.background]="color"
          ></i>
        </div>
        <div class="days" aria-hidden="true">
          @for (day of dayLabels; track $index) {
            <span>{{ day }}</span>
          }
        </div>
        <figcaption class="legend">
          <span class="peak">Peak {{ peak }}</span>
          <span class="latest">Latest {{ latest }}</span>
        </figcaption>
      } @else {
        <p class="empty">No data to chart yet.</p>
      }
    </figure>
  `,
  styles: [
    `
      .sparkline {
        margin: 0;
      }
      .plot {
        position: relative;
      }
      svg {
        display: block;
        width: 100%;
        height: 96px;
        overflow: visible;
      }
      .end-dot {
        position: absolute;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        animation: spark-fade 0.4s ease 0.9s both;
      }
      .days {
        display: flex;
        justify-content: space-between;
        margin: 6px 2px 0;
        color: var(--text-muted);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .days span:nth-child(odd) {
        visibility: hidden;
      }
      .line {
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: spark-draw 1.1s cubic-bezier(0.65, 0, 0.15, 1) both;
      }
      .area {
        opacity: 0;
        animation: spark-fade 0.9s ease 0.35s both;
      }
      @keyframes spark-draw {
        to {
          stroke-dashoffset: 0;
        }
      }
      @keyframes spark-fade {
        to {
          opacity: 1;
        }
      }
      .legend {
        display: flex;
        justify-content: space-between;
        margin: 10px 0 0;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .empty {
        margin: 0;
        padding: 32px 0;
        color: var(--text-muted);
        font-size: 14px;
        text-align: center;
      }
      @media (prefers-reduced-motion: reduce) {
        .line,
        .area,
        .end-dot {
          animation: none;
          opacity: 1;
          stroke-dashoffset: 0;
        }
      }
    `,
  ],
})
export class SparklineComponent {
  private readonly id = ++uid;

  @Input({ required: true }) data: number[] = [];
  @Input() label = 'Trend';
  @Input() color = 'var(--chart-1)';

  get gradientId() {
    return `spark-grad-${this.id}`;
  }

  get dayLabels(): string[] {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    // data[0] is 6 days ago, data[6] is today
    return this.data.map((_, index) => names[(today - (this.data.length - 1 - index) + 7) % 7]);
  }

  get peak() {
    return Math.max(0, ...this.data);
  }

  get latest() {
    return this.data.length ? this.data[this.data.length - 1] : 0;
  }

  private get coords(): Array<[number, number]> {
    const max = Math.max(1, this.peak);
    const step = this.data.length > 1 ? 100 / (this.data.length - 1) : 100;
    return this.data.map((value, index) => [
      index * step,
      32 - Math.round((value / max) * 28),
    ]);
  }

  get linePoints() {
    return this.coords.map(([x, y]) => `${x},${y}`).join(' ');
  }

  get areaPath() {
    const points = this.coords;
    if (!points.length) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const line = points.map(([x, y]) => `L ${x} ${y}`).join(' ');
    return `M ${first[0]} 36 ${line} L ${last[0]} 36 Z`;
  }

  get lastX() {
    const coords = this.coords;
    return coords.length ? coords[coords.length - 1][0] : 0;
  }

  get lastY() {
    const coords = this.coords;
    return coords.length ? coords[coords.length - 1][1] : 0;
  }
}
