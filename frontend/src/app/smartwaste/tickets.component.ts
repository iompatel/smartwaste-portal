import { Component, OnInit, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  AvatarComponent,
  FieldLabelComponent,
  ModalComponent,
  PriorityBadgeComponent,
  SectionHeaderComponent,
  StatusBadgeComponent,
  SurfaceComponent,
  inputClassName,
} from '../shared/ui-components';
import { Priority, Ticket } from './data';
import { TicketService } from '../core/ticket.service';
import { cn } from '../shared/utils';

@Component({
  selector: 'app-tickets-view',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    PriorityBadgeComponent,
    SectionHeaderComponent,
    StatusBadgeComponent,
    SurfaceComponent,
  ],
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <app-section-header
          eyebrow="Citizen portal"
          title="My reports"
          description="Every report is tracked, verified, and resolved with care."
        ></app-section-header>
        <button
          type="button"
          appButton
          variant="brand"
          (click)="report.emit()"
          class="h-11 shrink-0 rounded-full px-5"
        >
          <app-icon name="image-plus" class="size-4"></app-icon>
          Report waste
        </button>
      </div>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div class="min-w-0">
          <!-- Filter Tabs -->
          <div class="flex items-center gap-1 rounded-full bg-muted p-1 sm:w-fit" role="tablist" aria-label="Filter reports">
            @for (item of (['All', 'Open', 'Completed']); track item) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="filter() === item"
                (click)="filter.set(item)"
                class="flex-1 rounded-full px-4 py-2 text-xs font-medium transition-colors sm:flex-none cursor-pointer"
                [ngClass]="filter() === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              >
                {{ item }}
                <span class="ml-1.5 text-[10px] opacity-60">{{ getFilterCount(item) }}</span>
              </button>
            }
          </div>

          <!-- Filtered Ticket List -->
          <div class="mt-4 flex flex-col gap-3">
            @for (ticket of filteredTickets(); track ticket.id) {
              <app-surface class="p-4 transition-colors hover:border-primary/25 sm:p-5">
                <div class="flex items-start gap-3">
                  <span
                    class="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
                    [ngClass]="ticket.status === 'Completed' ? 'bg-brand/10 text-brand' : 'bg-primary/10 text-primary'"
                  >
                    <app-icon name="trash-2" class="size-5"></app-icon>
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-sm font-medium text-foreground">{{ ticket.title }}</h3>
                      <span class="text-[10px] text-muted-foreground">{{ ticket.id }}</span>
                    </div>
                    <p class="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <app-icon name="map-pin" class="size-3"></app-icon>
                      {{ ticket.address }}
                    </p>
                  </div>
                  <app-status-badge [status]="ticket.status"></app-status-badge>
                </div>

                <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                  <span class="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">{{ ticket.category }}</span>
                  <app-priority-badge [priority]="ticket.priority"></app-priority-badge>
                  <span class="ml-auto text-[10px] text-muted-foreground">{{ ticket.time }}</span>
                </div>

                @if (ticket.code && ticket.status !== 'Completed') {
                  <div class="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-muted/60 px-3.5 py-3">
                    <div>
                      <p class="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Your completion code</p>
                      <p class="mt-1 font-mono text-lg font-semibold tracking-[0.18em] text-foreground">
                        {{ ticket.code.slice(0, 3) }} {{ ticket.code.slice(3) }}
                      </p>
                    </div>
                    <app-icon name="shield-check" class="size-5 text-brand"></app-icon>
                  </div>
                }

                <div class="mt-4 flex items-center justify-between gap-3">
                  <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    @if (ticket.status === 'Completed') {
                      <app-icon name="check-circle-2" class="size-3.5 text-brand"></app-icon>
                      Verified collection
                    } @else {
                      <app-icon name="clock-3" class="size-3.5"></app-icon>
                      {{ ticket.eta || 'Awaiting dispatch' }}
                    }
                  </span>
                  <button
                    type="button"
                    appButton
                    variant="ghost"
                    size="sm"
                    (click)="selectTicket.emit(ticket)"
                    class="rounded-full"
                  >
                    View details
                    <app-icon name="chevron-right" class="size-3.5"></app-icon>
                  </button>
                </div>
              </app-surface>
            }

            @if (filteredTickets().length === 0) {
              <app-surface class="flex flex-col items-center gap-3 p-10 text-center">
                <span class="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <app-icon name="trash-2" class="size-5"></app-icon>
                </span>
                <p class="text-sm font-medium text-foreground">No reports found</p>
                <p class="text-xs text-muted-foreground">Try another filter or search term.</p>
              </app-surface>
            }
          </div>
        </div>

        <!-- Sidebar Info -->
        <div class="flex flex-col gap-4">
          <app-surface class="p-5">
            <app-section-header
              title="Verified collection"
              description="A simple process that keeps everyone accountable."
            ></app-section-header>
            <div class="mt-5 flex flex-col gap-5">
              <div class="flex gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">01</span>
                <div>
                  <p class="text-xs font-medium text-foreground">Report with a photo</p>
                  <p class="mt-1 text-[11px] leading-4 text-muted-foreground">Pin the location and show us what needs attention.</p>
                </div>
              </div>
              <div class="flex gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">02</span>
                <div>
                  <p class="text-xs font-medium text-foreground">Share your private OTP</p>
                  <p class="mt-1 text-[11px] leading-4 text-muted-foreground">Only share the six-digit code after collection.</p>
                </div>
              </div>
              <div class="flex gap-3">
                <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">03</span>
                <div>
                  <p class="text-xs font-medium text-foreground">Review the result</p>
                  <p class="mt-1 text-[11px] leading-4 text-muted-foreground">Rate the service and help your neighborhood improve.</p>
                </div>
              </div>
            </div>
          </app-surface>

        </div>
      </div>
    </div>
  `
})
export class TicketsViewComponent {
  tickets = input.required<Ticket[]>();
  search = input<string>('');
  report = output<void>();
  selectTicket = output<Ticket>();

  filter = signal<string>('All');

  filteredTickets = computed(() => {
    const list = this.tickets();
    const f = this.filter();
    const q = (this.search() || '').toLowerCase().trim();

    return list.filter((ticket) => {
      const matchesFilter =
        f === 'All' ||
        (f === 'Open' ? ticket.status !== 'Completed' : ticket.status === 'Completed');
      const matchesSearch =
        !q ||
        `${ticket.title} ${ticket.id} ${ticket.address} ${ticket.category}`
          .toLowerCase()
          .includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  getFilterCount(f: string): number {
    if (f === 'All') return this.tickets().length;
    if (f === 'Open') return this.tickets().filter((t) => t.status !== 'Completed').length;
    return this.tickets().filter((t) => t.status === 'Completed').length;
  }
}

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    ModalComponent,
    FieldLabelComponent,
  ],
  template: `
    <app-modal
      title="Report a waste issue"
      description="A few details help the right crew get there faster."
      [wide]="true"
      (close)="close.emit()"
    >
      <form (ngSubmit)="submit()" class="flex flex-col gap-5">
        <div>
          <app-field-label htmlFor="report-title">What needs attention?</app-field-label>
          <input
            id="report-title"
            [(ngModel)]="title"
            name="title"
            [class]="inputCls"
            placeholder="e.g. Overflowing street bin"
          />
        </div>

        <fieldset>
          <legend class="mb-2 text-xs font-medium text-foreground">Waste category</legend>
          <div class="flex flex-wrap gap-2">
            @for (item of categories; track item) {
              <button
                type="button"
                [attr.aria-pressed]="category() === item"
                (click)="category.set(item)"
                class="rounded-full border px-3 py-2 text-xs transition-colors cursor-pointer"
                [ngClass]="category() === item ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'"
              >
                {{ item }}
              </button>
            }
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-2 text-xs font-medium text-foreground">Priority</legend>
          <div class="grid grid-cols-3 gap-2">
            @for (item of priorities; track item) {
              <button
                type="button"
                [attr.aria-pressed]="priority() === item"
                (click)="priority.set(item)"
                class="rounded-[12px] border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer"
                [ngClass]="getPriorityClass(priority() === item, item)"
              >
                {{ item }}
              </button>
            }
          </div>
        </fieldset>

        <div>
          <app-field-label htmlFor="report-address">Collection address</app-field-label>
          <div class="relative">
            <app-icon name="map-pin" class="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground"></app-icon>
            <input
              id="report-address"
              [(ngModel)]="address"
              name="address"
              [class]="inputCls + ' pl-10'"
              placeholder="Street address or landmark"
            />
          </div>
        </div>

        <div>
          <app-field-label htmlFor="report-description" [optional]="true">Add a note</app-field-label>
          <textarea
            id="report-description"
            [(ngModel)]="description"
            name="description"
            rows="3"
            [class]="inputCls + ' h-auto resize-none py-3'"
            placeholder="Anything the crew should know?"
          ></textarea>
        </div>

        <div>
          <app-field-label htmlFor="report-photo">Photo evidence</app-field-label>
          <label
            for="report-photo"
            class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-input bg-muted/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span class="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <app-icon [name]="fileName() ? 'file-image' : 'upload'" class="size-4"></app-icon>
            </span>
            <span class="text-xs font-medium text-foreground">{{ fileName() || 'Drop a photo here, or browse' }}</span>
            <span class="text-[10px] text-muted-foreground">PNG or JPG · Max 1.5 MB</span>
          </label>
          <input
            id="report-photo"
            type="file"
            accept="image/png,image/jpeg"
            (change)="onFileSelected($event)"
            class="sr-only"
          />

          <label
            for="report-camera"
            class="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80"
          >
            <app-icon name="camera" class="size-3.5"></app-icon>
            Use device camera
          </label>
          <input
            id="report-camera"
            type="file"
            accept="image/*"
            capture="environment"
            (change)="onFileSelected($event)"
            class="sr-only"
          />
        </div>

        @if (error()) {
          <p role="alert" class="text-xs text-danger">{{ error() }}</p>
        }

        <div class="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            appButton
            variant="outline"
            (click)="close.emit()"
            class="rounded-full"
          >
            Cancel
          </button>
          <button
            type="submit"
            appButton
            variant="brand"
            class="rounded-full"
          >
            <app-icon name="send" class="size-4"></app-icon>
            Submit report
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class ReportModalComponent {
  close = output<void>();
  create = output<Ticket>();

  inputCls = inputClassName;

  categories = ['Mixed waste', 'Recyclables', 'Organic', 'Glass', 'Hazardous'];
  priorities: Priority[] = ['Low', 'Medium', 'High'];
  category = signal<string>('Mixed waste');
  priority = signal<Priority>('Medium');
  title = '';
  address = '';
  description = '';
  fileName = signal<string>('');
  mediaData = signal<string | null>(null);
  error = signal<string>('');

  getPriorityClass(isSelected: boolean, item: string): string {
    if (!isSelected) return 'border-border text-muted-foreground hover:text-foreground';
    if (item === 'High') return 'border-danger/40 bg-danger/10 text-danger';
    if (item === 'Medium') return 'border-warning/40 bg-warning/10 text-warning';
    return 'border-brand/40 bg-brand/10 text-brand';
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      this.error.set('Please choose an image smaller than 1.5 MB.');
      return;
    }
    this.error.set('');
    this.fileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      this.mediaData.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  submit() {
    if (!this.address.trim()) {
      this.error.set('Add a street address so the crew can find the issue.');
      return;
    }

    const title = this.title.trim() || `${this.category()} collection report`;
    const note = this.description.trim();
    const newTicket: Ticket = {
      id: `SW-${1050 + Math.floor(Math.random() * 40)}`,
      title,
      category: this.category(),
      address: this.address.trim(),
      status: 'Pending',
      priority: this.priority(),
      time: 'Just now',
      code: String(Math.floor(100000 + Math.random() * 900000)),
      // The API stores one description field, so keep the citizen's title in it.
      description: note ? `${title} — ${note}` : title,
      mediaData: this.mediaData(),
    };

    this.create.emit(newTicket);
  }
}

@Component({
  selector: 'app-ticket-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    ModalComponent,
    AvatarComponent,
    StatusBadgeComponent,
    PriorityBadgeComponent,
  ],
  template: `
    <app-modal
      [title]="ticket().title"
      [description]="ticket().id + ' · ' + ticket().category"
      [wide]="true"
      (close)="close.emit()"
    >
      <div class="flex flex-wrap items-center gap-2">
        <app-status-badge [status]="ticket().status"></app-status-badge>
        <app-priority-badge [priority]="ticket().priority"></app-priority-badge>
        <span class="ml-auto text-xs text-muted-foreground">{{ ticket().time }}</span>
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="rounded-[16px] bg-muted/60 p-4">
          <p class="text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">Collection address</p>
          <p class="mt-2 flex items-start gap-2 text-sm font-medium text-foreground">
            <app-icon name="map-pin" class="mt-0.5 size-4 shrink-0 text-primary"></app-icon>
            {{ ticket().address }}
          </p>
          <p class="mt-2 text-xs text-muted-foreground">
            {{ ticket().description || 'The crew has all the details they need for this collection.' }}
          </p>
        </div>

        <div class="rounded-[16px] bg-muted/60 p-4">
          <p class="text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">Assigned operative</p>
          <div class="mt-3 flex items-center gap-2.5">
            <app-avatar [initials]="workerInitials()" class="size-9"></app-avatar>
            <div>
              <p class="text-xs font-medium text-foreground">{{ ticket().worker || 'Dispatch pending' }}</p>
              @if (ticket().worker) {
                <p class="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <app-icon name="shield-check" class="size-3 text-brand"></app-icon>
                  Verified operative
                </p>
              } @else {
                <p class="mt-1 text-[11px] text-muted-foreground">Awaiting assignment</p>
              }
            </div>
          </div>
        </div>
      </div>

      @if (ticket().code && ticket().status !== 'Completed') {
        <div class="mt-4 flex items-center justify-between gap-4 rounded-[18px] border border-brand/20 bg-brand/10 p-5">
          <div>
            <p class="flex items-center gap-1.5 text-xs font-medium text-brand">
              <app-icon name="shield-check" class="size-4"></app-icon>
              Private completion code
            </p>
            <p class="mt-2 font-mono text-[30px] font-semibold tracking-[0.2em] text-foreground">
              {{ ticket().code?.slice(0, 3) }} {{ ticket().code?.slice(3) }}
            </p>
            <p class="mt-1 text-[11px] text-muted-foreground">Share this only after your waste is collected.</p>
          </div>
          <button
            type="button"
            appButton
            variant="outline"
            size="icon"
            (click)="copyCode()"
            aria-label="Copy completion code"
            class="rounded-full bg-card/70"
          >
            @if (copied()) {
              <app-icon name="check" class="size-4 text-brand"></app-icon>
            } @else {
              <app-icon name="copy" class="size-4"></app-icon>
            }
          </button>
        </div>
      }

      <!-- Progress Line -->
      <div class="mt-5">
        <p class="text-xs font-medium text-foreground">Collection progress</p>
        <div class="mt-4 flex items-start">
          @for (step of (['Reported', 'Dispatched', 'Collected']); track step; let i = $index) {
            <div class="relative flex flex-1 flex-col items-center gap-2 text-center">
              <div
                class="flex size-7 items-center justify-center rounded-full text-[11px] font-medium"
                [class.bg-brand]="isStepActive(i)"
                [class.text-brand-foreground]="isStepActive(i)"
                [class.bg-muted]="!isStepActive(i)"
                [class.text-muted-foreground]="!isStepActive(i)"
              >
                @if (isStepActive(i)) {
                  <app-icon name="check" class="size-3.5"></app-icon>
                } @else {
                  {{ i + 1 }}
                }
              </div>
              <span class="text-[10px] text-muted-foreground">{{ step }}</span>
              @if (i < 2) {
                <span
                  class="absolute top-3.5 left-[calc(50%+14px)] h-px w-[calc(100%-28px)]"
                  [class.bg-brand]="isLineActive(i)"
                  [class.bg-border]="!isLineActive(i)"
                ></span>
              }
            </div>
          }
        </div>
      </div>

      <!-- Chat thread -->
      <div class="mt-6 rounded-[18px] border border-border/60">
        <div class="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <app-icon name="message-circle" class="size-4 text-primary"></app-icon>
          <p class="text-xs font-medium text-foreground">Ticket messages</p>
        </div>

        <div class="flex max-h-44 flex-col gap-3 overflow-y-auto p-4">
          @for (item of messages(); track $index) {
            <div
              class="max-w-[85%] rounded-[14px] px-3 py-2 text-xs leading-5"
              [class.self-start]="item.from === 'worker'"
              [class.bg-muted]="item.from === 'worker'"
              [class.text-foreground]="item.from === 'worker'"
              [class.self-end]="item.from === 'citizen'"
              [class.bg-primary]="item.from === 'citizen'"
              [class.text-primary-foreground]="item.from === 'citizen'"
            >
              {{ item.text }}
            </div>
          }
          @if (messages().length === 0) {
            <p class="py-3 text-center text-[11px] text-muted-foreground">
              No messages yet. Start the conversation below.
            </p>
          }
        </div>

        <form (ngSubmit)="sendMessage()" class="flex gap-2 border-t border-border/60 p-3">
          <label for="ticket-message" class="sr-only">Message your operative</label>
          <input
            id="ticket-message"
            [(ngModel)]="messageText"
            name="message"
            placeholder="Write a message..."
            class="h-9 min-w-0 flex-1 rounded-full bg-muted px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            appButton
            variant="brand"
            size="icon"
            aria-label="Send message"
            class="size-9 rounded-full"
          >
            <app-icon name="send" class="size-4"></app-icon>
          </button>
        </form>
        @if (messageError()) {
          <p role="alert" class="border-t border-border/60 px-4 py-2 text-[11px] text-danger">{{ messageError() }}</p>
        }
      </div>
    </app-modal>
  `
})
export class TicketDetailModalComponent implements OnInit {
  ticket = input.required<Ticket>();
  close = output<void>();

  copied = signal<boolean>(false);
  messageError = signal<string>('');
  messageText = '';
  messages = signal<{ text: string; from: 'worker' | 'citizen' }[]>([]);

  constructor(private ticketService: TicketService) {}

  async ngOnInit() {
    const numId = this.ticket().numericId;
    if (numId) {
      try {
        const history = await this.ticketService.getMessages(numId);
        if (history && history.length > 0) {
          this.messages.set(
            history.map((m) => ({
              text: m.message,
              from: m.senderRole === 'user' ? 'citizen' : 'worker',
            }))
          );
        }
      } catch {}
    }
  }

  workerInitials = computed(() => {
    const w = this.ticket().worker;
    if (!w) return 'OP';
    return w
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });

  isStepActive(index: number): boolean {
    const status = this.ticket().status;
    return (
      index === 0 ||
      status === 'Completed' ||
      (index === 1 && (status === 'Scheduled' || status === 'In progress'))
    );
  }

  isLineActive(index: number): boolean {
    const status = this.ticket().status;
    return (index === 0 && status !== 'Pending') || status === 'Completed';
  }

  async copyCode() {
    const code = this.ticket().code;
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        // clipboard fallback
      }
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    }
  }

  async sendMessage() {
    const text = this.messageText.trim();
    if (!text) return;
    this.messageError.set('');
    const numId = this.ticket().numericId;
    if (!numId) {
      this.messageError.set('This ticket is not available for messaging.');
      return;
    }

    try {
      const sent = await this.ticketService.sendMessage(numId, text);
      this.messages.update((list) => [
        ...list,
        { text: sent.message, from: sent.senderRole === 'user' ? 'citizen' : 'worker' },
      ]);
      this.messageText = '';
    } catch (err: any) {
      this.messageError.set(err?.message || 'Could not send message.');
    }
  }
}

@Component({
  selector: 'app-worker-routes-view',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    PriorityBadgeComponent,
    SectionHeaderComponent,
    StatusBadgeComponent,
    SurfaceComponent,
  ],
  template: `
    <div class="flex flex-col gap-5">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <app-section-header
          eyebrow="Field operations"
          title="Route queue"
          description="{{ activeRouteTickets().length }} stops queued. One verified handover at a time."
        ></app-section-header>
        <div class="flex items-center gap-2 rounded-full px-3 py-2 text-xs" [ngClass]="onDuty() ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'">
          <span class="size-2 rounded-full" [ngClass]="onDuty() ? 'bg-brand' : 'bg-muted-foreground'"></span>
          {{ onDuty() ? 'On duty' : 'Off duty' }}
        </div>
      </div>

      <app-surface class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-[13px] bg-primary/10 text-primary">
            <app-icon name="navigation" class="size-5"></app-icon>
          </span>
          <div>
            <p class="text-sm font-medium text-foreground">Assigned route</p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ completedCount() }} completed · {{ activeRouteTickets().length }} remaining
            </p>
          </div>
        </div>
        <button
          type="button"
          appButton
          variant="outline"
          class="rounded-full"
          [disabled]="activeRouteTickets().length === 0"
          (click)="openDirections()"
        >
          <app-icon name="navigation" class="size-4"></app-icon>
          Open in Maps
        </button>
      </app-surface>

      <div class="flex flex-col gap-3">
        @for (ticket of activeRouteTickets(); track ticket.id; let i = $index) {
          <app-surface class="p-5">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {{ (i + 1).toString().padStart(2, '0') }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-medium text-foreground">{{ ticket.address }}</h3>
                  <app-priority-badge [priority]="ticket.priority"></app-priority-badge>
                </div>
                <p class="mt-1.5 text-xs text-muted-foreground">{{ ticket.title }} · {{ ticket.category }} · {{ ticket.id }}</p>
                <p class="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <app-icon name="clock-3" class="size-3.5"></app-icon>
                  {{ ticket.eta || 'Ready to start' }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <app-status-badge [status]="ticket.status"></app-status-badge>
                <button
                  type="button"
                  appButton
                  [variant]="ticket.status === 'In progress' ? 'brand' : 'outline'"
                  size="sm"
                  (click)="ticket.status === 'In progress' ? openHandover.emit(ticket) : startRoute.emit(ticket)"
                  class="rounded-full cursor-pointer"
                >
                  {{ ticket.status === 'In progress' ? 'Verify collection' : 'Start route' }}
                  <app-icon name="chevron-right" class="size-3.5"></app-icon>
                </button>
              </div>
            </div>
          </app-surface>
        }
        @if (activeRouteTickets().length === 0) {
          <app-surface class="p-8 text-center text-sm text-muted-foreground">
            No open route stops.
          </app-surface>
        }
      </div>
    </div>
  `
})
export class WorkerRoutesViewComponent {
  tickets = input.required<Ticket[]>();
  onDuty = input<boolean>(false);
  openHandover = output<Ticket>();
  startRoute = output<Ticket>();

  activeRouteTickets = computed(() => {
    return this.tickets().filter((t) => t.status !== 'Completed');
  });
  completedCount = computed(() => this.tickets().filter((ticket) => ticket.status === 'Completed').length);

  openDirections() {
    const next = this.activeRouteTickets()[0];
    if (!next) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(next.address)}`,
      '_blank',
      'noopener'
    );
  }
}

@Component({
  selector: 'app-handover-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    ModalComponent,
    FieldLabelComponent,
  ],
  template: `
    <app-modal
      title="Verify collection"
      [description]="ticket().address + ' · ' + ticket().id"
      (close)="close.emit()"
    >
      <form (ngSubmit)="submit()" class="flex flex-col gap-5">
        <div class="flex items-start gap-3 rounded-[16px] bg-primary/10 p-4">
          <app-icon name="shield-check" class="mt-0.5 size-5 shrink-0 text-primary"></app-icon>
          <p class="text-xs leading-5 text-muted-foreground">
            Ask the resident for their private code, then upload a photo of the cleaned area. Both are required to close this report.
          </p>
        </div>

        <div>
          <app-field-label htmlFor="handover-otp">Resident's six-digit code</app-field-label>
          <input
            id="handover-otp"
            [ngModel]="otp()"
            (ngModelChange)="onOtpChange($event)"
            name="otp"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            aria-describedby="otp-hint"
            [class]="inputCls + ' h-14 text-center font-mono text-2xl font-semibold tracking-[0.35em]'"
          />
          <p id="otp-hint" class="mt-2 text-center text-[11px] text-muted-foreground">
            The resident can find this code in their report.
          </p>
        </div>

        <div>
          <app-field-label htmlFor="handover-photo">After-collection photo</app-field-label>
          <label
            for="handover-photo"
            class="flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-input bg-muted/40 p-4 transition-colors hover:border-primary/50"
          >
            <span class="flex size-9 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
              <app-icon [name]="photoName() ? 'check-circle-2' : 'camera'" class="size-4"></app-icon>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-foreground">{{ photoName() || 'Take or upload a photo' }}</span>
              <span class="mt-1 block text-[10px] text-muted-foreground">Required · JPG or PNG up to 1.5 MB</span>
            </span>
            <app-icon name="upload" class="size-4 text-muted-foreground"></app-icon>
          </label>
          <input
            id="handover-photo"
            type="file"
            accept="image/*"
            capture="environment"
            (change)="onPhotoSelected($event)"
            class="sr-only"
          />
        </div>

        @if (error()) {
          <p role="alert" class="text-xs leading-5 text-danger">{{ error() }}</p>
        }

        <button
          type="submit"
          appButton
          variant="brand"
          class="h-11 w-full rounded-full"
        >
          <app-icon name="check-circle-2" class="size-4"></app-icon>
          Complete verified handover
        </button>
      </form>
    </app-modal>
  `
})
export class HandoverModalComponent {
  ticket = input.required<Ticket>();
  close = output<void>();
  complete = output<{ ticket: Ticket; otp: string; photoData: string }>();

  inputCls = inputClassName;

  otp = signal<string>('');
  photoName = signal<string>('');
  photoData = signal<string>('');
  error = signal<string>('');

  onOtpChange(val: string) {
    this.otp.set(val.replace(/\D/g, '').slice(0, 6));
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.photoName.set(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        this.photoData.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  submit() {
    if (this.otp().length !== 6) {
      this.error.set('Enter the resident\'s full 6-digit handover verification code.');
      return;
    }
    if (this.ticket().code && this.otp() !== this.ticket().code) {
      this.error.set('That code does not match. Ask the resident for their six-digit code.');
      return;
    }
    if (!this.photoName()) {
      this.error.set('Add an after-collection photo to verify this handover.');
      return;
    }
    const photoPayload =
      this.photoData() ||
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    this.complete.emit({ ticket: this.ticket(), otp: this.otp(), photoData: photoPayload });
  }
}
