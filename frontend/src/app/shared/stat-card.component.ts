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
        min-height: 148px;
        padding: 24px;
        box-shadow: var(--shadow-soft);
        transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s ease;
      }
      .card:hover {
        transform: translateY(-2px);
        border-color: var(--accent);
      }
      .label {
        margin: 0;
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.43;
        letter-spacing: 0;
      }
      h3 {
        margin: 12px 0 0;
        font-size: 34px;
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
      .hint {
        margin: 12px 0 0;
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.43;
      }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = 0;
  @Input() hint = '';
}
