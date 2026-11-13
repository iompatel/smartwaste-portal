import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CardFlipData {
  badge: string;
  title: string;
  metric: string;
  metricLabel: string;
  description: string;
  icon: 'leaf' | 'recycle' | 'sparkles' | 'shield';
  slogan: string;
  sloganHindi?: string;
  sloganQuote: string;
  impactMetric: string;
  impactLabel: string;
  variant?: 'green' | 'blue' | 'amber' | 'indigo';
}

@Component({
  selector: 'app-card-flip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kokonut-card-flip-container" [class.is-flipped]="isFlipped">
      <div class="card-flip-inner" (click)="toggleFlip()" (keydown.enter)="toggleFlip()" tabindex="0" role="button" [attr.aria-label]="title + ', click to flip card for Clean India mission pledge'">
        <!-- FRONT FACE -->
        <article class="card-face card-front" [class]="'variant-' + (variant || 'green')">
          <div class="card-header-row">
            <span class="card-badge">
              <span class="badge-dot"></span>
              {{ badge }}
            </span>
            <button type="button" class="flip-trigger-btn" (click)="toggleFlip(); $event.stopPropagation()" aria-label="Flip card for Clean India slogan">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </button>
          </div>

          <div class="card-body">
            <div class="card-icon-bubble">
              @if (icon === 'leaf') {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
                  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
                </svg>
              } @else if (icon === 'recycle') {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="7 19 3 19 3 15"></polyline>
                  <path d="M4 14a8 8 0 0 1 14.65-4.42"></path>
                  <polyline points="17 5 21 5 21 9"></polyline>
                  <path d="M20 10a8 8 0 0 1-14.65 4.42"></path>
                </svg>
              } @else if (icon === 'sparkles') {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"></path>
                </svg>
              } @else {
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              }
            </div>

            <h3 class="card-title">{{ title }}</h3>
            <p class="card-desc">{{ description }}</p>
          </div>

          <div class="card-footer-row">
            <div class="metric-block">
              <span class="metric-num">{{ metric }}</span>
              <span class="metric-lbl">{{ metricLabel }}</span>
            </div>

            <div class="flip-hint-pill">
              <span>Clean India Slogan</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </article>

        <!-- BACK FACE (Clean India / Swachh Bharat Slogan) -->
        <article class="card-face card-back" [class]="'variant-' + (variant || 'green')">
          <div class="card-header-row">
            <span class="swachh-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
              Swachh Bharat Mission
            </span>
            <button type="button" class="flip-trigger-btn back-trigger" (click)="toggleFlip(); $event.stopPropagation()" aria-label="Flip back to front">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="slogan-content">
            @if (sloganHindi) {
              <div class="slogan-hindi">"{{ sloganHindi }}"</div>
            }
            <blockquote class="slogan-quote">"{{ slogan }}"</blockquote>
            <p class="slogan-subtext">{{ sloganQuote }}</p>
          </div>

          <div class="impact-chip">
            <div class="impact-glow"></div>
            <div class="impact-info">
              <strong>{{ impactMetric }}</strong>
              <small>{{ impactLabel }}</small>
            </div>
            <span class="action-check">✓ Active Pledge</span>
          </div>
        </article>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .kokonut-card-flip-container {
      perspective: 1400px;
      height: 100%;
      min-height: 250px;
    }

    .card-flip-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      outline: none;
      border-radius: var(--radius-xl, 22px);
    }

    .card-flip-inner:focus-visible {
      box-shadow: 0 0 0 4px var(--apple-blue-light, rgba(0, 113, 227, 0.3));
    }

    .kokonut-card-flip-container.is-flipped .card-flip-inner {
      transform: rotateY(180deg);
    }

    .card-face {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      border-radius: var(--radius-xl, 22px);
      padding: var(--space-5, 20px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      transition: box-shadow 0.25s var(--ease-spring), border-color 0.25s;
    }

    .card-flip-inner:hover .card-face {
      box-shadow: var(--shadow-md);
      border-color: var(--border-strong);
    }

    /* FRONT FACE */
    .card-front {
      z-index: 2;
      transform: rotateY(0deg);
    }

    /* BACK FACE */
    .card-back {
      transform: rotateY(180deg);
      background: var(--surface-elevated, var(--surface-strong));
      border-color: rgba(52, 199, 89, 0.35);
    }

    /* Header */
    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .card-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: rgba(0, 0, 0, 0.04);
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    :host-context(body.theme-dark) .card-badge {
      background: rgba(255, 255, 255, 0.06);
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-success-500, #34c759);
    }

    .flip-trigger-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      background: var(--surface-subtle);
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all 0.2s var(--ease-spring);

      &:hover {
        background: var(--surface-hover);
        color: var(--apple-blue);
        transform: rotate(90deg);
      }

      &.back-trigger:hover {
        transform: scale(1.1);
        color: var(--text-primary);
      }
    }

    /* Card Body */
    .card-icon-bubble {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md, 14px);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-3, 12px);
      background: rgba(52, 199, 89, 0.12);
      color: var(--apple-green, #34c759);
    }

    .variant-blue .card-icon-bubble {
      background: rgba(0, 113, 227, 0.12);
      color: var(--apple-blue, #0071e3);
    }

    .variant-amber .card-icon-bubble {
      background: rgba(255, 149, 0, 0.12);
      color: #ff9500;
    }

    .variant-indigo .card-icon-bubble {
      background: rgba(88, 86, 214, 0.12);
      color: #5856d6;
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-primary);
      margin: 0 0 6px;
      line-height: 1.25;
    }

    .card-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.4;
      margin: 0;
    }

    /* Footer */
    .card-footer-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      padding-top: var(--space-3, 12px);
      border-top: 1px solid var(--border);
    }

    .metric-block {
      display: flex;
      flex-direction: column;
    }

    .metric-num {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
      line-height: 1.1;
    }

    .metric-lbl {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .flip-hint-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--apple-blue);
      padding: 4px 8px;
      border-radius: var(--radius-pill);
      background: rgba(0, 113, 227, 0.08);
      transition: background 0.2s;
    }

    .card-flip-inner:hover .flip-hint-pill {
      background: rgba(0, 113, 227, 0.15);
    }

    /* BACK FACE STYLING */
    .swachh-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: rgba(52, 199, 89, 0.14);
      border: 1px solid rgba(52, 199, 89, 0.3);
      color: var(--color-success-600, #34c759);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .slogan-content {
      padding: var(--space-2, 8px) 0;
    }

    .slogan-hindi {
      font-size: 16px;
      font-weight: 700;
      color: #ff9500;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }

    .slogan-quote {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      font-style: italic;
      color: var(--text-primary);
      line-height: 1.35;
      letter-spacing: -0.01em;
    }

    .slogan-subtext {
      margin: 0;
      font-size: 12.5px;
      color: var(--text-secondary);
      line-height: 1.45;
    }

    .impact-chip {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--radius-lg, 16px);
      background: rgba(52, 199, 89, 0.1);
      border: 1px solid rgba(52, 199, 89, 0.25);
    }

    .impact-info {
      display: flex;
      flex-direction: column;

      strong {
        font-size: 14px;
        color: var(--text-primary);
        font-weight: 700;
      }

      small {
        font-size: 11px;
        color: var(--text-muted);
      }
    }

    .action-check {
      font-size: 11px;
      font-weight: 700;
      color: var(--color-success-600);
      background: rgba(52, 199, 89, 0.18);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }
  `],
})
export class CardFlipComponent {
  @Input() badge = 'Citizen Action';
  @Input() title = 'Zero Waste Mission';
  @Input() metric = '100%';
  @Input() metricLabel = 'Segregation';
  @Input() description = 'Segregate wet organic waste from dry recyclable plastics.';
  @Input() icon: 'leaf' | 'recycle' | 'sparkles' | 'shield' = 'leaf';
  @Input() slogan = 'Clean India, Green India';
  @Input() sloganHindi = 'एक कदम स्वच्छता की ओर';
  @Input() sloganQuote = 'Every small action in neighborhood waste segregation powers a greener nation.';
  @Input() impactMetric = '2.4 Tons';
  @Input() impactLabel = 'Diverted from Landfill';
  @Input() variant: 'green' | 'blue' | 'amber' | 'indigo' = 'green';

  @Output() cardFlipped = new EventEmitter<boolean>();

  isFlipped = false;

  toggleFlip() {
    this.isFlipped = !this.isFlipped;
    this.cardFlipped.emit(this.isFlipped);
  }
}
