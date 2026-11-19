import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  viewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';
import { ButtonDirective } from './button.component';
import { cn } from './utils';
import { Priority, TicketStatus } from '../smartwaste/data';

export const inputClassName =
  'h-11 w-full rounded-[12px] border border-input bg-background/70 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/15';

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex items-center gap-2 sm:gap-2.5">
      <span
        [class]="iconClasses()"
      >
        <app-icon name="recycle" [class]="iconSizeClass()" [strokeWidth]="2.2"></app-icon>
      </span>
      @if (!compact()) {
        <span class="font-semibold tracking-[-0.055em] text-foreground select-none" [class]="textClasses()">
          smartwaste<span class="text-brand-ink">.</span>
        </span>
      }
    </div>
  `
})
export class BrandMarkComponent {
  compact = input<boolean>(false);
  size = input<'default' | 'sm' | 'responsive'>('default');

  iconClasses = computed(() => {
    if (this.size() === 'sm') {
      return 'flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand text-brand-foreground shadow-[0_4px_12px_color-mix(in_oklab,var(--brand)_22%,transparent)]';
    }
    if (this.size() === 'responsive') {
      return 'flex size-8 sm:size-10 shrink-0 items-center justify-center rounded-[11px] sm:rounded-[14px] bg-brand text-brand-foreground shadow-[0_6px_16px_color-mix(in_oklab,var(--brand)_22%,transparent)]';
    }
    return 'flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-brand text-brand-foreground shadow-[0_8px_20px_color-mix(in_oklab,var(--brand)_22%,transparent)]';
  });

  iconSizeClass = computed(() => {
    if (this.size() === 'sm') return 'size-4';
    if (this.size() === 'responsive') return 'size-4 sm:size-5';
    return 'size-5';
  });

  textClasses = computed(() => {
    if (this.size() === 'sm') return 'text-[17px]';
    if (this.size() === 'responsive') return 'text-[17px] sm:text-[21px]';
    return 'text-[21px]';
  });
}

@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span
      [class]="classes()"
    >
      {{ initials() }}
      @if (online()) {
        <span
          class="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card bg-brand"
          aria-label="Online"
        ></span>
      }
    </span>
  `
})
export class AvatarComponent {
  initials = input.required<string>();
  class = input<string>('');
  online = input<boolean>(false);

  classes = computed(() => {
    return cn(
      'relative flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-foreground',
      this.class()
    );
  });
}

@Component({
  selector: 'app-live-dot',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span [class]="classes()">
      <span class="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-50"></span>
      <span class="relative inline-flex size-2 rounded-full bg-brand"></span>
    </span>
  `
})
export class LiveDotComponent {
  class = input<string>('');

  classes = computed(() => {
    return cn('relative flex size-2', this.class());
  });
}

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span [class]="classes()">
      <span class="size-1.5 rounded-full bg-current"></span>
      {{ status() }}
    </span>
  `
})
export class StatusBadgeComponent {
  status = input.required<TicketStatus | 'Confirmed' | 'Pending' | 'On route' | 'Break' | 'Open' | string>();

  classes = computed(() => {
    const s = this.status();
    const tone =
      s === 'Completed' || s === 'Confirmed' || s === 'On route' || s === 'Online'
        ? 'bg-success/10 text-success-ink'
        : s === 'Cancelled'
          ? 'bg-danger/10 text-danger-ink'
        : s === 'In progress' || s === 'Pending' || s === 'Open'
          ? 'bg-primary/10 text-primary'
          : s === 'Scheduled'
            ? 'bg-warning/10 text-warning-ink'
            : 'bg-muted text-muted-foreground';
    return cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
      tone
    );
  });
}

@Component({
  selector: 'app-priority-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span [class]="classes()">
      {{ priority() }}
    </span>
  `
})
export class PriorityBadgeComponent {
  priority = input.required<Priority>();

  classes = computed(() => {
    const p = this.priority();
    const tone =
      p === 'High'
        ? 'bg-danger/10 text-danger-ink'
        : p === 'Medium'
          ? 'bg-warning/10 text-warning-ink'
          : 'bg-muted text-muted-foreground';
    return cn(
      'rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide uppercase',
      tone
    );
  });
}

@Component({
  selector: 'app-surface',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div [class]="classes()">
      <ng-content></ng-content>
    </div>
  `
})
export class SurfaceComponent {
  class = input<string>('');

  classes = computed(() => {
    return cn(
      'rounded-[22px] border border-border/70 bg-card text-card-foreground shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] backdrop-blur-xl',
      this.class()
    );
  });
}

@Component({
  selector: 'app-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        @if (eyebrow()) {
          <p class="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {{ eyebrow() }}
          </p>
        }
        <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">
          {{ title() }}
        </h2>
        @if (description()) {
          <p class="text-sm leading-5 text-muted-foreground">
            {{ description() }}
          </p>
        }
      </div>
      <ng-content select="[action]"></ng-content>
    </div>
  `
})
export class SectionHeaderComponent {
  eyebrow = input<string>('');
  title = input.required<string>();
  description = input<string>('');
}

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [SurfaceComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-surface [class]="'p-4 sm:p-5 ' + class()">
      <div class="flex items-start justify-between gap-3">
        <span [class]="toneClass()">
          <app-icon [name]="icon()" class="size-[18px]"></app-icon>
        </span>
        @if (trend()) {
          <span class="text-[11px] font-medium text-brand-ink">{{ trend() }}</span>
        }
      </div>
      <div class="mt-5 flex flex-col gap-1">
        <span class="text-[12px] font-medium text-muted-foreground">{{ label() }}</span>
        <strong class="text-[28px] font-semibold tracking-[-0.055em] tabular-nums text-foreground">
          {{ value() }}
        </strong>
        <span class="text-[11px] text-muted-foreground">{{ detail() }}</span>
      </div>
    </app-surface>
  `
})
export class MetricCardComponent {
  label = input.required<string>();
  value = input.required<string>();
  detail = input.required<string>();
  icon = input.required<string>();
  trend = input<string>('');
  tone = input<'blue' | 'green' | 'amber' | 'red'>('blue');
  class = input<string>('');

  toneClass = computed(() => {
    const tones = {
      blue: 'bg-primary/10 text-primary',
      green: 'bg-brand/10 text-brand-ink',
      amber: 'bg-warning/10 text-warning-ink',
      red: 'bg-danger/10 text-danger-ink',
    };
    return cn(
      'flex size-9 items-center justify-center rounded-[12px]',
      tones[this.tone()]
    );
  });
}

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        class="h-full rounded-full transition-[width] duration-500"
        [class.bg-brand]="tone() === 'brand'"
        [class.bg-primary]="tone() === 'primary'"
        [style.width.%]="clampedValue()"
      ></div>
    </div>
  `
})
export class ProgressBarComponent {
  value = input.required<number>();
  tone = input<'brand' | 'primary'>('brand');

  clampedValue = computed(() => {
    return Math.min(100, Math.max(0, this.value()));
  });
}

@Component({
  selector: 'app-score-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="relative flex size-[132px] shrink-0 items-center justify-center rounded-full p-[7px] sm:size-[154px]"
      [style.background]="conicGradient()"
    >
      <div class="flex size-full flex-col items-center justify-center rounded-full bg-hero text-center">
        <span class="text-[42px] font-semibold leading-none tracking-[-0.08em] text-foreground">
          {{ score() }}
        </span>
        <span class="mt-2 max-w-[80px] text-[10px] leading-3 text-muted-foreground">
          {{ label() }}
        </span>
      </div>
    </div>
  `
})
export class ScoreRingComponent {
  score = input.required<number>();
  label = input<string>('Completion rate');

  conicGradient = computed(() => {
    const s = this.score();
    return `conic-gradient(var(--brand) 0% ${s}%, color-mix(in oklab, var(--brand) 12%, transparent) ${s}% 100%)`;
  });
}

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <button
      type="button"
      role="switch"
      [disabled]="disabled()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      (click)="toggle()"
      class="relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      [ngClass]="checked() ? 'bg-brand' : 'bg-muted-foreground/30'"
    >
      <span
        class="block size-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        [class.translate-x-5]="checked()"
      ></span>
    </button>
  `
})
export class ToggleComponent {
  disabled = input(false);
  checked = input.required<boolean>();
  label = input.required<string>();
  checkedChange = output<boolean>();

  toggle() {
    if (this.disabled()) return;
    this.checkedChange.emit(!this.checked());
  }
}

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [ButtonDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      (mousedown)="onBackdropClick($event)"
    >
      <div
        #dialog
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        [attr.aria-labelledby]="titleId"
        [class]="modalClasses() + ' outline-none'"
      >
        <div class="mb-6 flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1.5">
            <h2 [id]="titleId" class="text-xl font-semibold tracking-[-0.04em] text-foreground">
              {{ title() }}
            </h2>
            @if (description()) {
              <p class="text-sm leading-5 text-muted-foreground">
                {{ description() }}
              </p>
            }
          </div>
          <button
            type="button"
            appButton
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            (click)="closeModal()"
            class="rounded-full"
          >
            <app-icon name="x" class="size-4"></app-icon>
          </button>
        </div>
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class ModalComponent implements OnInit, AfterViewInit, OnDestroy {
  title = input.required<string>();
  description = input<string>('');
  wide = input<boolean>(false);
  close = output<void>();

  readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 8)}`;
  private dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';

  modalClasses = computed(() => {
    return cn(
      'max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-border/70 bg-card p-5 shadow-2xl sm:rounded-[28px] sm:p-7',
      this.wide() ? 'sm:max-w-2xl' : 'sm:max-w-lg'
    );
  });

  ngOnInit() {
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit() {
    this.dialog()?.nativeElement.focus();
  }

  ngOnDestroy() {
    document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: Event) {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === 'Escape') {
      this.closeModal();
      return;
    }
    if (keyEvent.key !== 'Tab') return;
    const root = this.dialog()?.nativeElement;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    if (!focusables.length) {
      keyEvent.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (document.activeElement === root || !root.contains(document.activeElement)) {
      keyEvent.preventDefault();
      (keyEvent.shiftKey ? last : first).focus();
    } else if (keyEvent.shiftKey && document.activeElement === first) {
      keyEvent.preventDefault();
      last.focus();
    } else if (!keyEvent.shiftKey && document.activeElement === last) {
      keyEvent.preventDefault();
      first.focus();
    }
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  closeModal() {
    this.close.emit();
  }
}

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      role="status"
      class="fixed right-4 bottom-20 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-foreground shadow-2xl backdrop-blur-xl sm:right-6 sm:bottom-6"
    >
      <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-ink">
        <app-icon name="check" class="size-3.5"></app-icon>
      </span>
      <span class="leading-5">{{ message() }}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        (click)="closeToast()"
        class="ml-2 text-muted-foreground hover:text-foreground"
      >
        <app-icon name="x" class="size-4"></app-icon>
      </button>
    </div>
  `
})
export class ToastComponent {
  message = input.required<string>();
  close = output<void>();

  closeToast() {
    this.close.emit();
  }
}

@Component({
  selector: 'app-text-link',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <button
      type="button"
      (click)="clicked.emit()"
      class="inline-flex items-center gap-1 rounded text-xs font-medium text-primary transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ng-content></ng-content>
      <app-icon name="chevron-right" class="size-3.5"></app-icon>
    </button>
  `
})
export class TextLinkComponent {
  clicked = output<void>();
}

@Component({
  selector: 'app-field-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <label
      [attr.for]="htmlFor()"
      class="mb-2 flex items-center justify-between text-xs font-medium text-foreground"
    >
      <span><ng-content></ng-content></span>
      @if (optional()) {
        <span class="font-normal text-muted-foreground">Optional</span>
      }
    </label>
  `
})
export class FieldLabelComponent {
  htmlFor = input.required<string>();
  optional = input<boolean>(false);
}
