import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { AvatarComponent } from './ui-components';
import { Role, View } from '../smartwaste/data';
import { BackendUser } from '../core/api.types';

export type AccountStatus = 'online' | 'away' | 'busy';
export type AccountTheme = 'light' | 'dark' | 'system';

export interface AccountOption {
  id: string | number;
  name: string;
  email: string;
  role?: string;
  initials?: string;
  plan?: string;
}

@Component({
  selector: 'app-profile-dropdown',
  standalone: true,
  imports: [CommonModule, IconComponent, AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative isolate inline-block" [class.z-50]="isOpen()">
      <!-- Trigger Button: Compact (Header) or Full (Sidebar) -->
      @if (variant() === 'compact') {
        <button
          type="button"
          aria-haspopup="menu"
          [attr.aria-expanded]="isOpen()"
          aria-label="Open account menu"
          (click)="toggleMenu()"
          class="relative flex items-center justify-center rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          <app-avatar
            [initials]="initials()"
            class="size-9"
            [online]="status() === 'online'"
          ></app-avatar>
        </button>
      } @else {
        <button
          type="button"
          aria-haspopup="menu"
          [attr.aria-expanded]="isOpen()"
          aria-label="Open account menu"
          (click)="toggleMenu()"
          class="flex w-full items-center gap-2.5 rounded-2xl border border-zinc-200/80 bg-white/90 p-2 pr-3 text-left outline-none transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60 cursor-pointer shadow-sm"
        >
          <app-avatar
            [initials]="initials()"
            class="size-8"
            [online]="status() === 'online'"
          ></app-avatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {{ displayName() }}
            </p>
            <p class="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
              {{ displaySubtitle() }}
            </p>
          </div>
          <app-icon
            name="chevrons-up-down"
            class="size-4 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500"
            [class.rotate-180]="isOpen()"
          ></app-icon>
        </button>
      }

      <!-- Kokonut UI Flyout Panel -->
      @if (isOpen()) {
        <div
          role="menu"
          [attr.aria-label]="displayName()"
          [ngClass]="panelPositionClasses()"
          class="absolute z-50 w-72 rounded-2xl border border-zinc-200/90 bg-white/95 p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/95 dark:shadow-[0_16px_36px_rgba(0,0,0,0.65)] animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          <!-- Main Menu Page -->
          @if (currentPage() === 'main') {
            <div class="flex flex-col">
              <!-- Identity Header -->
              <div class="flex items-start justify-between px-2.5 pt-2.5 pb-2.5">
                <div class="flex items-center gap-2.5 min-w-0">
                  <app-avatar
                    [initials]="initials()"
                    class="size-10"
                    [online]="status() === 'online'"
                  ></app-avatar>
                  <div class="flex min-w-0 flex-col text-left">
                    <span class="truncate font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-tight">
                      {{ displayName() }}
                    </span>
                    <span class="truncate text-xs text-zinc-500 dark:text-zinc-400 leading-tight">
                      {{ displayEmail() }}
                    </span>
                  </div>
                </div>
                <span class="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {{ displayPlan() }}
                </span>
              </div>

              <!-- Status Selector Row -->
              <div class="flex items-center justify-between border-0 py-1 pr-1 pl-2.5 text-xs">
                <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</span>
                <div class="flex items-center gap-0.5">
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="status() === 'online'"
                    (click)="setStatus('online')"
                    class="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors outline-none cursor-pointer"
                    [ngClass]="status() === 'online' ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'"
                  >
                    <span class="size-2 rounded-full bg-emerald-500"></span>
                    Online
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="status() === 'away'"
                    (click)="setStatus('away')"
                    class="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors outline-none cursor-pointer"
                    [ngClass]="status() === 'away' ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'"
                  >
                    <span class="size-2 rounded-full bg-amber-400"></span>
                    Away
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="status() === 'busy'"
                    (click)="setStatus('busy')"
                    class="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors outline-none cursor-pointer"
                    [ngClass]="status() === 'busy' ? 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'"
                  >
                    <span class="size-2 rounded-full bg-red-500"></span>
                    DND
                  </button>
                </div>
              </div>

              <!-- Theme Toggle Row -->
              <div class="flex items-center justify-between border-0 py-1 pr-1 pl-2.5 text-xs">
                <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Theme</span>
                <div class="flex rounded-[10px] bg-zinc-100 p-0.5 dark:bg-zinc-800">
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="theme() === 'light'"
                    aria-label="Light mode"
                    (click)="setTheme('light')"
                    class="relative grid h-7 w-8 place-items-center rounded-lg text-zinc-500 transition-colors outline-none cursor-pointer hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    [ngClass]="theme() === 'light' ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100' : ''"
                  >
                    <app-icon name="sun" class="size-3.5"></app-icon>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="theme() === 'dark'"
                    aria-label="Dark mode"
                    (click)="setTheme('dark')"
                    class="relative grid h-7 w-8 place-items-center rounded-lg text-zinc-500 transition-colors outline-none cursor-pointer hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    [ngClass]="theme() === 'dark' ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100' : ''"
                  >
                    <app-icon name="moon" class="size-3.5"></app-icon>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="theme() === 'system'"
                    aria-label="System mode"
                    (click)="setTheme('system')"
                    class="relative grid h-7 w-8 place-items-center rounded-lg text-zinc-500 transition-colors outline-none cursor-pointer hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    [ngClass]="theme() === 'system' ? 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100' : ''"
                  >
                    <app-icon name="monitor" class="size-3.5"></app-icon>
                  </button>
                </div>
              </div>

              <hr class="mx-2.5 my-1.5 h-px border-0 bg-zinc-100 dark:bg-zinc-800" />

              <!-- Navigation Menu Items -->
              <div class="flex flex-col gap-0.5">
                <button
                  type="button"
                  role="menuitem"
                  (click)="handleNavigate('profile')"
                  class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
                >
                  <app-icon name="user" class="size-4 text-zinc-400 dark:text-zinc-500"></app-icon>
                  <span class="flex-1">Profile & credentials</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  (click)="handleNavigate('settings')"
                  class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
                >
                  <app-icon name="settings" class="size-4 text-zinc-400 dark:text-zinc-500"></app-icon>
                  <span class="flex-1">Settings</span>
                  <span class="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">⌘,</span>
                </button>

                @if (role() === 'worker') {
                  <button
                    type="button"
                    role="menuitem"
                    (click)="handleNavigate('tickets')"
                    class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
                  >
                    <app-icon name="credit-card" class="size-4 text-zinc-400 dark:text-zinc-500"></app-icon>
                    <span class="flex-1">Active routes & tasks</span>
                  </button>
                } @else if (role() === 'citizen') {
                  <button
                    type="button"
                    role="menuitem"
                    (click)="handleNavigate('hire')"
                    class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
                  >
                    <app-icon name="credit-card" class="size-4 text-zinc-400 dark:text-zinc-500"></app-icon>
                    <span class="flex-1">Special pickups & bookings</span>
                  </button>
                }

                @if (accountsList().length > 1) {
                  <button
                    type="button"
                    role="menuitem"
                    (click)="currentPage.set('accounts')"
                    class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 cursor-pointer"
                  >
                    <span class="flex -space-x-1.5">
                      @for (acc of accountsList().slice(0, 2); track acc.id) {
                        <span class="flex size-5 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-bold text-zinc-700 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-900">
                          {{ acc.initials || acc.name.slice(0, 2).toUpperCase() }}
                        </span>
                      }
                    </span>
                    <span class="flex-1">Switch account</span>
                    <app-icon name="chevron-right" class="size-3.5 text-zinc-400 dark:text-zinc-500"></app-icon>
                  </button>
                }
              </div>

              <hr class="mx-2.5 my-1.5 h-px border-0 bg-zinc-100 dark:bg-zinc-800" />

              <!-- Kokonut UI Signature Hold-to-Sign-Out Button -->
              <div class="relative mt-0.5">
                <button
                  type="button"
                  role="menuitem"
                  (pointerdown)="startHold($event)"
                  (pointerup)="cancelHold()"
                  (pointerleave)="cancelHold()"
                  (pointercancel)="cancelHold()"
                  (click)="handleQuickClick()"
                  class="relative flex w-full items-center gap-2.5 overflow-hidden rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer select-none touch-none"
                >
                  <app-icon name="log-out" class="size-4 text-zinc-400 dark:text-zinc-500"></app-icon>
                  <span class="flex-1">Sign out</span>
                  <span class="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                    {{ isHolding() ? 'Keep holding' : 'Hold' }}
                  </span>

                  <!-- Animated Clip-Path Fill Layer -->
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-0 flex items-center gap-2.5 rounded-[10px] bg-zinc-900 px-2.5 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                    [style.clip-path]="isHolding() || isDone() ? 'inset(0 0 0 0 round 10px)' : 'inset(0 100% 0 0 round 10px)'"
                    [style.transition]="isHolding() ? 'clip-path ' + holdDuration() + 'ms linear' : 'clip-path 240ms cubic-bezier(0.23, 1, 0.32, 1)'"
                  >
                    <app-icon name="log-out" class="size-4"></app-icon>
                    <span class="flex-1">Signing out...</span>
                    <span class="text-[10px] font-semibold">
                      {{ isDone() ? 'Done' : 'Hold' }}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          }

          <!-- Accounts Subpage -->
          @if (currentPage() === 'accounts') {
            <div class="flex flex-col animate-in fade-in slide-in-from-right-3 duration-150">
              <button
                type="button"
                role="menuitem"
                (click)="currentPage.set('main')"
                class="flex w-full items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-left text-xs font-semibold text-zinc-800 outline-none hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <app-icon name="chevron-left" class="size-4 text-zinc-400 dark:text-zinc-500"></app-icon>
                <span>Back</span>
              </button>

              <hr class="mx-2.5 my-1.5 h-px border-0 bg-zinc-100 dark:bg-zinc-800" />

              <div class="flex flex-col gap-0.5">
                @for (acc of accountsList(); track acc.id) {
                  @let isSelected = acc.email === displayEmail() || acc.id === user()?.id;
                  <button
                    type="button"
                    role="menuitemradio"
                    [attr.aria-checked]="isSelected"
                    (click)="selectAccount(acc)"
                    class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium outline-none transition-colors duration-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    [ngClass]="isSelected ? 'bg-zinc-100/70 dark:bg-zinc-800/70' : ''"
                  >
                    <app-avatar
                      [initials]="acc.initials || acc.name.slice(0, 2).toUpperCase()"
                      class="size-7 text-[10px]"
                      [online]="isSelected && status() === 'online'"
                    ></app-avatar>
                    <div class="flex min-w-0 flex-1 flex-col">
                      <span class="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {{ acc.name }}
                      </span>
                      <span class="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                        {{ acc.email }}
                      </span>
                    </div>
                    @if (isSelected) {
                      <app-icon name="check" class="size-3.5 text-zinc-900 dark:text-zinc-100"></app-icon>
                    }
                  </button>
                }
              </div>

              <hr class="mx-2.5 my-1.5 h-px border-0 bg-zinc-100 dark:bg-zinc-800" />

              <button
                type="button"
                role="menuitem"
                (click)="addAccount()"
                class="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-medium text-zinc-700 outline-none transition-colors duration-100 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <span class="grid size-6 place-items-center rounded-full border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                  <app-icon name="plus" class="size-3"></app-icon>
                </span>
                <span>Add new account</span>
              </button>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class ProfileDropdownComponent {
  user = input<BackendUser | null>(null);
  role = input<Role>('citizen');
  variant = input<'compact' | 'full'>('compact');
  placement = input<'bottom-end' | 'top-start' | 'bottom-start'>('bottom-end');
  currentStatus = input<AccountStatus>('online');
  currentTheme = input<AccountTheme>('system');
  accounts = input<AccountOption[]>([]);
  holdDuration = input<number>(1000);

  themeChange = output<AccountTheme>();
  statusChange = output<AccountStatus>();
  navigate = output<View>();
  signOut = output<void>();
  accountChange = output<AccountOption>();

  isOpen = signal<boolean>(false);
  currentPage = signal<'main' | 'accounts'>('main');
  status = signal<AccountStatus>('online');
  theme = signal<AccountTheme>('system');
  isHolding = signal<boolean>(false);
  isDone = signal<boolean>(false);

  private holdTimer?: any;
  private holdStartTimestamp = 0;

  constructor(private elementRef: ElementRef) {
    effect(() => {
      this.status.set(this.currentStatus());
    });
    effect(() => {
      this.theme.set(this.currentTheme());
    });
  }

  displayName = computed(() => {
    const u = this.user();
    if (u) {
      return `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'User';
    }
    return this.role() === 'admin' ? 'City Command' : this.role() === 'worker' ? 'Field Operative' : 'Citizen';
  });

  displayEmail = computed(() => {
    return this.user()?.email || 'citizen@smartwaste.gov';
  });

  displaySubtitle = computed(() => {
    return this.user()?.email || (this.role() === 'admin' ? 'Administrator' : this.role() === 'worker' ? 'Operative' : 'Resident');
  });

  displayPlan = computed(() => {
    if (this.role() === 'admin') return 'Command';
    if (this.role() === 'worker') return 'Operative';
    return 'Citizen';
  });

  initials = computed(() => {
    const u = this.user();
    if (u?.firstName || u?.lastName) {
      const f = u.firstName?.[0] || '';
      const l = u.lastName?.[0] || '';
      return (f + l).toUpperCase() || 'U';
    }
    return this.role() === 'admin' ? 'CC' : this.role() === 'worker' ? 'FO' : 'CZ';
  });

  accountsList = computed<AccountOption[]>(() => {
    const custom = this.accounts();
    if (custom && custom.length > 0) {
      return custom;
    }
    const current: AccountOption = {
      id: this.user()?.id || 'current',
      name: this.displayName(),
      email: this.displayEmail(),
      role: this.role(),
      initials: this.initials(),
      plan: this.displayPlan()
    };
    return [current];
  });

  panelPositionClasses = computed(() => {
    switch (this.placement()) {
      case 'top-start':
        return 'bottom-full left-0 mb-2.5';
      case 'bottom-start':
        return 'top-full left-0 mt-2.5';
      case 'bottom-end':
      default:
        return 'top-full right-0 mt-2.5';
    }
  });

  toggleMenu() {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.currentPage.set('main');
    }
  }

  closeMenu() {
    this.isOpen.set(false);
    this.cancelHold();
  }

  setStatus(st: AccountStatus) {
    this.status.set(st);
    this.statusChange.emit(st);
  }

  setTheme(th: AccountTheme) {
    this.theme.set(th);
    this.themeChange.emit(th);
  }

  handleNavigate(view: View) {
    this.closeMenu();
    this.navigate.emit(view);
  }

  selectAccount(acc: AccountOption) {
    this.accountChange.emit(acc);
    this.closeMenu();
  }

  addAccount() {
    this.closeMenu();
    this.handleNavigate('profile');
  }

  startHold(event: PointerEvent) {
    if (event.button !== 0) return;
    this.cancelHold();
    this.isHolding.set(true);
    this.isDone.set(false);
    this.holdStartTimestamp = Date.now();

    this.holdTimer = setTimeout(() => {
      this.isHolding.set(false);
      this.isDone.set(true);
      setTimeout(() => {
        this.closeMenu();
        this.signOut.emit();
      }, 180);
    }, this.holdDuration());
  }

  cancelHold() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = undefined;
    }
    this.isHolding.set(false);
  }

  handleQuickClick() {
    const elapsed = Date.now() - this.holdStartTimestamp;
    if (elapsed < this.holdDuration() && !this.isDone()) {
      this.cancelHold();
      this.closeMenu();
      this.signOut.emit();
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentClick(event: PointerEvent) {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onEscapeKey(event: Event) {
    if ((event as KeyboardEvent).key === 'Escape' && this.isOpen()) {
      this.closeMenu();
    }
  }
}
