export const MAX_IMAGE_SIDE = 4096;
export const MAX_IMAGE_PIXELS = 4096 * 4096;
export const MAX_IMAGE_FRAMES = 1;

export type ImageGeometry =
  | { ok: true; width: number; height: number; frames: number }
  | { ok: false; message: string };

const UNREADABLE = 'Could not read image dimensions.';

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function latin1(bytes: Uint8Array, start: number, end: number): string {
  return Buffer.from(bytes.subarray(start, end)).toString('latin1');
}

function inspectPng(bytes: Uint8Array): ImageGeometry {
  if (bytes.length < 33) return { ok: false, message: UNREADABLE };
  let offset = 8;
  let width = 0;
  let height = 0;
  let frames = 1;
  let sawIhdr = false;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    if (length > 16_000_000) break;
    const type = latin1(bytes, offset + 4, offset + 8);
    const data = offset + 8;
    if (data + Math.min(length, 13) > bytes.length) break;
    if (type === 'IHDR' && length >= 8) {
      width = u32be(bytes, data);
      height = u32be(bytes, data + 4);
      sawIhdr = true;
    } else if (type === 'acTL' && length >= 4) {
      frames = Math.max(1, u32be(bytes, data));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (!sawIhdr || !width || !height) return { ok: false, message: UNREADABLE };
  return { ok: true, width, height, frames };
}

function inspectJpeg(bytes: Uint8Array): ImageGeometry {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { ok: false, message: UNREADABLE };
  let index = 2;
  while (index + 8 < bytes.length) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    while (index < bytes.length && bytes[index] === 0xff) index += 1;
    if (index >= bytes.length) break;
    const marker = bytes[index];
    index += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8) continue;
    if (index + 1 >= bytes.length) break;
    const length = (bytes[index] << 8) | bytes[index + 1];
    if (length < 2) break;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof && index + 6 < bytes.length) {
      const height = (bytes[index + 3] << 8) | bytes[index + 4];
      const width = (bytes[index + 5] << 8) | bytes[index + 6];
      if (!width || !height) return { ok: false, message: UNREADABLE };
      return { ok: true, width, height, frames: 1 };
    }
    index += length;
  }
  return { ok: false, message: UNREADABLE };
}

function skipGifSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start;
  while (offset < bytes.length) {
    const size = bytes[offset];
    if (size === 0) return offset + 1;
    offset += 1 + size;
  }
  return offset;
}

function inspectGif(bytes: Uint8Array): ImageGeometry {
  if (bytes.length < 13) return { ok: false, message: UNREADABLE };
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  let offset = 13;
  if (packed & 0x80) offset += 3 * (2 ** ((packed & 7) + 1));
  let frames = 0;
  while (offset < bytes.length) {
    const block = bytes[offset];
    if (block === 0x3b) break;
    if (block === 0x21) {
      offset = skipGifSubBlocks(bytes, offset + 2);
      continue;
    }
    if (block === 0x2c) {
      if (offset + 10 > bytes.length) break;
      const localPacked = bytes[offset + 9];
      offset += 10;
      if (localPacked & 0x80) offset += 3 * (2 ** ((localPacked & 7) + 1));
      offset += 1;
      offset = skipGifSubBlocks(bytes, offset);
      frames += 1;
      continue;
    }
    break;
  }
  if (!width || !height || frames < 1) return { ok: false, message: UNREADABLE };
  return { ok: true, width, height, frames };
}

function inspectWebp(bytes: Uint8Array): ImageGeometry {
  if (bytes.length < 30 || latin1(bytes, 0, 4) !== 'RIFF' || latin1(bytes, 8, 12) !== 'WEBP') {
    return { ok: false, message: UNREADABLE };
  }
  const fourcc = latin1(bytes, 12, 16);
  if (fourcc === 'VP8X') {
    const animated = (bytes[20] & 0x02) !== 0;
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    if (!width || !height) return { ok: false, message: UNREADABLE };
    return { ok: true, width, height, frames: animated ? 2 : 1 };
  }
  if (fourcc === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    if (!width || !height) return { ok: false, message: UNREADABLE };
    return { ok: true, width, height, frames: 1 };
  }
  if (fourcc === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { ok: true, width, height, frames: 1 };
  }
  return { ok: false, message: UNREADABLE };
}

export function inspectImageGeometry(bytes: Uint8Array, mimeFamily: string): ImageGeometry {
  if (mimeFamily === 'image/png') return inspectPng(bytes);
  if (mimeFamily === 'image/jpeg') return inspectJpeg(bytes);
  if (mimeFamily === 'image/gif') return inspectGif(bytes);
  if (mimeFamily === 'image/webp') return inspectWebp(bytes);
  return { ok: false, message: UNREADABLE };
}

export function assertImageLimits(geometry: ImageGeometry): ImageGeometry {
  if (!geometry.ok) return geometry;
  if (geometry.frames > MAX_IMAGE_FRAMES) {
    return { ok: false, message: 'Animated images are not accepted.' };
  }
  if (geometry.width > MAX_IMAGE_SIDE || geometry.height > MAX_IMAGE_SIDE) {
    return { ok: false, message: 'Image dimensions are too large. Use an image at most 4096px on a side.' };
  }
  if (geometry.width * geometry.height > MAX_IMAGE_PIXELS) {
    return { ok: false, message: 'Image dimensions are too large. Use an image at most 4096px on a side.' };
  }
  return geometry;
}
