import { AfterViewInit, Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';

@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: { class: 'reveal' },
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  private static observer: IntersectionObserver | null = null;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  @Input() revealDelay = 0;

  ngAfterViewInit() {
    const delay = Math.min(Math.max(Number(this.revealDelay) || 0, 0), 160);
    this.element.style.setProperty('--reveal-delay', `${delay}ms`);

    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.element.classList.add('is-visible');
      return;
    }

    RevealDirective.observer ??= new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    RevealDirective.observer.observe(this.element);
  }

  ngOnDestroy() {
    RevealDirective.observer?.unobserve(this.element);
  }
}
