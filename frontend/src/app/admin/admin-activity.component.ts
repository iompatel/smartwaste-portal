import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { AccountActivity, ActivityFilters } from '../core/api.types';
import { ButtonDirective } from '../shared/button.component';
import { IconComponent } from '../shared/icon.component';
import { ModalComponent, SectionHeaderComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';

type RoleFilter = '' | 'user' | 'worker' | 'admin';
type DetailRow = { key: string; label: string; value: string; url: string | null; image: boolean };

@Component({
  selector: 'app-admin-activity',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ModalComponent, SectionHeaderComponent, SurfaceComponent, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header eyebrow="City command" title="Account activity" description="User, worker, and administrator actions with the details captured at the time.">
        <button action type="button" appButton variant="outline" class="h-10 rounded-full" [disabled]="loading()" (click)="loadActivities()">
          <app-icon name="refresh-cw" class="size-4" [class.animate-spin]="loading()"></app-icon>Refresh
        </button>
      </app-section-header>
      <app-surface class="p-5 sm:p-6">
        <form (ngSubmit)="applyFilters()" class="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div><label for="activity-role" class="mb-1.5 block text-xs font-medium">Account role</label>
            <select id="activity-role" name="role" [(ngModel)]="roleFilter" [class]="inputCls"><option value="">All roles</option><option value="user">User</option><option value="worker">Worker</option><option value="admin">Admin</option></select>
          </div>
          <div><label for="activity-actor" class="mb-1.5 block text-xs font-medium">Actor ID</label>
            <input id="activity-actor" name="actorId" [(ngModel)]="actorId" inputmode="numeric" [class]="inputCls" [attr.aria-invalid]="invalidField() === 'actorId'" [attr.aria-describedby]="invalidField() === 'actorId' ? 'activity-filter-error' : null" placeholder="Any account ID" />
          </div>
          <div><label for="activity-action" class="mb-1.5 block text-xs font-medium">Action</label>
            <input id="activity-action" name="action" [(ngModel)]="action" [class]="inputCls" placeholder="e.g. Ticket Created" />
          </div>
          <div><label for="activity-from" class="mb-1.5 block text-xs font-medium">From date</label>
            <input id="activity-from" name="from" type="date" [(ngModel)]="from" [class]="inputCls" />
          </div>
          <div><label for="activity-to" class="mb-1.5 block text-xs font-medium">To date</label>
            <input id="activity-to" name="to" type="date" [(ngModel)]="to" [class]="inputCls" [attr.aria-invalid]="invalidField() === 'date'" [attr.aria-describedby]="invalidField() === 'date' ? 'activity-filter-error' : null" />
          </div>
          <div class="flex gap-2"><button type="submit" appButton variant="brand" class="h-11 flex-1 rounded-full">Apply</button><button type="button" appButton variant="outline" class="h-11 rounded-full" (click)="clearFilters()">Clear</button></div>
        </form>
        @if (filterError()) { <p id="activity-filter-error" role="alert" class="mt-3 text-sm text-danger">{{ filterError() }}</p> }
      </app-surface>
      @if (error()) { <p role="alert" class="rounded-xl bg-danger/10 p-3 text-sm text-danger">{{ error() }}</p> }
      <app-surface class="p-5 sm:p-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{{ total() }} {{ total() === 1 ? 'event' : 'events' }} · Page {{ page() }} of {{ pageCount() }}</span>
          <span class="inline-flex items-center gap-1.5"><app-icon name="activity" class="size-3.5"></app-icon>Refreshes every 15 seconds</span>
        </div>
        <div class="divide-y divide-border/60" [attr.aria-busy]="loading()">
          @for (event of events(); track event.id) {
            <div class="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start">
              <span class="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"><app-icon [name]="event.actorRole === 'admin' ? 'shield-check' : event.actorRole === 'worker' ? 'route' : 'user-round'" class="size-4"></app-icon></span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2"><p class="text-sm font-medium">{{ event.action }}</p><span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{{ roleLabel(event.actorRole) }} #{{ event.actorId }}</span></div>
                <p class="mt-1 text-xs text-muted-foreground">{{ event.actorName || 'Unknown account' }}{{ event.actorEmail ? ' · ' + event.actorEmail : '' }}</p>
                <p class="mt-2 break-words text-sm leading-6">{{ event.summary }}</p>
              </div>
              <div class="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                <time [attr.datetime]="event.createdAt" class="text-xs text-muted-foreground">{{ formatDate(event.createdAt) }}</time>
                <button type="button" appButton variant="outline" class="h-9 rounded-full" (click)="selected.set(event)">View details</button>
              </div>
            </div>
          } @empty {
            <p class="py-10 text-center text-sm text-muted-foreground">{{ loading() ? 'Loading activity…' : 'No events match these filters.' }}</p>
          }
        </div>
        <nav aria-label="Activity pagination" class="mt-5 flex justify-between gap-2 border-t border-border/60 pt-4">
          <button type="button" appButton variant="outline" class="h-10 rounded-full" [disabled]="page() <= 1 || loading()" (click)="changePage(-1)">Previous</button>
          <button type="button" appButton variant="outline" class="h-10 rounded-full" [disabled]="page() >= pageCount() || loading()" (click)="changePage(1)">Next</button>
        </nav>
      </app-surface>
    </div>
    @if (selected(); as event) {
      <app-modal [title]="event.action" [description]="'Event #' + event.id + ' · ' + formatDate(event.createdAt)" [wide]="true" (close)="selected.set(null)">
        <div class="rounded-xl bg-muted/50 p-4 text-sm leading-6">
          <p class="font-medium">{{ event.actorName || 'Unknown account' }} · {{ roleLabel(event.actorRole) }} #{{ event.actorId }}</p>
          @if (event.actorEmail) { <p class="break-all text-xs text-muted-foreground">{{ event.actorEmail }}</p> }
          <p class="mt-2">{{ event.summary }}</p>
          @if (event.targetType) { <p class="mt-2 text-xs text-muted-foreground">Target: {{ event.targetType }}{{ event.targetId ? ' #' + event.targetId : '' }}</p> }
        </div>
        <h3 class="mt-5 text-sm font-semibold">Event details</h3>
        <p class="mt-1 text-xs text-muted-foreground">These values show the record when this action occurred.</p>
        <dl class="mt-4 divide-y divide-border/60">
          @for (row of detailRows(); track row.key) {
            <div class="grid gap-1 py-3 sm:grid-cols-[minmax(150px,0.8fr)_minmax(0,1.2fr)] sm:gap-4">
              <dt class="break-words text-xs text-muted-foreground">{{ row.label }}</dt>
              <dd class="min-w-0 whitespace-pre-wrap break-words text-sm">
                @if (row.url) {
                  <a [href]="row.url" target="_blank" rel="noopener noreferrer" class="text-primary underline">{{ row.image ? 'Open photo' : row.value }}</a>
                  @if (row.image) { <img [src]="row.url" [alt]="row.label" class="mt-2 max-h-52 max-w-full rounded-xl object-contain" loading="lazy" /> }
                } @else { {{ row.value }} }
              </dd>
            </div>
          } @empty { <p class="py-4 text-sm text-muted-foreground">No additional details were captured.</p> }
        </dl>
        <div class="mt-5 flex justify-end border-t border-border/60 pt-4"><button type="button" appButton variant="outline" class="h-10 rounded-full" (click)="selected.set(null)">Close details</button></div>
      </app-modal>
    }
  `,
})
export class AdminActivityComponent implements OnInit, OnDestroy {
  events = signal<AccountActivity[]>([]);
  total = signal(0);
  page = signal(1);
  loading = signal(false);
  error = signal('');
  filterError = signal('');
  invalidField = signal<'actorId' | 'date' | null>(null);
  selected = signal<AccountActivity | null>(null);
  pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));
  detailRows = computed(() => this.snapshotRows(this.selected()?.details || {}));
  inputCls = inputClassName;
  roleFilter: RoleFilter = '';
  actorId = '';
  action = '';
  from = '';
  to = '';
  private readonly limit = 25;
  private filters: ActivityFilters = {};
  private timer?: ReturnType<typeof setInterval>;
  private inFlight = false;
  private pendingRefresh = false;
  private destroyed = false;
  private revision = 0;

  constructor(private adminService: AdminService, private element: ElementRef<HTMLElement>) {}
  ngOnInit() {
    void this.loadActivities();
    this.timer = setInterval(() => { if (!this.inFlight) void this.loadActivities(); }, 15000);
  }
  ngOnDestroy() { this.destroyed = true; this.revision++; if (this.timer) clearInterval(this.timer); }

  applyFilters() {
    this.filterError.set(''); this.invalidField.set(null);
    if (this.actorId.trim() && (!/^\d+$/.test(this.actorId.trim()) || !Number.isSafeInteger(Number(this.actorId)) || Number(this.actorId) <= 0)) {
      this.filterError.set('Actor ID must be a positive whole number.'); this.invalidField.set('actorId'); this.focusFilter('activity-actor'); return;
    }
    if (this.from && this.to && this.from > this.to) { this.filterError.set('The end date must be on or after the start date.'); this.invalidField.set('date'); this.focusFilter('activity-to'); return; }
    this.filters = {
      ...(this.roleFilter ? { actorRole: this.roleFilter } : {}),
      ...(this.actorId.trim() ? { actorId: Number(this.actorId) } : {}),
      ...(this.action.trim() ? { action: this.action.trim() } : {}),
      ...(this.from ? { from: new Date(`${this.from}T00:00:00`).toISOString() } : {}),
      ...(this.to ? { to: new Date(`${this.to}T23:59:59.999`).toISOString() } : {}),
    };
    this.page.set(1); this.revision++; void this.loadActivities();
  }

  clearFilters() { this.roleFilter = ''; this.actorId = ''; this.action = ''; this.from = ''; this.to = ''; this.applyFilters(); }
  changePage(delta: number) { this.page.set(Math.min(this.pageCount(), Math.max(1, this.page() + delta))); this.revision++; void this.loadActivities(); }

  async loadActivities() {
    if (this.destroyed) return;
    if (this.inFlight) { this.pendingRefresh = true; return; }
    this.inFlight = true; this.loading.set(true); this.error.set('');
    const revision = this.revision;
    try {
      const response = await this.adminService.getAccountActivities({ ...this.filters, page: this.page(), limit: this.limit });
      if (!this.destroyed && revision === this.revision) {
        this.events.set(response.items); this.total.set(response.total);
        if (this.page() > this.pageCount()) { this.page.set(this.pageCount()); this.pendingRefresh = true; }
      }
    } catch (error: any) {
      if (!this.destroyed && revision === this.revision) this.error.set(error?.message || 'Could not load activity. The last available events are shown.');
    } finally {
      this.inFlight = false;
      if (!this.destroyed) {
        this.loading.set(false);
        if (this.pendingRefresh) { this.pendingRefresh = false; void this.loadActivities(); }
      }
    }
  }

  roleLabel(role: string) { return role === 'admin' ? 'Admin' : role === 'worker' ? 'Worker' : 'User'; }
  formatDate(value: string) { return new Date(value).toLocaleString(); }
  private focusFilter(id: string) { setTimeout(() => this.element.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus(), 0); }

  private snapshotRows(details: Record<string, any>): DetailRow[] {
    const rows: DetailRow[] = [];
    const visit = (value: unknown, path: string[]) => {
      const field = path[path.length - 1] || '';
      if (/password|otp|completioncode|secret|token|hash/i.test(field)) return;
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
        return;
      }
      const text = value == null || value === '' ? '—' : String(value);
      const image = /media|photo|image/i.test(field);
      const url = /^https?:\/\//i.test(text) || (image && /^data:image\/(jpeg|png|webp);base64,/i.test(text)) ? text : null;
      rows.push({ key: path.join('.'), label: path.map(key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')).join(' · '), value: text, url, image });
    };
    for (const [key, value] of Object.entries(details)) visit(value, [key]);
    return rows;
  }
}
