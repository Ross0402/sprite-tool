/* ============================================================
   config.js
   Fixed proportions, global state, and the shared data store.
   Every other script reads/writes through window.STICK.
   ============================================================ */

(function () {
  const CONFIG = {
    // ---- Fixed body proportions (px) ----
    HEAD_RADIUS: 8,
    TORSO_LENGTH: 24,
    UPPER_ARM_LENGTH: 8,
    LOWER_ARM_LENGTH: 8,
    UPPER_LEG_LENGTH: 10,
    LOWER_LEG_LENGTH: 10,

    LINE_WIDTH: 3,
    CANVAS_W: 300,
    CANVAS_H: 300,

    // The blueprint's proportions (8px head, 24px torso, etc.) are sized
    // for a 64px export frame. On the larger 300x300 live preview canvas
    // they'd render as a nearly invisible ~40px-tall figure, so the
    // preview is scaled up by this factor. Export still uses the raw,
    // unscaled proportions sized for FRAME_SIZE.
    PREVIEW_SCALE: 4,

    // Sprite sheet export
    FRAME_COUNT: 4, // default for looping cycles (walk/run/idle)
    FRAME_SIZE: 64,
    ONE_SHOT_FRAME_COUNT: 8, // strikes/emotes need more frames to read clearly
    ONE_SHOT_DURATION_MS: 600, // fallback duration for any move not listed below
    MOVE_DURATIONS_MS: {
      jump: 700,
      jab: 350,
      cross: 450,
      haymaker: 650,
      'front-kick': 500,
      'roundhouse-kick': 600,
      wave: 1400,
      clap: 1200,
    },
  };

  // ---- Global state ----
  const STATE = {
    mode: 'BUILD_MODE', // 'BUILD_MODE' | 'ANIMATE_MODE'
    currentMovement: 'walk', // see ENGINE move list: walk/run/idle/jump/jab/cross/haymaker/front-kick/roundhouse-kick/wave/clap
    selectedPart: null, // 'head' | 'torso' | 'arm' | 'leg' | null
    clock: 0, // global animation clock, increments every tick
    animating: false,
    rafId: null,
  };

  // ---- Body data: single source of truth for the rig ----
  // torso is the anchor everything else snaps to.
  const BODY = {
    torso: null, // { x, y } base point (hip), set by clicking canvas with [Torso] selected
    head: false,
    arms: false,
    legs: false,
  };

  window.STICK = {
    CONFIG,
    STATE,
    BODY,

    // Helpers other modules rely on
    hasTorso() {
      return !!BODY.torso;
    },
    isComplete() {
      return BODY.torso && BODY.head && BODY.arms && BODY.legs;
    },
    reset() {
      BODY.torso = null;
      BODY.head = false;
      BODY.arms = false;
      BODY.legs = false;
      STATE.mode = 'BUILD_MODE';
      STATE.animating = false;
      STATE.clock = 0;
      if (STATE.rafId) {
        cancelAnimationFrame(STATE.rafId);
        STATE.rafId = null;
      }
    },
  };
})();
