import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../avatar/avatar.component';
import { RolePillComponent } from '../role-pill.component';
import { ShellNavItem } from '../../shell/shell-navigation';
import { User } from '../../models/types';

@Component({
  selector: 'app-profile-dropdown',
  standalone: true,
  imports: [CommonModule, RouterLink, AvatarComponent, RolePillComponent],
  template: `
    <div class="profile-dropdown-container">
      <button
        type="button"
        class="profile-trigger-btn"
        (click)="toggleMenu($event)"
        [attr.aria-expanded]="isOpen"
        aria-haspopup="true"
        aria-label="User profile menu"
      >
        <app-avatar
          [src]="user?.profileImage || ''"
          [name]="userName"
          [size]="'sm'"
          [status]="user?.role === 'worker' && user?.workerOnline ? 'online' : undefined"
        ></app-avatar>
        <span class="user-display-name">{{ user?.firstName || 'Account' }}</span>
        <svg
          class="dropdown-caret"
          [class.open]="isOpen"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      @if (isOpen) {
        <div class="dropdown-menu" role="menu" (click)="$event.stopPropagation()">
          <div class="menu-user-card">
            <app-avatar
              [src]="user?.profileImage || ''"
              [name]="userName"
              [size]="'md'"
            ></app-avatar>
            <div class="menu-user-info">
              <strong>{{ userName }}</strong>
              <small class="user-email" [title]="user?.email">{{ user?.email }}</small>
              <div class="user-role-badge">
                <app-role-pill [role]="user?.role || 'user'"></app-role-pill>
              </div>
            </div>
          </div>

          <div class="menu-divider"></div>

          <nav class="menu-nav-links" aria-label="Quick profile links">
            @for (item of navItems; track item.path) {
              <a
                [routerLink]="item.path"
                class="menu-link"
                (click)="onLinkClick()"
                role="menuitem"
              >
                <span class="menu-link-label">{{ item.label }}</span>
              </a>
            }
          </nav>

          <div class="menu-divider"></div>

          <div class="theme-row">
            <span class="theme-title">Theme</span>
            <div class="theme-switch-pills">
              <button
                type="button"
                class="theme-btn"
                [class.active]="currentTheme === 'light'"
                (click)="themeSelected.emit('light')"
                title="Light mode"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                <span>Light</span>
              </button>
              <button
                type="button"
                class="theme-btn"
                [class.active]="currentTheme === 'dark'"
                (click)="themeSelected.emit('dark')"
                title="Dark mode"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                <span>Dark</span>
              </button>
            </div>
          </div>

          <div class="menu-divider"></div>

          <button
            type="button"
            class="logout-menu-btn"
            (click)="onLogout()"
            role="menuitem"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .profile-dropdown-container {
      position: relative;
    }

    .profile-trigger-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 4px 10px 4px 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: var(--radius-full);
      cursor: pointer;
      color: var(--text-primary);
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .profile-trigger-btn:hover {
      background: var(--surface-hover);
      border-color: var(--border);
    }

    .user-display-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dropdown-caret {
      color: var(--text-muted);
      transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .dropdown-caret.open {
      transform: rotate(180deg);
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 260px;
      background: var(--surface-strong);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      padding: 12px;
      z-index: var(--z-dropdown);
      animation: menu-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    @keyframes menu-pop {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .menu-user-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px;
    }

    .menu-user-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .menu-user-info strong {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-email {
      font-size: 12px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .user-role-badge {
      margin-top: 4px;
    }

    .menu-divider {
      height: 1px;
      background: var(--border);
      margin: 10px -12px;
    }

    .menu-nav-links {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .menu-link {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .menu-link:hover {
      background: var(--surface-hover);
      color: var(--color-primary-600);
    }

    .theme-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px;
    }

    .theme-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .theme-switch-pills {
      display: inline-flex;
      background: var(--bg-elevated);
      border-radius: var(--radius-full);
      padding: 2px;
      gap: 2px;
    }

    .theme-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border: none;
      background: transparent;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .theme-btn.active {
      background: var(--surface-strong);
      color: var(--color-primary-600);
      box-shadow: var(--shadow-xs);
    }

    .logout-menu-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      font-size: 13px;
      font-weight: 600;
      color: var(--color-danger-600);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .logout-menu-btn:hover {
      background: var(--color-danger-50);
    }
  `],
})
export class ProfileDropdownComponent {
  @Input() user: User | null = null;
  @Input() navItems: ShellNavItem[] = [];
  @Input() currentTheme: 'light' | 'dark' = 'light';

  @Output() logout = new EventEmitter<void>();
  @Output() themeSelected = new EventEmitter<'light' | 'dark'>();

  isOpen = false;

  get userName(): string {
    if (!this.user) return 'User';
    return `${this.user.firstName || ''} ${this.user.lastName || ''}`.trim() || 'User';
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  onLinkClick() {
    this.close();
  }

  onLogout() {
    this.close();
    this.logout.emit();
  }

  @HostListener('document:click')
  onDocClick() {
    this.close();
  }
}
