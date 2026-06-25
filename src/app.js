// ============================================================
// app.js
// Global APP state, canvas/context references, small utility
// functions (setStatus, genId), and mode-switching. The workflow is
// deliberately simple: the built-in stickman loads immediately, ready
// to pose -- no drawing or manual joint-clicking required. Depends
// on: skeleton.js, default-stickman.js.
// ============================================================

const APP = {
  mode: 'pose', // 'pose' | 'library' | 'export'

  sprite: null, // set by loadBuiltInStickman() at bootstrap

  currentMovement: { id: null, name: 'Untitled movement', frames: [] },
  currentFrameIndex: 0,
  draggingJoint: null,
  showAngleTable: false,

  librarySprites: [],
  libraryMovements: [],
  librarySelectedSpriteId: null,
  librarySelectedMovementId: null,

  // ---- EXPORT mode state ----
  exportFrameCount: 8,
  exportFrameSize: 128,
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
   LOADING THE BUILT-IN STICKMAN
   ============================================================ */
function loadBuiltInStickman() {
  const sprite = buildDefaultStickmanSprite();
  sprite.id = genId();
  sprite.bindInfo = buildDefaultStickmanBindInfo();
  sprite.bindInfo.hipBindPos = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 + 60 };
  APP.sprite = sprite;
  APP.currentMovement = { id: null, name: 'Untitled movement', frames: [] };
  APP.currentFrameIndex = 0;
  ensureAtLeastOneFrame();
}

/* ============================================================
   MODE SWITCHING
   ============================================================ */
function setMode(mode) {
  APP.mode = mode;
  refreshTabs();
  renderSidebar();
  redrawStage();
  document.getElementById('timelineWrap').classList.toggle('hidden', mode !== 'pose');
  if (mode === 'pose') renderTimeline();
  if (mode === 'library') { refreshLibrary(); }
  renderLibraryGrid();
  renderExportPanel();
}

function refreshTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    const t = tab.getAttribute('data-tab');
    tab.classList.toggle('active', t === APP.mode);
  });
  document.getElementById('spriteNameBadge').textContent = APP.sprite ? APP.sprite.name : 'No sprite loaded';
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setMode(tab.getAttribute('data-tab')));
});
