import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  SectionHeaderComponent,
  SurfaceComponent,
} from '../shared/ui-components';
import { AdminService } from '../core/admin.service';

@Component({
  selector: 'app-admin-broadcast',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    SectionHeaderComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
      <app-surface class="p-5 sm:p-7">
        <app-section-header
          eyebrow="City command"
          title="Broadcast a message"
          description="Keep residents and field teams aligned with a clear, timely update."
        ></app-section-header>

        <form class="mt-7 flex flex-col gap-5" (ngSubmit)="submit()">
          <div>
            <label for="broadcast-title" class="mb-2 block text-xs font-medium text-foreground">Announcement title</label>
            <input
              id="broadcast-title"
              required
              [(ngModel)]="title"
              name="title"
              placeholder="e.g. Holiday collection schedule"
              class="h-11 w-full rounded-[12px] border border-input bg-background/70 px-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
            />
          </div>

          <div>
            <label for="broadcast-audience" class="mb-2 block text-xs font-medium text-foreground">Audience</label>
            <select
              id="broadcast-audience"
              [(ngModel)]="audience"
              name="audience"
              class="h-11 w-full rounded-[12px] border border-input bg-background/70 px-3.5 text-sm text-foreground outline-none focus:border-primary cursor-pointer"
            >
              <option value="">All SmartWaste users</option>
              <option value="user">Citizens only</option>
              <option value="worker">Field operatives only</option>
            </select>
          </div>

          <div>
            <label for="broadcast-message" class="mb-2 block text-xs font-medium text-foreground">Message</label>
            <textarea
              id="broadcast-message"
              required
              rows="6"
              [(ngModel)]="message"
              name="message"
              placeholder="Write something helpful and clear..."
              class="w-full resize-none rounded-[12px] border border-input bg-background/70 p-3.5 text-sm text-foreground outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
            ></textarea>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-[11px] text-muted-foreground">Delivered in the SmartWaste portal</span>
            <button type="submit" appButton variant="brand" class="rounded-full">
              <app-icon name="send" class="size-4"></app-icon>
              {{ sent() ? 'Broadcast sent' : 'Send broadcast' }}
            </button>
          </div>

          @if (sent()) {
            <p role="status" class="flex items-center gap-2 text-xs text-brand">
              <app-icon name="check-circle-2" class="size-4"></app-icon>
              Broadcast sent.
            </p>
          }
          @if (error()) {
            <p role="alert" class="text-xs text-danger">{{ error() }}</p>
          }
        </form>
      </app-surface>

      <app-surface class="p-5 sm:p-7">
        <app-section-header
          title="Recent dispatches"
          description="Your latest announcements."
        ></app-section-header>

        <div class="mt-6 flex flex-col gap-5">
          @if (recentDispatches().length === 0) {
            <p class="text-xs text-muted-foreground">No broadcasts sent yet.</p>
          }
          @for (item of recentDispatches(); track item.time + item.title) {
            <div class="flex gap-3">
              <span class="mt-1 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                <app-icon name="bell-ring" class="size-4"></app-icon>
              </span>
              <div>
                <p class="text-xs font-medium text-foreground">{{ item.title }}</p>
                <p class="mt-1 text-[11px] leading-5 text-muted-foreground">{{ item.audience }}</p>
                <p class="mt-2 text-[10px] text-muted-foreground">{{ item.time }}</p>
              </div>
            </div>
          }
        </div>
      </app-surface>
    </div>
  `
})
export class AdminBroadcastComponent implements OnInit {
  title = '';
  message = '';
  audience: '' | 'user' | 'worker' = '';
  sent = signal<boolean>(false);
  error = signal<string>('');
  recentDispatches = signal<Array<{ title: string; audience: string; time: string }>>([]);

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadDispatches();
  }

  private async loadDispatches() {
    try {
      const activities = await this.adminService.getActivities();
      this.recentDispatches.set(
        activities
          .filter((activity) => activity.action === 'Notification Sent')
          .slice(0, 5)
          .map((activity) => ({
            title: activity.summary,
            audience:
              activity.targetType === 'targeted-notification'
                ? 'Targeted account'
                : 'Broadcast',
            time: new Date(activity.createdAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          })),
      );
    } catch {
      this.recentDispatches.set([]);
    }
  }

  async submit() {
    if (!this.title.trim() || !this.message.trim()) return;

    try {
      this.error.set('');
      await this.adminService.sendBroadcast({
        title: this.title.trim(),
        message: this.message.trim(),
        targetRole: this.audience || undefined,
      });
      this.sent.set(true);
      this.title = '';
      this.message = '';
      await this.loadDispatches();
      setTimeout(() => this.sent.set(false), 3500);
    } catch (err: any) {
      this.sent.set(false);
      this.error.set(err?.message || 'Could not send the broadcast.');
    }
  }
}
