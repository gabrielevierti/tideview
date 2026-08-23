import { IMAGE_ENCODING } from "../config";

/**
 * One byte per pixel, each holding a 0..15 level. This is what v0.2 sent and
 * what the SDK appears to accept when it does its own conversion pass.
 */
export function toByteArray(gray4: Uint8Array): number[] {
  const out = new Array<number>(gray4.length);
  for (let i = 0; i < gray4.length; i++) out[i] = (gray4[i] as number) & 0x0f;
  return out;
}

/**
 * True 4bpp packing: two pixels per byte, first pixel in the high nibble.
 * Rows are padded to a whole byte, which matters only for odd widths.
 */
export function packGray4(gray4: Uint8Array, width: number): number[] {
  const height = gray4.length / width;
  const bytesPerRow = Math.ceil(width / 2);
  const out = new Array<number>(bytesPerRow * height).fill(0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = (gray4[y * width + x] as number) & 0x0f;
      const index = y * bytesPerRow + (x >> 1);
      out[index] = (out[index] as number) | (x % 2 === 0 ? value << 4 : value);
    }
  }
  return out;
}

/** Encode a rendered frame using the format selected in `config.ts`. */
export function encodeFrame(gray4: Uint8Array, width: number): number[] {
  return IMAGE_ENCODING === "packed" ? packGray4(gray4, width) : toByteArray(gray4);
}
