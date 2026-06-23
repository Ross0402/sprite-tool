// ============================================================
// render.js
// Draws a deformed mesh by texture-mapping the original drawing onto
// it, one triangle at a time, using the standard canvas-2D technique:
// for each triangle, compute the affine transform from the SOURCE
// (bind-pose / UV) triangle to the DESTINATION (deformed) triangle,
// clip the canvas to the destination triangle, apply that transform,
// then draw the source image once (the clip masks out everything
// except this triangle). Depends on: skeleton.js, fk.js, mesh.js.
// ============================================================

function drawMeshTriangle(ctx, image, srcTri, dstTri) {
  // srcTri/dstTri: arrays of 3 {x,y} points, same winding order.
  // Solve for the 2x3 affine matrix [a b c d e f] such that:
  //   dst.x = a*src.x + c*src.y + e
  //   dst.y = b*src.x + d*src.y + f
  // using the three point correspondences (a standard 3-point affine
  // solve — this is the well-known canvas triangle-texture-mapping trick).
  const [s0, s1, s2] = srcTri;
  const [d0, d1, d2] = dstTri;

  const denom = s0.x * (s1.y - s2.y) - s1.x * (s0.y - s2.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-8) return; // degenerate source triangle, skip

  // Solve the affine coefficients via Cramer's rule on the 3x3 system
  // built from the source triangle (homogeneous coords) for each of
  // dst.x and dst.y independently.
  function solveAxis(d0v, d1v, d2v) {
    const a = (d0v * (s1.y - s2.y) - d1v * (s0.y - s2.y) + d2v * (s0.y - s1.y)) / denom;
    const c = (s0.x * (d1v - d2v) - s1.x * (d0v - d2v) + s2.x * (d0v - d1v)) / denom;
    const e = (s0.x * (s1.y * d2v - s2.y * d1v) - s1.x * (s0.y * d2v - s2.y * d0v) + s2.x * (s0.y * d1v - s1.y * d0v)) / denom;
    return { a, c, e };
  }

  const xCoef = solveAxis(d0.x, d1.x, d2.x);
  const yCoef = solveAxis(d0.y, d1.y, d2.y);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  ctx.transform(xCoef.a, yCoef.a, xCoef.c, yCoef.c, xCoef.e, yCoef.e);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawDeformedMesh(ctx, image, mesh, deformedVertices) {
  mesh.triangles.forEach((tri) => {
    const srcTri = tri.map((idx) => mesh.vertices[idx]); // bind-pose positions = UV coords (1:1 with the drawing)
    const dstTri = tri.map((idx) => deformedVertices[idx]);
    drawMeshTriangle(ctx, image, srcTri, dstTri);
  });
}

// ---------------------------------------------------------
// Top-level: given a sprite (mesh + bindInfo + drawingImage) and a
// pose, deform and draw it in one call.
// ---------------------------------------------------------
function drawPosedSprite(ctx, sprite, pose) {
  if (!sprite.mesh || !sprite.bindInfo || !sprite.drawingImage) return;
  const bindPose = { rootPos: sprite.bindInfo.hipBindPos, boneAngles: sprite.bindInfo.restAnglesRelative };
  const { transforms: bindTransforms } = FK.boneTransforms(sprite.bindInfo, bindPose);
  const { transforms: currentTransforms } = FK.boneTransforms(sprite.bindInfo, pose);
  const deformed = MESH.deformMesh(sprite.mesh.vertices, sprite.mesh.skinWeights, bindTransforms, currentTransforms);
  drawDeformedMesh(ctx, sprite.drawingImage, sprite.mesh, deformed);
  return deformed; // returned so callers (e.g. joint-handle overlay) can reuse the solved pose
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

function drawMeshWireframe(ctx, mesh, vertices) {
  ctx.strokeStyle = '#2f6f5e55';
  ctx.lineWidth = 1;
  mesh.triangles.forEach((tri) => {
    const [a, b, c] = tri.map((idx) => vertices[idx]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
    ctx.closePath();
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

  if (APP.mode === 'draw') {
    initDrawCanvasIfNeeded();
    SCTX.drawImage(APP.drawCanvas, 0, 0);
  } else if (APP.mode === 'rig') {
    if (APP.sprite.drawingImage) SCTX.drawImage(APP.sprite.drawingImage, 0, 0);
    if (APP.rigStep === 'joints') {
      drawSkeletonLines(SCTX, APP.sprite.jointPositions);
      drawJointHandles(SCTX, APP.sprite.jointPositions);
    } else if (APP.rigStep === 'silhouette') {
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
    if (frame && APP.sprite.mesh) {
      const deformed = drawPosedSprite(SCTX, APP.sprite, frame);
      if (APP.showWireframe && deformed) {
        drawMeshWireframe(SCTX, APP.sprite.mesh, deformed);
      }
      const solved = FK.solvePose(APP.sprite.bindInfo, frame);
      drawJointHandles(SCTX, solved.joints, { fill: '#d97757' });
    }
  } else if (APP.mode === 'library') {
    drawLibraryPreview();
  }
}
