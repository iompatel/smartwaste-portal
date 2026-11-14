import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppNotification } from '../../models/types';

@Component({
  selector: 'app-notification-stack',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-stack-container">
      <button
        type="button"
        class="bell-trigger-btn"
        (click)="toggleOpen($event)"
        [attr.aria-expanded]="isOpen"
        aria-haspopup="true"
        aria-label="View notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        @if (unreadCount > 0) {
          <span class="notification-badge" [class.pulse]="unreadCount > 0">
            {{ unreadCount > 9 ? '9+' : unreadCount }}
          </span>
        }
      </button>

      @if (isOpen) {
        <div class="stack-panel" (click)="$event.stopPropagation()" role="region" aria-label="Notifications panel">
          <div class="stack-header">
            <div class="header-left">
              <h4>Notifications</h4>
              @if (unreadCount > 0) {
                <span class="count-pill">{{ unreadCount }} new</span>
              }
            </div>
            @if (notifications.length > 0) {
              <button
                type="button"
                class="mark-all-btn"
                (click)="onMarkAllRead()"
                [disabled]="markingAll"
              >
                {{ markingAll ? 'Marking...' : 'Mark all read' }}
              </button>
            }
          </div>

          <div class="stack-list">
            @for (item of notifications; track item.id) {
              <div
                class="notification-item"
                [class.unread]="!item.read"
                (click)="onNotificationClick(item.id)"
              >
                <div class="item-icon-col">
                  <div class="item-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  </div>
                </div>
                <div class="item-body">
                  <strong>{{ item.title }}</strong>
                  <p>{{ item.message }}</p>
                  <small>{{ item.createdAt | date:'shortTime' }}</small>
                </div>
                @if (!item.read) {
                  <span class="unread-dot" title="Unread"></span>
                }
              </div>
            } @empty {
              <div class="empty-notifications">
                <div class="empty-bell">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                </div>
                <p>No new notifications</p>
                <small>You're all caught up!</small>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-stack-container {
      position: relative;
    }

    .bell-trigger-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-full);
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .bell-trigger-btn:hover {
      background: var(--surface-hover);
      color: var(--text-primary);
    }

    .notification-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: var(--color-danger-600);
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--surface-strong);
    }

    .notification-badge.pulse {
      animation: badge-pulse 2s infinite;
    }

    @keyframes badge-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    .stack-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 320px;
      max-height: 460px;
      background: var(--surface-strong);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      z-index: var(--z-dropdown);
      animation: stack-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes stack-in {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .stack-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-left h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .count-pill {
      font-size: 11px;
      font-weight: 600;
      background: var(--color-primary-50);
      color: var(--color-primary-600);
      padding: 2px 8px;
      border-radius: var(--radius-full);
    }

    .mark-all-btn {
      background: transparent;
      border: none;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-primary-600);
      cursor: pointer;
      padding: 0;
    }

    .mark-all-btn:hover {
      text-decoration: underline;
    }

    .stack-list {
      overflow-y: auto;
      max-height: 380px;
    }

    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      position: relative;
      transition: background-color 0.15s ease;
    }

    .notification-item:hover {
      background: var(--surface-hover);
    }

    .notification-item.unread {
      background: var(--color-primary-50);
    }

    .notification-item.unread:hover {
      background: var(--color-primary-100);
    }

    .item-icon-col {
      flex-shrink: 0;
      margin-top: 2px;
    }

    .item-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg-elevated);
      color: var(--color-primary-600);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .item-body {
      flex: 1;
      min-width: 0;
    }

    .item-body strong {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
    }

    .item-body p {
      margin: 0 0 4px;
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .item-body small {
      font-size: 11px;
      color: var(--text-muted);
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-primary-600);
      flex-shrink: 0;
      margin-top: 6px;
    }

    .empty-notifications {
      padding: 36px 16px;
      text-align: center;
      color: var(--text-muted);
    }

    .empty-bell {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--bg-elevated);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 12px;
    }

    .empty-notifications p {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .empty-notifications small {
      font-size: 12px;
    }
  `],
})
export class NotificationStackComponent {
  @Input() notifications: AppNotification[] = [];
  @Input() markingAll = false;

  @Output() notificationClick = new EventEmitter<number>();
  @Output() markAllRead = new EventEmitter<void>();

  isOpen = false;

  get unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  toggleOpen(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  onNotificationClick(id: number) {
    this.notificationClick.emit(id);
  }

  onMarkAllRead() {
    this.markAllRead.emit();
  }

  @HostListener('document:click')
  onDocClick() {
    this.close();
  }
}
