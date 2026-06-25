// ============================================================
// ui.js
// Sidebar rendering for every mode, the pose-mode timeline strip, the
// export panel, and all control event wiring.
// Depends on: app.js, skeleton.js, render.js, pose.js, storage.js,
// export.js.
// ============================================================

function renderSidebar() {
  const el = document.getElementById('sidebar');
  if (APP.mode === 'pose') el.innerHTML = sidebarPoseHTML();
  else if (APP.mode === 'library') el.innerHTML = sidebarLibraryHTML();
  else if (APP.mode === 'export') el.innerHTML = sidebarExportHTML();
  wireSidebarEvents();
}

function formatBoneName(boneId) {
  return boneId.replace(/_/g, ' ');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================================
   POSE SIDEBAR
   ============================================================ */
function sidebarPoseHTML() {
  const frame = currentFrame();
  if (!frame) {
    return `<div class="section"><p class="hint">No frames yet.</p><button id="addFrameBtnSidebar" class="primary">Add first frame</button></div>`;
  }
  const angleRows = SKELETON.bones.map((b) => `
    <tr>
      <td>${formatBoneName(b.id)}</td>
      <td><input type="number" step="1" data-bone="${b.id}" class="angle-input" value="${(frame.boneAngles[b.id] || 0).toFixed(1)}" /></td>
    </tr>
  `).join('');

  return `
    <div class="section">
      <h3>Movement name</h3>
      <input type="text" id="movementNameInput" value="${escapeAttr(APP.currentMovement.name)}" />
    </div>
    <div class="section">
      <h3>Current frame</h3>
      <label class="field">Duration (ms)</label>
      <input type="number" id="frameDurationInput" min="16" value="${frame.durationMs}" />
      <label class="field">Root position (hip)</label>
      <div class="btn-row">
        <input type="number" id="rootXInput" value="${frame.rootPos.x.toFixed(1)}" />
        <input type="number" id="rootYInput" value="${frame.rootPos.y.toFixed(1)}" />
      </div>
      <p class="hint">Drag any joint on the canvas to pose it. Dragging the hip moves the whole body.</p>
    </div>
    <div class="section">
      <button id="toggleTableBtn">${APP.showAngleTable ? 'Hide' : 'Show'} angle table</button>
      ${APP.showAngleTable ? `
        <table class="angle-table">
          <thead><tr><th>Bone</th><th>Angle°</th></tr></thead>
          <tbody>${angleRows}</tbody>
        </table>
      ` : ''}
    </div>
    <div class="section">
      <button id="saveMovementBtn" class="primary">Save movement</button>
      <button id="saveSpriteBtn">Save sprite</button>
      <button id="resetPoseBtn" class="danger">Reset to default stickman</button>
    </div>
  `;
}

/* ============================================================
   LIBRARY SIDEBAR
   ============================================================ */
function sidebarLibraryHTML() {
  return `
    <div class="section">
      <h3>Sprites</h3>
      <p class="hint">${APP.librarySprites.length} saved</p>
    </div>
    <div class="section">
      <h3>Movements</h3>
      <p class="hint">${APP.libraryMovements.length} saved</p>
    </div>
    <div class="section">
      <button id="loadCombinationBtn" class="primary" ${(APP.librarySelectedSpriteId && APP.librarySelectedMovementId) ? '' : 'disabled'}>Load into Pose editor</button>
      <p class="hint">Pick a sprite and a movement from the grid, then load them together — a movement made on one character works on any other character with the same skeleton.</p>
    </div>
    <div class="section">
      <button id="refreshLibraryBtn">Refresh</button>
    </div>
  `;
}

/* ============================================================
   EXPORT SIDEBAR
   ============================================================ */
function sidebarExportHTML() {
  const frameCount = APP.currentMovement.frames.length;
  return `
    <div class="section">
      <h3>Sprite sheet export</h3>
      <p class="hint">Exports the current movement ("${escapeHtml(APP.currentMovement.name)}", ${frameCount} frame${frameCount === 1 ? '' : 's'}) as a single PNG strip — one column per frame, ready to slice in Unity, Godot, GameMaker, or Phaser.</p>
    </div>
    <div class="section">
      <label class="field">Frame size (px)</label>
      <input type="number" id="exportFrameSizeInput" min="32" step="32" value="${APP.exportFrameSize}" />
      <p class="hint">Each frame is rendered into a square cell of this size.</p>
    </div>
    <div class="section">
      <button id="downloadSheetBtn" class="primary">Download sprite sheet (PNG)</button>
      <button id="downloadGifBtn">Download animated GIF preview</button>
    </div>
    <div class="section">
      <p class="hint">Want a different pose sequence? Go back to the Pose tab, build the frames you want, then come back here to export.</p>
    </div>
  `;
}

/* ============================================================
   TIMELINE (POSE mode)
   ============================================================ */
function renderTimeline() {
  const strip = document.getElementById('timelineStrip');
  if (APP.mode !== 'pose') { strip.innerHTML = ''; return; }

  const thumbs = APP.currentMovement.frames.map((frame, i) => {
    const dataUrl = renderFrameThumbnail(frame);
    return `
      <div class="frame-thumb ${i === APP.currentFrameIndex ? 'current' : ''}" data-frame-index="${i}">
        <img src="${dataUrl}" />
        <span class="frame-num">${i + 1}</span>
        <button class="frame-del" data-del-index="${i}">×</button>
      </div>
    `;
  }).join('');

  strip.innerHTML = thumbs + `<button class="add-frame-btn" id="addFrameBtnTimeline">+</button>`;

  strip.querySelectorAll('.frame-thumb').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('frame-del')) return;
      selectFrame(parseInt(el.getAttribute('data-frame-index'), 10));
    });
  });
  strip.querySelectorAll('.frame-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFrame(parseInt(btn.getAttribute('data-del-index'), 10));
    });
  });
  const addBtn = document.getElementById('addFrameBtnTimeline');
  if (addBtn) addBtn.addEventListener('click', addFrame);
}

function renderFrameThumbnail(frame) {
  const tmp = document.createElement('canvas');
  tmp.width = 64; tmp.height = 64;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 64, 64);
  const full = document.createElement('canvas');
  full.width = CANVAS_SIZE; full.height = CANVAS_SIZE;
  const fctx = full.getContext('2d');
  fctx.fillStyle = '#ffffff';
  fctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  drawPosedSprite(fctx, APP.sprite, frame);
  tctx.drawImage(full, 0, 0, 64, 64);
  return tmp.toDataURL('image/png');
}

/* ============================================================
   SIDEBAR EVENT WIRING
   ============================================================ */
function wireSidebarEvents() {
  if (APP.mode === 'pose') {
    const nameInput = document.getElementById('movementNameInput');
    if (nameInput) nameInput.addEventListener('change', (e) => { APP.currentMovement.name = e.target.value || 'Untitled movement'; });
    const durInput = document.getElementById('frameDurationInput');
    if (durInput) durInput.addEventListener('change', (e) => setFrameDuration(e.target.value));
    const rootX = document.getElementById('rootXInput');
    if (rootX) rootX.addEventListener('change', (e) => setRootPosFromTable('x', e.target.value));
    const rootY = document.getElementById('rootYInput');
    if (rootY) rootY.addEventListener('change', (e) => setRootPosFromTable('y', e.target.value));
    const toggleTableBtn = document.getElementById('toggleTableBtn');
    if (toggleTableBtn) toggleTableBtn.addEventListener('click', () => { APP.showAngleTable = !APP.showAngleTable; renderSidebar(); });
    document.querySelectorAll('.angle-input').forEach((inp) => {
      inp.addEventListener('change', (e) => setBoneAngleFromTable(e.target.getAttribute('data-bone'), e.target.value));
    });
    const saveMovementBtn = document.getElementById('saveMovementBtn');
    if (saveMovementBtn) saveMovementBtn.addEventListener('click', saveCurrentMovement);
    const saveSpriteBtn = document.getElementById('saveSpriteBtn');
    if (saveSpriteBtn) saveSpriteBtn.addEventListener('click', saveCurrentSprite);
    const addFrameBtnSidebar = document.getElementById('addFrameBtnSidebar');
    if (addFrameBtnSidebar) addFrameBtnSidebar.addEventListener('click', addFrame);
    const resetPoseBtn = document.getElementById('resetPoseBtn');
    if (resetPoseBtn) resetPoseBtn.addEventListener('click', () => {
      loadBuiltInStickman();
      renderSidebar();
      renderTimeline();
      redrawStage();
      setStatus('Reset to the default stickman.', null);
    });

  } else if (APP.mode === 'library') {
    const loadBtn = document.getElementById('loadCombinationBtn');
    if (loadBtn) loadBtn.addEventListener('click', loadSelectedCombination);
    const refreshBtn = document.getElementById('refreshLibraryBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshLibrary);

  } else if (APP.mode === 'export') {
    const sizeInput = document.getElementById('exportFrameSizeInput');
    if (sizeInput) sizeInput.addEventListener('change', (e) => {
      const n = parseInt(e.target.value, 10);
      if (!Number.isNaN(n) && n >= 32) APP.exportFrameSize = n;
    });
    const downloadSheetBtn = document.getElementById('downloadSheetBtn');
    if (downloadSheetBtn) downloadSheetBtn.addEventListener('click', downloadSpriteSheet);
    const downloadGifBtn = document.getElementById('downloadGifBtn');
    if (downloadGifBtn) downloadGifBtn.addEventListener('click', downloadAnimatedGifPreview);
  }
}

function renderExportPanel() {
  // Export mode currently has no extra canvas-drawn preview beyond the
  // standard redrawStage() pose preview; nothing extra needed here.
  // Kept as a named hook so app.js's setMode() has a stable function
  // to call regardless of which mode is active.
}
