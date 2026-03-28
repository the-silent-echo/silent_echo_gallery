/**
 * process-artwork.mjs
 *
 * Compresses artwork images to ≤2MB and adds a gallery label watermark.
 *
 * Usage:
 *   node scripts/process-artwork.mjs
 *
 * Or with arguments (skips prompts):
 *   node scripts/process-artwork.mjs --input ./originals --output ./public/images --watermark "The Silent Echo"
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input')     result.input     = args[++i];
    if (args[i] === '--output')    result.output    = args[++i];
    if (args[i] === '--watermark') result.watermark = args[++i];
  }
  return result;
}

function getImageFiles(dir) {
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif']);
  return fs.readdirSync(dir)
    .filter(f => exts.has(path.extname(f).toLowerCase()))
    .map(f => path.join(dir, f));
}

function fileSizeMB(filePath) {
  return fs.statSync(filePath).size / (1024 * 1024);
}

// ─── Watermark: gallery label badge ──────────────────────────────────────────
//
// Renders a small semi-transparent gray rectangle badge in the bottom-right
// corner with the artist signature in white italic serif text on top.
// Rotated slightly (-3°) for an artistic, hand-applied feel — like a gallery
// price tag or exhibition label sticker.

function makeWatermarkSvg(text, imageWidth, imageHeight) {
  const fontSize = Math.round(Math.max(imageWidth, imageHeight) * 0.0055); // 1/4 of previous size
  const badgeW   = Math.round(fontSize * 11);
  const badgeH   = Math.round(fontSize * 2.6);
  const margin   = Math.round(fontSize * 2.0);
  const bx       = imageWidth  - margin - badgeW;
  const by       = imageHeight - margin - badgeH;
  const cx       = bx + Math.round(badgeW / 2);
  const textY    = by + Math.round(badgeH * 0.68);
  const rx       = Math.round(fontSize * 0.2);

  return Buffer.from(`
    <svg width="${imageWidth}" height="${imageHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${bx}" y="${by}" width="${badgeW}" height="${badgeH}"
            rx="${rx}" ry="${rx}" fill="rgb(160, 160, 160)"/>
      <text x="${cx}" y="${textY}"
            font-family="Georgia, 'Times New Roman', serif"
            font-style="italic"
            font-size="${fontSize}"
            fill="white"
            text-anchor="middle"
            letter-spacing="0.08em">${text}</text>
    </svg>
  `);
}

// ─── Compression ──────────────────────────────────────────────────────────────
//
// All output is WebP (lossy) — vastly better compression than PNG or JPEG,
// fully supported on Cloudflare Pages and all modern browsers/phones.
// A 15MB PNG typically becomes 400–900KB WebP at quality 80.
//
// Strategy: step quality down from 82 → 40 at full resolution first.
// If still over target (unusual for WebP), progressively resize.
// Reports ⚠ in the console if the target could not be reached.

const TARGET_MB = 2;
const TARGET_B  = TARGET_MB * 1024 * 1024;

async function compressToTarget(inputPath, origWidth, origHeight) {
  // Quality stepping at full resolution
  for (const quality of [82, 72, 62, 52, 40]) {
    const buffer = await sharp(inputPath)
      .webp({ quality, effort: 6 })
      .toBuffer();
    if (buffer.length <= TARGET_B) return buffer;
  }

  // Resize fallback (rarely needed with WebP, but handles extreme cases)
  for (const scale of [0.75, 0.55, 0.40, 0.30]) {
    const buffer = await sharp(inputPath)
      .resize(
        Math.round(origWidth  * scale),
        Math.round(origHeight * scale),
        { fit: 'inside', withoutEnlargement: true }
      )
      .webp({ quality: 72, effort: 6 })
      .toBuffer();
    if (buffer.length <= TARGET_B) return buffer;
  }

  // Last resort: smallest scale
  return sharp(inputPath)
    .resize(
      Math.round(origWidth  * 0.25),
      Math.round(origHeight * 0.25),
      { fit: 'inside', withoutEnlargement: true }
    )
    .webp({ quality: 60, effort: 6 })
    .toBuffer();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│  Artwork Image Processor                │');
  console.log('│  Compress + Watermark for Gallery Use   │');
  console.log('└─────────────────────────────────────────┘\n');

  const inputDir = args.input
    ?? await ask(rl, '  Source folder (where originals are stored): ');

  if (!fs.existsSync(inputDir)) {
    console.error(`\n  ✗ Folder not found: ${inputDir}`);
    rl.close(); process.exit(1);
  }

  const outputDirRaw = args.output
    ?? await ask(rl, '  Output folder [default: public/images]: ');
  const outputDir = outputDirRaw || 'public/images';

  const watermarkRaw = args.watermark
    ?? await ask(rl, '  Watermark text [default: The Silent Echo]: ');
  const watermarkText = watermarkRaw || 'The Silent Echo';

  rl.close();

  fs.mkdirSync(outputDir, { recursive: true });

  const files = getImageFiles(inputDir);

  if (files.length === 0) {
    console.log('\n  No image files found in the source folder.\n');
    process.exit(0);
  }

  console.log(`\n  Found ${files.length} image(s). Processing...\n`);

  let processed = 0;
  let skipped   = 0;

  for (const filePath of files) {
    // Use the original-case extension for path.basename so '.PNG' is stripped
    // correctly (path.basename uses strict string comparison, not toLowerCase).
    // Also strip any residual image extension from the base — handles files that
    // were double-extended, e.g. "photo.PNG.png" → base "photo" → "photo_gallery.png".
    const extOrig    = path.extname(filePath);
    const imageExtRe = /\.(png|jpe?g|webp|tiff?)$/i;
    const baseName   = path.basename(filePath, extOrig).replace(imageExtRe, '');
    const sizeMB     = fileSizeMB(filePath);

    const outName = `${baseName}_gallery.webp`;
    const outPath = path.join(outputDir, outName);

    process.stdout.write(`  ${path.basename(filePath)}  (${sizeMB.toFixed(1)} MB)  →  `);

    try {
      const meta   = await sharp(filePath).metadata();
      const origW  = meta.width  ?? 2000;
      const origH  = meta.height ?? 2000;

      // 1. Compress to ≤2MB WebP (with resize fallback)
      const compressed = await compressToTarget(filePath, origW, origH);

      // 2. Read actual output dimensions for correct watermark sizing
      const compMeta = await sharp(compressed).metadata();
      const w = compMeta.width  ?? origW;
      const h = compMeta.height ?? origH;

      // 3. Composite gallery label watermark
      const watermarkSvg = makeWatermarkSvg(watermarkText, w, h);
      const final = await sharp(compressed)
        .composite([{ input: watermarkSvg, blend: 'over' }])
        .toBuffer();

      fs.writeFileSync(outPath, final);

      const outMB    = (final.length / (1024 * 1024)).toFixed(2);
      const overTag  = final.length > TARGET_B ? ' ⚠ over target' : '';
      console.log(`${outName}  (${outMB} MB)${overTag}  ✓`);
      processed++;

    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n  Done. ${processed} processed, ${skipped} skipped.`);
  console.log(`  Output: ${path.resolve(outputDir)}\n`);
}

main().catch(err => {
  console.error('\n  Fatal error:', err.message);
  process.exit(1);
});
