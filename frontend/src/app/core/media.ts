export const MAX_UPLOAD_DATA_LENGTH = 1_900_000;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const PASSTHROUGH_BYTES = 1_400_000;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function imageFileError(file: Pick<File, 'size' | 'type'>): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) return 'Choose a JPG, PNG, or WebP image.';
  if (!file.size) return 'The selected image is empty.';
  if (file.size > MAX_SOURCE_BYTES) return 'Choose an image smaller than 15 MB.';
  return null;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected image could not be opened.'));
    image.src = source;
  });
}

export async function prepareImageFile(file: File): Promise<string> {
  const validationError = imageFileError(file);
  if (validationError) throw new Error(validationError);

  const source = await readAsDataUrl(file);
  if (file.size <= PASSTHROUGH_BYTES && source.length <= MAX_UPLOAD_DATA_LENGTH) return source;

  const image = await loadImage(source);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  let scale = Math.min(1, 1_600 / longestSide, Math.sqrt(PASSTHROUGH_BYTES / file.size));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.72, 0.6]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= MAX_UPLOAD_DATA_LENGTH) return result;
    }
    scale *= 0.75;
  }

  throw new Error('The photo is still too large. Try taking it at a lower resolution.');
}
