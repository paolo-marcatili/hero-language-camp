#!/usr/bin/env node
// Usage: node tools/verify-webp-lossless.mjs [pngRoot] [webpRoot]
// Decodes every <name>.png under pngRoot and the sibling <name>.webp under webpRoot
// (needs `dwebp` from libwebp) and fails unless every RGBA byte is identical.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

const pngRoot = path.resolve(process.argv[2] ?? "asset-packs/cc0-pixel-v10");
const webpRoot = path.resolve(process.argv[3] ?? "apps/web/public/assets/pixel");

function decodePng(file) { // 8-bit, non-interlaced RGB / RGBA only (all pack assets are)
  const bytes = readFileSync(file);
  let offset = 8, width = 0, height = 0, colorType = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9];
      if (data[8] !== 8 || data[12] !== 0 || (colorType !== 2 && colorType !== 6)) throw new Error(`${file}: unsupported PNG (need 8-bit RGB/RGBA, non-interlaced)`);
    }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const bpp = colorType === 6 ? 4 : 3, stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? line[x - bpp] : 0, up = previous[x], upLeft = x >= bpp ? previous[x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[x] = value & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const s = x * bpp, d = (y * width + x) * 4;
      rgba[d] = line[s]; rgba[d + 1] = line[s + 1]; rgba[d + 2] = line[s + 2]; rgba[d + 3] = bpp === 4 ? line[s + 3] : 255;
    }
    previous = line;
  }
  return { width, height, rgba };
}
function decodeWebp(file) { // dwebp -pam => header + raw RGBA
  const out = execFileSync("dwebp", ["-pam", "-o", "-", file], { maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "ignore"] });
  const end = out.indexOf("ENDHDR\n") + 7, header = out.toString("ascii", 0, end);
  return { width: Number(/WIDTH (\d+)/.exec(header)[1]), height: Number(/HEIGHT (\d+)/.exec(header)[1]), rgba: out.subarray(end) };
}
function* walk(directory, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "sources" || entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) yield* walk(path.join(directory, entry.name), path.join(prefix, entry.name));
    else if (entry.name.toLowerCase().endsWith(".png")) yield path.join(prefix, entry.name);
  }
}

let checked = 0;
const failures = [];
for (const relative of walk(pngRoot)) {
  const webp = path.join(webpRoot, relative.replace(/\.png$/i, ".webp"));
  if (!existsSync(webp)) continue; // PNGs that are not shipped (e.g. concept art) have no WebP
  const a = decodePng(path.join(pngRoot, relative)), b = decodeWebp(webp);
  checked += 1;
  if (a.width !== b.width || a.height !== b.height || !a.rgba.equals(b.rgba)) failures.push(relative);
}
if (failures.length || checked === 0) {
  console.error(`WebP verification FAILED (${checked} compared): ${failures.join(", ") || "nothing to compare"}`);
  process.exit(1);
}
console.log(`WebP verification passed: ${checked} files are pixel-identical to their PNG sources.`);
