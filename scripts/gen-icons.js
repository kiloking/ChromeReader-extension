/**
 * 以純 Node（zlib）產生簡單 RGBA PNG，供擴充 manifest 使用。
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/** PNG chunk CRC-32（對 type+data） */
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(typeStr, data) {
  const type = Buffer.from(typeStr);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  return Buffer.concat([len, type, data, crc]);
}

function pngSolid(width, height, r, g, b, a) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    let offs = 1;
    for (let x = 0; x < width; x++) {
      row[offs++] = r;
      row[offs++] = g;
      row[offs++] = b;
      row[offs++] = a;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, "..", "extension", "icons");
fs.mkdirSync(dir, { recursive: true });
const blue = [0x3b, 0x82, 0xf6, 0xff];
for (const [name, w] of [
  ["icon16.png", 16],
  ["icon48.png", 48],
  ["icon128.png", 128],
]) {
  fs.writeFileSync(
    path.join(dir, name),
    pngSolid(w, w, ...blue)
  );
}
console.log("icons ok:", dir);
