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
      .card {
        background: var(--surface);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        padding: 16px;
        backdrop-filter: none;
        box-shadow: none;
      }
      .label {
        margin: 0;
        color: var(--text-muted);
        font-size: 12px;
        font-weight: 400;
        letter-spacing: -0.01em;
      }
      h3 {
        margin: 6px 0 0;
        font-size: 28px;
        font-weight: 600;
        line-height: 1.14;
        letter-spacing: -0.012em;
      }
      .hint {
        margin: 6px 0 0;
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.43;
      }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input() hint = '';
}
