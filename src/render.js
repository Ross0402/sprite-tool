// ============================================================
// render.js
// Draws a posed sprite using RIGID PER-PART PIECES, matching how
// Spine, Unity 2D Animation, and DragonBones rig by default: each
// body part is its own piece of art, pinned to exactly one bone, and
// moves as a single rigid unit. This is what makes the warping bug
// from the mesh-deform approach structurally impossible here — there
// is no shared mesh connecting the head to a hand or one leg to the
// other, so nothing can pull on a part it isn't attached to.
//
// Depends on: skeleton.js, fk.js.
// ============================================================

// Draws ONE piece (a Path2D built from its SVG path string, or a
// circle for the head) at its bone's current world transform.
function drawPiece(ctx, piece, position, angleDeg) {
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = piece.color;

  if (piece.isHead) {
    ctx.beginPath();
    ctx.arc(0, 0, piece.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (piece.path2d) {
    ctx.fill(piece.path2d);
  }

  ctx.restore();
}

// Lazily builds and caches a Path2D for each piece's SVG path string,
// since Path2D objects are relatively expensive to construct and the
// path itself never changes after the sprite is created.
function ensurePiecePaths(sprite) {
  Object.keys(sprite.parts).forEach((boneId) => {
    const piece = sprite.parts[boneId];
    if (!piece.isHead && piece.svgPath && !piece.path2d) {
      piece.path2d = new Path2D(piece.svgPath);
    }
  });
}

// Top-level: given a sprite (parts + bindInfo) and a pose, draw every
// piece at its current FK-solved position/rotation. Draw order follows
// SKELETON.bones order (parent-before-child), with torso first so
// limbs layer naturally on top — matching the original v1 hierarchy
// (back limbs -> torso -> head -> front limbs) closely enough for a
// simple stick figure without needing explicit z-ordering per pose.
function drawPosedSprite(ctx, sprite, pose) {
  if (!sprite.parts || !sprite.bindInfo) return null;
  ensurePiecePaths(sprite);

  const { solved } = FK.boneTransforms(sprite.bindInfo, pose);

  // Draw back-to-front: right-side limbs (back), torso, head, then
  // left-side limbs (front) -- a simple fixed convention that reads
  // correctly for a side-on or front-on stick figure without needing
  // per-frame depth sorting.
  const drawOrder = [
    'R_forearm', 'R_upperArm', 'R_shin', 'R_thigh',
    'torso',
    'L_thigh', 'L_shin', 'L_upperArm', 'L_forearm',
    'head',
  ];

  drawOrder.forEach((boneId) => {
    const piece = sprite.parts[boneId];
    if (!piece) return;
    const bone = SKELETON.bones.find((b) => b.id === boneId);
    const position = solved.joints[bone.fromJoint];
    const angleDeg = solved.boneWorldAngles[boneId];
    drawPiece(ctx, piece, position, angleDeg);
  });

  return solved.joints;
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

/* ============================================================
   TOP-LEVEL STAGE DISPATCHER
   ============================================================ */
function redrawStage() {
  SCTX.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  SCTX.fillStyle = '#ffffff';
  SCTX.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (APP.mode === 'pose') {
    const frame = currentFrame();
    if (frame && APP.sprite.parts) {
      const joints = drawPosedSprite(SCTX, APP.sprite, frame);
      if (joints) {
        drawSkeletonLines(SCTX, joints);
        drawJointHandles(SCTX, joints, { fill: '#d97757' });
      }
    }
  } else if (APP.mode === 'library') {
    drawLibraryPreview();
  }
}
