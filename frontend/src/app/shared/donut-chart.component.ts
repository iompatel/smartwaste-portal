import { Component, Input } from '@angular/core';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Ring chart with visible legend — hand-built SVG, no chart dependency. */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  template: `
    <figure class="donut">
      @if (total > 0) {
        <svg
          viewBox="0 0 42 42"
          role="img"
          [attr.aria-label]="label + '. ' + ariaSummary"
        >
          <circle class="track" cx="21" cy="21" r="15.9155" fill="none" stroke="var(--border)" stroke-width="4" />
          @for (slice of visible; track slice.label) {
            <circle
              class="slice"
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              [attr.stroke]="slice.color"
              stroke-width="4"
              stroke-linecap="round"
              [attr.stroke-dasharray]="slice.dash"
              [attr.stroke-dashoffset]="slice.offset"
            >
              <title>{{ slice.label }}: {{ slice.value }}</title>
            </circle>
          }
        </svg>
        <div class="center" aria-hidden="true">
          <strong>{{ total }}</strong>
          <span>total</span>
        </div>
        <figcaption class="legend">
          @for (slice of visible; track slice.label) {
            <span class="legend-item">
              <i class="swatch" [style.background]="slice.color"></i>
              {{ slice.label }}
              <strong>{{ slice.value }}</strong>
            </span>
          }
        </figcaption>
      } @else {
        <p class="empty">No data to chart yet.</p>
      }
    </figure>
  `,
  styles: [
    `
      .donut {
        position: relative;
        margin: 0;
        display: grid;
        justify-items: center;
      }
      svg {
        width: 168px;
        height: 168px;
        animation: donut-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes donut-in {
        from {
          opacity: 0;
          transform: scale(0.92) rotate(-24deg);
        }
        to {
          opacity: 1;
          transform: scale(1) rotate(0);
        }
      }
      .center {
        position: absolute;
        top: 84px;
        transform: translateY(-50%);
        display: grid;
        justify-items: center;
        pointer-events: none;
      }
      .center strong {
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .center span {
        margin-top: 4px;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 600;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px 16px;
        margin: 16px 0 0;
      }
      .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: var(--text-muted);
        font-size: 13px;
        text-transform: capitalize;
      }
      .legend-item strong {
        color: var(--text);
        font-weight: 600;
      }
      .swatch {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .empty {
        margin: 0;
        padding: 32px 0;
        color: var(--text-muted);
        font-size: 14px;
        text-align: center;
      }
      @media (prefers-reduced-motion: reduce) {
        svg {
          animation: none;
        }
      }
    `,
  ],
})
export class DonutChartComponent {
  @Input({ required: true }) slices: DonutSlice[] = [];
  @Input() label = 'Breakdown';

  get total() {
    return this.slices.reduce((sum, slice) => sum + slice.value, 0);
  }

  get visible() {
    let start = 0;
    return this.slices
      .filter((slice) => slice.value > 0)
      .map((slice) => {
        const pct = (slice.value / this.total) * 100;
        // dashoffset trick: 25 shifts the start to 12 o'clock
        const entry = { ...slice, pct, dash: `${pct} ${100 - pct}`, offset: 25 - start };
        start += pct;
        return entry;
      });
  }

  get ariaSummary() {
    return this.visible.map((slice) => `${slice.label} ${slice.value}`).join(', ');
  }
}
