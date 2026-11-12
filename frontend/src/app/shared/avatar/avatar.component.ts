import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avatar" [class]="sizeClass()" [style.background]="backgroundColor()">
      @if (src) {
        <img [src]="src" [alt]="alt" class="avatar-img" (error)="onImageError()" />
      } @else {
        <span class="avatar-text">{{ initials() }}</span>
      }
      @if (status) {
        <span class="avatar-status" [class]="status"></span>
      }
    </div>
  `,
  styles: [`
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      overflow: hidden;
      background: var(--brand);
      color: var(--text-on-primary);
      font-weight: 600;
      line-height: 1;
      flex-shrink: 0;
      position: relative;
      box-shadow: var(--shadow-sm);
    }

    .avatar-xs { width: 24px; height: 24px; font-size: 10px; }
    .avatar-sm { width: 32px; height: 32px; font-size: 11px; }
    .avatar-md { width: 44px; height: 44px; font-size: 14px; }
    .avatar-lg { width: 56px; height: 56px; font-size: 16px; }
    .avatar-xl { width: 80px; height: 80px; font-size: 24px; }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .avatar-text {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: var(--text-on-primary);
      font-weight: 600;
    }

    .avatar-status {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid var(--surface-strong);
      flex-shrink: 0;
    }

    .avatar-status.online {
      background: var(--success);
      box-shadow: 0 0 0 2px var(--success-bg);
    }

    .avatar-status.offline {
      background: var(--text-muted);
    }

    .avatar-status.busy {
      background: var(--warning);
      box-shadow: 0 0 0 2px var(--warning-bg);
    }

    .avatar-status.away {
      background: var(--info);
    }
  `],
})
export class AvatarComponent {
  @Input() src = '';
  @Input() alt = '';
  @Input() name = '';
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() status?: 'online' | 'offline' | 'busy' | 'away';
  @Input() color?: string;

  readonly sizeClass = computed(() => `avatar-${this.size}`);

  readonly initials = computed(() => {
    if (!this.name) return '?';
    const parts = this.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  readonly backgroundColor = computed(() => {
    if (this.color) return this.color;
    // Generate consistent color from name
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) {
      hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 65%, 45%)`;
  });

  onImageError(): void {
    // Image will be hidden by template logic when src fails
  }
}