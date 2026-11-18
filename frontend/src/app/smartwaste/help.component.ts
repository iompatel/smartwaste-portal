import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { SectionHeaderComponent, SurfaceComponent } from '../shared/ui-components';

@Component({
  selector: 'app-faq-view',
  standalone: true,
  imports: [CommonModule, IconComponent, SectionHeaderComponent, SurfaceComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-5 sm:gap-6">
      <app-section-header eyebrow="Help centre" title="Frequently asked questions" description="Quick answers about reports, live tracking, completion codes, and your account."></app-section-header>
      <div class="flex flex-col gap-3">
        @for (item of questions; track item.question) {
          <app-surface class="overflow-hidden">
            <details class="group">
              <summary class="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-medium text-foreground sm:px-5">
                <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <app-icon name="info" class="size-4"></app-icon>
                </span>
                <span class="flex-1">{{ item.question }}</span>
                <app-icon name="chevron-down" class="size-4 text-muted-foreground transition-transform group-open:rotate-180"></app-icon>
              </summary>
              <p class="border-t border-border/60 px-5 py-4 text-xs leading-6 text-muted-foreground sm:pl-16">{{ item.answer }}</p>
            </details>
          </app-surface>
        }
      </div>
    </div>
  `,
})
export class FaqViewComponent {
  readonly questions = [
    { question: 'How do I report a waste issue?', answer: 'Open My reports, choose Report waste, enter the collection address, add a clear photo, and submit. Selecting an address suggestion enables arrival-distance updates.' },
    { question: 'When can I track the worker?', answer: 'Live tracking appears in the report details after the assigned worker starts the route and shares GPS. The location refreshes every three seconds while the details are open.' },
    { question: 'When should I share the completion code?', answer: 'Share the six-digit code only after the collection is complete and you have checked the work. The worker needs the code and an after-photo to close the report.' },
    { question: 'How will I know the worker is nearby?', answer: 'For reports created with a suggested map location, SmartWaste sends a notification when the worker comes within about 500 metres of the collection point.' },
    { question: 'Can I contact the assigned worker?', answer: 'Yes. Open the report details to see the assigned worker’s ID, name, and mobile number. On a phone, tap Call worker to start a normal phone call.' },
    { question: 'How do I change a forgotten password?', answer: 'After repeated failed sign-in attempts, use the password reset option. If you are already signed in, Settings can send the same secure Firebase link.' },
    { question: 'Why is live tracking unavailable?', answer: 'The worker may not have started the route, may be offline, or may not have granted location permission. Tracking hides stale GPS fixes automatically.' },
  ];
}

@Component({
  selector: 'app-terms-view',
  standalone: true,
  imports: [IconComponent, SectionHeaderComponent, SurfaceComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-5 sm:gap-6">
      <app-section-header eyebrow="Legal" title="Terms and conditions" description="Effective 18 November 2026 · SmartWaste citizen portal"></app-section-header>
      <app-surface class="p-5 sm:p-7">
        <div class="flex items-start gap-3 rounded-[14px] bg-primary/10 p-4 text-xs leading-5 text-muted-foreground">
          <app-icon name="shield-check" class="mt-0.5 size-4 shrink-0 text-primary"></app-icon>
          <p>These terms cover use of this portal. Local municipal service rules and emergency procedures still apply.</p>
        </div>
        <div class="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
          @for (section of sections; track section.title; let index = $index) {
            <section>
              <h2 class="font-semibold text-foreground">{{ index + 1 }}. {{ section.title }}</h2>
              <p class="mt-2">{{ section.body }}</p>
            </section>
          }
        </div>
      </app-surface>
    </div>
  `,
})
export class TermsViewComponent {
  readonly sections = [
    { title: 'Account use', body: 'Provide accurate contact and collection information, keep your sign-in details secure, and use only your own account. You are responsible for activity performed through your account.' },
    { title: 'Waste reports', body: 'Submit genuine reports with an accurate address and lawful photo evidence. Do not upload private, abusive, misleading, or unrelated content. Reports may be reviewed, assigned, rescheduled, or cancelled by authorised staff.' },
    { title: 'Worker contact and live location', body: 'Worker contact details and live GPS are shown only for service coordination on an assigned report. Do not copy, publish, track, or use this information outside that purpose. Live locations are approximate and may be delayed or unavailable.' },
    { title: 'Completion verification', body: 'Keep the completion code private until the work has been completed. Giving the code to the worker confirms handover; the worker must also upload an after-photo before the report can close.' },
    { title: 'Photos and personal information', body: 'SmartWaste processes account details, report addresses, photos, messages, and service events to operate and audit collections. Avoid including people, vehicle plates, or private property in photos unless necessary for the report.' },
    { title: 'Service availability', body: 'The portal, address suggestions, maps, email links, and notifications rely on network and third-party services and may occasionally be delayed. For urgent hazards, use the municipality’s emergency contact instead of relying on the portal.' },
    { title: 'Acceptable use', body: 'Do not misuse the portal, probe other accounts, automate excessive requests, interfere with service, submit malicious files, or harass citizens, workers, or administrators.' },
    { title: 'Changes and support', body: 'These terms and portal features may change when service or legal requirements change. Continued use after an updated effective date means you accept the revised terms. Contact municipal support if you need help or want to question a service record.' },
  ];
}
