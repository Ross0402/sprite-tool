/* ============================================================
   exporter.js
   Builds a hidden offline canvas grid, asks engine.js for the
   joint positions of the active movement at each step, paints
   the strip, then forces a transparent PNG download.
   ============================================================ */

(function () {
  const { CONFIG, BODY, STATE } = window.STICK;

  function buildSpriteSheet() {
    if (!window.STICK.isComplete()) {
      alert('Build a complete stickman first (head, torso, arms, legs) before exporting.');
      return;
    }

    const frameSize = CONFIG.FRAME_SIZE;
    const move = STATE.currentMovement;
    const oneShot = window.ENGINE.isOneShot(move);
    const frameCount = oneShot ? CONFIG.ONE_SHOT_FRAME_COUNT : CONFIG.FRAME_COUNT;

    // Offline hidden wide canvas grid: frameCount x frameSize
    const sheet = document.createElement('canvas');
    sheet.width = frameSize * frameCount;
    sheet.height = frameSize;
    const ctx = sheet.getContext('2d');

    // Anchor the rig centered in each frame cell, feet near the bottom
    const localTorso = {
      x: frameSize / 2,
      y: frameSize / 2 + 18,
    };

    for (let i = 0; i < frameCount; i++) {
      ctx.save();
      ctx.translate(i * frameSize, 0);

      let pose;
      if (oneShot) {
        // Slice the full wind-up -> strike -> recover arc into equal steps,
        // including the final frame (i / (frameCount - 1)) so the sheet
        // shows the complete motion start to finish.
        const stepProgress = frameCount > 1 ? i / (frameCount - 1) : 0;
        pose = window.ENGINE.computePose(localTorso, move, 0, stepProgress);
      } else {
        // Slice the looping cycle into equal angle steps (0 to 2*PI)
        const stepProgress = i / frameCount; // 0, 0.25, 0.5, 0.75 for 4 frames
        const t = stepProgress * Math.PI * 2;
        pose = window.ENGINE.computePose(localTorso, move, t);
      }

      window.ENGINE.drawPose(ctx, pose, { color: '#1a1a1a' });
      ctx.restore();
    }

    downloadCanvas(sheet, `stickman-${move}-spritesheet.png`);
  }

  function downloadCanvas(canvas, filename) {
    // Transparent PNG data stream
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.EXPORTER = {
    buildSpriteSheet,
  };
})();
