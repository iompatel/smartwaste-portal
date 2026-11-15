import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import {
  SectionHeaderComponent,
  SurfaceComponent,
} from '../shared/ui-components';
import { AdminService } from '../core/admin.service';

@Component({
  selector: 'app-admin-activity',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    SectionHeaderComponent,
    SurfaceComponent,
  ],
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header
        eyebrow="City command"
        title="Audit activity"
        description="A transparent record of every administrative change."
      ></app-section-header>

      <app-surface class="p-5 sm:p-7">
        <div class="flex items-center gap-2 rounded-[14px] bg-brand/10 px-4 py-3 text-xs text-brand">
          <app-icon name="shield-check" class="size-4"></app-icon>
          Administrative changes are recorded in this audit log.
        </div>

        <div class="mt-6 flex flex-col divide-y divide-border/60">
          @for (row of audits(); track row.action + row.time) {
            <div class="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-muted text-muted-foreground">
                <app-icon [name]="row.icon" class="size-4"></app-icon>
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">{{ row.action }}</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{ row.actor }} <span class="mx-1">→</span> {{ row.target }}
                </p>
              </div>
              <span class="shrink-0 text-[11px] text-muted-foreground">{{ row.time }}</span>
            </div>
          }
          @if (audits().length === 0) {
            <div class="py-8 text-center text-xs text-muted-foreground">
              No audit activity recorded yet.
            </div>
          }
        </div>
      </app-surface>
    </div>
  `
})
export class AdminActivityComponent implements OnInit {
  audits = signal<Array<{ action: string; actor: string; target: string; time: string; icon: string }>>([]);

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    try {
      const records = await this.adminService.getActivities();
      this.audits.set(
        (records ?? []).map((r) => ({
          action: r.action,
          actor: r.adminName || 'Admin',
          target: r.summary || (r.targetType ? `${r.targetType} #${r.targetId}` : 'System'),
          time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          icon: 'shield-check',
        })),
      );
    } catch {
      this.audits.set([]);
    }
  }
}
