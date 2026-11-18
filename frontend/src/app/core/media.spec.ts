import { describe, expect, it } from 'vitest';

import { imageFileError } from './media';

describe('camera image validation', () => {
  it('accepts supported phone photo formats and rejects unsafe or oversized files', () => {
    expect(imageFileError({ type: 'image/jpeg', size: 2_000_000 })).toBeNull();
    expect(imageFileError({ type: 'image/heic', size: 2_000_000 })).toMatch(/JPG/);
    expect(imageFileError({ type: 'image/png', size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  });
});
