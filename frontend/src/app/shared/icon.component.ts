import { Component, computed, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from './icons.data';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.class]="svgClass()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [innerHTML]="svgContent()"
    ></svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      flex-shrink: 0;
    }
  `]
})
export class IconComponent {
  name = input.required<string>();
  class = input<string>('size-4');
  strokeWidth = input<number | string>(2);

  constructor(private sanitizer: DomSanitizer) {}

  svgClass = computed(() => {
    return this.class();
  });

  svgContent = computed<SafeHtml>(() => {
    const rawName = this.name();
    const node = ICONS[rawName] || ICONS[rawName.toLowerCase()];
    if (!node) return '';
    const inner = node
      .map(([tag, attrs]) => {
        const attrStr = Object.entries(attrs)
          .filter(([k]) => k !== 'key')
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ');
        return `<${tag} ${attrStr}></${tag}>`;
      })
      .join('');
    return this.sanitizer.bypassSecurityTrustHtml(inner);
  });
}
