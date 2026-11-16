import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteMedia,
  extractBase64Buffer,
  firebaseMediaPath,
  uploadMedia,
} from '../src/storage.js';

test('extractBase64Buffer extracts buffer, mime, and extension correctly', () => {
  const dataUri = 'data:image/jpeg;base64,aGVsbG8=';
  const result = extractBase64Buffer(dataUri);
  assert.notEqual(result, null);
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.extension, 'jpg');
  assert.equal(result.buffer.toString('utf8'), 'hello');
});

test('extractBase64Buffer returns null for invalid formats', () => {
  assert.equal(extractBase64Buffer('not-a-data-uri'), null);
  assert.equal(extractBase64Buffer('data:text/plain;base64,YQ=='), null);
  assert.equal(extractBase64Buffer(null), null);
});

test('uploadMedia preserves existing URLs', async () => {
  const url = 'https://example.com/photo.jpg';
  const result = await uploadMedia(url);
  assert.equal(result, url);
});

test('uploadMedia transparently falls back to inline Base64 when cloud unconfigured', async () => {
  const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
  const result = await uploadMedia(dataUri);
  assert.equal(result, dataUri);
});

test('uploadMedia handles null and empty gracefully', async () => {
  assert.equal(await uploadMedia(null), null);
  assert.equal(await uploadMedia(''), '');
});

test('non-Firebase media URLs are never treated as owned files', async () => {
  assert.equal(firebaseMediaPath('https://example.com/photo.jpg'), null);
  assert.equal(await deleteMedia('https://example.com/photo.jpg'), false);
});

test('firebaseMediaPath extracts only paths from the configured bucket shape', () => {
  assert.equal(
    firebaseMediaPath(
      'https://firebasestorage.googleapis.com/v0/b/test-bucket/o/profiles%2Fphoto.jpg?alt=media&token=x',
      'test-bucket',
    ),
    'profiles/photo.jpg',
  );
  assert.equal(
    firebaseMediaPath(
      'https://firebasestorage.googleapis.com/v0/b/other/o/profiles%2Fphoto.jpg',
      'test-bucket',
    ),
    null,
  );
});
