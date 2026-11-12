import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ElementRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnimationService } from '../../services/animation.service';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

@Component({
  selector: 'app-animated-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="animated-btn"
      [class]="computedClasses()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading()"
      [attr.aria-disabled]="disabled() || loading()"
      (click)="onClick($event)"
      (mousedown)="onMouseDown()"
      (mouseup)="onMouseUp()"
      (mouseleave)="onMouseLeave()"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd()"
    >
      @if (loading()) {
        <span class="btn-spinner" aria-hidden="true"></span>
        <span class="btn-text">{{ loadingText() }}</span>
      } @else {
        @if (icon() && !label()) {
          <span class="btn-icon" [innerHTML]="icon()"></span>
        } @else if (icon()) {
          <span class="btn-icon" [innerHTML]="icon()"></span>
          <span class="btn-text">{{ label() }}</span>
        } @else {
          <span class="btn-text">{{ label() }}</span>
        }
      }
      <span class="ripple" #ripple></span>
    </button>
  `,
  styles: [`
    .animated-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      border-radius: var(--radius-md);
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      overflow: hidden;
      transition: all 200ms cubic-bezier(0.22, 1, 0.36, 1);
      white-space: nowrap;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    /* Sizes */
    .animated-btn.size-sm { min-height: 36px; padding: 0 14px; font-size: 13px; gap: 6px; }
    .animated-btn.size-md { min-height: 44px; padding: 0 20px; font-size: 15px; gap: 8px; }
    .animated-btn.size-lg { min-height: 52px; padding: 0 28px; font-size: 16px; gap: 10px; }
    .animated-btn.size-icon { width: 44px; height: 44px; padding: 0; border-radius: var(--radius-full); }

    /* Variants */
    .animated-btn.variant-primary {
      background: var(--brand);
      color: var(--text-on-primary);
      box-shadow: var(--shadow-sm);
    }
    .animated-btn.variant-primary:hover:not(:disabled) {
      background: var(--brand-hover);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .animated-btn.variant-primary:active:not(:disabled) {
      transform: scale(0.98);
    }

    .animated-btn.variant-secondary {
      background: var(--surface-strong);
      color: var(--brand);
      border: 1px solid var(--border);
    }
    .animated-btn.variant-secondary:hover:not(:disabled) {
      background: var(--surface-hover);
      border-color: var(--border-strong);
    }

    .animated-btn.variant-ghost {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid transparent;
    }
    .animated-btn.variant-ghost:hover:not(:disabled) {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    .animated-btn.variant-danger {
      background: var(--danger);
      color: var(--text-inverse);
      box-shadow: var(--shadow-sm);
    }
    .animated-btn.variant-danger:hover:not(:disabled) {
      background: var(--danger-hover);
      box-shadow: var(--shadow-md);
    }

    .animated-btn.variant-outline {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }
    .animated-btn.variant-outline:hover:not(:disabled) {
      background: var(--surface-hover);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    /* Disabled state */
    .animated-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    /* Loading state */
    .animated-btn.loading .btn-text { opacity: 0; }
    .animated-btn.loading .btn-spinner { display: block; }

    .btn-spinner {
      display: none;
      width: 18px;
      height: 18px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Ripple effect */
    .ripple {
      position: absolute;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.3;
      transform: scale(0);
      pointer-events: none;
    }

    .ripple.active {
      animation: ripple 0.4s ease-out forwards;
    }

    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }

    /* Focus visible */
    .animated-btn:focus-visible {
      outline: 2px solid var(--border-focus);
      outline-offset: 2px;
    }

    /* Icon sizing */
    .btn-icon {
      display: flex;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
    }

    .animated-btn.size-sm .btn-icon { width: 16px; height: 16px; }
    .animated-btn.size-lg .btn-icon { width: 20px; height: 20px; }
    .animated-btn.size-icon .btn-icon { width: 22px; height: 22px; }
  `],
})
export class AnimatedButtonComponent {
  private readonly elementRef = inject(ElementRef<HTMLButtonElement>);
  private readonly animationService = inject(AnimationService);

  @Input() label = signal('');
  @Input() icon = signal('');
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = signal(false);
  @Input() loading = signal(false);
  @Input() loadingText = signal('Loading...');
  @Input() ripple = true;

  @Output() clicked = new EventEmitter<MouseEvent>();

  computedClasses = computed(() => [
    'animated-btn',
    `variant-${this.variant}`,
    `size-${this.size}`,
    this.loading() ? 'loading' : '',
  ]);

  onClick(event: MouseEvent) {
    if (this.disabled() || this.loading()) return;
    if (this.ripple) {
      this.animationService.ripple(this.elementRef.nativeElement, event);
    }
    this.clicked.emit(event);
  }

  @HostListener('mousedown')
  onMouseDown() {
    if (this.disabled() || this.loading()) return;
    this.elementRef.nativeElement.style.transform = 'scale(0.98)';
  }

  @HostListener('mouseup')
  @HostListener('mouseleave')
  onMouseUp() {
    if (this.disabled() || this.loading()) return;
    this.elementRef.nativeElement.style.transform = '';
  }

  onMouseLeave() {
    this.onMouseUp();
  }

  onTouchStart(event: TouchEvent) {
    if (this.disabled() || this.loading()) return;
    this.elementRef.nativeElement.style.transform = 'scale(0.98)';
  }

  onTouchEnd() {
    this.elementRef.nativeElement.style.transform = '';
  }
}