import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];

@Component({
  selector: 'app-helpful-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="helpful-rating" [class.readonly]="readonly">
      <div class="stars-row" role="radiogroup" aria-label="Rating">
        @for (star of [1, 2, 3, 4, 5]; track star) {
          <button
            type="button"
            class="star-btn"
            [class.active]="star <= currentDisplayRating"
            [class.hovered]="hoverRating >= star"
            [disabled]="readonly"
            (mouseenter)="onHover(star)"
            (mouseleave)="onLeave()"
            (click)="selectRating(star)"
            [attr.aria-label]="'Rate ' + star + ' out of 5'"
          >
            <svg
              viewBox="0 0 24 24"
              class="star-icon"
              [class.bounce]="star === rating"
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              />
            </svg>
          </button>
        }
      </div>

      @if (showLabel && currentDisplayRating > 0) {
        <span class="rating-label">{{ ratingText }}</span>
      }
    </div>
  `,
  styles: [`
    .helpful-rating {
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }

    .stars-row {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .star-btn {
      background: transparent;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--color-slate-300);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.15s ease;
    }

    .star-btn:hover:not(:disabled) {
      transform: scale(1.22);
    }

    .star-btn:active:not(:disabled) {
      transform: scale(0.95);
    }

    .star-icon {
      width: 24px;
      height: 24px;
      fill: currentColor;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linejoin: round;
    }

    .star-btn.active,
    .star-btn.hovered {
      color: var(--color-accent-500);
    }

    .star-icon.bounce {
      animation: star-bounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes star-bounce {
      0% { transform: scale(1); }
      50% { transform: scale(1.35) rotate(8deg); }
      100% { transform: scale(1) rotate(0deg); }
    }

    .readonly .star-btn {
      cursor: default;
      pointer-events: none;
    }

    .rating-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      letter-spacing: -0.01em;
      min-width: 70px;
    }
  `],
})
export class HelpfulRatingComponent {
  @Input() rating = 0;
  @Input() readonly = false;
  @Input() showLabel = true;
  @Output() ratingChange = new EventEmitter<number>();

  hoverRating = 0;

  get currentDisplayRating(): number {
    return this.hoverRating > 0 ? this.hoverRating : this.rating;
  }

  get ratingText(): string {
    const val = Math.round(this.currentDisplayRating);
    return RATING_LABELS[val] || '';
  }

  onHover(star: number) {
    if (!this.readonly) {
      this.hoverRating = star;
    }
  }

  onLeave() {
    this.hoverRating = 0;
  }

  selectRating(star: number) {
    if (this.readonly) return;
    this.rating = star;
    this.ratingChange.emit(star);
  }
}
