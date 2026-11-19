import { ChangeDetectionStrategy, Component, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { AccountPayload, BackendUser } from '../core/api.types';
import { ButtonDirective } from '../shared/button.component';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent, ModalComponent, SectionHeaderComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';
import { AccountFormComponent } from './account-form.component';

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, ModalComponent, SectionHeaderComponent, SurfaceComponent, ButtonDirective, IconComponent, AccountFormComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header eyebrow="City command" [title]="section() === 'worker' ? 'Worker accounts' : 'User accounts'"
        [description]="section() === 'worker' ? 'Create staff credentials and manage the field fleet.' : 'Manage resident accounts and their contact details.'">
        <button action type="button" appButton variant="brand" class="h-10 rounded-full" (click)="openForm()">
          <app-icon name="plus" class="size-4"></app-icon>Create {{ label().toLowerCase() }}
        </button>
      </app-section-header>
      @if (notice()) { <p role="status" class="rounded-xl bg-brand/10 p-3 text-sm text-brand-ink">{{ notice() }}</p> }
      @if (error()) { <p role="alert" class="rounded-xl bg-danger/10 p-3 text-sm text-danger-ink">{{ error() }}</p> }
      <app-surface class="p-5 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="relative w-full sm:max-w-sm">
            <app-icon name="search" class="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"></app-icon>
            <input [class]="inputCls + ' pl-10'" aria-label="Search accounts" [ngModel]="query()" (ngModelChange)="query.set($event)" placeholder="Search by name, ID, email, or phone" />
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-muted-foreground">{{ filteredAccounts().length }} {{ section() === 'worker' ? 'workers' : 'users' }}</span>
            <button type="button" appButton variant="outline" class="h-10 rounded-full" [disabled]="loading()" (click)="loadAccounts()">
              <app-icon name="refresh-cw" class="size-4" [class.animate-spin]="loading()"></app-icon>Refresh
            </button>
          </div>
        </div>
        <div class="mt-5 overflow-x-auto" [attr.aria-busy]="loading()">
          <table class="w-full min-w-[730px] text-left text-sm">
            <thead><tr class="border-b border-border/60 text-xs text-muted-foreground">
              <th class="py-3 pr-4 font-medium">{{ label() }} ID</th><th class="py-3 pr-4 font-medium">Name & email</th>
              <th class="py-3 pr-4 font-medium">Contact & address</th><th class="py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody class="divide-y divide-border/60">
              @for (account of filteredAccounts(); track account.id) {
                <tr>
                  <td class="py-4 pr-4 font-mono text-xs text-muted-foreground">#{{ account.id }}</td>
                  <td class="py-4 pr-4"><div class="flex items-center gap-3">
                    <app-avatar [initials]="initials(account)" [online]="account.workerOnline || false" class="size-9"></app-avatar>
                    <div class="min-w-0"><p class="font-medium">{{ fullName(account) }}</p><p class="mt-1 break-all text-xs text-muted-foreground">{{ account.email }}</p></div>
                  </div></td>
                  <td class="max-w-xs py-4 pr-4"><p>{{ account.mobile }}</p><p class="mt-1 text-xs text-muted-foreground">{{ account.address }}</p></td>
                  <td class="py-4"><div class="flex flex-wrap gap-1.5">
                    <button type="button" appButton variant="outline" class="h-9" (click)="selected.set(account)">View</button>
                    <button type="button" appButton variant="outline" class="h-9" (click)="openForm(account)">Edit</button>
                    <button type="button" appButton variant="destructive" class="h-9" (click)="confirmDelete(account)">Delete</button>
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="py-10 text-center text-sm text-muted-foreground">{{ loading() ? 'Loading accounts…' : 'No matching accounts.' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </app-surface>
    </div>
    @if (formOpen()) {
      <app-modal [title]="(editing() ? 'Edit ' : 'Create ') + label().toLowerCase()" description="Required fields are marked with an asterisk." [wide]="true" (close)="closeForm()">
        <app-account-form [section]="section()" [account]="editing()" [submitting]="saving()" [serverError]="formError()" (save)="saveAccount($event)" (cancel)="closeForm()"></app-account-form>
      </app-modal>
    }
    @if (selected(); as account) {
      <app-modal [title]="fullName(account)" [description]="label() + ' #' + account.id" (close)="selected.set(null)">
        <dl class="grid grid-cols-[100px_1fr] gap-x-4 gap-y-3 text-sm">
          <dt class="text-muted-foreground">Email</dt><dd class="break-all">{{ account.email }}</dd>
          <dt class="text-muted-foreground">Phone</dt><dd>{{ account.mobile }}</dd>
          <dt class="text-muted-foreground">Address</dt><dd class="break-words">{{ account.address }}</dd>
          <dt class="text-muted-foreground">Gender</dt><dd>{{ account.gender || 'Other' }}</dd>
          <dt class="text-muted-foreground">Role</dt><dd>{{ label() }}</dd>
          @if (section() === 'worker') {
            <dt class="text-muted-foreground">Availability</dt><dd>{{ account.workerOnline ? 'Online' : 'Offline' }}</dd>
            <dt class="text-muted-foreground">Rating</dt><dd>{{ account.ratingCount ? (account.ratingAverage | number:'1.1-1') + ' · ' + account.ratingCount + ' reviews' : 'No reviews yet' }}</dd>
          }
          <dt class="text-muted-foreground">Created</dt><dd>{{ date(account.createdAt) }}</dd>
          <dt class="text-muted-foreground">Last sign in</dt><dd>{{ date(account.lastLoginAt) }}</dd>
          <dt class="text-muted-foreground">Updated</dt><dd>{{ date(account.updatedAt) }}</dd>
        </dl>
        <div class="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
          <button type="button" appButton variant="outline" class="h-10 rounded-full" (click)="selected.set(null)">Close</button>
          <button type="button" appButton variant="brand" class="h-10 rounded-full" (click)="openForm(account)">Edit account</button>
        </div>
      </app-modal>
    }
    @if (deleting(); as account) {
      <app-modal [title]="'Delete ' + label().toLowerCase() + '?'" description="This deletion cannot be undone." (close)="closeDelete()">
        <p class="text-sm leading-6">Delete <strong>{{ fullName(account) }}</strong> (#{{ account.id }}, {{ account.email }})?</p>
        <div class="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm leading-6">
          @if (section() === 'user') {
            Their account, tickets, hire requests, related messages and reviews, notifications, and owned photos will be removed.
          } @else {
            Their account, saved location, messages, reviews, notifications, and owned photos will be removed. Their assigned jobs will be released for dispatch.
          }
          They will lose access to the portal. Activity history is retained.
        </div>
        @if (deleteError()) { <p role="alert" class="mt-4 text-sm text-danger-ink">{{ deleteError() }}</p> }
        <div class="mt-6 flex justify-end gap-2">
          <button type="button" appButton variant="outline" class="h-10 rounded-full" [disabled]="saving()" (click)="closeDelete()">Keep account</button>
          <button type="button" appButton variant="destructive" class="h-10 rounded-full" [disabled]="saving()" (click)="deleteAccount()">{{ saving() ? 'Deleting…' : 'Delete permanently' }}</button>
        </div>
      </app-modal>
    }
  `,
})
export class AdminAccountsComponent implements OnInit, OnChanges, OnDestroy {
  section = input<'user' | 'worker'>('user');
  search = input<string>('');
  accounts = signal<BackendUser[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  notice = signal('');
  formError = signal('');
  deleteError = signal('');
  formOpen = signal(false);
  editing = signal<BackendUser | null>(null);
  selected = signal<BackendUser | null>(null);
  deleting = signal<BackendUser | null>(null);
  query = signal('');
  inputCls = inputClassName;
  label = computed(() => this.section() === 'worker' ? 'Worker' : 'User');
  filteredAccounts = computed(() => {
    const words = `${this.query()} ${this.search()}`.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.accounts().filter(account => account.role === this.section() && words.every(word =>
      [account.id, account.firstName, account.lastName, account.email, account.mobile, account.address].join(' ').toLowerCase().includes(word)));
  });
  private requestId = 0;
  private destroyed = false;

  constructor(private adminService: AdminService) {}
  ngOnInit() { void this.loadAccounts(); }
  ngOnChanges(changes: SimpleChanges) {
    if (changes['section'] && !changes['section'].firstChange) {
      this.formOpen.set(false); this.selected.set(null); this.deleting.set(null); this.query.set('');
      void this.loadAccounts();
    }
  }
  ngOnDestroy() { this.destroyed = true; this.requestId++; }

  async loadAccounts() {
    const requestId = ++this.requestId;
    this.loading.set(true); this.error.set('');
    try {
      const users = await this.adminService.getUsers(this.section());
      if (!this.destroyed && requestId === this.requestId) this.accounts.set(users);
    } catch (error: any) {
      if (!this.destroyed && requestId === this.requestId) this.error.set(error?.message || 'Could not load accounts.');
    } finally {
      if (!this.destroyed && requestId === this.requestId) this.loading.set(false);
    }
  }

  openForm(account: BackendUser | null = null) {
    this.selected.set(null); this.editing.set(account); this.formError.set(''); this.formOpen.set(true);
  }
  closeForm() { if (!this.saving()) this.formOpen.set(false); }
  confirmDelete(account: BackendUser) { this.deleteError.set(''); this.deleting.set(account); }
  closeDelete() { if (!this.saving()) this.deleting.set(null); }

  async saveAccount(payload: AccountPayload) {
    if (this.saving()) return;
    this.saving.set(true); this.formError.set('');
    const editing = this.editing();
    try {
      const saved = editing ? await this.adminService.updateUser(editing.id, payload) : await this.adminService.createUser(payload);
      this.accounts.update(accounts => editing ? accounts.map(account => account.id === editing.id ? saved : account) : [saved, ...accounts]);
      this.formOpen.set(false); this.notice.set(`${this.label()} #${saved.id} ${editing ? 'updated' : 'created'}.`);
    } catch (error: any) {
      this.formError.set(error?.message || 'Could not save this account.');
    } finally { this.saving.set(false); }
  }

  async deleteAccount() {
    const account = this.deleting();
    if (!account || this.saving()) return;
    this.saving.set(true); this.deleteError.set('');
    try {
      await this.adminService.deleteUser(account.id);
      this.accounts.update(accounts => accounts.filter(item => item.id !== account.id));
      this.deleting.set(null); this.notice.set(`${this.label()} #${account.id} deleted.`);
    } catch (error: any) { this.deleteError.set(error?.message || 'Could not delete this account.'); }
    finally { this.saving.set(false); }
  }

  fullName(account: BackendUser) { return `${account.firstName} ${account.lastName}`.trim(); }
  initials(account: BackendUser) { return `${account.firstName?.[0] || ''}${account.lastName?.[0] || ''}`.toUpperCase() || 'U'; }
  date(value?: string | null) { return value ? new Date(value).toLocaleString() : '—'; }
}
