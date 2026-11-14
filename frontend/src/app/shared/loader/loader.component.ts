import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kokonut-loader" [class]="'size-' + size" [class.center]="centered">
      <div class="loader-spinner">
        <svg viewBox="0 0 50 50" class="spinner-svg">
          <circle
            class="spinner-track"
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke-width="4"
          />
          <circle
            class="spinner-circle"
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke-width="4"
            stroke-linecap="round"
          />
        </svg>
      </div>
      @if (label) {
        <span class="loader-label">{{ label }}</span>
      }
    </div>
  `,
  styles: [`
    .kokonut-loader {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 500;
    }

    .kokonut-loader.center {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 32px 16px;
      width: 100%;
    }

    .loader-spinner {
      position: relative;
      display: inline-block;
    }

    .size-sm .spinner-svg { width: 18px; height: 18px; }
    .size-md .spinner-svg { width: 28px; height: 28px; }
    .size-lg .spinner-svg { width: 44px; height: 44px; }

    .spinner-svg {
      animation: rotate 1.6s linear infinite;
      transform-origin: center center;
    }

    .spinner-track {
      stroke: var(--border);
      opacity: 0.6;
    }

    .spinner-circle {
      stroke: var(--color-primary-600);
      stroke-dasharray: 90, 150;
      stroke-dashoffset: 0;
      animation: dash 1.4s ease-in-out infinite;
    }

    @keyframes rotate {
      100% {
        transform: rotate(360deg);
      }
    }

    @keyframes dash {
      0% {
        stroke-dasharray: 1, 200;
        stroke-dashoffset: 0;
      }
      50% {
        stroke-dasharray: 90, 200;
        stroke-dashoffset: -35px;
      }
      100% {
        stroke-dasharray: 90, 200;
        stroke-dashoffset: -124px;
      }
    }

    .loader-label {
      color: var(--text-secondary);
      font-size: 13px;
      letter-spacing: -0.01em;
    }
  `],
})
export class LoaderComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() label?: string;
  @Input() centered = false;
}
