import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TearButtonComponent } from '../tear-button/tear-button.component';

export interface SloganCard {
  id: number;
  badge: string;
  hindiTitle: string;
  title: string;
  subtitle: string;
  directive: string;
  metric: string;
  metricLabel: string;
  icon: 'leaf' | 'shield' | 'check' | 'heart';
  gradient: string;
}

@Component({
  selector: 'app-card-stack',
  standalone: true,
  imports: [CommonModule, TearButtonComponent],
  template: `
    <div class="kokonut-card-stack-wrapper">
      <div class="stack-header-bar">
        <div class="stack-title-box">
          <span class="mission-pill">
            <span class="pulse-dot"></span>
            Swachh Bharat Abhiyan
          </span>
          <h3 class="stack-title">Clean India Inspirations</h3>
        </div>

        <div class="stack-controls">
          <span class="card-counter">{{ activeIndex + 1 }} / {{ cards.length }}</span>
          <div class="control-buttons">
            <button type="button" class="arrow-btn" (click)="prevCard()" aria-label="Previous Clean India card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button type="button" class="arrow-btn" (click)="nextCard()" aria-label="Next Clean India card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- CARD STACK DECK -->
      <div class="stack-deck" (click)="nextCard()" tabindex="0" role="region" aria-label="Interactive Clean India Card Stack, click to cycle">
        @for (card of cards; track card.id; let i = $index) {
          @if (getRelativePosition(i) < 4) {
            <div
              class="stack-card"
              [class.top-card]="getRelativePosition(i) === 0"
              [style.z-index]="10 - getRelativePosition(i)"
              [style.transform]="getCardTransform(i)"
              [style.opacity]="getCardOpacity(i)"
            >
              <div class="card-inner-glass">
                <div class="card-top-row">
                  <span class="card-badge-pill">
                    <span class="badge-mini-dot"></span>
                    {{ card.badge }}
                  </span>
                  <div class="card-mini-icon">
                    @if (card.icon === 'leaf') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path>
                        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>
                      </svg>
                    } @else if (card.icon === 'shield') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    } @else if (card.icon === 'check') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    } @else {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                      </svg>
                    }
                  </div>
                </div>

                <div class="slogan-block">
                  <div class="hindi-slogan">"{{ card.hindiTitle }}"</div>
                  <h4 class="english-title">"{{ card.title }}"</h4>
                  <p class="slogan-desc">{{ card.directive }}</p>
                </div>

                <div class="card-bottom-row">
                  <div class="stat-group">
                    <span class="stat-number">{{ card.metric }}</span>
                    <span class="stat-label">{{ card.metricLabel }}</span>
                  </div>

                  <span class="click-hint">
                    Tap to cycle
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          }
        }
      </div>

      <!-- PROGRESS DOTS & ACTION -->
      <div class="stack-dots-row">
        <div class="dots-group">
          @for (card of cards; track card.id; let i = $index) {
            <button
              type="button"
              class="dot-indicator"
              [class.active]="i === activeIndex"
              (click)="goToIndex(i)"
              [attr.aria-label]="'Go to card ' + (i + 1)"
            ></button>
          }
        </div>
        <app-tear-button variant="ghost" size="sm" (btnClick)="nextCard()">
          Next Slogan →
        </app-tear-button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .kokonut-card-stack-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 280px;
    }

    .stack-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
    }

    .mission-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: rgba(255, 149, 0, 0.12);
      border: 1px solid rgba(255, 149, 0, 0.3);
      color: #ff9500;
      margin-bottom: 4px;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ff9500;
      box-shadow: 0 0 0 2px rgba(255, 149, 0, 0.35);
      animation: pulse-dot 2s infinite;
    }

    .stack-title {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-primary);
      margin: 0;
    }

    .stack-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .card-counter {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-tertiary);
      letter-spacing: 0.04em;
    }

    .control-buttons {
      display: flex;
      gap: 4px;
    }

    .arrow-btn {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s var(--ease-spring);

      &:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
        transform: scale(1.08);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    /* DECK & CARDS */
    .stack-deck {
      position: relative;
      flex: 1;
      min-height: 210px;
      cursor: pointer;
      outline: none;
    }

    .stack-card {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border-radius: var(--radius-xl, 22px);
      transition:
        transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
        opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 0.45s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: center bottom;
      user-select: none;
    }

    .card-inner-glass {
      width: 100%;
      height: 100%;
      border-radius: var(--radius-xl, 22px);
      padding: var(--space-5, 20px);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      position: relative;
    }

    .stack-card.top-card .card-inner-glass {
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
      border-color: rgba(52, 199, 89, 0.3);
    }

    :host-context(body.theme-dark) .stack-card.top-card .card-inner-glass {
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      background: #1c1c1e;
    }

    .card-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: rgba(52, 199, 89, 0.12);
      color: var(--color-success-600);
      border: 1px solid rgba(52, 199, 89, 0.25);
    }

    .badge-mini-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-success-500);
    }

    .card-mini-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(52, 199, 89, 0.15);
      color: var(--apple-green, #34c759);
    }

    .slogan-block {
      padding: 6px 0;
    }

    .hindi-slogan {
      font-size: 15px;
      font-weight: 700;
      color: #ff9500;
      margin-bottom: 2px;
      letter-spacing: -0.01em;
    }

    .english-title {
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.015em;
      color: var(--text-primary);
      margin: 0 0 6px;
      line-height: 1.3;
    }

    .slogan-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.45;
      margin: 0;
    }

    .card-bottom-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
    }

    .stat-group {
      display: flex;
      flex-direction: column;
    }

    .stat-number {
      font-size: 17px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
    }

    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.03em;
    }

    .click-hint {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--apple-blue);
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: rgba(0, 113, 227, 0.08);
    }

    /* DOTS & FOOTER ACTION */
    .stack-dots-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 16px;
      padding: 0 4px;
    }

    .dots-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .dot-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: none;
      background: var(--border-strong, #c7c7cc);
      cursor: pointer;
      padding: 0;
      transition: all 0.25s var(--ease-spring);

      &.active {
        width: 22px;
        border-radius: var(--radius-pill);
        background: var(--apple-green, #34c759);
      }
    }
  `],
})
export class CardStackComponent {
  activeIndex = 0;

  readonly cards: SloganCard[] = [
    {
      id: 1,
      badge: 'Citizen Pledge',
      hindiTitle: 'एक कदम स्वच्छता की ओर',
      title: 'One Step Towards Cleanliness',
      subtitle: 'A giant leap for a healthy neighborhood',
      directive: 'Segregate at source: place wet kitchen waste in green bins and clean recyclables in blue bins.',
      metric: '4,850+ Tons',
      metricLabel: 'Diverted from Landfill',
      icon: 'leaf',
      gradient: 'green',
    },
    {
      id: 2,
      badge: 'Rapid Response',
      hindiTitle: 'स्वच्छ शहर, हरित शहर, मेरा सपना',
      title: 'Green City, Clean City, My Dream City',
      subtitle: 'Spot garbage? Snap a photo with live GPS',
      directive: 'City operations dispatches certified sanitation workers within 120 minutes with live GPS route telemetry.',
      metric: '98.4%',
      metricLabel: 'SLA On-Time Target',
      icon: 'shield',
      gradient: 'blue',
    },
    {
      id: 3,
      badge: 'Verified Handover',
      hindiTitle: 'स्वच्छ भारत, स्वस्थ भारत',
      title: 'Be the Solution, Not the Pollution',
      subtitle: 'Zero false completions with 6-digit OTP verification',
      directive: 'Workers only mark tasks complete when you provide the private code shown on your ticket screen.',
      metric: '100%',
      metricLabel: 'OTP Verified Handovers',
      icon: 'check',
      gradient: 'amber',
    },
    {
      id: 4,
      badge: 'Worker Dignity',
      hindiTitle: 'सफाई मित्रों का सम्मान, हमारा कर्तव्य',
      title: 'Empower Our Sanitation Squads',
      subtitle: 'Rate your assigned operative after collection',
      directive: 'Recognize outstanding municipal service with star ratings and feedback that directly rewards field workers.',
      metric: '4.9 ★',
      metricLabel: 'Operative Satisfaction',
      icon: 'heart',
      gradient: 'indigo',
    },
  ];

  getRelativePosition(index: number): number {
    return (index - this.activeIndex + this.cards.length) % this.cards.length;
  }

  getCardTransform(index: number): string {
    const rel = this.getRelativePosition(index);
    if (rel === 0) {
      return 'translateY(0px) scale(1) rotate(0deg)';
    } else if (rel === 1) {
      return 'translateY(12px) scale(0.96) rotate(1deg)';
    } else if (rel === 2) {
      return 'translateY(24px) scale(0.92) rotate(-1deg)';
    } else {
      return 'translateY(36px) scale(0.88) rotate(0deg)';
    }
  }

  getCardOpacity(index: number): number {
    const rel = this.getRelativePosition(index);
    if (rel === 0) return 1;
    if (rel === 1) return 0.85;
    if (rel === 2) return 0.6;
    return 0;
  }

  nextCard() {
    this.activeIndex = (this.activeIndex + 1) % this.cards.length;
  }

  prevCard() {
    this.activeIndex = (this.activeIndex - 1 + this.cards.length) % this.cards.length;
  }

  goToIndex(index: number) {
    if (index >= 0 && index < this.cards.length) {
      this.activeIndex = index;
    }
  }
}
