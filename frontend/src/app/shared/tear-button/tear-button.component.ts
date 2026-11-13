import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-tear-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      class="tear-btn"
      [class]="'variant-' + variant + ' size-' + size"
      [class.loading]="loading"
      [class.full-width]="fullWidth"
      [disabled]="disabled || loading"
      (click)="onClick($event)"
    >
      @if (loading) {
        <span class="btn-spinner" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="btn-spinner-svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" opacity="0.25"/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"/>
          </svg>
        </span>
      }

      <span class="btn-content" [class.invisible]="loading">
        <ng-content select="[slot=icon-start]"></ng-content>
        <span class="btn-label">
          <ng-content></ng-content>
        </span>
        <ng-content select="[slot=icon-end]"></ng-content>
      </span>

      <span class="tear-ripple" *ngFor="let ripple of ripples" [style.left.px]="ripple.x" [style.top.px]="ripple.y"></span>
    </button>
  `,
  styles: [`
    .tear-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
      font-weight: 600;
      border: 1px solid transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      user-select: none;
      text-decoration: none;
      overflow: hidden;
      transition:
        background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1),
        border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.15s cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .tear-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .tear-btn:active:not(:disabled) {
      transform: translateY(1px) scale(0.985);
    }

    .tear-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    /* Sizes */
    .size-sm {
      min-height: 36px;
      padding: 0 14px;
      font-size: 13px;
      gap: 6px;
      border-radius: var(--radius-sm);
    }

    .size-md {
      min-height: 44px;
      padding: 0 20px;
      font-size: 14px;
      gap: 8px;
      border-radius: var(--radius-md);
    }

    .size-lg {
      min-height: 52px;
      padding: 0 26px;
      font-size: 15px;
      gap: 10px;
      border-radius: var(--radius-lg);
    }

    .full-width {
      width: 100%;
    }

    /* Variants */
    .variant-primary {
      background: var(--color-primary-600);
      color: #FFFFFF;
      border-color: var(--color-primary-600);
      box-shadow: 0 1px 2px rgba(5, 150, 105, 0.2);
    }

    .variant-primary:hover:not(:disabled) {
      background: var(--color-primary-700);
      border-color: var(--color-primary-700);
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }

    .variant-secondary {
      background: var(--surface-strong);
      color: var(--text-primary);
      border-color: var(--border-strong);
    }

    .variant-secondary:hover:not(:disabled) {
      background: var(--surface-hover);
      border-color: var(--color-primary-500);
      color: var(--color-primary-600);
    }

    .variant-outline {
      background: transparent;
      color: var(--color-primary-600);
      border-color: var(--color-primary-500);
    }

    .variant-outline:hover:not(:disabled) {
      background: var(--color-primary-50);
      border-color: var(--color-primary-600);
    }

    .variant-danger {
      background: var(--color-danger-600);
      color: #FFFFFF;
      border-color: var(--color-danger-600);
      box-shadow: 0 1px 2px rgba(220, 38, 38, 0.2);
    }

    .variant-danger:hover:not(:disabled) {
      background: var(--color-danger-700);
      border-color: var(--color-danger-700);
      box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
    }

    .variant-ghost {
      background: transparent;
      color: var(--text-secondary);
      border-color: transparent;
    }

    .variant-ghost:hover:not(:disabled) {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    .variant-accent {
      background: var(--color-accent-500);
      color: #0F172A;
      border-color: var(--color-accent-500);
    }

    .variant-accent:hover:not(:disabled) {
      background: var(--color-accent-600);
      border-color: var(--color-accent-600);
    }

    /* Content & Spinner */
    .btn-content {
      display: inline-flex;
      align-items: center;
      gap: inherit;
      line-height: 1;
    }

    .btn-content.invisible {
      visibility: hidden;
    }

    .btn-spinner {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-spinner-svg {
      width: 20px;
      height: 20px;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .tear-ripple {
      position: absolute;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      transform: translate(-50%, -50%) scale(0);
      animation: ripple-effect 0.55s ease-out forwards;
      pointer-events: none;
    }

    @keyframes ripple-effect {
      to {
        transform: translate(-50%, -50%) scale(12);
        opacity: 0;
      }
    }
  `],
})
export class TearButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() fullWidth = false;

  @Output() buttonClick = new EventEmitter<MouseEvent>();

  ripples: Array<{ x: number; y: number }> = [];

  onClick(event: MouseEvent) {
    if (this.disabled || this.loading) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.ripples.push({ x, y });
    setTimeout(() => {
      this.ripples.shift();
    }, 600);

    this.buttonClick.emit(event);
  }
}
