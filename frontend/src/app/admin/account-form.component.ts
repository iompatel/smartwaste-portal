import { ChangeDetectionStrategy, Component, ElementRef, OnChanges, SimpleChanges, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AccountPayload, BackendUser } from '../core/api.types';
import { ButtonDirective } from '../shared/button.component';
import { inputClassName } from '../shared/ui-components';

type Field = 'id' | 'name' | 'email' | 'mobile' | 'address' | 'gender' | 'password' | 'confirmPassword';
type FieldError = { field: Field; message: string };

@Component({
  selector: 'app-account-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="flex flex-col gap-4">
      @if (errors().length || serverError()) {
        <div id="account-form-errors" tabindex="-1" role="alert" aria-labelledby="account-error-heading" class="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger-ink outline-none focus:ring-2 focus:ring-danger">
          <h3 id="account-error-heading" class="font-semibold">Please check the account details</h3>
          @if (serverError()) { <p class="mt-2">{{ serverError() }}</p> }
          @if (errors().length) {
            <ul class="mt-2 list-disc space-y-1 pl-5">
              @for (error of errors(); track error.field) { <li><a [href]="'#account-' + error.field" class="underline" (click)="focusField($event, error.field)">{{ error.message }}</a></li> }
            </ul>
          }
        </div>
      }
      @if (account() || section() === 'worker') {
        <div>
          <label for="account-id" class="mb-1.5 block text-sm font-medium">{{ section() === 'worker' ? 'Worker' : 'User' }} ID {{ account() ? '' : '(optional)' }}</label>
          <input id="account-id" type="text" inputmode="numeric" formControlName="id" [class]="inputCls" [attr.aria-invalid]="!!errorFor('id')" aria-describedby="account-id-hint account-id-error" placeholder="Generated automatically if left blank" />
          <p id="account-id-hint" class="mt-1 text-xs text-muted-foreground">{{ account() ? 'The account ID cannot be changed.' : 'Use a unique positive number, or leave blank for an automatic ID.' }}</p>
          @if (errorFor('id')) { <p id="account-id-error" class="mt-1 text-xs text-danger-ink">{{ errorFor('id') }}</p> }
        </div>
      }
      <div class="grid gap-4 sm:grid-cols-2">
        @for (field of fields; track field.key) {
          <div [class.sm:col-span-2]="field.key === 'name'">
            <label [for]="'account-' + field.key" class="mb-1.5 block text-sm font-medium">{{ field.label }} *</label>
            <input [id]="'account-' + field.key" [type]="field.type" [formControlName]="field.key" [attr.autocomplete]="field.autocomplete" [attr.inputmode]="field.key === 'mobile' ? 'tel' : null" [attr.maxlength]="field.maxLength" [placeholder]="field.placeholder" [class]="inputCls" [attr.aria-invalid]="!!errorFor(field.key)" [attr.aria-describedby]="'account-' + field.key + '-error'" />
            @if (errorFor(field.key)) { <p [id]="'account-' + field.key + '-error'" class="mt-1 text-xs text-danger-ink">{{ errorFor(field.key) }}</p> }
          </div>
        }
        <div>
          <label for="account-gender" class="mb-1.5 block text-sm font-medium">Gender *</label>
          <select id="account-gender" formControlName="gender" [class]="inputCls"><option>Female</option><option>Male</option><option>Other</option></select>
        </div>
      </div>
      <div>
        <label for="account-address" class="mb-1.5 block text-sm font-medium">Address *</label>
        <textarea id="account-address" formControlName="address" rows="3" maxlength="500" [class]="inputCls + ' h-auto py-3'" autocomplete="street-address" [attr.aria-invalid]="!!errorFor('address')" aria-describedby="account-address-error" placeholder="Street, area, city, and postcode"></textarea>
        @if (errorFor('address')) { <p id="account-address-error" class="mt-1 text-xs text-danger-ink">{{ errorFor('address') }}</p> }
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="account-password" class="mb-1.5 block text-sm font-medium">{{ account() ? 'New password (optional)' : 'Password *' }}</label>
          <input id="account-password" type="password" formControlName="password" autocomplete="new-password" [class]="inputCls" [attr.aria-invalid]="!!errorFor('password')" aria-describedby="account-password-hint account-password-error" />
          <p id="account-password-hint" class="mt-1 text-xs text-muted-foreground">At least 8 characters, one uppercase letter, and one special symbol.{{ account() ? ' Leave blank to keep the current password.' : '' }}</p>
          @if (errorFor('password')) { <p id="account-password-error" class="mt-1 text-xs text-danger-ink">{{ errorFor('password') }}</p> }
        </div>
        <div>
          <label for="account-confirmPassword" class="mb-1.5 block text-sm font-medium">{{ account() ? 'Confirm new password' : 'Confirm password *' }}</label>
          <input id="account-confirmPassword" type="password" formControlName="confirmPassword" autocomplete="new-password" [class]="inputCls" [attr.aria-invalid]="!!errorFor('confirmPassword')" aria-describedby="account-confirmPassword-error" />
          @if (errorFor('confirmPassword')) { <p id="account-confirmPassword-error" class="mt-1 text-xs text-danger-ink">{{ errorFor('confirmPassword') }}</p> }
        </div>
      </div>
      <div class="mt-2 flex justify-end gap-2 border-t border-border/60 pt-4">
        <button type="button" appButton variant="outline" class="h-10 rounded-full" [disabled]="submitting()" (click)="cancel.emit()">Cancel</button>
        <button type="submit" appButton variant="brand" class="h-10 rounded-full" [disabled]="submitting()">{{ submitting() ? 'Saving…' : account() ? 'Save changes' : 'Create account' }}</button>
      </div>
    </form>
  `,
})
export class AccountFormComponent implements OnChanges {
  section = input<'user' | 'worker'>('user');
  account = input<BackendUser | null>(null);
  submitting = input(false);
  serverError = input('');
  save = output<AccountPayload>();
  cancel = output<void>();
  errors = signal<FieldError[]>([]);
  inputCls = inputClassName;
  fields: Array<{ key: Field; label: string; type: string; autocomplete: string; maxLength: number; placeholder: string }> = [
    { key: 'name', label: 'Full name', type: 'text', autocomplete: 'name', maxLength: 201, placeholder: 'Full name' },
    { key: 'email', label: 'Email', type: 'email', autocomplete: 'email', maxLength: 254, placeholder: 'name@example.com' },
    { key: 'mobile', label: 'Phone number', type: 'tel', autocomplete: 'tel', maxLength: 15, placeholder: '10–15 digits' },
  ];
  form = new FormBuilder().nonNullable.group({ id: '', name: '', email: '', mobile: '', address: '', gender: 'Other', password: '', confirmPassword: '' });

  constructor(private element: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['account'] || changes['section']) {
      const account = this.account();
      this.form.enable();
      this.form.reset({ id: account ? String(account.id) : '', name: account ? `${account.firstName} ${account.lastName}`.trim() : '', email: account?.email || '', mobile: account?.mobile || '', address: account?.address || '', gender: account?.gender || 'Other', password: '', confirmPassword: '' });
      if (account) this.form.controls.id.disable();
      this.errors.set([]);
    }
    if (changes['serverError'] && this.serverError()) this.focusErrors();
  }

  errorFor(field: Field) { return this.errors().find(error => error.field === field)?.message || ''; }
  focusField(event: Event, field: Field) { event.preventDefault(); this.element.nativeElement.querySelector<HTMLElement>(`#account-${field}`)?.focus(); }
  private focusErrors() { setTimeout(() => this.element.nativeElement.querySelector<HTMLElement>('#account-form-errors')?.focus(), 0); }

  submit() {
    if (this.submitting()) return;
    const values = this.form.getRawValue();
    const errors: FieldError[] = [];
    const add = (field: Field, message: string) => errors.push({ field, message });
    const parts = values.name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || (this.section() === 'worker' ? 'Worker' : 'User');
    if (!firstName || firstName.length > 100 || lastName.length > 100) add('name', 'Enter a name with first and last names of no more than 100 characters each.');
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim()) || values.email.trim().length > 254) add('email', 'Enter a valid email address.');
    if (!/^\d{10,15}$/.test(values.mobile.trim())) add('mobile', 'Enter a phone number containing 10–15 digits.');
    if (!values.address.trim() || values.address.trim().length > 500) add('address', 'Enter an address of no more than 500 characters.');
    if (!this.account() && values.id.trim() && (!/^\d+$/.test(values.id.trim()) || !Number.isSafeInteger(Number(values.id)) || Number(values.id) <= 0)) add('id', 'Enter a positive whole number for the worker ID.');
    if ((!this.account() || values.password) && !/^(?=.*[A-Z])(?=.*[^A-Za-z0-9\s]).{8,}$/.test(values.password)) add('password', 'Use at least 8 characters, one uppercase letter, and one special symbol.');
    if (values.password !== values.confirmPassword || (!this.account() && !values.confirmPassword)) add('confirmPassword', 'Enter the same password in both password fields.');
    this.errors.set(errors);
    if (errors.length) { this.focusErrors(); return; }
    const payload: AccountPayload = { firstName, lastName, email: values.email.trim().toLowerCase(), mobile: values.mobile.trim(), address: values.address.trim(), gender: values.gender, role: this.section() };
    if (!this.account() && this.section() === 'worker' && values.id.trim()) payload.id = Number(values.id);
    if (values.password) { payload.password = values.password; payload.confirmPassword = values.confirmPassword; }
    this.save.emit(payload);
  }
}
