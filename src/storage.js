// ============================================================
// storage.js
// Persistent storage layer: the localStorage-backed shim (used when
// not running inside a Claude artifact) plus all save/load functions
// for sprites and movements, and the library index helpers.
// Depends on: app.js (APP, genId, setStatus), skeleton.js (SKELETON).
// ============================================================

if (!window.storage) {
  window.storage = (function () {
    function k(key, shared) {
      return (shared ? 'shared:' : 'personal:') + key;
    }
    return {
      async get(key, shared) {
        try {
          const raw = localStorage.getItem(k(key, shared));
          if (raw === null) return null;
          return { key, value: raw, shared: !!shared };
        } catch (err) {
          throw new Error('localStorage get failed: ' + err.message);
        }
      },
      async set(key, value, shared) {
        try {
          localStorage.setItem(k(key, shared), value);
          return { key, value, shared: !!shared };
        } catch (err) {
          throw new Error('localStorage set failed: ' + err.message);
        }
      },
      async delete(key, shared) {
        try {
          localStorage.removeItem(k(key, shared));
          return { key, deleted: true, shared: !!shared };
        } catch (err) {
          throw new Error('localStorage delete failed: ' + err.message);
        }
      },
      async list(prefix, shared) {
        const fullPrefix = (shared ? 'shared:' : 'personal:') + (prefix || '');
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const rawKey = localStorage.key(i);
          if (rawKey && rawKey.indexOf(fullPrefix) === 0) {
            keys.push(rawKey.slice((shared ? 'shared:' : 'personal:').length));
          }
        }
        return { keys, prefix, shared: !!shared };
      },
    };
  })();
}

/* ============================================================
   PERSISTENT STORAGE (window.storage) — sprites & movements
   Parts are plain JSON (color/length/width/an SVG path STRING), so
   unlike the old mesh-deform tool's per-bone textures, nothing here
   needs canvas->dataURL conversion. The only non-serializable field
   is each part's cached Path2D object (built lazily by render.js for
   drawing performance), which is simply excluded and rebuilt on load.
   ============================================================ */
function serializeSprite() {
  const partsOut = {};
  Object.keys(APP.sprite.parts).forEach((boneId) => {
    const p = APP.sprite.parts[boneId];
    partsOut[boneId] = {
      length: p.length, width: p.width, color: p.color,
      isHead: !!p.isHead, svgPath: p.svgPath || null,
      // path2d intentionally omitted -- rebuilt lazily by render.js
    };
  });
  return {
    id: APP.sprite.id || genId(),
    name: APP.sprite.name,
    isBuiltIn: !!APP.sprite.isBuiltIn,
    parts: partsOut,
    bindInfo: APP.sprite.bindInfo,
    savedAt: Date.now(),
  };
}

function deserializeSpriteInto(record) {
  APP.sprite = {
    id: record.id,
    name: record.name,
    isBuiltIn: !!record.isBuiltIn,
    parts: record.parts, // path2d will be rebuilt lazily by render.js
    bindInfo: record.bindInfo,
  };
}

async function saveCurrentSprite() {
  try {
    const record = serializeSprite();
    APP.sprite.id = record.id;
    await window.storage.set('sprite:' + record.id, JSON.stringify(record), false);
    await updateIndex('sprite-index', record.id, record.name);
    setStatus(`Sprite "${record.name}" saved.`, 'success');
    refreshTabs();
  } catch (err) {
    setStatus('Could not save sprite: ' + err.message, 'error');
  }
}

async function saveCurrentMovement() {
  try {
    if (APP.currentMovement.frames.length === 0) {
      setStatus('Add at least one frame before saving.', 'error');
      return;
    }
    const id = APP.currentMovement.id || genId();
    APP.currentMovement.id = id;
    const record = { id, name: APP.currentMovement.name, frames: APP.currentMovement.frames, savedAt: Date.now() };
    await window.storage.set('movement:' + id, JSON.stringify(record), false);
    await updateIndex('movement-index', id, record.name);
    setStatus(`Movement "${record.name}" saved. Reusable on any rigged sprite.`, 'success');
  } catch (err) {
    setStatus('Could not save movement: ' + err.message, 'error');
  }
}

async function updateIndex(key, id, name) {
  let list = [];
  try {
    const existing = await window.storage.get(key, false);
    if (existing) list = JSON.parse(existing.value);
  } catch (e) { /* key doesn't exist yet */ }
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list[idx] = { id, name }; else list.push({ id, name });
  await window.storage.set(key, JSON.stringify(list), false);
}

async function refreshLibrary() {
  try {
    const spriteIdx = await safeGet('sprite-index');
    const movementIdx = await safeGet('movement-index');
    const spriteList = spriteIdx ? JSON.parse(spriteIdx) : [];
    const movementList = movementIdx ? JSON.parse(movementIdx) : [];

    APP.librarySprites = [];
    for (const entry of spriteList) {
      const raw = await safeGet('sprite:' + entry.id);
      if (raw) APP.librarySprites.push(JSON.parse(raw));
    }
    APP.libraryMovements = [];
    for (const entry of movementList) {
      const raw = await safeGet('movement:' + entry.id);
      if (raw) APP.libraryMovements.push(JSON.parse(raw));
    }
    renderSidebar();
    renderLibraryGrid();
    setStatus(`Loaded ${APP.librarySprites.length} sprite(s) and ${APP.libraryMovements.length} movement(s).`, null);
  } catch (err) {
    setStatus('Could not load library: ' + err.message, 'error');
  }
}

async function safeGet(key) {
  try {
    const r = await window.storage.get(key, false);
    return r ? r.value : null;
  } catch (e) {
    return null;
  }
}

function renderLibraryGrid() {
  const wrap = document.getElementById('stageCanvas').parentElement;
  let grid = document.getElementById('libraryGridOverlay');
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'libraryGridOverlay';
    grid.style.position = 'absolute';
    grid.style.inset = '0';
    grid.style.overflow = 'auto';
    grid.style.background = 'var(--bg)';
    wrap.style.position = 'relative';
    wrap.appendChild(grid);
  }
  grid.style.display = APP.mode === 'library' ? 'block' : 'none';
  if (APP.mode !== 'library') return;

  if (APP.librarySprites.length === 0 && APP.libraryMovements.length === 0) {
    grid.innerHTML = `<div class="library-empty">No saved sprites or movements yet. Save your posed stickman and a movement to see them here.</div>`;
    return;
  }

  const spriteCards = APP.librarySprites.map((s) => `
    <div class="library-card ${s.id === APP.librarySelectedSpriteId ? 'selected' : ''}" data-sprite-id="${s.id}">
      <div class="thumb">${renderSpriteThumbSvg(s)}</div>
      <div class="meta"><div class="name">${escapeHtml(s.name)}</div><div class="sub">Sprite</div></div>
    </div>
  `).join('');
  const movementCards = APP.libraryMovements.map((m) => `
    <div class="library-card ${m.id === APP.librarySelectedMovementId ? 'selected' : ''}" data-movement-id="${m.id}">
      <div class="thumb" style="display:flex;align-items:center;justify-content:center;font-size:28px;">🎞️</div>
      <div class="meta"><div class="name">${escapeHtml(m.name)}</div><div class="sub">${m.frames.length} frame(s)</div></div>
    </div>
  `).join('');

  grid.innerHTML = `
    <div style="padding:14px 16px 0;"><h3 style="margin:0 0 4px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em;">Sprites</h3></div>
    <div class="library-grid">${spriteCards || '<p class="library-empty">No sprites saved yet.</p>'}</div>
    <div style="padding:0 16px;"><h3 style="margin:0 0 4px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.07em;">Movements</h3></div>
    <div class="library-grid">${movementCards || '<p class="library-empty">No movements saved yet.</p>'}</div>
  `;

  grid.querySelectorAll('[data-sprite-id]').forEach((card) => {
    card.addEventListener('click', () => {
      APP.librarySelectedSpriteId = card.getAttribute('data-sprite-id');
      renderLibraryGrid();
      renderSidebar();
    });
  });
  grid.querySelectorAll('[data-movement-id]').forEach((card) => {
    card.addEventListener('click', () => {
      APP.librarySelectedMovementId = card.getAttribute('data-movement-id');
      renderLibraryGrid();
      renderSidebar();
    });
  });
}

// A tiny static SVG preview of a saved sprite (bind pose, simplified),
// just for the library thumbnail -- not the full posed render.
function renderSpriteThumbSvg(spriteRecord) {
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;">🧍</div>`;
}

function drawLibraryPreview() {
  // The library uses an HTML overlay grid rather than canvas drawing;
  // nothing to render on the SCTX canvas itself in this mode.
}

function loadSelectedCombination() {
  const spriteRecord = APP.librarySprites.find((s) => s.id === APP.librarySelectedSpriteId);
  const movementRecord = APP.libraryMovements.find((m) => m.id === APP.librarySelectedMovementId);
  if (!spriteRecord || !movementRecord) return;

  deserializeSpriteInto(spriteRecord);
  APP.currentMovement = { id: movementRecord.id, name: movementRecord.name, frames: JSON.parse(JSON.stringify(movementRecord.frames)) };
  APP.currentFrameIndex = 0;
  setMode('pose');
  setStatus(`Loaded "${spriteRecord.name}" with movement "${movementRecord.name}".`, 'success');
}
