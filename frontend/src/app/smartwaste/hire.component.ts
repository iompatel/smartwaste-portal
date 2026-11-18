import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  FieldLabelComponent,
  SectionHeaderComponent,
  StatusBadgeComponent,
  SurfaceComponent,
  inputClassName,
} from '../shared/ui-components';
import { Booking } from './data';

export interface ServiceOption {
  title: string;
  description: string;
  icon: string;
}

export const services: ServiceOption[] = [
  { title: 'Home cleaning', description: 'A fresh start for your space.', icon: 'home' },
  { title: 'Garden cleanup', description: 'Make your outdoors feel new.', icon: 'leaf' },
  { title: 'Bulk waste pickup', description: 'For the things that do not fit.', icon: 'truck' },
];

@Component({
  selector: 'app-citizen-hire-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    FieldLabelComponent,
    SectionHeaderComponent,
    StatusBadgeComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      <section class="relative isolate overflow-hidden rounded-[26px] border border-brand/15 bg-hero p-6 sm:p-8">
        <div class="pointer-events-none absolute -right-10 -bottom-28 -z-10 size-72 rounded-full border border-brand/15"></div>
        <div class="max-w-xl">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
            <app-icon name="sparkles" class="size-3.5"></app-icon>
            Trusted help, on your schedule
          </span>
          <h1 class="mt-5 text-[32px] leading-tight font-semibold tracking-[-0.065em] text-foreground sm:text-[40px]">
            A helping hand, when you need it<span class="text-brand">.</span>
          </h1>
          <p class="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Request a verified local operative and follow every assignment update in one place.
          </p>
        </div>
      </section>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <!-- Booking form -->
        <app-surface class="p-5 sm:p-7">
          <app-section-header
            title="What can we help with?"
            description="Choose a service and find your ideal time."
          ></app-section-header>

          <form (ngSubmit)="submit()" class="mt-6 flex flex-col gap-5">
            <div class="grid gap-3 sm:grid-cols-3">
              @for (service of servicesList; track service.title) {
                @let selected = selectedService() === service.title;
                <button
                  type="button"
                  [attr.aria-pressed]="selected"
                  (click)="selectedService.set(service.title)"
                  class="flex flex-col items-start rounded-[16px] border p-4 text-left transition-all cursor-pointer"
                  [ngClass]="selected ? 'border-brand/50 bg-brand/10' : 'border-border hover:border-brand/30'"
                >
                  <span
                    class="flex size-9 items-center justify-center rounded-[11px]"
                    [ngClass]="selected ? 'bg-brand/15 text-brand' : 'bg-muted text-muted-foreground'"
                  >
                    <app-icon [name]="service.icon" class="size-4"></app-icon>
                  </span>
                  <span class="mt-3 text-xs font-medium text-foreground">{{ service.title }}</span>
                  <span class="mt-1 text-[10px] leading-4 text-muted-foreground">{{ service.description }}</span>
                </button>
              }
            </div>

            <div>
              <app-field-label htmlFor="hire-address">Work address</app-field-label>
              <div class="relative">
                <app-icon name="map-pin" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="hire-address"
                  [(ngModel)]="address"
                  name="address"
                  required
                  placeholder="Where should the operative come?"
                  [class]="inputCls + ' pl-10'"
                />
              </div>
            </div>

            <div>
              <app-field-label htmlFor="hire-note" [optional]="true">Tell your operative a little more</app-field-label>
              <textarea
                id="hire-note"
                [(ngModel)]="note"
                name="note"
                rows="3"
                placeholder="Access notes, special requests, or anything helpful..."
                [class]="inputCls + ' h-auto resize-none py-3'"
              ></textarea>
            </div>

            <div class="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <app-icon name="shield-check" class="size-3.5 text-brand"></app-icon>
                Verified operatives · Secure booking
              </span>
              <button
                type="submit"
                appButton
                variant="brand"
                class="rounded-full"
              >
                Request booking
                <app-icon name="arrow-right" class="size-4"></app-icon>
              </button>
            </div>
          </form>
        </app-surface>

        <!-- Right Side: Your bookings -->
        <div class="flex flex-col gap-5">
          <app-surface class="p-5 sm:p-6">
            <div class="flex items-center justify-between">
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">Your bookings</h2>
              <app-icon name="briefcase-business" class="size-4 text-muted-foreground"></app-icon>
            </div>

            <div class="mt-4 flex flex-col gap-3">
              @if (bookings().length === 0) {
                <p class="rounded-[14px] bg-muted/50 p-3.5 text-[11px] text-muted-foreground">
                  No bookings yet. Request a service and an admin will assign an operative.
                </p>
              }
              @for (booking of bookings(); track booking.id) {
                <div class="rounded-[14px] bg-muted/50 p-3.5">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="text-xs font-medium text-foreground">{{ booking.title }}</p>
                      <p class="mt-1 text-[11px] text-muted-foreground">{{ booking.worker }}</p>
                    </div>
                    <app-status-badge [status]="booking.status"></app-status-badge>
                  </div>
                  <div class="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span class="flex items-center gap-1">
                      <app-icon name="calendar-days" class="size-3"></app-icon>
                      {{ booking.date }}
                    </span>
                  </div>
                </div>
              }
            </div>
          </app-surface>
        </div>
      </div>
    </div>
  `
})
export class CitizenHireViewComponent {
  bookings = input.required<Booking[]>();
  createBooking = output<Booking>();

  inputCls = inputClassName;
  servicesList = services;

  selectedService = signal<string>('Home cleaning');
  address = '';
  note = '';

  submit() {
    const newBooking: Booking = {
      id: `BK-${210 + this.bookings().length}`,
      title: this.selectedService(),
      worker: 'Awaiting operative',
      date: new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      status: 'Pending',
      purpose: this.note.trim() || 'Residential maintenance and waste collection',
      address: this.address.trim(),
    };

    this.createBooking.emit(newBooking);
  }
}

@Component({
  selector: 'app-worker-hire-view',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    SectionHeaderComponent,
    StatusBadgeComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header
        eyebrow="Field operations"
        title="Hired tasks"
        description="Private cleaning requests from residents in your area."
      ></app-section-header>

      @if (bookings().length === 0) {
        <app-surface class="p-6">
          <p class="text-xs text-muted-foreground">
            No hired tasks right now. Admin-assigned private requests will appear here.
          </p>
        </app-surface>
      }
      <div class="grid gap-4 md:grid-cols-2">
        @for (booking of bookings(); track booking.id) {
          <app-surface class="p-5">
            <div class="flex items-start justify-between gap-3">
              <span class="flex size-10 items-center justify-center rounded-[13px] bg-brand/10 text-brand">
                <app-icon name="briefcase-business" class="size-5"></app-icon>
              </span>
              <app-status-badge [status]="booking.status"></app-status-badge>
            </div>
            <h3 class="mt-4 text-base font-medium tracking-[-0.02em] text-foreground">{{ booking.title }}</h3>
            <p class="mt-1 text-[10px] font-medium text-muted-foreground">{{ booking.id }}</p>
            <p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <app-icon name="map-pin" class="size-3.5"></app-icon>
              {{ booking.address || 'Address shared by dispatcher' }}
            </p>
            <p class="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <app-icon name="calendar-days" class="size-3.5"></app-icon>
              {{ booking.date }}
            </p>
            @if (booking.purpose) {
              <p class="mt-2 line-clamp-2 text-xs text-muted-foreground">{{ booking.purpose }}</p>
            }
            <div class="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
              @if (booking.status === 'Confirmed') {
                <button
                  type="button"
                  appButton
                  variant="brand"
                  size="sm"
                  class="rounded-full"
                  (click)="completeBooking.emit(booking)"
                >
                  Complete task
                  <app-icon name="check" class="size-3.5"></app-icon>
                </button>
              }
            </div>
          </app-surface>
        }
      </div>
    </div>
  `
})
export class WorkerHireViewComponent {
  bookings = input.required<Booking[]>();
  completeBooking = output<Booking>();
}

@Component({
  selector: 'app-hire-view',
  standalone: true,
  imports: [CommonModule, CitizenHireViewComponent, WorkerHireViewComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (worker()) {
      <app-worker-hire-view
        [bookings]="bookings()"
        (completeBooking)="completeBooking.emit($event)"
      ></app-worker-hire-view>
    } @else {
      <app-citizen-hire-view
        [bookings]="bookings()"
        (createBooking)="createBooking.emit($event)"
      ></app-citizen-hire-view>
    }
  `
})
export class HireViewComponent {
  bookings = input.required<Booking[]>();
  worker = input<boolean>(false);
  createBooking = output<Booking>();
  completeBooking = output<Booking>();
}
