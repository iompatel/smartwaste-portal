import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="file-upload-wrapper">
      @if (previewUrl) {
        <div class="preview-box">
          <img [src]="previewUrl" alt="Upload preview" class="preview-img" />
          <div class="preview-overlay">
            <button
              type="button"
              class="btn-remove"
              (click)="removeFile()"
              aria-label="Remove image"
              title="Remove image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="18" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      } @else {
        <div
          class="drop-zone"
          [class.drag-over]="isDragOver"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <input
            #fileInput
            type="file"
            class="hidden-input"
            [accept]="accept"
            (change)="onFileSelected($event)"
          />

          <div class="drop-content">
            <div class="drop-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div class="drop-text">
              <strong>{{ label }}</strong>
              <small>{{ hint || 'JPEG, PNG, or WebP up to 1.5MB' }}</small>
            </div>
          </div>
        </div>
      }

      @if (error) {
        <p class="error-msg" role="alert">{{ error }}</p>
      }
    </div>
  `,
  styles: [`
    .file-upload-wrapper {
      width: 100%;
    }

    .hidden-input {
      display: none;
    }

    .drop-zone {
      position: relative;
      border: 2px dashed var(--border-strong);
      border-radius: var(--radius-lg);
      padding: 24px 16px;
      text-align: center;
      background: var(--surface);
      cursor: pointer;
      transition:
        border-color 0.2s ease,
        background-color 0.2s ease,
        transform 0.15s ease;
    }

    .drop-zone:hover,
    .drop-zone.drag-over {
      border-color: var(--color-primary-500);
      background: var(--color-primary-50);
      transform: translateY(-1px);
    }

    .drop-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .drop-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--bg-elevated);
      color: var(--color-primary-600);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }

    .drop-zone:hover .drop-icon {
      transform: translateY(-2px);
      background: #FFFFFF;
      box-shadow: var(--shadow-sm);
    }

    .drop-text strong {
      display: block;
      font-size: 14px;
      color: var(--text-primary);
      font-weight: 600;
    }

    .drop-text small {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .preview-box {
      position: relative;
      width: 100%;
      max-height: 240px;
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      background: #000;
    }

    .preview-img {
      width: 100%;
      height: 100%;
      max-height: 240px;
      object-fit: cover;
      display: block;
    }

    .preview-overlay {
      position: absolute;
      top: 10px;
      right: 10px;
    }

    .btn-remove {
      background: rgba(15, 23, 42, 0.75);
      color: #FFFFFF;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      backdrop-filter: blur(4px);
      transition: background 0.15s ease, transform 0.15s ease;
    }

    .btn-remove:hover {
      background: var(--color-danger-600);
      transform: scale(1.1);
    }

    .error-msg {
      margin: 6px 0 0;
      font-size: 12px;
      color: var(--color-danger-600);
      font-weight: 500;
    }
  `],
})
export class FileUploadComponent {
  @Input() label = 'Click to upload or drag & drop';
  @Input() hint = 'JPEG, PNG, or WebP under 1.5MB';
  @Input() accept = 'image/jpeg,image/png,image/webp';
  @Input() maxSizeBytes = 1_500_000;
  @Input() previewUrl: string | null = null;

  @Output() fileSelected = new EventEmitter<string | null>();

  isDragOver = false;
  error = '';

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.processFile(file);
    }
    input.value = '';
  }

  removeFile() {
    this.previewUrl = null;
    this.error = '';
    this.fileSelected.emit(null);
  }

  private processFile(file: File) {
    this.error = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'Invalid format. Choose a JPEG, PNG, or WebP image.';
      return;
    }

    if (file.size > this.maxSizeBytes) {
      this.error = `File is too large. Maximum size is ${(this.maxSizeBytes / 1_000_000).toFixed(1)}MB.`;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      this.previewUrl = result;
      this.fileSelected.emit(result);
    };
    reader.onerror = () => {
      this.error = 'Unable to read file.';
    };
    reader.readAsDataURL(file);
  }
}
