import { Component, OnInit, computed, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AvatarComponent,
  SectionHeaderComponent,
  SurfaceComponent,
} from '../shared/ui-components';
import { AdminService } from '../core/admin.service';
import { BackendUser } from '../core/api.types';

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [
    CommonModule,
    AvatarComponent,
    SectionHeaderComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header
        eyebrow="City command"
        title="Accounts & permissions"
        description="Review citizens, field operatives, and administrative access."
      >
      </app-section-header>
      @if (error()) {
        <p role="alert" class="rounded-xl bg-danger/10 p-3 text-xs text-danger">{{ error() }}</p>
      }

      <app-surface class="p-5 sm:p-6">
        <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span class="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary">
               All accounts · {{ accounts().length }}
            </span>
            <span class="rounded-full bg-muted px-3 py-1.5">
              Workers · {{ workerCount() }}
            </span>
          </div>
        </div>

        <div class="mt-6 overflow-x-auto">
          <table class="w-full min-w-[600px] text-left">
            <thead>
              <tr class="border-b border-border/60 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                <th class="pb-3 font-medium">Person</th>
                <th class="pb-3 font-medium">Role</th>
                <th class="pb-3 font-medium">Location</th>
                <th class="pb-3 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/60">
              @for (user of filteredAccounts(); track user.id) {
                <tr class="text-xs">
                  <td class="py-4">
                    <div class="flex items-center gap-3">
                      <app-avatar [initials]="getInitials(user)" class="size-9"></app-avatar>
                      <div>
                        <p class="font-medium text-foreground">{{ user.firstName }} {{ user.lastName }}</p>
                        <p class="mt-1 text-[11px] text-muted-foreground">{{ user.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-4">
                    <span
                      class="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      [ngClass]="
                        user.role === 'admin'
                          ? 'bg-primary/15 text-primary'
                          : user.role === 'worker'
                            ? 'bg-brand/15 text-brand'
                            : 'bg-muted text-foreground'
                      "
                    >
                      {{ user.role === 'admin' ? 'Admin' : user.role === 'worker' ? 'Worker' : 'Citizen' }}
                    </span>
                  </td>
                  <td class="py-4 text-muted-foreground">{{ user.address || '—' }}</td>
                  <td class="py-4 text-muted-foreground">{{ user.mobile || '—' }}</td>
                </tr>
              }
              @if (filteredAccounts().length === 0) {
                <tr>
                  <td colspan="4" class="py-10 text-center text-xs text-muted-foreground">
                    No accounts found.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </app-surface>
    </div>
  `
})
export class AdminAccountsComponent implements OnInit {
  search = input<string>('');
  accounts = signal<BackendUser[]>([]);
  error = signal<string>('');
  workerCount = computed(() => this.accounts().filter((user) => user.role === 'worker').length);
  filteredAccounts = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.accounts();
    return this.accounts().filter((user) =>
      [user.firstName, user.lastName, user.email, user.mobile, user.address, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  });

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    try {
      const users = await this.adminService.getUsers();
      this.accounts.set(users ?? []);
    } catch (error: any) {
      this.accounts.set([]);
      this.error.set(error?.message || 'Could not load accounts.');
    }
  }

  getInitials(user: BackendUser): string {
    const f = user.firstName ? user.firstName[0] : '';
    const l = user.lastName ? user.lastName[0] : '';
    return (f + l).toUpperCase() || 'U';
  }
}
