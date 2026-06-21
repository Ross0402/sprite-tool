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

    // Sprite sheet export
    FRAME_COUNT: 4,
    FRAME_SIZE: 64,
  };

  // ---- Global state ----
  const STATE = {
    mode: 'BUILD_MODE', // 'BUILD_MODE' | 'ANIMATE_MODE'
    currentMovement: 'walk', // 'walk' | 'run' | 'jump'
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
