import {
  Component,
  ElementRef,
  ViewChildren,
  QueryList,
  computed,
  input,
  output,
  signal,
  type OnInit,
  type OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from './icon.component';

export interface StackNotificationItem {
  id: string;
  app: string;
  title: string;
  body: string;
  time: string;
  icon?: string;
  iconBg?: string;
  read?: boolean;
}

const PEEK = 12;
const VISIBLE_BEHIND = 2;
const GAP = 10;
const FALLBACK_HEIGHT = 76;
const DISMISS_DISTANCE = 80;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  axis: 'x' | 'y' | null;
  time: number;
}

@Component({
  selector: 'app-notification-stack',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      class="w-full max-w-sm mx-auto select-none transition-all duration-300"
      (pointerenter)="onPointerEnter($event)"
      (pointerleave)="onPointerLeave($event)"
    >
      <!-- Header -->
      <div class="mb-3 flex h-7 items-center justify-between px-1">
        <p class="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>Notifications</span>
          <span class="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400 font-semibold tabular-nums">
            {{ laidOut().length }}
          </span>
        </p>
        <div class="flex items-center gap-2">
          @if (unreadCount() > 0) {
            <button
              type="button"
              (click)="markAllRead.emit()"
              class="text-xs text-primary font-medium hover:underline cursor-pointer"
            >
              Mark all read
            </button>
          }
          @if (laidOut().length > 1) {
            <button
              type="button"
              [attr.aria-expanded]="expanded()"
              (click)="togglePinned()"
              class="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 cursor-pointer font-medium"
            >
              {{ expanded() ? 'Show less' : 'Show all' }}
            </button>
          }
        </div>
      </div>

      <!-- Card Stack List -->
      <ol
        #listContainer
        aria-label="Notifications"
        class="relative outline-none transition-[height] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
        [style.height.px]="totalStackHeight()"
      >
        @for (item of items(); track item.id; let idx = $index) {
          @let depth = getDepth(item.id);
          @let isLeaving = leaving().has(item.id);
          @let hidden = depth > VISIBLE_BEHIND && !expanded();
          @let scale = getScale(depth, isLeaving);
          @let yPos = getYPosition(depth, item.id);
          @let zIdx = getZIndex(depth);
          @let muted = !expanded() && depth > 0;

          <li
            #cardElement
            [attr.data-id]="item.id"
            class="absolute inset-x-0 top-0 origin-top transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
            [style.transform]="'translateY(' + yPos + 'px) scale(' + scale + ')'"
            [style.opacity]="hidden ? '0' : '1'"
            [style.z-index]="zIdx"
            [style.pointer-events]="hidden ? 'none' : 'auto'"
          >
            <div
              class="touch-pan-y relative"
              [style.transform]="getCardSwipeTransform(item.id)"
              [style.opacity]="getCardSwipeOpacity(item.id)"
              (pointerdown)="handlePointerDown($event, depth)"
              (pointermove)="handlePointerMove($event, item.id)"
              (pointerup)="handlePointerUp($event, item.id)"
              (pointercancel)="handlePointerCancel(item.id)"
            >
              <article
                [attr.aria-label]="item.app + ': ' + item.title + '. ' + item.body"
                class="group relative flex select-none gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3.5 shadow-sm outline-none transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                [class.cursor-pointer]="!expanded() && depth === 0 && laidOut().length > 1"
                [class.ring-1]="!item.read"
                [class.ring-primary/30]="!item.read"
                (click)="onCardClick(item)"
              >
                <!-- Dismiss button (Kokonut UI top-left pill) -->
                <button
                  type="button"
                  [attr.aria-label]="'Dismiss ' + item.title"
                  (click)="dismissCard($event, item.id)"
                  class="absolute -top-2 -left-2 z-10 flex size-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 opacity-0 transition-opacity duration-150 hover:bg-zinc-100 hover:text-zinc-900 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer shadow-sm"
                  [class.hidden]="muted"
                >
                  <app-icon name="x" class="size-3"></app-icon>
                </button>

                <!-- Notification Content -->
                <div
                  class="flex min-w-0 flex-1 gap-3 transition-opacity duration-200"
                  [class.opacity-0]="muted"
                >
                  <!-- Icon Box -->
                  <div class="shrink-0">
                    <span
                      class="flex size-9 items-center justify-center rounded-xl text-white shadow-xs"
                      [ngClass]="item.iconBg || 'bg-primary'"
                    >
                      <app-icon [name]="item.icon || 'bell'" class="size-4.5"></app-icon>
                    </span>
                  </div>

                  <!-- Text details -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <p class="truncate font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <span>{{ item.title }}</span>
                        @if (!item.read) {
                          <span class="size-1.5 rounded-full bg-primary inline-block"></span>
                        }
                      </p>
                      <span class="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {{ item.time }}
                      </span>
                    </div>
                    <p class="mt-0.5 line-clamp-2 text-xs leading-4 text-zinc-500 dark:text-zinc-400">
                      {{ item.body }}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </li>
        }
      </ol>

      <!-- Empty State -->
      @if (laidOut().length === 0) {
        <div class="py-8 text-center">
          <span class="mx-auto flex size-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-2">
            <app-icon name="bell" class="size-5"></app-icon>
          </span>
          <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">You're all caught up</p>
          <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">No new notifications right now</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class NotificationStackComponent implements OnInit, OnDestroy {
  items = input<StackNotificationItem[]>([]);
  dismiss = output<string>();
  markAllRead = output<void>();
  selectNotification = output<StackNotificationItem>();

  readonly VISIBLE_BEHIND = VISIBLE_BEHIND;

  hovered = signal(false);
  pinned = signal(false);
  leaving = signal<Set<string>>(new Set());

  // Swipe offset state
  swipeOffsets = signal<Record<string, number>>({});

  @ViewChildren('cardElement') cardElements!: QueryList<ElementRef<HTMLElement>>;

  private heights: Record<string, number> = {};
  private activeDrag: DragState | null = null;
  private resizeObserver: ResizeObserver | null = null;

  laidOut = computed(() => {
    const leavingSet = this.leaving();
    return this.items().filter((item) => !leavingSet.has(item.id));
  });

  unreadCount = computed(() => {
    return this.items().filter((item) => !item.read).length;
  });

  expanded = computed(() => {
    return (this.hovered() || this.pinned()) && this.laidOut().length > 1;
  });

  totalStackHeight = computed(() => {
    const list = this.laidOut();
    if (!list.length) return 80;
    const expandedMode = this.expanded();
    const frontHeight = this.heightOf(list[0]?.id);

    if (expandedMode) {
      return (
        list.reduce((sum, item) => sum + this.heightOf(item.id), 0) +
        Math.max(list.length - 1, 0) * GAP
      );
    }

    return frontHeight + Math.min(list.length - 1, VISIBLE_BEHIND) * PEEK;
  });

  ngOnInit() {
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).getAttribute('data-id');
          if (id) {
            this.heights[id] = Math.round(entry.borderBoxSize[0]?.blockSize || (entry.target as HTMLElement).offsetHeight);
          }
        }
      });
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  private heightOf(id?: string): number {
    if (!id) return FALLBACK_HEIGHT;
    return this.heights[id] || FALLBACK_HEIGHT;
  }

  getDepth(id: string): number {
    const index = this.laidOut().findIndex((card) => card.id === id);
    return Math.max(index, 0);
  }

  getScale(depth: number, isLeaving: boolean): number {
    if (this.expanded() || isLeaving) return 1;
    return Math.max(1 - depth * 0.05, 0.85);
  }

  getYPosition(depth: number, id: string): number {
    const list = this.laidOut();
    if (this.expanded()) {
      let offset = 0;
      for (let i = 0; i < depth; i++) {
        offset += this.heightOf(list[i]?.id) + GAP;
      }
      return offset;
    }

    const frontHeight = this.heightOf(list[0]?.id);
    const scale = this.getScale(depth, false);
    return frontHeight + depth * PEEK - this.heightOf(id) * scale;
  }

  getZIndex(depth: number): number {
    return Math.max(this.items().length - depth, 1);
  }

  getCardSwipeTransform(id: string): string {
    const offset = this.swipeOffsets()[id] || 0;
    return offset === 0 ? 'none' : `translateX(${offset}px)`;
  }

  getCardSwipeOpacity(id: string): string {
    const offset = this.swipeOffsets()[id] || 0;
    if (offset === 0) return '1';
    return `${Math.max(1 - Math.abs(offset) / 200, 0.2)}`;
  }

  onPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      this.hovered.set(true);
    }
  }

  onPointerLeave(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      this.hovered.set(false);
    }
  }

  togglePinned() {
    this.pinned.update((v) => !v);
  }

  onCardClick(item: StackNotificationItem) {
    if (!this.expanded() && this.laidOut().length > 1) {
      this.pinned.set(true);
      return;
    }
    this.selectNotification.emit(item);
  }

  dismissCard(event: MouseEvent, id: string) {
    event.stopPropagation();
    this.leaving.update((set) => new Set([...set, id]));
    setTimeout(() => {
      this.dismiss.emit(id);
      this.leaving.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }, 200);
  }

  handlePointerDown(event: PointerEvent, depth: number) {
    if (this.activeDrag || (!this.expanded() && depth > 0)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;

    this.activeDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dx: 0,
      axis: null,
      time: Date.now(),
    };
  }

  handlePointerMove(event: PointerEvent, id: string) {
    if (!this.activeDrag || this.activeDrag.pointerId !== event.pointerId) return;
    const dx = event.clientX - this.activeDrag.startX;
    const dy = event.clientY - this.activeDrag.startY;

    if (this.activeDrag.axis === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this.activeDrag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    }

    if (this.activeDrag.axis === 'x') {
      this.activeDrag.dx = dx;
      this.swipeOffsets.update((offsets) => ({ ...offsets, [id]: dx }));
    }
  }

  handlePointerUp(event: PointerEvent, id: string) {
    if (!this.activeDrag || this.activeDrag.pointerId !== event.pointerId) return;
    const drag = this.activeDrag;
    this.activeDrag = null;

    if (drag.axis === 'x') {
      const dt = Date.now() - drag.time;
      const velocity = Math.abs(drag.dx) / (dt || 1);
      const isFlick = velocity > 0.4 && Math.abs(drag.dx) > 30;

      if (Math.abs(drag.dx) > DISMISS_DISTANCE || isFlick) {
        // Fling out
        const direction = drag.dx > 0 ? 1 : -1;
        this.swipeOffsets.update((offsets) => ({ ...offsets, [id]: direction * 400 }));
        this.leaving.update((set) => new Set([...set, id]));
        setTimeout(() => {
          this.dismiss.emit(id);
          this.swipeOffsets.update((offsets) => {
            const next = { ...offsets };
            delete next[id];
            return next;
          });
          this.leaving.update((set) => {
            const next = new Set(set);
            next.delete(id);
            return next;
          });
        }, 200);
        return;
      }
    }

    // Snap back
    this.swipeOffsets.update((offsets) => ({ ...offsets, [id]: 0 }));
  }

  handlePointerCancel(id: string) {
    this.activeDrag = null;
    this.swipeOffsets.update((offsets) => ({ ...offsets, [id]: 0 }));
  }
}
