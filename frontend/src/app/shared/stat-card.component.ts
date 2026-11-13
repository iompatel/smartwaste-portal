import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="card">
      <div class="card-header">
        <p class="label">{{ label }}</p>
        @if (icon) {
          <div class="card-icon" [ngClass]="icon">
            @switch (icon) {
              @case ('tickets') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              }
              @case ('open') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              }
              @case ('check') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              }
              @case ('worker') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              }
              @case ('toggle') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect><circle cx="16" cy="12" r="3"></circle></svg>
              }
              @case ('star') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              }
            }
          </div>
        }
      </div>
      <h3>{{ value }}</h3>
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
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .label {
        margin: 0;
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.43;
        letter-spacing: 0;
      }
      .card-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-md);
        background: var(--bg-elevated);
        color: var(--color-primary-600);
      }
      .card-icon.check {
        color: var(--color-success-600);
        background: var(--color-success-50);
      }
      .card-icon.open {
        color: var(--color-warning-600);
        background: var(--color-warning-50);
      }
      .card-icon.star {
        color: var(--color-accent-500);
        background: var(--color-accent-50);
      }
      h3 {
        margin: 12px 0 0;
        font-size: 34px;
        font-weight: 600;
        line-height: 1.1;
        letter-spacing: -0.02em;
      }
    `,
  ],
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = 0;
  @Input() icon?: string;
}
