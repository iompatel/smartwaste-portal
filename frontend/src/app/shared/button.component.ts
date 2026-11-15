import { Component, computed, Directive, input } from '@angular/core';
import { cn } from './utils';

export type ButtonVariant = 'default' | 'brand' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

const baseButtonClasses =
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80',
  brand: 'bg-brand text-brand-foreground hover:bg-brand/85',
  outline:
    'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
  ghost:
    'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
  destructive:
    'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-8 gap-1.5 px-2.5',
  xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
  sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
  lg: 'h-9 gap-1.5 px-2.5',
  icon: 'size-8',
  'icon-xs': "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
  'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)]',
  'icon-lg': 'size-9',
};

export function buttonVariants(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  const variant = options?.variant ?? 'default';
  const size = options?.size ?? 'default';
  return cn(baseButtonClasses, variantClasses[variant], sizeClasses[size], options?.className);
}

@Directive({
  selector: 'button[appButton], a[appButton]',
  standalone: true,
  host: {
    '[class]': 'classes()',
    'data-slot': '"button"'
  }
})
export class ButtonDirective {
  variant = input<ButtonVariant>('default');
  size = input<ButtonSize>('default');
  class = input<string>('');

  classes = computed(() => {
    return buttonVariants({
      variant: this.variant(),
      size: this.size(),
      className: this.class()
    });
  });
}

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() || null"
      [class]="classes()"
      data-slot="button"
    >
      <ng-content></ng-content>
    </button>
  `
})
export class ButtonComponent {
  variant = input<ButtonVariant>('default');
  size = input<ButtonSize>('default');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input<boolean>(false);
  class = input<string>('');
  ariaLabel = input<string>('');

  classes = computed(() => {
    return buttonVariants({
      variant: this.variant(),
      size: this.size(),
      className: this.class()
    });
  });
}
