// ============================================================
// render.js
// The main render pipeline: drawing cutout textures via FK transforms
// (drawRiggedSprite), joint/skeleton-line overlays, and the top-level
// redrawStage() dispatcher used by every mode.
// Depends on: app.js, skeleton.js, fk.js.
// ============================================================

/* ============================================================
   RENDER PIPELINE
   ============================================================ */
function drawRiggedSprite(ctx, bindInfo, cutouts, pose, offsetX, offsetY) {
  offsetX = offsetX || 0;
  offsetY = offsetY || 0;
  const solved = FK.solvePose(bindInfo, pose);

  SKELETON.bones.forEach((bone) => {
    const cutout = cutouts[bone.id];
    if (!cutout || !cutout.texture) return;

    const worldAngle = solved.boneWorldAngles[bone.id];
    const pivotWorld = solved.joints[bone.fromJoint];

    ctx.save();
    ctx.translate(offsetX + pivotWorld.x, offsetY + pivotWorld.y);
    ctx.rotate((worldAngle * Math.PI) / 180);
    // Texture was rasterized with pivotInTexture marking where the pivot
    // joint sits inside the texture; draw offset so that point lands at
    // the (now transformed) origin.
    ctx.drawImage(cutout.texture, -cutout.pivotInTexture.x, -cutout.pivotInTexture.y);
    ctx.restore();
  });
}

function drawJointHandles(ctx, jointPositions, opts) {
  opts = opts || {};
  const radius = opts.radius || 5;
  Object.keys(jointPositions).forEach((name) => {
    const p = jointPositions[name];
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = opts.fill || '#d97757';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.stroke || '#1c1b1a';
    ctx.stroke();
  });
}

function drawSkeletonLines(ctx, jointPositions) {
  ctx.strokeStyle = '#d9775788';
  ctx.lineWidth = 2;
  SKELETON.bones.forEach((bone) => {
    const a = jointPositions[bone.fromJoint];
    const b = jointPositions[bone.toJoint];
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
}

function redrawStage() {
  SCTX.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  SCTX.fillStyle = '#ffffff';
  SCTX.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (APP.mode === 'draw') {
    initDrawCanvasIfNeeded();
    SCTX.drawImage(APP.drawCanvas, 0, 0);
  } else if (APP.mode === 'rig') {
    if (APP.sprite.drawingImage) SCTX.drawImage(APP.sprite.drawingImage, 0, 0);
    if (APP.rigStep === 'joints') {
      drawSkeletonLines(SCTX, APP.sprite.jointPositions);
      drawJointHandles(SCTX, APP.sprite.jointPositions);
      // Preview marker at the next joint to place — none, since position
      // is unknown until clicked; the sidebar list communicates this instead.
    } else if (APP.rigStep === 'cutouts') {
      // Show already-rasterized cutouts as a faint confirmation overlay
      // is unnecessary (the drawing already shows them); just show the
      // in-progress lasso path.
      if (APP.rigCurrentLasso.length > 0) {
        SCTX.beginPath();
        APP.rigCurrentLasso.forEach((pt, i) => {
          if (i === 0) SCTX.moveTo(pt.x, pt.y); else SCTX.lineTo(pt.x, pt.y);
        });
        SCTX.strokeStyle = '#d97757';
        SCTX.lineWidth = 2;
        SCTX.setLineDash([5, 4]);
        SCTX.stroke();
        SCTX.setLineDash([]);
        APP.rigCurrentLasso.forEach((pt) => {
          SCTX.beginPath();
          SCTX.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          SCTX.fillStyle = '#d97757';
          SCTX.fill();
        });
      }
      drawJointHandles(SCTX, APP.sprite.jointPositions, { radius: 3, fill: '#8c8780' });
    }
  } else if (APP.mode === 'pose') {
    const frame = currentFrame();
    if (frame) {
      drawRiggedSprite(SCTX, APP.sprite.bindInfo, APP.sprite.cutouts, frame);
      const solved = FK.solvePose(APP.sprite.bindInfo, frame);
      drawSkeletonLines(SCTX, solved.joints);
      drawJointHandles(SCTX, solved.joints, {
        fill: '#d97757',
      });
    }
  } else if (APP.mode === 'library') {
    drawLibraryPreview();
  }
}
