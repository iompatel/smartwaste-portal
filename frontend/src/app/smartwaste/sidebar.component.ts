import { Component, computed, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { AvatarComponent, BrandMarkComponent } from '../shared/ui-components';
import {
  navByRole,
  roleMeta,
  secondaryNav,
  Role,
  View,
} from './data';
import { cn } from '../shared/utils';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    AvatarComponent,
    BrandMarkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (open()) {
      <button
        type="button"
        aria-label="Close navigation"
        (click)="close.emit()"
        class="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
      ></button>
    }

    <aside [class]="asideClasses()">
      <div class="flex items-center justify-between px-2">
        <app-brand-mark></app-brand-mark>
        <button
          type="button"
          appButton
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          (click)="close.emit()"
          class="rounded-full lg:hidden"
        >
          <app-icon name="x" class="size-4"></app-icon>
        </button>
      </div>

      <div class="mt-8 flex items-center gap-2 rounded-[14px] border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-left">
        <span class="flex size-7 items-center justify-center rounded-[9px] bg-sidebar-accent text-muted-foreground">
          <app-icon name="map-pin" class="size-3.5"></app-icon>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-xs font-medium">San Francisco</span>
          <span class="block text-[10px] text-muted-foreground">District 04 · California</span>
        </span>
        <app-icon name="chevron-down" class="size-3.5 text-muted-foreground"></app-icon>
      </div>

      <nav aria-label="Main navigation" class="mt-8 flex flex-1 flex-col gap-1">
        <p class="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Workspace</p>
        @for (item of currentNav(); track item.id) {
          @let active = view() === item.id;
          @let badge = getBadge(item.id, item.badge);
          <button
            type="button"
            [attr.aria-current]="active ? 'page' : null"
            (click)="navigate.emit(item.id)"
            [class]="navItemClass(active)"
          >
            <app-icon [name]="item.icon" class="size-[17px]" [class.text-brand]="active"></app-icon>
            <span class="flex-1 text-left">{{ item.label }}</span>
            @if (badge) {
              <span
                class="rounded-full px-2 py-0.5 text-[10px] tabular-nums"
                [ngClass]="active ? 'bg-brand/15 text-brand' : 'bg-sidebar-accent text-muted-foreground'"
              >
                {{ badge }}
              </span>
            }
          </button>
        }

        <p class="mt-7 mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Preferences</p>
        @for (item of secondaryNavItems; track item.id) {
          @let active = view() === item.id;
          <button
            type="button"
            [attr.aria-current]="active ? 'page' : null"
            (click)="navigate.emit(item.id)"
            class="flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[13px] font-medium transition-colors cursor-pointer"
            [ngClass]="active ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'"
          >
            <app-icon [name]="item.icon" class="size-[17px]"></app-icon>
            <span>{{ item.label }}</span>
          </button>
        }

        <button
          type="button"
          (click)="themeToggle.emit()"
          class="flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          @if (theme() === 'dark') {
            <app-icon name="sun" class="size-[17px]"></app-icon>
            <span>Light appearance</span>
          } @else {
            <app-icon name="moon" class="size-[17px]"></app-icon>
            <span>Dark appearance</span>
          }
        </button>
      </nav>

      <!-- Bottom Profile -->
      <div class="flex items-center gap-2 border-t border-sidebar-border px-1 pt-4">
        <app-avatar [initials]="displayInitials()" [online]="userOnline()"></app-avatar>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium text-foreground">{{ displayName() }}</p>
          <p class="truncate text-[10px] text-muted-foreground">{{ displaySubtitle() }}</p>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          (click)="signOut.emit()"
          class="text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          <app-icon name="log-out" class="size-4"></app-icon>
        </button>
      </div>
    </aside>
  `
})
export class SidebarComponent {
  role = input.required<Role>();
  view = input.required<View>();
  open = input<boolean>(false);
  theme = input<'light' | 'dark'>('light');
  ticketCount = input<number>(0);
  routeCount = input<number>(0);
  bookingCount = input<number>(0);
  userName = input<string>();
  userSubtitle = input<string>();
  userInitials = input<string>();
  userOnline = input<boolean>(false);

  close = output<void>();
  navigate = output<View>();
  roleChange = output<Role>();
  themeToggle = output<void>();
  signOut = output<void>();

  secondaryNavItems = secondaryNav;

  meta = computed(() => roleMeta[this.role()]);
  displayName = computed(() => this.userName() || this.meta().name);
  displaySubtitle = computed(() => this.userSubtitle() || this.meta().subtitle);
  displayInitials = computed(() => this.userInitials() || this.meta().initials);
  currentNav = computed(() => navByRole[this.role()]);

  asideClasses = computed(() => {
    return cn(
      'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0',
      this.open() ? 'translate-x-0' : '-translate-x-full'
    );
  });

  navItemClass(active: boolean): string {
    return cn(
      'group flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[13px] font-medium transition-all duration-200 cursor-pointer',
      active
        ? 'bg-sidebar-accent text-foreground shadow-[0_2px_8px_color-mix(in_oklab,var(--foreground)_4%,transparent)]'
        : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
    );
  }

  getBadge(id: View, defaultBadge?: string): string | undefined {
    if (id === 'tickets') {
      return String(this.role() === 'citizen' ? this.ticketCount() : this.routeCount());
    }
    if (id === 'hire' && this.role() === 'worker') {
      return String(this.bookingCount());
    }
    return defaultBadge;
  }
}
