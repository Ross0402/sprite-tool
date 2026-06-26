// ============================================================
// render.js
// Draws a posed sprite using RIGID PER-PART PIECES, matching how
// Spine, Unity 2D Animation, DragonBones, and Pivot Animator all rig
// by default: each body part is pinned to exactly one bone and moves
// as a single rigid unit. This is what makes cross-part warping
// structurally impossible — there's no shared mesh connecting the
// head to a hand or one leg to the other.
//
// VISUAL STYLE: thick stroked line segments + round joint handles,
// matching Pivot Animator's stick figure exactly (heavy black lines,
// large round head, bold joint dots) rather than thin capsule fills.
// This is simpler AND more reliable — plain stroke/arc calls instead
// of Path2D parsing of generated SVG path strings.
//
// Depends on: skeleton.js, fk.js.
// ============================================================

// Draws one bone as a thick line from its start to end joint.
function drawLimbSegment(ctx, from, to, lineWidth, color) {
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawHead(ctx, center, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Top-level: given a sprite (parts + bindInfo) and a pose, draw every
// limb segment + the head at its current FK-solved position. Draw
// order follows the skeleton's natural hierarchy (torso/limbs first,
// head last) so the head reads clearly on top, same as Pivot.
function drawPosedSprite(ctx, sprite, pose) {
  if (!sprite.parts || !sprite.bindInfo) return null;

  const { solved } = FK.boneTransforms(sprite.bindInfo, pose);
  const j = solved.joints;

  const drawOrder = [
    'R_forearm', 'R_upperArm', 'R_shin', 'R_thigh',
    'torso',
    'L_thigh', 'L_shin', 'L_upperArm', 'L_forearm',
  ];

  drawOrder.forEach((boneId) => {
    const piece = sprite.parts[boneId];
    if (!piece) return;
    const bone = SKELETON.bones.find((b) => b.id === boneId);
    drawLimbSegment(ctx, j[bone.fromJoint], j[bone.toJoint], piece.lineWidth, piece.color);
  });

  // Head drawn last, on top, as a filled circle at the head joint —
  // matching Pivot's bold round head.
  const headPiece = sprite.parts.head;
  if (headPiece) {
    drawHead(ctx, j.head, headPiece.radius, headPiece.color);
  }

  return j;
}

function drawJointHandles(ctx, jointPositions, opts) {
  opts = opts || {};
  const radius = opts.radius || 7;
  Object.keys(jointPositions).forEach((name) => {
    if (name === 'head') return; // head already drawn as the head circle itself
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
        drawJointHandles(SCTX, joints, { fill: '#d97757' });
      }
    }
  } else if (APP.mode === 'library') {
    drawLibraryPreview();
  }
}
