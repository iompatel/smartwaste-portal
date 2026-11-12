import { Injectable } from '@angular/core';
import { animate, stagger } from 'animejs';

@Injectable({ providedIn: 'root' })
export class AnimationService {
  // Page transitions
  enterPage(selector: string, options: { delay?: number; duration?: number } = {}) {
    const { delay = 0, duration = 400 } = options;
    return animate(selector, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration,
      delay,
      easing: 'easeOut',
    });
  }

  leavePage(selector: string, options: { delay?: number; duration?: number } = {}) {
    const { delay = 0, duration = 300 } = options;
    return animate(selector, {
      opacity: [1, 0],
      translateY: [0, -20],
      duration,
      delay,
      easing: 'easeIn',
    });
  }

  // Staggered entrance for lists/grids
  staggerIn(selector: string, options: { stagger?: number; startDelay?: number; duration?: number } = {}) {
    const { stagger: staggerVal = 80, startDelay = 0, duration = 400 } = options;
    return animate(selector, {
      opacity: [0, 1],
      translateY: [20, 0],
      duration,
      delay: stagger(staggerVal, { start: startDelay }),
      easing: 'easeOut',
    });
  }

  // Button press animation
  press(element: HTMLElement) {
    return animate(element, {
      scale: [1, 0.96],
      duration: 100,
      easing: 'easeOut',
    }).then(() => animate(element, { scale: 1, duration: 100 }));
  }

  // Ripple effect for buttons
  ripple(element: HTMLElement, event: MouseEvent) {
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: currentColor;
      opacity: 0.3;
      border-radius: 50%;
      transform: scale(0);
      pointer-events: none;
    `;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

    animate(ripple, {
      scale: [0, 1],
      opacity: [0.3, 0],
      duration: 400,
      easing: 'easeOut',
    }).then(() => ripple.remove());
  }

  // Drawer/sidebar animations
  openDrawer(drawer: HTMLElement, backdrop: HTMLElement) {
    animate(backdrop, { opacity: [0, 1], duration: 200 });
    animate(drawer, {
      translateX: ['100%', 0],
      duration: 350,
      easing: 'easeOut',
    });
  }

  closeDrawer(drawer: HTMLElement, backdrop: HTMLElement) {
    animate(backdrop, { opacity: [1, 0], duration: 200 });
    animate(drawer, {
      translateX: [0, '100%'],
      duration: 300,
      easing: 'easeIn',
    });
  }

  // Hamburger to X animation
  toggleHamburger(button: HTMLElement, isOpen: boolean) {
    const lines = button.querySelectorAll('line, path');
    if (isOpen) {
      animate(lines[0], { translateY: 6, rotate: 45, duration: 200, easing: 'easeOut' });
      animate(lines[1], { opacity: 0, duration: 150 });
      animate(lines[2], { translateY: -6, rotate: -45, duration: 200, easing: 'easeOut' });
    } else {
      animate(lines[0], { translateY: 0, rotate: 0, duration: 200, easing: 'easeOut' });
      animate(lines[1], { opacity: 1, duration: 150 });
      animate(lines[2], { translateY: 0, rotate: 0, duration: 200, easing: 'easeOut' });
    }
  }

  // Card hover lift
  cardHover(card: HTMLElement, isHover: boolean) {
    if (isHover) {
      animate(card, { translateY: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.12)', duration: 200 });
    } else {
      animate(card, { translateY: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', duration: 200 });
    }
  }

  // Input focus animation
  inputFocus(input: HTMLElement, isFocus: boolean) {
    const wrapper = input.closest('.form-field') || input.parentElement;
    if (wrapper) {
      animate(wrapper, { 
        borderColor: isFocus ? '#059669' : 'var(--border)', 
        boxShadow: isFocus ? '0 0 0 3px rgba(5, 150, 105, 0.2)' : 'none',
        duration: 200 
      });
    }
  }

  // Toast animation
  showToast(toast: HTMLElement) {
    animate(toast, {
      translateX: [400, 0],
      opacity: [0, 1],
      duration: 400,
      easing: 'easeOut',
    });
  }

  hideToast(toast: HTMLElement) {
    animate(toast, {
      translateX: [0, 400],
      opacity: [1, 0],
      duration: 300,
      easing: 'easeIn',
    }).then(() => toast.remove());
  }

  // Modal animation
  openModal(modal: HTMLElement, backdrop: HTMLElement) {
    animate(backdrop, { opacity: [0, 1], duration: 200 });
    animate(modal, {
      scale: [0.9, 1],
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOut',
    });
  }

  closeModal(modal: HTMLElement, backdrop: HTMLElement) {
    animate(backdrop, { opacity: [1, 0], duration: 200 });
    animate(modal, {
      scale: [1, 0.9],
      opacity: [1, 0],
      duration: 200,
      easing: 'easeIn',
    });
  }
}