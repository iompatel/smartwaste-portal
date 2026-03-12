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
        border: 1px solid var(--glass-border);
        border-radius: 24px;
        padding: 0.92rem;
        box-shadow: var(--shadow-soft);
        backdrop-filter: blur(18px);
      }
      .label {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h3 {
        margin: 0.48rem 0 0;
        font-size: 1.95rem;
        line-height: 1;
        letter-spacing: -0.05em;
      }
      .hint {
        margin: 0.38rem 0 0;
        color: var(--text-muted);
        font-size: 0.76rem;
        line-height: 1.5;
      }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value = 0;
  @Input() hint = '';
}
