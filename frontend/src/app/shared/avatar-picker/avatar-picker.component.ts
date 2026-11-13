import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  template: `
    <div class="avatar-picker-container">
      <div class="avatar-trigger" (click)="fileInput.click()">
        <app-avatar
          [src]="imageSrc || ''"
          [name]="name"
          [size]="'xl'"
          class="picker-avatar"
        ></app-avatar>

        <div class="avatar-overlay" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </div>

        <input
          #fileInput
          type="file"
          class="hidden-input"
          accept="image/jpeg,image/png,image/webp"
          (change)="onFileChanged($event)"
        />
      </div>

      <div class="avatar-actions">
        <button
          type="button"
          class="btn-text upload-link"
          (click)="fileInput.click()"
        >
          Change Photo
        </button>
        @if (imageSrc) {
          <button
            type="button"
            class="btn-text remove-link"
            (click)="clearPhoto()"
          >
            Remove
          </button>
        }
      </div>

      @if (error) {
        <p class="picker-error">{{ error }}</p>
      }
    </div>
  `,
  styles: [`
    .avatar-picker-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .hidden-input {
      display: none;
    }

    .avatar-trigger {
      position: relative;
      cursor: pointer;
      border-radius: 50%;
      overflow: hidden;
      box-shadow: var(--shadow-md);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .avatar-trigger:hover {
      transform: scale(1.05);
    }

    .avatar-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      backdrop-filter: blur(2px);
      transition: opacity 0.2s ease;
      border-radius: 50%;
    }

    .avatar-trigger:hover .avatar-overlay {
      opacity: 1;
    }

    .avatar-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .btn-text {
      background: transparent;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      transition: color 0.15s ease;
    }

    .upload-link {
      color: var(--color-primary-600);
    }

    .upload-link:hover {
      color: var(--color-primary-700);
      text-decoration: underline;
    }

    .remove-link {
      color: var(--color-danger-600);
    }

    .remove-link:hover {
      color: var(--color-danger-700);
      text-decoration: underline;
    }

    .picker-error {
      margin: 0;
      font-size: 12px;
      color: var(--color-danger-600);
      font-weight: 500;
    }
  `],
})
export class AvatarPickerComponent {
  @Input() imageSrc: string | null = null;
  @Input() name = '';
  @Output() imageChanged = new EventEmitter<string | null>();

  error = '';

  onFileChanged(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.error = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'Please choose a JPEG, PNG, or WebP photo.';
      input.value = '';
      return;
    }

    if (file.size > 1_500_000) {
      this.error = 'Photo must be under 1.5MB.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      this.imageSrc = result;
      this.imageChanged.emit(result);
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  clearPhoto() {
    this.imageSrc = null;
    this.error = '';
    this.imageChanged.emit(null);
  }
}
