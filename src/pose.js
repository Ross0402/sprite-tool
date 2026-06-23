// ============================================================
// pose.js
// POSE mode: keyframe/frame management, joint-drag-to-bone-angle
// math (the inverse of fk.js), and the angle-table edit functions.
// Depends on: app.js, skeleton.js, fk.js.
// ============================================================

/* ============================================================
   POSE MODE
   ============================================================ */
function boneForToJoint(jointName) {
  return SKELETON.bones.find((b) => b.toJoint === jointName);
}

function currentFrame() {
  return APP.currentMovement.frames[APP.currentFrameIndex] || null;
}

function ensureAtLeastOneFrame() {
  if (APP.currentMovement.frames.length === 0) {
    addFrame();
  }
}

function addFrame() {
  const prev = currentFrame();
  const newFrame = {
    id: genId(),
    durationMs: 400,
    rootPos: prev ? { ...prev.rootPos } : { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 + 40 },
    boneAngles: prev ? { ...prev.boneAngles } : defaultBoneAngles(),
  };
  APP.currentMovement.frames.push(newFrame);
  APP.currentFrameIndex = APP.currentMovement.frames.length - 1;
  renderTimeline();
  renderSidebar();
  redrawStage();
}

function defaultBoneAngles() {
  const angles = {};
  SKELETON.bones.forEach((b) => { angles[b.id] = APP.sprite.bindInfo.restAnglesRelative[b.id]; });
  return angles;
}

function deleteFrame(index) {
  if (APP.currentMovement.frames.length <= 1) {
    setStatus('A movement needs at least one frame.', 'error');
    return;
  }
  APP.currentMovement.frames.splice(index, 1);
  if (APP.currentFrameIndex >= APP.currentMovement.frames.length) {
    APP.currentFrameIndex = APP.currentMovement.frames.length - 1;
  }
  renderTimeline();
  renderSidebar();
  redrawStage();
}

function selectFrame(index) {
  APP.currentFrameIndex = index;
  renderTimeline();
  renderSidebar();
  redrawStage();
}

// Hit-test: which joint (if any) is under this stage point, given the
// current frame's solved pose? Returns the joint name or null.
function jointHitTest(point) {
  const frame = currentFrame();
  if (!frame) return null;
  const solved = FK.solvePose(APP.sprite.bindInfo, frame);
  const HIT_RADIUS = 14;
  let closest = null, closestDist = Infinity;
  ALL_JOINTS.forEach((j) => {
    const jp = solved.joints[j];
    if (!jp) return;
    const d = Math.hypot(jp.x - point.x, jp.y - point.y);
    if (d < HIT_RADIUS && d < closestDist) { closest = j; closestDist = d; }
  });
  return closest;
}

function posePointerDown(e) {
  if (APP.mode !== 'pose') return;
  const p = stagePointFromEvent(e);
  const hit = jointHitTest(p);
  if (hit) {
    APP.draggingJoint = hit;
    e.preventDefault();
  }
}

function posePointerMove(e) {
  if (APP.mode !== 'pose' || !APP.draggingJoint) return;
  const p = stagePointFromEvent(e);
  applyJointDrag(APP.draggingJoint, p);
  redrawStage();
  renderSidebar();
  e.preventDefault();
}

function posePointerUp() {
  if (APP.mode !== 'pose') return;
  APP.draggingJoint = null;
}

// Dragging a joint to a new world position needs to convert that back
// into a relative bone angle. Special case: dragging "hip" (the root)
// just moves rootPos directly — everything else rotates a bone.
function applyJointDrag(jointName, targetPoint) {
  const frame = currentFrame();
  if (!frame) return;

  if (jointName === 'hip') {
    frame.rootPos = { x: targetPoint.x, y: targetPoint.y };
    return;
  }

  const bone = boneForToJoint(jointName);
  if (!bone) return; // shoulders aren't directly draggable (derived attachment points)

  // Solve the CURRENT pose to get this bone's pivot (fromJoint) position
  // and its parent's current world angle — we need both to convert the
  // desired world-space target back into a bone-relative angle.
  const solved = FK.solvePose(APP.sprite.bindInfo, frame);
  const pivot = solved.joints[bone.fromJoint];
  const parentWorldAngle = bone.parent ? solved.boneWorldAngles[bone.parent] : 0;

  const dx = targetPoint.x - pivot.x;
  const dy = targetPoint.y - pivot.y;
  // World angle of the new bone direction (0 = up, clockwise positive) —
  // inverse of fk.angleToVector()
  const desiredWorldAngle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const relativeAngle = desiredWorldAngle - parentWorldAngle;

  frame.boneAngles[bone.id] = normalizeAngle(relativeAngle);
}

function normalizeAngle(deg) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

function setBoneAngleFromTable(boneId, value) {
  const frame = currentFrame();
  if (!frame) return;
  const num = parseFloat(value);
  if (Number.isNaN(num)) return;
  frame.boneAngles[boneId] = normalizeAngle(num);
  redrawStage();
  renderTimeline();
}

function setRootPosFromTable(axis, value) {
  const frame = currentFrame();
  if (!frame) return;
  const num = parseFloat(value);
  if (Number.isNaN(num)) return;
  frame.rootPos[axis] = num;
  redrawStage();
  renderTimeline();
}

function setFrameDuration(value) {
  const frame = currentFrame();
  if (!frame) return;
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num < 16) return;
  frame.durationMs = num;
  renderTimeline();
}
