/* ============================================================
   input.js
   Wires up the build buttons, canvas clicks (with joint-snapping
   formulas), animation selection buttons, and drives the live
   preview loop on the main canvas.
   ============================================================ */

(function () {
  const { CONFIG, BODY, STATE } = window.STICK;

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  const partButtons = document.querySelectorAll('[data-part]');
  const moveButtons = document.querySelectorAll('[data-move]');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusEl = document.getElementById('status');
  const modeEl = document.getElementById('modeLabel');

  // ---------------------------------------------------------
  // BUILD BUTTON SELECTION: [Head] [Torso] [Arm] [Leg]
  // ---------------------------------------------------------
  partButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (STATE.mode === 'ANIMATE_MODE') return;
      const part = btn.getAttribute('data-part');

      // Torso must exist before any other part can snap
      if (part !== 'torso' && !window.STICK.hasTorso()) {
        setStatus('Place the torso first.');
        return;
      }

      STATE.selectedPart = part;
      partButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // Head/Arm/Leg snap automatically the instant they're selected
      // (per blueprint: "runs automatic joint-snapping formulas to lock
      // those parts perfectly onto the Torso coordinates").
      if (part === 'head') {
        BODY.head = true;
        setStatus('Head snapped to torso.');
        redrawBuild();
      } else if (part === 'arm') {
        BODY.arms = true;
        setStatus('Arms snapped to shoulders.');
        redrawBuild();
      } else if (part === 'leg') {
        BODY.legs = true;
        setStatus('Legs snapped to hips.');
        redrawBuild();
      } else {
        setStatus('Click the canvas to place the torso anchor.');
      }

      checkComplete();
    });
  });

  // ---------------------------------------------------------
  // CANVAS CLICK: only [Torso] selection drops the core body
  // ---------------------------------------------------------
  canvas.addEventListener('click', (e) => {
    if (STATE.mode === 'ANIMATE_MODE') return;
    if (STATE.selectedPart !== 'torso') {
      if (!window.STICK.hasTorso()) {
        setStatus('Select [Torso] first, then click the canvas.');
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Keep the anchor away from edges so the rig has room to animate
    const margin = 60;
    BODY.torso = {
      x: clamp(x, margin, CONFIG.CANVAS_W - margin),
      y: clamp(y, margin, CONFIG.CANVAS_H - margin),
    };

    setStatus('Torso placed. Select Head, Arm, or Leg to snap them on.');
    redrawBuild();
    checkComplete();
  });

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // ---------------------------------------------------------
  // ANIMATION SELECTION: [Walk] [Run] [Jump]
  // ---------------------------------------------------------
  moveButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!window.STICK.isComplete()) {
        setStatus('Finish building the stickman before animating.');
        return;
      }

      const move = btn.getAttribute('data-move');
      STATE.currentMovement = move;
      STATE.mode = 'ANIMATE_MODE';
      STATE.clock = 0;

      moveButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      partButtons.forEach((b) => b.classList.remove('active'));

      modeEl.textContent = 'ANIMATE_MODE';
      setStatus(`Playing: ${move}`);
      startAnimationLoop();
    });
  });

  // ---------------------------------------------------------
  // LIVE ANIMATION LOOP (drives the global clock)
  // ---------------------------------------------------------
  function startAnimationLoop() {
    if (STATE.rafId) cancelAnimationFrame(STATE.rafId);
    STATE.animating = true;

    let jumpStart = null;
    const JUMP_DURATION = 700; // ms for one full jump arc

    function tick(timestamp) {
      if (!STATE.animating) return;

      STATE.clock += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let pose;
      if (STATE.currentMovement === 'jump') {
        if (jumpStart === null) jumpStart = timestamp;
        let progress = (timestamp - jumpStart) / JUMP_DURATION;
        if (progress > 1) {
          jumpStart = timestamp; // loop the jump
          progress = 0;
        }
        pose = window.ENGINE.computePose(BODY.torso, 'jump', 0, progress);
      } else {
        pose = window.ENGINE.computePose(BODY.torso, STATE.currentMovement, STATE.clock);
      }

      window.ENGINE.drawPoseScaled(ctx, pose, BODY.torso, CONFIG.PREVIEW_SCALE);
      STATE.rafId = requestAnimationFrame(tick);
    }

    STATE.rafId = requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------
  // DOWNLOAD + RESET
  // ---------------------------------------------------------
  downloadBtn.addEventListener('click', () => {
    window.EXPORTER.buildSpriteSheet();
  });

  resetBtn.addEventListener('click', () => {
    window.STICK.reset();
    partButtons.forEach((b) => b.classList.remove('active'));
    moveButtons.forEach((b) => b.classList.remove('active'));
    modeEl.textContent = 'BUILD_MODE';
    setStatus('Reset. Select [Torso] and click the canvas to begin.');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------
  function redrawBuild() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.ENGINE.drawBuildState(ctx);
  }

  function checkComplete() {
    if (window.STICK.isComplete()) {
      setStatus('Stickman complete! Choose Walk, Run, or Jump to animate.');
    }
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  // Initial state
  setStatus('Select [Torso], then click the canvas to begin.');
})();
