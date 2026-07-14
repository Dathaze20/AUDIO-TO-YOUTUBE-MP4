import { describe, it, expect } from 'vitest';
import { formatTime, validateFile } from './utils';

describe('formatTime', () => {
  it('formats whole minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('pads single-digit seconds', () => {
    expect(formatTime(61)).toBe('1:01');
  });

  it('falls back to 0:00 for NaN or infinite input', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(Math.min(sizeBytes, 1024))], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('validateFile', () => {
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  it('accepts a matching, reasonably-sized file', () => {
    const file = makeFile('cover.png', 'image/png', 1024);
    expect(validateFile(file, IMAGE_TYPES, 'Image')).toBeNull();
  });

  it('rejects an unsupported mime type', () => {
    const file = makeFile('cover.gif', 'image/gif', 1024);
    const error = validateFile(file, IMAGE_TYPES, 'Image');
    expect(error).toContain('not a supported format');
  });

  it('rejects a file over the 500 MB limit', () => {
    const file = makeFile('huge.png', 'image/png', 501 * 1024 * 1024);
    const error = validateFile(file, IMAGE_TYPES, 'Image');
    expect(error).toContain('too large');
  });

  it('accepts any type when no accepted types are given', () => {
    const file = makeFile('anything.xyz', 'application/octet-stream', 1024);
    expect(validateFile(file, [], 'File')).toBeNull();
  });
});
