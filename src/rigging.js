// ============================================================
// rigging.js
// RIG mode: placing the 13 skeleton joints on the drawing, then
// lassoing + rasterizing a cutout texture for each bone. Depends on:
// app.js, skeleton.js, rig.js.
// ============================================================

/* ============================================================
   RIG MODE
   ============================================================ */
function rigPointerDown(e) {
  if (APP.mode !== 'rig') return;
  const p = stagePointFromEvent(e);

  if (APP.rigStep === 'joints') {
    const jointName = ALL_JOINTS[APP.rigJointIndex];
    if (!jointName) return;
    APP.sprite.jointPositions[jointName] = p;
    APP.rigJointIndex++;
    if (APP.rigJointIndex >= ALL_JOINTS.length) {
      finishJointPlacement();
    }
    renderSidebar();
    redrawStage();
  } else if (APP.rigStep === 'cutouts') {
    APP.rigCurrentLasso.push(p);
    redrawStage();
  }
  e.preventDefault();
}

function finishJointPlacement() {
  try {
    APP.sprite.bindInfo = RIG.deriveBindInfo(APP.sprite.jointPositions);
    APP.rigStep = 'cutouts';
    APP.rigCutoutBoneIndex = 0;
    setStatus('Joints placed. Now lasso each highlighted body part to cut it out.', 'success');
  } catch (err) {
    setStatus('Could not compute the skeleton: ' + err.message, 'error');
  }
}

function undoLastJoint() {
  if (APP.rigStep !== 'joints' || APP.rigJointIndex === 0) return;
  APP.rigJointIndex--;
  delete APP.sprite.jointPositions[ALL_JOINTS[APP.rigJointIndex]];
  renderSidebar();
  redrawStage();
}

function restartRig() {
  APP.rigStep = 'joints';
  APP.rigJointIndex = 0;
  APP.sprite.jointPositions = {};
  APP.sprite.bindInfo = null;
  APP.sprite.cutouts = {};
  APP.rigCurrentLasso = [];
  refreshTabs();
  renderSidebar();
  redrawStage();
}

function closeLassoAndRasterize() {
  const boneIds = SKELETON.bones.map((b) => b.id);
  const boneId = boneIds[APP.rigCutoutBoneIndex];
  if (!boneId) return;
  if (APP.rigCurrentLasso.length < 3) {
    setStatus('Draw at least 3 points to make a cutout region.', 'error');
    return;
  }

  const polygon = APP.rigCurrentLasso.slice();
  const bounds = RIG.polygonBounds(polygon);
  const padX = Math.max(2, bounds.width * 0.05);
  const padY = Math.max(2, bounds.height * 0.05);
  const texW = Math.max(1, Math.ceil(bounds.width + padX * 2));
  const texH = Math.max(1, Math.ceil(bounds.height + padY * 2));

  const tex = document.createElement('canvas');
  tex.width = texW;
  tex.height = texH;
  const tctx = tex.getContext('2d');

  // Clip to the lasso polygon (shifted into texture-local space), then
  // draw the full sprite drawing shifted so the right region lands inside.
  tctx.save();
  tctx.beginPath();
  polygon.forEach((pt, i) => {
    const lx = pt.x - bounds.minX + padX;
    const ly = pt.y - bounds.minY + padY;
    if (i === 0) tctx.moveTo(lx, ly); else tctx.lineTo(lx, ly);
  });
  tctx.closePath();
  tctx.clip();
  tctx.drawImage(APP.sprite.drawingImage, -(bounds.minX - padX), -(bounds.minY - padY));
  tctx.restore();

  // The bone's pivot joint (fromJoint) position in drawing space, and
  // where that pivot lands within the texture-local coordinate space —
  // both are needed at render time to place+rotate the texture correctly.
  const bone = bonesById()[boneId];
  const pivotInDrawing = APP.sprite.jointPositions[bone.fromJoint];
  const pivotInTexture = {
    x: pivotInDrawing.x - bounds.minX + padX,
    y: pivotInDrawing.y - bounds.minY + padY,
  };

  APP.sprite.cutouts[boneId] = {
    polygon,
    texture: tex,
    pivotInTexture,
  };

  APP.rigCurrentLasso = [];
  APP.rigCutoutBoneIndex++;
  if (APP.rigCutoutBoneIndex >= boneIds.length) {
    setStatus('All cutouts complete! You can now move to Pose.', 'success');
  } else {
    setStatus(`Cutout saved. Now lasso: ${formatBoneName(boneIds[APP.rigCutoutBoneIndex])}`, 'success');
  }
  refreshTabs();
  renderSidebar();
  redrawStage();
}

function undoCutout() {
  const boneIds = SKELETON.bones.map((b) => b.id);
  if (APP.rigCurrentLasso.length > 0) {
    APP.rigCurrentLasso = [];
    redrawStage();
    return;
  }
  if (APP.rigCutoutBoneIndex === 0) return;
  APP.rigCutoutBoneIndex--;
  delete APP.sprite.cutouts[boneIds[APP.rigCutoutBoneIndex]];
  refreshTabs();
  renderSidebar();
  redrawStage();
}

function formatBoneName(boneId) {
  return boneId.replace(/_/g, ' ');
}
