import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton" [class]="type" [style.width]="width" [style.height]="height" [style.border-radius]="borderRadius"></div>
  `,
  styles: [`
    .skeleton {
      background: linear-gradient(
        90deg,
        var(--border) 25%,
        var(--border-strong) 50%,
        var(--border) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-pulse 1.5s ease-in-out infinite;
      border-radius: var(--radius-sm);
    }

    .skeleton.text {
      height: 1rem;
      width: 100%;
      border-radius: 4px;
    }

    .skeleton.title {
      height: 1.5rem;
      width: 60%;
      border-radius: 4px;
    }

    .skeleton.avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
    }

    .skeleton.avatar-sm {
      width: 32px;
      height: 32px;
    }

    .skeleton.avatar-lg {
      width: 56px;
      height: 56px;
    }

    .skeleton.card {
      height: 200px;
      border-radius: var(--radius-lg);
    }

    .skeleton.button {
      height: 48px;
      width: 120px;
      border-radius: var(--radius-md);
    }

    .skeleton.circle {
      border-radius: 50%;
    }

    .skeleton.rounded {
      border-radius: var(--radius-md);
    }

    @keyframes skeleton-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  @Input() type: 'text' | 'title' | 'avatar' | 'card' | 'button' | 'circle' | 'rounded' = 'text';
  @Input() width?: string;
  @Input() height?: string;
  @Input() borderRadius?: string;
}