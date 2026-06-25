// ============================================================
// export.js
// Renders the current movement into a downloadable sprite sheet PNG
// (one frame per column, matching the standard format used by Unity,
// Godot, GameMaker, and Phaser) and an animated GIF preview.
// Depends on: app.js, render.js, pose.js.
// ============================================================

function downloadCanvas(canvas, filename) {
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderFrameToCell(ctx, frame, cellSize, offsetX) {
  ctx.save();
  ctx.translate(offsetX, 0);
  const recenteredFrame = {
    rootPos: { x: cellSize / 2, y: cellSize / 2 },
    boneAngles: frame.boneAngles,
  };
  drawPosedSprite(ctx, APP.sprite, recenteredFrame);
  ctx.restore();
}

function buildSpriteSheetCanvas() {
  const frames = APP.currentMovement.frames;
  const cellSize = APP.exportFrameSize;
  const sheet = document.createElement('canvas');
  sheet.width = cellSize * frames.length;
  sheet.height = cellSize;
  const ctx = sheet.getContext('2d');
  frames.forEach((frame, i) => {
    renderFrameToCell(ctx, frame, cellSize, i * cellSize);
  });
  return sheet;
}

function downloadSpriteSheet() {
  if (!APP.sprite || APP.currentMovement.frames.length === 0) {
    setStatus('Nothing to export yet — pose at least one frame first.', 'error');
    return;
  }
  const sheet = buildSpriteSheetCanvas();
  const safeName = (APP.currentMovement.name || 'movement').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  downloadCanvas(sheet, `${safeName}-spritesheet.png`);
  setStatus(`Exported ${APP.currentMovement.frames.length}-frame sprite sheet (${APP.exportFrameSize}px per frame).`, 'success');
}

function downloadAnimatedGifPreview() {
  if (!APP.sprite || APP.currentMovement.frames.length === 0) {
    setStatus('Nothing to export yet — pose at least one frame first.', 'error');
    return;
  }
  try {
    const gifBlob = buildSimpleGif();
    const url = URL.createObjectURL(gifBlob);
    const safeName = (APP.currentMovement.name || 'movement').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}-preview.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Downloaded animated GIF preview.', 'success');
  } catch (err) {
    setStatus('Could not build GIF preview: ' + err.message, 'error');
  }
}

function buildSimpleGif() {
  const frames = APP.currentMovement.frames;
  const size = Math.min(APP.exportFrameSize, 256);
  const canvases = frames.map((frame) => {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    renderFrameToCell(ctx, frame, size, 0);
    return c;
  });
  return encodeGif89a(canvases, frames.map((f) => f.durationMs));
}

function encodeGif89a(canvases, durationsMs) {
  const width = canvases[0].width, height = canvases[0].height;
  const bytes = [];

  function pushStr(s) { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); }
  function pushByte(b) { bytes.push(b & 0xff); }
  function pushShortLE(v) { bytes.push(v & 0xff, (v >> 8) & 0xff); }

  const paletteMap = new Map();
  const palette = [];
  function colorIndex(r, g, b) {
    const key = r * 65536 + g * 256 + b;
    if (paletteMap.has(key)) return paletteMap.get(key);
    if (palette.length >= 256) return 0;
    const idx = palette.length;
    paletteMap.set(key, idx);
    palette.push([r, g, b]);
    return idx;
  }

  const frameIndexed = canvases.map((c) => {
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, width, height).data;
    const indices = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
      const rr = a < 10 ? 255 : r, gg = a < 10 ? 255 : g, bb = a < 10 ? 255 : b;
      indices[i] = colorIndex(rr, gg, bb);
    }
    return indices;
  });

  while (palette.length < 2) palette.push([255, 255, 255]);
  let paletteBits = Math.ceil(Math.log2(palette.length));
  if (paletteBits < 1) paletteBits = 1;
  const paletteSize = 1 << paletteBits;

  pushStr('GIF89a');
  pushShortLE(width);
  pushShortLE(height);
  pushByte(0x80 | (paletteBits - 1));
  pushByte(0);
  pushByte(0);

  for (let i = 0; i < paletteSize; i++) {
    const c = palette[i] || [255, 255, 255];
    pushByte(c[0]); pushByte(c[1]); pushByte(c[2]);
  }

  pushByte(0x21); pushByte(0xff); pushByte(0x0b);
  pushStr('NETSCAPE2.0');
  pushByte(0x03); pushByte(0x01); pushShortLE(0); pushByte(0x00);

  frameIndexed.forEach((indices, frameIdx) => {
    const delayCs = Math.max(2, Math.round((durationsMs[frameIdx] || 100) / 10));

    pushByte(0x21); pushByte(0xf9); pushByte(0x04);
    pushByte(0x00);
    pushShortLE(delayCs);
    pushByte(0x00);
    pushByte(0x00);

    pushByte(0x2c);
    pushShortLE(0); pushShortLE(0);
    pushShortLE(width); pushShortLE(height);
    pushByte(0x00);

    const minCodeSize = Math.max(2, paletteBits);
    pushByte(minCodeSize);
    const lzwBytes = encodeUncompressedLzw(indices, minCodeSize);
    let pos = 0;
    while (pos < lzwBytes.length) {
      const chunkLen = Math.min(255, lzwBytes.length - pos);
      pushByte(chunkLen);
      for (let k = 0; k < chunkLen; k++) pushByte(lzwBytes[pos + k]);
      pos += chunkLen;
    }
    pushByte(0x00);
  });

  pushByte(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}

function encodeUncompressedLzw(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const codeBitsSize = minCodeSize + 1;

  const bitBuffer = [];
  let bitAcc = 0, bitCount = 0;
  function writeCode(code, size) {
    bitAcc |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      bitBuffer.push(bitAcc & 0xff);
      bitAcc >>= 8;
      bitCount -= 8;
    }
  }

  writeCode(clearCode, codeBitsSize);
  for (let i = 0; i < indices.length; i++) {
    writeCode(indices[i], codeBitsSize);
  }
  writeCode(endCode, codeBitsSize);
  if (bitCount > 0) bitBuffer.push(bitAcc & 0xff);

  return bitBuffer;
}
