import { Component, Input } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
}

/** Category columns with a ghost track — plain HTML/CSS, no chart dependency. */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <div class="bars" role="img" [attr.aria-label]="label + '. ' + ariaSummary">
      @for (bar of normalized; track bar.label) {
        <div class="bar-row">
          <span class="bar-value">{{ bar.value }}</span>
          <div class="bar-track">
            <i
              class="bar-fill"
              [style.height.%]="bar.pct"
              [style.animation-delay.ms]="80 + 60 * $index"
            ></i>
          </div>
          <span class="bar-label" [title]="bar.label">{{ bar.label }}</span>
        </div>
      } @empty {
        <p class="empty">No data to chart yet.</p>
      }
    </div>
  `,
  styles: [
    `
      .bars {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        min-height: 150px;
      }
      .bar-row {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .bar-value {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .bar-track {
        display: flex;
        align-items: flex-end;
        align-self: stretch;
        height: 96px;
        border-radius: 8px;
        background: var(--accent-soft);
      }
      .bar-fill {
        align-self: flex-end;
        display: block;
        width: min(34px, 100%);
        margin: 0 auto;
        border-radius: 8px 8px 4px 4px;
        background: linear-gradient(180deg, var(--chart-2), var(--chart-1));
        transform-origin: bottom;
        animation: bar-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @keyframes bar-rise {
        from {
          transform: scaleY(0);
        }
        to {
          transform: scaleY(1);
        }
      }
      .bar-label {
        overflow: hidden;
        max-width: 100%;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 600;
        letter-spacing: -0.01em;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-transform: capitalize;
      }
      .empty {
        margin: 0;
        padding: 32px 0;
        color: var(--text-muted);
        font-size: 14px;
        text-align: center;
      }
      @media (prefers-reduced-motion: reduce) {
        .bar-fill {
          animation: none;
        }
      }
    `,
  ],
})
export class BarChartComponent {
  @Input({ required: true }) data: BarDatum[] = [];
  @Input() label = 'Comparison';

  get normalized() {
    const max = Math.max(1, ...this.data.map((bar) => bar.value));
    return this.data.map((bar) => ({ ...bar, pct: (bar.value / max) * 100 }));
  }

  get ariaSummary() {
    return this.data.map((bar) => `${bar.label} ${bar.value}`).join(', ');
  }
}
