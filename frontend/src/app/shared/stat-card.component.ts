import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <article class="card">
      <p class="label">{{ label }}</p>
      <h3>{{ value }}</h3>
      <p class="hint">{{ hint }}</p>
    </article>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .card {
        position: relative;
        min-height: 9rem;
        overflow: hidden;
        background:
          radial-gradient(circle at 100% 0%, var(--accent-soft), transparent 52%),
          var(--content-surface);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        padding: 1rem;
        box-shadow: var(--shadow-card);
      }
      .card::after {
        content: '';
        position: absolute;
        right: 1rem;
        bottom: 1rem;
        width: 0.45rem;
        height: 0.45rem;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 0 5px var(--success-soft);
      }
      .label {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.68rem;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h3 {
        margin: 0.7rem 0 0;
        font-size: 2.35rem;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.06em;
      }
      .hint {
        max-width: calc(100% - 1.4rem);
        margin: 0.55rem 0 0;
        color: var(--text-muted);
        font-size: 0.75rem;
        line-height: 1.45;
      }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input() hint = '';
}
