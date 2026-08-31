// Gera os ícones do PWA (PNG) localmente, sem dependências externas.
// Uso: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk('IDAT', idatData);
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function makeCanvas(size) {
  const rgba = Buffer.alloc(size * size * 4);
  return {
    size,
    data: rgba,
    set(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      // alpha-blend onto existing pixel
      const srcA = a / 255;
      const dstA = rgba[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) {
        rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 0;
        return;
      }
      rgba[i] = Math.round((r * srcA + rgba[i] * dstA * (1 - srcA)) / outA);
      rgba[i + 1] = Math.round((g * srcA + rgba[i + 1] * dstA * (1 - srcA)) / outA);
      rgba[i + 2] = Math.round((b * srcA + rgba[i + 2] * dstA * (1 - srcA)) / outA);
      rgba[i + 3] = Math.round(outA * 255);
    }
  };
}

function fillRoundedRect(cv, x0, y0, x1, y1, radius, color) {
  const [r, g, b, a] = color;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
      const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius || (x >= x0 + radius && x <= x1 - radius) || (y >= y0 + radius && y <= y1 - radius)) {
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) cv.set(x, y, r, g, b, a);
      }
    }
  }
}

function fillEllipse(cv, cx, cy, rx, ry, color) {
  const [r, g, b, a] = color;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) cv.set(x, y, r, g, b, a);
    }
  }
}

function strokeEllipse(cv, cx, cy, rx, ry, thickness, color) {
  const [r, g, b, a] = color;
  for (let y = Math.floor(cy - ry - thickness); y <= Math.ceil(cy + ry + thickness); y++) {
    for (let x = Math.floor(cx - rx - thickness); x <= Math.ceil(cx + rx + thickness); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      const inner = ((x - cx) / (rx - thickness)) ** 2 + ((y - cy) / (ry - thickness)) ** 2;
      if (d <= 1 && inner >= 1) cv.set(x, y, r, g, b, a);
    }
  }
}

function drawIcon(size, { maskable }) {
  const cv = makeCanvas(size);
  const bg1 = [15, 118, 110]; // teal-700
  const bg2 = [16, 150, 129]; // teal-500
  // gradient background
  for (let y = 0; y < size; y++) {
    const t = y / size;
    const r = Math.round(bg1[0] + (bg2[0] - bg1[0]) * t);
    const g = Math.round(bg1[1] + (bg2[1] - bg1[1]) * t);
    const b = Math.round(bg1[2] + (bg2[2] - bg1[2]) * t);
    for (let x = 0; x < size; x++) cv.set(x, y, r, g, b, 255);
  }
  if (!maskable) {
    // round the outer corners by clearing alpha outside a rounded rect mask
    const radius = size * 0.22;
    const mask = makeCanvas(size);
    fillRoundedRect(mask, 0, 0, size - 1, size - 1, radius, [0, 0, 0, 255]);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (mask.data[i + 3] === 0) {
          cv.data[i] = 0; cv.data[i + 1] = 0; cv.data[i + 2] = 0; cv.data[i + 3] = 0;
        }
      }
    }
  }
  // coins stack (gold), kept within the safe zone (center ~60%)
  const cx = size / 2, cy = size / 2;
  const gold = [245, 197, 66, 255];
  const goldDark = [201, 155, 34, 255];
  const coinRx = size * 0.20, coinRy = size * 0.13;
  const offsets = [0.13, 0, -0.13];
  offsets.forEach((off, idx) => {
    const ccy = cy + size * off * 1.05;
    fillEllipse(cv, cx, ccy, coinRx, coinRy, idx === 1 ? gold : goldDark);
    strokeEllipse(cv, cx, ccy, coinRx * 0.72, coinRy * 0.62, size * 0.012, [255, 255, 255, 160]);
  });
  return cv;
}

function writeIcon(fileName, size, opts) {
  const cv = drawIcon(size, opts);
  const png = encodePNG(size, size, cv.data);
  const outPath = path.join(__dirname, '..', 'icons', fileName);
  fs.writeFileSync(outPath, png);
  console.log('gerado', outPath);
}

writeIcon('icon-192.png', 192, { maskable: false });
writeIcon('icon-512.png', 512, { maskable: false });
writeIcon('icon-maskable-512.png', 512, { maskable: true });
