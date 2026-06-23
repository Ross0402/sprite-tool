// ============================================================
// draw.js
// DRAW mode: freehand pen drawing on the stage canvas, image upload,
// and the pointer-event wiring (mouse + touch) shared by draw/rig/pose
// modes (each mode's handler checks APP.mode and no-ops otherwise).
// Depends on: app.js.
// ============================================================

/* ============================================================
   DRAW MODE
   ============================================================ */
function initDrawCanvasIfNeeded() {
  if (APP.drawCanvas) return;
  APP.drawCanvas = document.createElement('canvas');
  APP.drawCanvas.width = CANVAS_SIZE;
  APP.drawCanvas.height = CANVAS_SIZE;
  APP.drawCtx = APP.drawCanvas.getContext('2d');
  APP.drawCtx.fillStyle = '#ffffff';
  APP.drawCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function stagePointFromEvent(e) {
  const rect = STAGE.getBoundingClientRect();
  const scaleX = STAGE.width / rect.width;
  const scaleY = STAGE.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function drawModePointerDown(e) {
  if (APP.mode !== 'draw') return;
  initDrawCanvasIfNeeded();
  APP.isDrawing = true;
  APP.lastDrawPoint = stagePointFromEvent(e);
  e.preventDefault();
}
function drawModePointerMove(e) {
  if (APP.mode !== 'draw' || !APP.isDrawing) return;
  const p = stagePointFromEvent(e);
  APP.drawCtx.strokeStyle = APP.drawColor;
  APP.drawCtx.lineWidth = APP.drawSize;
  APP.drawCtx.lineCap = 'round';
  APP.drawCtx.lineJoin = 'round';
  APP.drawCtx.beginPath();
  APP.drawCtx.moveTo(APP.lastDrawPoint.x, APP.lastDrawPoint.y);
  APP.drawCtx.lineTo(p.x, p.y);
  APP.drawCtx.stroke();
  APP.lastDrawPoint = p;
  redrawStage();
  e.preventDefault();
}
function drawModePointerUp() {
  if (APP.mode !== 'draw') return;
  if (APP.isDrawing) {
    APP.isDrawing = false;
    bakeDrawingToSprite();
  }
}

function bakeDrawingToSprite() {
  APP.sprite.drawingDataUrl = APP.drawCanvas.toDataURL('image/png');
  const img = new Image();
  img.onload = () => { APP.sprite.drawingImage = img; refreshTabs(); };
  img.src = APP.sprite.drawingDataUrl;
}

function handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      initDrawCanvasIfNeeded();
      APP.drawCtx.fillStyle = '#ffffff';
      APP.drawCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      // Fit image into canvas preserving aspect ratio
      const scale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height) * 0.9;
      const w = img.width * scale, h = img.height * scale;
      const x = (CANVAS_SIZE - w) / 2, y = (CANVAS_SIZE - h) / 2;
      APP.drawCtx.drawImage(img, x, y, w, h);
      bakeDrawingToSprite();
      redrawStage();
      setStatus('Image loaded. You can keep drawing on top, or move to Rig.', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearDrawing() {
  initDrawCanvasIfNeeded();
  APP.drawCtx.fillStyle = '#ffffff';
  APP.drawCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  APP.sprite.drawingDataUrl = null;
  APP.sprite.drawingImage = null;
  APP.sprite.jointPositions = {};
  APP.sprite.bindInfo = null;
  APP.sprite.cutouts = {};
  redrawStage();
  refreshTabs();
  setStatus('Canvas cleared.', null);
}

STAGE.addEventListener('mousedown', (e) => { drawModePointerDown(e); rigPointerDown(e); posePointerDown(e); });
STAGE.addEventListener('mousemove', (e) => { drawModePointerMove(e); posePointerMove(e); });
STAGE.addEventListener('mouseup', (e) => { drawModePointerUp(e); posePointerUp(e); });
STAGE.addEventListener('mouseleave', (e) => { drawModePointerUp(e); posePointerUp(e); });
STAGE.addEventListener('touchstart', (e) => { drawModePointerDown(e); rigPointerDown(e); posePointerDown(e); }, { passive: false });
STAGE.addEventListener('touchmove', (e) => { drawModePointerMove(e); posePointerMove(e); }, { passive: false });
STAGE.addEventListener('touchend', (e) => { drawModePointerUp(e); posePointerUp(e); });
