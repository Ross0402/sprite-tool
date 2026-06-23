// ============================================================
// app.js
// Global APP state object, canvas/context references, small utility
// functions (setStatus, genId), and mode-switching (setMode, tab
// wiring). Depends on: skeleton.js. Everything else depends on this.
// ============================================================

const APP = {
  mode: 'draw', // 'draw' | 'rig' | 'pose' | 'library'

  // ---- DRAW mode state ----
  drawColor: '#1a1a1a',
  drawSize: 4,
  isDrawing: false,
  drawCanvas: null, // offscreen canvas holding the baked drawing
  drawCtx: null,
  lastDrawPoint: null,

  // ---- Current sprite being worked on ----
  sprite: {
    id: null,
    name: 'Untitled sprite',
    drawingDataUrl: null, // baked PNG of the drawing
    drawingImage: null,   // loaded Image() of the above, for fast redraw
    jointPositions: {},   // { jointName: {x,y} } in drawing/canvas space — bind pose
    bindInfo: null,       // derived via RIG.deriveBindInfo once all joints placed
    silhouette: null,     // [{x,y}, ...] the one lasso traced around the whole character
    mesh: null,           // { vertices, triangles, skinWeights } built from the silhouette
  },

  // ---- RIG mode sub-state ----
  rigStep: 'joints', // 'joints' | 'silhouette'
  rigJointIndex: 0,   // index into ALL_JOINTS for the next joint to place
  rigCurrentLasso: [], // points being drawn for the in-progress silhouette lasso

  // ---- POSE mode state ----
  currentMovement: { id: null, name: 'Untitled movement', frames: [] },
  currentFrameIndex: 0,
  draggingJoint: null, // joint name currently being dragged
  showAngleTable: false,
  showWireframe: false, // debug overlay: show the mesh triangles

  // ---- LIBRARY mode state ----
  librarySprites: [],
  libraryMovements: [],
  librarySelectedSpriteId: null,
  librarySelectedMovementId: null,
};

const CANVAS_SIZE = 480;
const STAGE = document.getElementById('stageCanvas');
STAGE.width = CANVAS_SIZE;
STAGE.height = CANVAS_SIZE;
const SCTX = STAGE.getContext('2d');

function setStatus(msg, kind) {
  const el = document.getElementById('statusbar');
  el.textContent = msg;
  el.className = 'statusbar' + (kind ? ' ' + kind : '');
}

function genId() {
  return 'id_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}

/* ============================================================
   MODE SWITCHING
   ============================================================ */
function canEnterRig() {
  return !!APP.sprite.drawingDataUrl;
}
function canEnterPose() {
  return !!APP.sprite.bindInfo && !!APP.sprite.mesh;
}

function setMode(mode) {
  if (mode === 'rig' && !canEnterRig()) {
    setStatus('Draw or upload a sprite first.', 'error');
    return;
  }
  if (mode === 'pose' && !canEnterPose()) {
    setStatus('Finish rigging (joints + silhouette) before posing.', 'error');
    return;
  }
  APP.mode = mode;
  refreshTabs();
  renderSidebar();
  redrawStage();
  document.getElementById('timelineWrap').classList.toggle('hidden', mode !== 'pose');
  if (mode === 'pose') renderTimeline();
  if (mode === 'library') { refreshLibrary(); }
  renderLibraryGrid();
}

function refreshTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    const t = tab.getAttribute('data-tab');
    tab.classList.toggle('active', t === APP.mode);
    if (t === 'rig') tab.classList.toggle('disabled', !canEnterRig());
    if (t === 'pose') tab.classList.toggle('disabled', !canEnterPose());
  });
  document.getElementById('spriteNameBadge').textContent = APP.sprite.drawingDataUrl
    ? APP.sprite.name
    : 'No sprite yet';
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.getAttribute('data-tab')));
});
