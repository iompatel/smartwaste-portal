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
      font-weight: 500;
      letter-spacing: -0.01em;
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      cursor: pointer;
      user-select: none;
      text-decoration: none;
      overflow: hidden;
      transition:
        background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
        border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .tear-btn:hover:not(:disabled) {
      transform: translateY(-1px);
    }

    .tear-btn:active:not(:disabled) {
      transform: scale(0.965);
    }

    .tear-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    /* Sizes */
    .size-sm {
      min-height: 34px;
      padding: 0 14px;
      font-size: 13px;
      gap: 6px;
      border-radius: var(--radius-pill);
    }

    .size-md {
      min-height: 44px;
      padding: 0 20px;
      font-size: 14px;
      gap: 8px;
      border-radius: var(--radius-pill);
    }

    .size-lg {
      min-height: 52px;
      padding: 0 26px;
      font-size: 16px;
      gap: 10px;
      border-radius: var(--radius-pill);
    }

    .full-width {
      width: 100%;
    }

    /* Variants (Apple HIG System Palette) */
    .variant-primary {
      background: var(--apple-blue, #0071E3);
      color: #FFFFFF;
      border-color: rgba(0, 0, 0, 0.08);
      box-shadow: 0 1px 3px rgba(0, 113, 227, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .variant-primary:hover:not(:disabled) {
      background: #0077ED;
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);
    }

    .variant-primary:active:not(:disabled) {
      background: #0062C4;
    }

    .variant-secondary {
      background: rgba(0, 0, 0, 0.05);
      color: var(--text-primary);
      border-color: rgba(0, 0, 0, 0.06);
    }

    :host-context(body.theme-dark) .variant-secondary {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .variant-secondary:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.08);
    }

    :host-context(body.theme-dark) .variant-secondary:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.16);
    }

    .variant-outline {
      background: transparent;
      color: var(--apple-blue, #0071E3);
      border-color: rgba(0, 113, 227, 0.35);
    }

    .variant-outline:hover:not(:disabled) {
      background: rgba(0, 113, 227, 0.1);
      border-color: var(--apple-blue, #0071E3);
    }

    .variant-danger {
      background: #FF3B30;
      color: #FFFFFF;
      border-color: rgba(0, 0, 0, 0.08);
      box-shadow: 0 1px 3px rgba(255, 59, 48, 0.25);
    }

    .variant-danger:hover:not(:disabled) {
      background: #E6352B;
      box-shadow: 0 4px 14px rgba(255, 59, 48, 0.35);
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
      background: #34C759;
      color: #FFFFFF;
      border-color: rgba(0, 0, 0, 0.08);
      box-shadow: 0 1px 3px rgba(52, 199, 89, 0.25);
    }

    .variant-accent:hover:not(:disabled) {
      background: #28A745;
      box-shadow: 0 4px 14px rgba(52, 199, 89, 0.35);
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
