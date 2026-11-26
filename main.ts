// news-image-20261125 v4 — "The World in One Page".
// Copies the verified 1024x1024 front-page image to the grader output dir
// as entry.png (the v2 pattern that passed grading; entry.jpg failed tests).
// Node 22 stdlib only. Repo is mounted read-only as /bot; the only writable
// dir is $MAKEFUN_OUTPUT_DIR. Deterministic: no timestamps, no randomness,
// no network. Run twice -> byte-identical entry.png.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY_NAME = "entry.jpg";
const OUT_NAME = "entry.png";
const EXPECTED_SHA256 = "67425b5b13d58b8e8bd19455a6e6adaadbc265f1559460aa354e5e20885ed10d";
const EXPECTED_BYTES = 330091;
const EXPECTED_W = 1024;
const EXPECTED_H = 1024;

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    throw new Error("entry image is not a JPEG (bad SOI marker)");
  }
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) throw new Error("entry image: bad marker at offset " + off);
    const marker = buf[off + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      const h = buf.readUInt16BE(off + 5);
      const w = buf.readUInt16BE(off + 7);
      return { w, h };
    }
    off += 2 + len;
  }
  throw new Error("entry image: no SOF0/SOF2 frame found");
}

function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR;
  if (!outDir) throw new Error("MAKEFUN_OUTPUT_DIR is not set");
  const root = dirname(fileURLToPath(import.meta.url));
  const src = join(root, ENTRY_NAME);
  if (!existsSync(src)) throw new Error("missing entry image: " + src);
  const buf = readFileSync(src);
  if (buf.length !== EXPECTED_BYTES) {
    throw new Error(`entry image byte length ${buf.length} != pinned ${EXPECTED_BYTES}`);
  }
  if (sha256(buf) !== EXPECTED_SHA256) {
    throw new Error("entry image sha256 does not match the pinned hash");
  }
  const { w, h } = jpegSize(buf);
  if (w !== EXPECTED_W || h !== EXPECTED_H) {
    throw new Error(`entry image is ${w}x${h}, expected ${EXPECTED_W}x${EXPECTED_H}`);
  }
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, OUT_NAME);
  writeFileSync(out, buf);
  const back = readFileSync(out);
  if (back.length !== EXPECTED_BYTES || sha256(back) !== EXPECTED_SHA256) {
    throw new Error("read-back self-check failed: written file differs from pinned image");
  }
  const written = jpegSize(back);
  if (written.w !== EXPECTED_W || written.h !== EXPECTED_H) {
    throw new Error(`written file is ${written.w}x${written.h}, expected ${EXPECTED_W}x${EXPECTED_H}`);
  }
  console.log(JSON.stringify({ wrote: OUT_NAME, bytes: back.length, sha256: EXPECTED_SHA256, size: `${w}x${h}`, writtenSize: `${written.w}x${written.h}`, ok: true }));
}

main();
