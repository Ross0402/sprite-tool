// ============================================================
// input.js
// Stage pointer-event coordinate conversion and wiring. Simplified
// from the earlier draw/rig tools since this app only needs canvas
// interaction in Pose mode (dragging joints) -- there's no freehand
// drawing or manual joint-placement step anymore.
// Depends on: app.js, pose.js (posePointerDown/Move/Up).
// ============================================================

function stagePointFromEvent(e) {
  const rect = STAGE.getBoundingClientRect();
  const scaleX = STAGE.width / rect.width;
  const scaleY = STAGE.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

STAGE.addEventListener('mousedown', (e) => { posePointerDown(e); });
STAGE.addEventListener('mousemove', (e) => { posePointerMove(e); });
STAGE.addEventListener('mouseup', (e) => { posePointerUp(e); });
STAGE.addEventListener('mouseleave', (e) => { posePointerUp(e); });
STAGE.addEventListener('touchstart', (e) => { posePointerDown(e); }, { passive: false });
STAGE.addEventListener('touchmove', (e) => { posePointerMove(e); }, { passive: false });
STAGE.addEventListener('touchend', (e) => { posePointerUp(e); });
