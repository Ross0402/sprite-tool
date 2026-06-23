// ============================================================
// ui.js
// Sidebar rendering for every mode, the pose-mode timeline strip,
// and all sidebar control event wiring.
// Depends on: app.js, skeleton.js, render.js, draw.js, rigging.js,
// pose.js, storage.js (saveCurrentSprite/Movement, refreshLibrary).
// ============================================================

function renderSidebar() {
  const el = document.getElementById('sidebar');
  if (APP.mode === 'draw') el.innerHTML = sidebarDrawHTML();
  else if (APP.mode === 'rig') el.innerHTML = sidebarRigHTML();
  else if (APP.mode === 'pose') el.innerHTML = sidebarPoseHTML();
  else if (APP.mode === 'library') el.innerHTML = sidebarLibraryHTML();
  wireSidebarEvents();
}

function sidebarDrawHTML() {
  const colors = ['#1a1a1a', '#c2614a', '#d97757', '#e8c468', '#6fae8f', '#5a8fc2', '#8c69b8', '#ffffff'];
  return `
    <div class="section">
      <h3>Sprite name</h3>
      <input type="text" id="spriteNameInput" value="${escapeAttr(APP.sprite.name)}" />
    </div>
    <div class="section">
      <h3>Tool</h3>
      <div class="btn-row">
        <button id="uploadImgBtn">Upload image</button>
        <input type="file" id="uploadImgInput" accept="image/*" class="hidden" />
      </div>
      <label class="field">Brush color</label>
      <div class="swatch-row">
        ${colors.map((c) => `<div class="swatch ${c === APP.drawColor ? 'active' : ''}" data-color="${c}" style="background:${c}; ${c === '#ffffff' ? 'box-shadow: inset 0 0 0 1px #999;' : ''}"></div>`).join('')}
      </div>
      <label class="field">Brush size: <span id="brushSizeLabel">${APP.drawSize}</span>px</label>
      <input type="range" id="brushSizeRange" min="1" max="24" value="${APP.drawSize}" />
    </div>
    <div class="section">
      <button id="clearDrawBtn" class="danger">Clear canvas</button>
    </div>
    <div class="section">
      <button id="toRigBtn" class="primary" ${canEnterRig() ? '' : 'disabled'}>Next: Place joints →</button>
      <p class="hint">Draw your character freehand, or upload a reference image. When you're happy with it, move to Rig to place joints.</p>
    </div>
  `;
}

function sidebarRigHTML() {
  if (APP.rigStep === 'joints') {
    const items = ALL_JOINTS.map((j, i) => {
      const placed = APP.sprite.jointPositions[j];
      const cls = i === APP.rigJointIndex ? 'current' : (placed ? 'placed' : '');
      return `<div class="joint-list-item ${cls}"><span class="joint-dot"></span>${JOINT_LABELS[j]}</div>`;
    }).join('');
    return `
      <div class="section">
        <h3>Place joints in order</h3>
        <p class="hint">Click on the canvas where each joint should sit. ${APP.rigJointIndex < ALL_JOINTS.length ? `Next: <strong>${JOINT_LABELS[ALL_JOINTS[APP.rigJointIndex]]}</strong>` : 'All joints placed.'}</p>
        ${items}
      </div>
      <div class="section btn-row">
        <button id="undoJointBtn" ${APP.rigJointIndex === 0 ? 'disabled' : ''}>Undo last</button>
        <button id="restartRigBtn" class="danger">Restart rig</button>
      </div>
    `;
  }

  // silhouette step
  const hasMesh = !!APP.sprite.mesh;
  const pointCount = APP.rigCurrentLasso.length;
  return `
    <div class="section">
      <h3>Trace your character's outline</h3>
      <p class="hint">Click points all the way around your whole character — like tracing its silhouette. This is ONE continuous outline, not per-limb. ${pointCount > 0 ? `${pointCount} point(s) placed.` : ''}</p>
    </div>
    <div class="section btn-row">
      <button id="closeSilhouetteBtn" ${pointCount < 3 ? 'disabled' : ''}>Close outline & build mesh</button>
      <button id="undoSilhouetteBtn" ${pointCount === 0 ? 'disabled' : ''}>Undo point</button>
      <button id="clearSilhouetteBtn" ${pointCount === 0 ? 'disabled' : ''}>Clear</button>
    </div>
    ${hasMesh ? `
      <div class="section">
        <p class="hint">✓ Mesh built: ${APP.sprite.mesh.vertices.length} points, ${APP.sprite.mesh.triangles.length} triangles.</p>
      </div>
    ` : ''}
    <div class="section">
      <button id="restartRigBtn" class="danger">Restart rig</button>
    </div>
    ${hasMesh ? `<div class="section"><button id="toPoseBtn" class="primary">Next: Pose →</button></div>` : ''}
  `;
}

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
      <label class="field"><input type="checkbox" id="wireframeToggle" ${APP.showWireframe ? 'checked' : ''} /> Show mesh wireframe</label>
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
    </div>
  `;
}

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
      <p class="hint">Pick a sprite and a movement from the grid, then load them together — even if the movement was made on a different sprite.</p>
    </div>
    <div class="section">
      <button id="refreshLibraryBtn">Refresh</button>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
  if (APP.mode === 'draw') {
    const nameInput = document.getElementById('spriteNameInput');
    if (nameInput) nameInput.addEventListener('change', (e) => { APP.sprite.name = e.target.value || 'Untitled sprite'; refreshTabs(); });

    const uploadBtn = document.getElementById('uploadImgBtn');
    const uploadInput = document.getElementById('uploadImgInput');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
      });
    }
    document.querySelectorAll('.swatch').forEach((sw) => {
      sw.addEventListener('click', () => { APP.drawColor = sw.getAttribute('data-color'); renderSidebar(); });
    });
    const sizeRange = document.getElementById('brushSizeRange');
    if (sizeRange) sizeRange.addEventListener('input', (e) => {
      APP.drawSize = parseInt(e.target.value, 10);
      document.getElementById('brushSizeLabel').textContent = APP.drawSize;
    });
    const clearBtn = document.getElementById('clearDrawBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearDrawing);
    const toRigBtn = document.getElementById('toRigBtn');
    if (toRigBtn) toRigBtn.addEventListener('click', () => setMode('rig'));

  } else if (APP.mode === 'rig') {
    const undoJointBtn = document.getElementById('undoJointBtn');
    if (undoJointBtn) undoJointBtn.addEventListener('click', undoLastJoint);
    const restartBtn = document.getElementById('restartRigBtn');
    if (restartBtn) restartBtn.addEventListener('click', restartRig);
    const closeSilhouetteBtn = document.getElementById('closeSilhouetteBtn');
    if (closeSilhouetteBtn) closeSilhouetteBtn.addEventListener('click', closeSilhouetteAndBuildMesh);
    const undoSilhouetteBtn = document.getElementById('undoSilhouetteBtn');
    if (undoSilhouetteBtn) undoSilhouetteBtn.addEventListener('click', undoSilhouettePoint);
    const clearSilhouetteBtn = document.getElementById('clearSilhouetteBtn');
    if (clearSilhouetteBtn) clearSilhouetteBtn.addEventListener('click', clearSilhouette);
    const toPoseBtn = document.getElementById('toPoseBtn');
    if (toPoseBtn) toPoseBtn.addEventListener('click', () => {
      ensureAtLeastOneFrame();
      setMode('pose');
    });

  } else if (APP.mode === 'pose') {
    const nameInput = document.getElementById('movementNameInput');
    if (nameInput) nameInput.addEventListener('change', (e) => { APP.currentMovement.name = e.target.value || 'Untitled movement'; });
    const durInput = document.getElementById('frameDurationInput');
    if (durInput) durInput.addEventListener('change', (e) => setFrameDuration(e.target.value));
    const rootX = document.getElementById('rootXInput');
    if (rootX) rootX.addEventListener('change', (e) => setRootPosFromTable('x', e.target.value));
    const rootY = document.getElementById('rootYInput');
    if (rootY) rootY.addEventListener('change', (e) => setRootPosFromTable('y', e.target.value));
    const wireframeToggle = document.getElementById('wireframeToggle');
    if (wireframeToggle) wireframeToggle.addEventListener('change', (e) => { APP.showWireframe = e.target.checked; redrawStage(); });
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

  } else if (APP.mode === 'library') {
    const loadBtn = document.getElementById('loadCombinationBtn');
    if (loadBtn) loadBtn.addEventListener('click', loadSelectedCombination);
    const refreshBtn = document.getElementById('refreshLibraryBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshLibrary);
  }
}
