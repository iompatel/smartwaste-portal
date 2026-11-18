import { Component, OnDestroy, OnInit, computed, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
import { Priority, Ticket, isClosedStatus } from './data';
import { TicketService } from '../core/ticket.service';
import { AddressSuggestion, BackendTicket, TicketTrackingSnapshot } from '../core/api.types';
import { prepareImageFile } from '../core/media';

export interface TicketDraft {
  title: string;
  category: string;
  address: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  priority: Priority;
  description: string;
  mediaData: string | null;
}

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
  changeDetection: ChangeDetectionStrategy.Eager,
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
            @for (item of (['All', 'Open', 'Completed', 'Cancelled']); track item) {
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
                    [ngClass]="ticket.status === 'Completed' ? 'bg-brand/10 text-brand' : ticket.status === 'Cancelled' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'"
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

                @if (ticket.code && !isClosedStatus(ticket.status)) {
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
  readonly isClosedStatus = isClosedStatus;
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
        (f === 'Open'
          ? !isClosedStatus(ticket.status)
          : f === 'Completed'
            ? ticket.status === 'Completed'
            : ticket.status === 'Cancelled');
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
    if (f === 'Open') return this.tickets().filter((t) => !isClosedStatus(t.status)).length;
    if (f === 'Completed') return this.tickets().filter((t) => t.status === 'Completed').length;
    return this.tickets().filter((t) => t.status === 'Cancelled').length;
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
  changeDetection: ChangeDetectionStrategy.Eager,
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
            <app-icon name="map-pin" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
            <input
              id="report-address"
              [ngModel]="address"
              (ngModelChange)="onAddressChange($event)"
              name="address"
              [class]="inputCls + ' pl-10'"
              placeholder="Street address or landmark"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="report-address-suggestions"
              [attr.aria-expanded]="addressSuggestions().length > 0"
            />
            @if (addressSearching()) {
              <app-icon name="refresh-cw" class="pointer-events-none absolute inset-y-0 right-3.5 my-auto size-4 animate-spin text-muted-foreground"></app-icon>
            }
            @if (addressSuggestions().length > 0) {
              <div id="report-address-suggestions" role="listbox" class="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-[14px] border border-border bg-popover p-1.5 shadow-xl">
                @for (suggestion of addressSuggestions(); track suggestion.label) {
                  <button type="button" role="option" (click)="selectAddress(suggestion)" class="flex min-h-11 w-full items-start gap-2 rounded-[10px] px-3 py-2.5 text-left text-xs text-popover-foreground hover:bg-muted">
                    <app-icon name="map-pin" class="mt-0.5 size-3.5 shrink-0 text-primary"></app-icon>
                    <span class="leading-5">{{ suggestion.label }}</span>
                  </button>
                }
                <p class="px-3 py-1 text-[10px] text-muted-foreground">Addresses © OpenStreetMap contributors</p>
              </div>
            }
          </div>
          <p class="mt-2 text-[11px] text-muted-foreground">Select a suggestion to enable worker arrival distance and nearby alerts.</p>
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
              <app-icon [name]="photoProcessing() ? 'refresh-cw' : fileName() ? 'file-image' : 'upload'" [class]="'size-4 ' + (photoProcessing() ? 'animate-spin' : '')"></app-icon>
            </span>
            <span class="text-xs font-medium text-foreground">{{ photoProcessing() ? 'Preparing photo...' : fileName() || 'Drop a photo here, or browse' }}</span>
            <span class="text-[10px] text-muted-foreground">JPG, PNG, or WebP · Large camera photos are resized safely</span>
          </label>
          <input
            id="report-photo"
            type="file"
            accept="image/*"
            (change)="onFileSelected($event)"
            class="sr-only"
          />

          <label
            for="report-camera"
            class="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 pr-3 text-xs font-medium text-primary hover:opacity-80"
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
          @if (mediaData(); as preview) {
            <div class="mt-3 overflow-hidden rounded-[14px] border border-border bg-muted/30">
              <img [src]="preview" alt="Selected waste report photo preview" class="max-h-56 w-full object-contain" />
            </div>
          }
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
            [disabled]="photoProcessing()"
          >
            <app-icon name="send" class="size-4"></app-icon>
            Submit report
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class ReportModalComponent implements OnDestroy {
  close = output<void>();
  create = output<TicketDraft>();

  inputCls = inputClassName;

  categories = ['Mixed waste', 'Recyclables', 'Organic', 'Glass', 'Hazardous'];
  priorities: Priority[] = ['Low', 'Medium', 'High'];
  category = signal<string>('Mixed waste');
  priority = signal<Priority>('Medium');
  title = '';
  address = '';
  locationLatitude = signal<number | null>(null);
  locationLongitude = signal<number | null>(null);
  addressSuggestions = signal<AddressSuggestion[]>([]);
  addressSearching = signal(false);
  description = '';
  fileName = signal<string>('');
  mediaData = signal<string | null>(null);
  photoProcessing = signal(false);
  error = signal<string>('');
  private addressTimer?: number;
  private addressRequest = 0;

  constructor(private ticketService: TicketService) {}

  getPriorityClass(isSelected: boolean, item: string): string {
    if (!isSelected) return 'border-border text-muted-foreground hover:text-foreground';
    if (item === 'High') return 'border-danger/40 bg-danger/10 text-danger';
    if (item === 'Medium') return 'border-warning/40 bg-warning/10 text-warning';
    return 'border-brand/40 bg-brand/10 text-brand';
  }

  onAddressChange(value: string) {
    this.address = value;
    this.locationLatitude.set(null);
    this.locationLongitude.set(null);
    this.addressSuggestions.set([]);
    if (this.addressTimer) clearTimeout(this.addressTimer);
    const query = value.trim();
    if (query.length < 3) {
      this.addressSearching.set(false);
      return;
    }
    const request = ++this.addressRequest;
    this.addressTimer = window.setTimeout(async () => {
      this.addressSearching.set(true);
      try {
        const suggestions = await this.ticketService.searchAddresses(query);
        if (request === this.addressRequest) this.addressSuggestions.set(suggestions);
      } catch {
        if (request === this.addressRequest) this.addressSuggestions.set([]);
      } finally {
        if (request === this.addressRequest) this.addressSearching.set(false);
      }
    }, 600);
  }

  selectAddress(suggestion: AddressSuggestion) {
    this.address = suggestion.label;
    this.locationLatitude.set(suggestion.latitude);
    this.locationLongitude.set(suggestion.longitude);
    this.addressSuggestions.set([]);
    this.addressRequest += 1;
    if (this.addressTimer) clearTimeout(this.addressTimer);
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.photoProcessing.set(true);
    this.error.set('');
    try {
      const imageData = await prepareImageFile(file);
      this.fileName.set(file.name || 'Camera photo.jpg');
      this.mediaData.set(imageData);
    } catch (err: any) {
      this.fileName.set('');
      this.mediaData.set(null);
      this.error.set(err?.message || 'Could not prepare that photo.');
    } finally {
      this.photoProcessing.set(false);
      input.value = '';
    }
  }

  submit() {
    if (!this.address.trim()) {
      this.error.set('Add a street address so the crew can find the issue.');
      return;
    }

    const title = this.title.trim() || `${this.category()} collection report`;
    const note = this.description.trim();
    const newTicket: TicketDraft = {
      title,
      category: this.category(),
      address: this.address.trim(),
      locationLatitude: this.locationLatitude(),
      locationLongitude: this.locationLongitude(),
      priority: this.priority(),
      // The API stores one description field, so keep the citizen's title in it.
      description: note ? `${title} — ${note}` : title,
      mediaData: this.mediaData(),
    };

    this.create.emit(newTicket);
  }

  ngOnDestroy() {
    if (this.addressTimer) clearTimeout(this.addressTimer);
    this.addressRequest += 1;
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
  changeDetection: ChangeDetectionStrategy.Eager,
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
          @if (assignedWorker(); as worker) {
            <div class="mt-3 flex items-start gap-2.5">
              <app-avatar [initials]="workerInitials()" class="size-9"></app-avatar>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-foreground">{{ worker.firstName }} {{ worker.lastName }}</p>
                <p class="mt-1 text-[11px] text-muted-foreground">Worker ID #{{ worker.id }} · Verified operative</p>
                @if (worker.mobile) {
                  <a [href]="'tel:' + worker.mobile" class="mt-2 inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline underline-offset-2">
                    <app-icon name="phone" class="size-3.5"></app-icon>
                    Call {{ worker.mobile }}
                  </a>
                }
              </div>
            </div>
          } @else {
            <p class="mt-3 text-xs text-muted-foreground">Awaiting assignment</p>
          }
        </div>
      </div>

      @if (assignedWorker()) {
        <div class="mt-4 overflow-hidden rounded-[18px] border border-border/60 bg-muted/30">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div>
              <p class="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <app-icon name="navigation" class="size-4 text-primary"></app-icon>
                Live route tracking
              </p>
              <p class="mt-1 text-[10px] text-muted-foreground" aria-live="polite">{{ trackingSummary() }}</p>
            </div>
            @if (directionsUrl()) {
              <a [href]="directionsUrl()" target="_blank" rel="noopener noreferrer" appButton variant="outline" size="sm" class="rounded-full">Open map</a>
            }
          </div>
          @if (mapPreview(); as preview) {
            <iframe title="Assigned worker's live route to the collection address" [src]="preview" class="h-64 w-full border-0 sm:h-72" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          } @else {
            <div class="flex min-h-44 flex-col items-center justify-center gap-2 px-5 text-center">
              <app-icon name="map-pin" class="size-6 text-muted-foreground"></app-icon>
              <p class="text-xs font-medium text-foreground">Waiting for live GPS</p>
              <p class="max-w-sm text-[11px] leading-5 text-muted-foreground">Tracking starts when the worker begins this route and shares a fresh location.</p>
            </div>
          }
        </div>
      }

      @if (ticket().code && !isClosedStatus(ticket().status)) {
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

      @if (completionPhoto(); as photo) {
        <div class="mt-5 rounded-[18px] border border-brand/25 bg-brand/5 p-4">
          <p class="flex items-center gap-2 text-xs font-medium text-brand">
            <app-icon name="check-circle-2" class="size-4"></app-icon>
            OTP verified · Work completed
          </p>
          <img [src]="photo" alt="Worker's photo of the completed collection" class="mt-3 max-h-80 w-full rounded-[14px] bg-muted object-contain" />
          <p class="mt-2 text-[11px] text-muted-foreground">Completion photo uploaded by the assigned worker.</p>
        </div>
      }

      @if (statusHistory().length > 0) {
        <div class="mt-5 rounded-[18px] border border-border/60 p-4">
          <p class="text-xs font-medium text-foreground">Latest updates</p>
          <ol class="mt-3 space-y-3">
            @for (event of statusHistory(); track $index) {
              <li class="flex gap-2.5 text-[11px] leading-5">
                <span class="mt-1.5 size-2 shrink-0 rounded-full bg-brand"></span>
                <span><strong class="font-medium text-foreground">{{ statusLabel(event.status) }}</strong><span class="block text-muted-foreground">{{ event.note || 'Status updated' }} · {{ event.createdAt | date:'medium' }}</span></span>
              </li>
            }
          </ol>
        </div>
      }

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
export class TicketDetailModalComponent implements OnInit, OnDestroy {
  readonly isClosedStatus = isClosedStatus;
  ticket = input.required<Ticket>();
  close = output<void>();
  trackingChanged = output<BackendTicket>();
  workerNearby = output<Ticket>();

  copied = signal<boolean>(false);
  messageError = signal<string>('');
  messageText = '';
  messages = signal<{ text: string; from: 'worker' | 'citizen' }[]>([]);
  tracking = signal<TicketTrackingSnapshot | null>(null);
  trackingError = signal('');
  mapPreview = signal<SafeResourceUrl | null>(null);
  directionsUrl = signal('');
  private trackingTimer?: number;
  private nearbyAnnounced = false;
  private destroyed = false;

  constructor(private ticketService: TicketService, private sanitizer: DomSanitizer) {}

  async ngOnInit() {
    const numId = this.ticket().numericId;
    if (numId) {
      const [messages] = await Promise.allSettled([
        this.ticketService.getMessages(numId),
        this.refreshTracking(),
      ]);
      if (messages.status === 'fulfilled' && messages.value.length > 0) {
        this.messages.set(messages.value.map((message) => ({
          text: message.message,
          from: message.senderRole === 'user' ? 'citizen' : 'worker',
        })));
      }
      if (!this.destroyed && !isClosedStatus(this.currentStatus())) {
        this.trackingTimer = window.setInterval(() => void this.refreshTracking(), 3000);
      }
    }
  }

  assignedWorker = computed(() => this.tracking()?.ticket?.assignedWorker ?? this.ticket().raw?.assignedWorker ?? null);
  completionPhoto = computed(() => this.tracking()?.ticket?.completionMediaData ?? this.ticket().raw?.completionMediaData ?? null);
  statusHistory = computed(() => {
    const history = this.tracking()?.ticket?.statusHistory ?? this.ticket().raw?.statusHistory ?? [];
    return [...history].slice(-5).reverse();
  });

  currentStatus = computed<Ticket['status']>(() => {
    const rawStatus = this.tracking()?.ticket?.status ?? this.ticket().raw?.status;
    if (rawStatus === 'assigned' || rawStatus === 'accepted') return 'Scheduled';
    if (rawStatus === 'in_progress') return 'In progress';
    if (rawStatus === 'completed') return 'Completed';
    if (rawStatus === 'cancelled') return 'Cancelled';
    return this.ticket().status;
  });

  trackingSummary = computed(() => {
    const snapshot = this.tracking();
    if (this.currentStatus() === 'Completed') return 'Completed with OTP verification and an after-photo.';
    if (this.trackingError()) return this.trackingError();
    if (!snapshot?.available) return 'Waiting for the worker to start sharing a fresh GPS location.';
    const distance = snapshot.distanceMeters;
    const distanceText = distance === null
      ? 'Live GPS active'
      : distance < 1000
        ? `${distance} m from the destination`
        : `${(distance / 1000).toFixed(1)} km from the destination`;
    return `${distanceText} · Updated every 3 seconds`;
  });

  workerInitials = computed(() => {
    const worker = this.assignedWorker();
    if (!worker) return 'OP';
    return `${worker.firstName?.[0] ?? ''}${worker.lastName?.[0] ?? ''}`.toUpperCase() || 'OP';
  });

  isStepActive(index: number): boolean {
    const status = this.currentStatus();
    return (
      index === 0 ||
      status === 'Completed' ||
      (index === 1 && (status === 'Scheduled' || status === 'In progress'))
    );
  }

  isLineActive(index: number): boolean {
    const status = this.currentStatus();
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

  statusLabel(status: string): string {
    return ({ pending: 'Report submitted', assigned: 'Worker assigned', accepted: 'Worker accepted', in_progress: 'Collection started', completed: 'Collection completed', cancelled: 'Report cancelled' } as Record<string, string>)[status] ?? status.replace(/_/g, ' ');
  }

  private async refreshTracking() {
    const ticketId = this.ticket().numericId;
    if (!ticketId || this.destroyed) return;
    const previousStatus = this.tracking()?.ticket?.status ?? this.ticket().raw?.status;
    try {
      const snapshot = await this.ticketService.getTracking(ticketId);
      if (this.destroyed) return;
      this.tracking.set(snapshot);
      this.trackingError.set('');
      this.updateMap(snapshot);
      if (snapshot.nearby && !this.nearbyAnnounced) {
        this.nearbyAnnounced = true;
        this.workerNearby.emit(this.ticket());
      }
      if (snapshot.ticket.status !== previousStatus) this.trackingChanged.emit(snapshot.ticket);
      if (['completed', 'cancelled'].includes(snapshot.ticket.status) && this.trackingTimer) {
        clearInterval(this.trackingTimer);
        this.trackingTimer = undefined;
      }
    } catch (err: any) {
      if (!this.destroyed) this.trackingError.set(err?.message || 'Live tracking is temporarily unavailable.');
    }
  }

  private updateMap(snapshot: TicketTrackingSnapshot) {
    if (!snapshot.available || !Number.isFinite(snapshot.latitude) || !Number.isFinite(snapshot.longitude)) {
      this.mapPreview.set(null);
      this.directionsUrl.set('');
      return;
    }
    const origin = `${snapshot.latitude},${snapshot.longitude}`;
    const raw = snapshot.ticket;
    const destination = Number.isFinite(raw.locationLatitude) && Number.isFinite(raw.locationLongitude)
      ? `${raw.locationLatitude},${raw.locationLongitude}`
      : raw.locationAddress;
    const embedded = `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}?output=embed`;
    const directions = new URL('https://www.google.com/maps/dir/');
    directions.searchParams.set('api', '1');
    directions.searchParams.set('origin', origin);
    directions.searchParams.set('destination', destination);
    this.mapPreview.set(this.sanitizer.bypassSecurityTrustResourceUrl(embedded));
    this.directionsUrl.set(directions.toString());
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.trackingTimer) clearInterval(this.trackingTimer);
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
  changeDetection: ChangeDetectionStrategy.Eager,
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
    return this.tickets().filter((t) => !isClosedStatus(t.status));
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
  changeDetection: ChangeDetectionStrategy.Eager,
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
              <app-icon [name]="photoProcessing() ? 'refresh-cw' : photoName() ? 'check-circle-2' : 'camera'" [class]="'size-4 ' + (photoProcessing() ? 'animate-spin' : '')"></app-icon>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-foreground">{{ photoProcessing() ? 'Preparing photo...' : photoName() || 'Take or upload a photo' }}</span>
              <span class="mt-1 block text-[10px] text-muted-foreground">Required · Large camera photos are resized safely</span>
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
          @if (photoData(); as preview) {
            <img [src]="preview" alt="After-collection photo preview" class="mt-3 max-h-52 w-full rounded-[14px] bg-muted object-contain" />
          }
        </div>

        @if (error()) {
          <p role="alert" class="text-xs leading-5 text-danger">{{ error() }}</p>
        }

        <button
          type="submit"
          appButton
          variant="brand"
          class="h-11 w-full rounded-full"
          [disabled]="photoProcessing()"
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
  photoProcessing = signal(false);
  error = signal<string>('');

  onOtpChange(val: string) {
    this.otp.set(val.replace(/\D/g, '').slice(0, 6));
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.photoProcessing.set(true);
    this.error.set('');
    try {
      this.photoData.set(await prepareImageFile(file));
      this.photoName.set(file.name || 'Completion photo.jpg');
    } catch (err: any) {
      this.photoName.set('');
      this.photoData.set('');
      this.error.set(err?.message || 'Could not prepare that photo.');
    } finally {
      this.photoProcessing.set(false);
      input.value = '';
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
    this.complete.emit({ ticket: this.ticket(), otp: this.otp(), photoData: this.photoData() });
  }
}
