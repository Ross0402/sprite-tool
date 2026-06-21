/* ============================================================
   engine.js
   Skeletal rigging math + the full movement library.
   Exposes window.ENGINE with a pure-ish API: given a torso anchor,
   a movement name, and a frame "time" (radians or 0..1 progress),
   it computes every joint position. exporter.js and input.js both
   call into this so animation logic lives in exactly one place.

   HUMAN-MOTION NOTES (why this doesn't look like raw sine waves):
   - Gait is asymmetric: a fast "swing" phase and a slower "stance"
     phase, not a smooth sine in/out. We use an eased swing curve
     instead of a plain sin().
   - Shoulders counter-rotate against hips (contrapposto) — when
     the right leg swings forward, the right arm swings back.
   - The torso leads slightly and the head lags/stabilizes, instead
     of every joint hitting its peak at the exact same instant.
   - One-shot moves (punch/kick/wave/clap) use eased anticipation →
     strike → recover phases rather than a linear or sine blend,
     which is what makes a strike feel "snappy" instead of floaty.
   ============================================================ */

(function () {
  const { CONFIG } = window.STICK;

  // ---------------------------------------------------------
  // EASING HELPERS
  // ---------------------------------------------------------
  const Ease = {
    // Smooth accelerate-decelerate, much more organic than linear/sine alone
    inOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    // Fast start, slow finish — good for strikes snapping out
    outQuad(t) {
      return 1 - (1 - t) * (1 - t);
    },
    // Slow start, fast finish — good for anticipation / wind-up
    inQuad(t) {
      return t * t;
    },
    // Overshoot-and-settle, good for landings / impacts
    outBack(t) {
      const c1 = 1.4;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    clamp01(v) {
      return Math.max(0, Math.min(1, v));
    },
  };

  // List of moves that loop continuously vs play once and return to idle
  const LOOPING_MOVES = ['walk', 'run', 'idle'];
  const ONE_SHOT_MOVES = [
    'jump', 'jab', 'cross', 'haymaker', 'roundhouse-kick', 'front-kick',
    'wave', 'clap',
  ];

  function isOneShot(move) {
    return ONE_SHOT_MOVES.indexOf(move) !== -1;
  }
  function isLooping(move) {
    return LOOPING_MOVES.indexOf(move) !== -1;
  }

  // ---------------------------------------------------------
  // POSE COMPUTATION
  //   torso        - {x, y} hip anchor point
  //   move         - one of the move names above
  //   t            - time value (radians), used for looping moves
  //   progress     - 0..1, used for one-shot moves
  // ---------------------------------------------------------
  function computePose(torso, move, t, progress) {
    switch (move) {
      case 'walk': return walkPose(torso, t);
      case 'run': return runPose(torso, t);
      case 'idle': return idleBreathPose(torso, t);
      case 'jump': return jumpPose(torso, progress != null ? progress : 0);
      case 'jab': return jabPose(torso, progress != null ? progress : 0);
      case 'cross': return crossPose(torso, progress != null ? progress : 0);
      case 'haymaker': return haymakerPose(torso, progress != null ? progress : 0);
      case 'front-kick': return frontKickPose(torso, progress != null ? progress : 0);
      case 'roundhouse-kick': return roundhouseKickPose(torso, progress != null ? progress : 0);
      case 'wave': return wavePose(torso, progress != null ? progress : 0);
      case 'clap': return clapPose(torso, progress != null ? progress : 0);
      default: return idlePose(torso);
    }
  }

  function idlePose(torso) {
    return {
      torsoTop: { x: torso.x, y: torso.y - CONFIG.TORSO_LENGTH },
      torsoBase: { x: torso.x, y: torso.y },
      headCenter: { x: torso.x, y: torso.y - CONFIG.TORSO_LENGTH - CONFIG.HEAD_RADIUS },
      leftArm: armChain(torso, -CONFIG.TORSO_LENGTH, 10, 0),
      rightArm: armChain(torso, -CONFIG.TORSO_LENGTH, -10, 0),
      leftLeg: legChain(torso, 8, 0),
      rightLeg: legChain(torso, -8, 0),
    };
  }

  // ---- IDLE: subtle breathing sway, not a dead-still T-pose ----
  function idleBreathPose(torso, t) {
    const breathe = Math.sin(t * 0.6) * 1.2; // slow chest rise/fall
    const sway = Math.sin(t * 0.35) * 0.8; // gentle weight shift
    const base = { x: torso.x + sway, y: torso.y - breathe * 0.3 };
    const shoulder = { x: base.x, y: base.y - CONFIG.TORSO_LENGTH };

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x + sway * 0.3, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, 8 + breathe, 5),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -8 - breathe, 5),
      leftLeg: legChain(base, 7, 0),
      rightLeg: legChain(base, -7, 0),
    };
  }

  // ---- WALK: realistic gait cycle ----
  // Real walking isn't a symmetric sine wave: each leg has a longer,
  // slower STANCE phase (on the ground, bearing weight) and a shorter,
  // faster SWING phase (moving forward through the air). We build that
  // asymmetric curve with eased segments instead of a raw sin().
  function gaitCurve(phase) {
    // phase: 0..1 across one full step cycle for one leg
    // 0.0-0.6 = stance (slow, leg moves back under body)
    // 0.6-1.0 = swing (fast, leg snaps forward)
    if (phase < 0.6) {
      const p = phase / 0.6;
      return 1 - Ease.inOutCubic(p) * 2; // +1 (forward) -> -1 (back), slow
    } else {
      const p = (phase - 0.6) / 0.4;
      return -1 + Ease.outQuad(p) * 2; // -1 (back) -> +1 (forward), fast
    }
  }

  function walkPose(torso, t) {
    const cyclePos = ((t / (Math.PI * 2)) % 1 + 1) % 1; // 0..1
    const leftPhase = cyclePos;
    const rightPhase = (cyclePos + 0.5) % 1;

    const leftSwing = gaitCurve(leftPhase) * 22; // degrees, medium width
    const rightSwing = gaitCurve(rightPhase) * 22;

    // Torso: settles lower during double-support, rises slightly mid-swing
    // (double bump per cycle, not one smooth sine)
    const torsoBob = (Math.abs(Math.sin(cyclePos * Math.PI * 2)) * 0.8 +
      Math.abs(Math.sin(cyclePos * Math.PI * 2 * 2)) * 0.6);
    const base = { x: torso.x, y: torso.y - torsoBob };

    // Hip sway: weight shifts toward the stance leg
    const hipSway = Math.sin(cyclePos * Math.PI * 2) * 1.2;
    base.x += hipSway;

    // Shoulders counter-rotate against hips (contrapposto): when left leg
    // is forward, right arm swings forward — opposite the matching-side leg.
    const leftArmSwing = -rightSwing * 0.85;
    const rightArmSwing = -leftSwing * 0.85;

    const shoulder = { x: base.x, y: base.y - CONFIG.TORSO_LENGTH };

    // Knees: bend during swing phase only, stay near-straight during stance
    // (a real knee doesn't bend on the back-swing the way it bends on the
    // forward swing — it's the forward/lift phase that flexes the knee)
    const leftKnee = leftPhase >= 0.6 ? Ease.outQuad((leftPhase - 0.6) / 0.4) * 28 : 4;
    const rightKnee = rightPhase >= 0.6 ? Ease.outQuad((rightPhase - 0.6) / 0.4) * 28 : 4;

    // Elbows: gentle natural bend, slightly more during the arm's forward swing
    const leftElbow = 18 + Math.max(0, leftArmSwing) * 0.3;
    const rightElbow = 18 + Math.max(0, rightArmSwing) * 0.3;

    // Head stabilizes against the torso bob (vestibular reflex) instead of
    // rigidly following the shoulder — heads stay level while walking.
    const headStabilize = torsoBob * 0.3;

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS + headStabilize },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, leftArmSwing, leftElbow),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, rightArmSwing, rightElbow),
      leftLeg: legChain(base, leftSwing, leftKnee),
      rightLeg: legChain(base, rightSwing, rightKnee),
    };
  }

  // ---- RUN: sprint gait — same asymmetric principle as walk, but the
  // swing phase dominates (legs spend more time airborne than planted),
  // stride is wider, and the torso leans into the motion.
  function sprintCurve(phase) {
    // Swing phase now takes up MORE of the cycle than stance (0.4 vs 0.6
    // for walking) — this is the real biomechanical difference between
    // a walk and a run, not just "faster sine wave."
    if (phase < 0.35) {
      const p = phase / 0.35;
      return 1 - Ease.inOutCubic(p) * 2;
    } else {
      const p = (phase - 0.35) / 0.65;
      return -1 + Ease.outQuad(p) * 2;
    }
  }

  function runPose(torso, t) {
    const cyclePos = ((t / (Math.PI * 2)) % 1 + 1) % 1;
    const leftPhase = cyclePos;
    const rightPhase = (cyclePos + 0.5) % 1;

    const leftSwing = sprintCurve(leftPhase) * 42;
    const rightSwing = sprintCurve(rightPhase) * 42;

    // Torso: forward lean plus a real vertical bounce from the flight phase
    const tiltDeg = 12;
    const torsoBob = Math.pow(Math.abs(Math.sin(cyclePos * Math.PI * 2)), 0.6) * 5;
    const base = { x: torso.x, y: torso.y - torsoBob };

    const tiltRad = (tiltDeg * Math.PI) / 180;
    const shoulder = {
      x: base.x + Math.sin(tiltRad) * CONFIG.TORSO_LENGTH,
      y: base.y - Math.cos(tiltRad) * CONFIG.TORSO_LENGTH,
    };

    // Counter-rotating arms drive hard to balance the powerful leg drive
    const leftArmSwing = -rightSwing * 0.95;
    const rightArmSwing = -leftSwing * 0.95;

    // Knees: deep flexion on swing (heel-to-glute), near-straight on stance
    const leftKnee = leftPhase < 0.35
      ? Ease.outBack(Ease.clamp01(leftPhase / 0.35)) * 60
      : 10;
    const rightKnee = rightPhase < 0.35
      ? Ease.outBack(Ease.clamp01(rightPhase / 0.35)) * 60
      : 10;

    // Elbows: locked tighter than a walk, sprinters pump with bent arms
    const elbowFixed = 85;

    const headStabilize = torsoBob * 0.25;

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: {
        x: shoulder.x + Math.sin(tiltRad) * CONFIG.HEAD_RADIUS,
        y: shoulder.y - Math.cos(tiltRad) * CONFIG.HEAD_RADIUS + headStabilize,
      },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, leftArmSwing, elbowFixed, tiltDeg),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, rightArmSwing, elbowFixed, tiltDeg),
      leftLeg: legChain(base, leftSwing, leftKnee),
      rightLeg: legChain(base, rightSwing, rightKnee),
    };
  }

  // Pivots the shoulder around the hip at the fixed torso length, given a
  // lean angle in degrees (0 = upright, positive = leaning toward +x).
  // This keeps the torso bone rigid instead of letting ad-hoc x-offsets
  // stretch it into a diagonal line longer than TORSO_LENGTH.
  function leanShoulder(base, leanDeg) {
    const rad = (leanDeg * Math.PI) / 180;
    return {
      x: base.x + Math.sin(rad) * CONFIG.TORSO_LENGTH,
      y: base.y - Math.cos(rad) * CONFIG.TORSO_LENGTH,
    };
  }

  // ---- JUMP: crouch-anticipate -> launch -> airborne tuck -> land-absorb.
  // progress: 0 = crouch start, ~0.25 = launch, 0.5 = peak, 1 = landed.
  function jumpPose(torso, progress) {
    const p = Ease.clamp01(progress);
    let torsoLift, knee, armOut, elbowFlair;

    if (p < 0.2) {
      // Anticipation: crouch down before leaving the ground
      const cp = Ease.inQuad(p / 0.2);
      torsoLift = -cp * 6; // dips down (negative lift)
      knee = cp * 35;
      armOut = 10;
      elbowFlair = 15;
    } else if (p < 0.8) {
      // Airborne: eased parabola, knees tuck at the peak
      const ap = (p - 0.2) / 0.6;
      torsoLift = Math.sin(ap * Math.PI) * 32;
      const peakFactor = 1 - Math.abs(ap - 0.5) / 0.5;
      knee = Math.max(0, peakFactor) * 65;
      const fallingPhase = ap > 0.5 ? (ap - 0.5) / 0.5 : 0;
      armOut = 15 + fallingPhase * 12;
      elbowFlair = 20 + fallingPhase * 25;
    } else {
      // Landing: absorb impact with a deep knee bend that eases out
      const lp = (p - 0.8) / 0.2;
      torsoLift = (1 - Ease.outBack(lp)) * 4;
      knee = (1 - Ease.outQuad(lp)) * 55;
      armOut = (1 - lp) * 25;
      elbowFlair = (1 - lp) * 40;
    }

    const base = { x: torso.x, y: torso.y - torsoLift };
    const shoulder = { x: base.x, y: base.y - CONFIG.TORSO_LENGTH };

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, armOut, elbowFlair),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -armOut, elbowFlair),
      leftLeg: legChain(base, 4, knee),
      rightLeg: legChain(base, -4, knee),
    };
  }

  // ===========================================================
  // STRIKES — each follows the same animation-principle shape:
  // wind-up (anticipation, slow) -> strike (fast, eased out) ->
  // recover (settle back to guard). This wind-up/strike/recover
  // pattern is what separates a believable hit from a linear swing.
  // ===========================================================

  function guardPose(base, tiltDeg) {
    // Boxing guard: elbows in, fists up near the chin
    return {
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, 25, 70, tiltDeg),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -25, 70, tiltDeg),
    };
  }

  // ---- JAB: fast, straight lead-hand punch, minimal body rotation ----
  function jabPose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };
    let punchExtend, twist;

    if (p < 0.15) {
      // tiny wind-up
      punchExtend = -Ease.inQuad(p / 0.15) * 8;
      twist = 0;
    } else if (p < 0.45) {
      // snap straight out — fast
      const sp = Ease.outQuad((p - 0.15) / 0.3);
      punchExtend = -8 + sp * 98;
      twist = sp * 6;
    } else {
      // recover to guard
      const rp = Ease.inOutCubic((p - 0.45) / 0.55);
      punchExtend = 90 - rp * 90;
      twist = 6 - rp * 6;
    }

    const shoulder = leanShoulder(base, twist);
    const guard = guardPose(base, twist);

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, 25 - punchExtend * 0.15, Math.max(5, 70 - punchExtend * 0.75), twist),
      rightArm: guard.rightArm,
      leftLeg: legChain(base, 8, 0),
      rightLeg: legChain(base, -8, 0),
    };
  }

  // ---- CROSS: rear-hand power punch with hip/shoulder rotation ----
  function crossPose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };
    let punchExtend, rotate, hipDrive;

    if (p < 0.2) {
      // wind-up: rotate rear hip/shoulder back, load weight on back leg
      const wp = Ease.inQuad(p / 0.2);
      punchExtend = -wp * 10;
      rotate = -wp * 12;
      hipDrive = -wp * 6;
    } else if (p < 0.5) {
      // drive through: hips rotate first, fist snaps out behind it
      const sp = Ease.outQuad((p - 0.2) / 0.3);
      punchExtend = -10 + sp * 105;
      rotate = -12 + sp * 30;
      hipDrive = -6 + sp * 10;
    } else {
      const rp = Ease.inOutCubic((p - 0.5) / 0.5);
      punchExtend = 95 - rp * 95;
      rotate = 18 - rp * 18;
      hipDrive = 4 - rp * 4;
    }

    const hipBase = { x: base.x + hipDrive * 0.3, y: base.y };
    const leanDeg = rotate * 0.25 + hipDrive * 0.2;
    const shoulder = leanShoulder(hipBase, leanDeg);
    const guard = guardPose(hipBase, leanDeg);

    return {
      torsoTop: shoulder,
      torsoBase: hipBase,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: guard.leftArm,
      rightArm: armChain(hipBase, -CONFIG.TORSO_LENGTH, -25 + punchExtend * 0.15, Math.max(5, 70 - punchExtend * 0.75), leanDeg),
      leftLeg: legChain(hipBase, 8 - hipDrive * 0.5, 0),
      rightLeg: legChain(hipBase, -8 + hipDrive * 0.5, 0),
    };
  }

  // ---- HAYMAKER: big looping overhand power punch ----
  function haymakerPose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };
    let windAngle, rotate, dip;

    if (p < 0.35) {
      // exaggerated wind-up: arm cocks back wide, body coils and dips
      const wp = Ease.inOutCubic(p / 0.35);
      windAngle = -wp * 70;
      rotate = -wp * 20;
      dip = wp * 4;
    } else if (p < 0.6) {
      // wide looping arc swings through — fast
      const sp = Ease.outQuad((p - 0.35) / 0.25);
      windAngle = -70 + sp * 150;
      rotate = -20 + sp * 35;
      dip = 4 - sp * 4;
    } else {
      const rp = Ease.inOutCubic((p - 0.6) / 0.4);
      windAngle = 80 - rp * 55; // settle back toward guard-ish, not fully reset
      rotate = 15 - rp * 15;
      dip = 0;
    }

    const base2 = { x: base.x, y: base.y + dip };
    const leanDeg = rotate * 0.3;
    const shoulder = leanShoulder(base2, leanDeg);
    const guard = guardPose(base2, leanDeg);

    return {
      torsoTop: shoulder,
      torsoBase: base2,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: guard.leftArm,
      rightArm: armChain(base2, -CONFIG.TORSO_LENGTH, -55 + windAngle, 25, leanDeg),
      leftLeg: legChain(base2, 8, dip * 2),
      rightLeg: legChain(base2, -8, dip * 2),
    };
  }

  // ---- FRONT KICK: snap kick straight out, hip drives the leg ----
  function frontKickPose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };
    let kneeLift, extend, leanBack;

    if (p < 0.25) {
      // chamber: lift the knee up first (real kicks chamber before extending)
      const wp = Ease.outQuad(p / 0.25);
      kneeLift = wp * 95;
      extend = 0;
      leanBack = wp * 8;
    } else if (p < 0.55) {
      // snap the shin out straight — fast
      const sp = Ease.outQuad((p - 0.25) / 0.3);
      kneeLift = 95 - sp * 70;
      extend = sp * 60;
      leanBack = 8 + sp * 4;
    } else {
      // re-chamber then drop the leg back down
      const rp = Ease.inOutCubic((p - 0.55) / 0.45);
      kneeLift = 25 + rp * (-25);
      extend = 60 - rp * 60;
      leanBack = 12 - rp * 12;
    }

    const base2 = { x: base.x, y: base.y };
    const leanDeg = -leanBack * 0.9; // negative = leaning back, away from the kick
    const shoulder = leanShoulder(base2, leanDeg);
    const guard = guardPose(base2, leanDeg);

    const kickSwing = Math.max(2, 50 - kneeLift * 0.4) + extend * 0.3;
    const kickKnee = Math.max(0, kneeLift - extend * 1.1);

    return {
      torsoTop: shoulder,
      torsoBase: base2,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base2, -CONFIG.TORSO_LENGTH, 35, 40, leanDeg), // arms out for balance
      rightArm: guard.rightArm,
      leftLeg: legChain(base2, -2, 5), // standing support leg
      rightLeg: legChain(base2, kickSwing, -kickKnee), // kicking leg (negative = straightens forward)
    };
  }

  // ---- ROUNDHOUSE KICK: rotational kick with hip pivot ----
  function roundhouseKickPose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };
    let pivot, kneeLift, sweep;

    if (p < 0.3) {
      // wind-up: pivot on support foot, chamber the kicking knee sideways
      const wp = Ease.inOutCubic(p / 0.3);
      pivot = -wp * 25;
      kneeLift = wp * 80;
      sweep = 0;
    } else if (p < 0.55) {
      // hip rotates through, leg sweeps across in an arc — fast
      const sp = Ease.outQuad((p - 0.3) / 0.25);
      pivot = -25 + sp * 70;
      kneeLift = 80 - sp * 20;
      sweep = sp * 75;
    } else {
      const rp = Ease.inOutCubic((p - 0.55) / 0.45);
      pivot = 45 - rp * 45;
      kneeLift = 60 - rp * 60;
      sweep = 75 - rp * 75;
    }

    const base2 = { x: base.x, y: base.y };
    const leanDeg = pivot * 0.25;
    const shoulder = leanShoulder(base2, leanDeg);

    return {
      torsoTop: shoulder,
      torsoBase: base2,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base2, -CONFIG.TORSO_LENGTH, 30 - pivot * 0.3, 50, leanDeg),
      rightArm: armChain(base2, -CONFIG.TORSO_LENGTH, -30 - pivot * 0.3, 50, leanDeg),
      leftLeg: legChain(base2, pivot * 0.4, 5), // pivoting support leg
      rightLeg: legChain(base2, sweep - kneeLift * 0.3, kneeLift * 0.5), // sweeping leg
    };
  }

  // ===========================================================
  // EMOTES
  // ===========================================================

  // ---- WAVE: friendly hand wave, side-to-side oscillation while raised ----
  function wavePose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };
    let raise;

    if (p < 0.2) {
      raise = Ease.outQuad(p / 0.2);
    } else if (p < 0.85) {
      raise = 1;
    } else {
      raise = 1 - Ease.inOutCubic((p - 0.85) / 0.15);
    }

    // Oscillating wave motion only kicks in once the arm is raised
    const waveOsc = p > 0.2 && p < 0.85 ? Math.sin((p - 0.2) * 26) * 18 : 0;

    const shoulder = { x: base.x, y: base.y - CONFIG.TORSO_LENGTH };

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, 10, 10),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -raise * 150 + waveOsc, -raise * 60),
      leftLeg: legChain(base, 8, 0),
      rightLeg: legChain(base, -8, 0),
    };
  }

  // ---- CLAP: both hands meet in front, repeating, with a small bounce ----
  function clapPose(torso, progress) {
    const p = Ease.clamp01(progress);
    const base = { x: torso.x, y: torso.y };

    // Several claps across the duration, each clap = quick close + open
    const clapOsc = Math.abs(Math.sin(p * Math.PI * 5));
    const armSwing = 35 + clapOsc * 35; // hands swing in toward center
    const bounce = clapOsc * 1.5;

    const base2 = { x: base.x, y: base.y - bounce };
    const shoulder = { x: base2.x, y: base2.y - CONFIG.TORSO_LENGTH };

    return {
      torsoTop: shoulder,
      torsoBase: base2,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base2, -CONFIG.TORSO_LENGTH, armSwing, 75),
      rightArm: armChain(base2, -CONFIG.TORSO_LENGTH, -armSwing, 75),
      leftLeg: legChain(base2, 8, 0),
      rightLeg: legChain(base2, -8, 0),
    };
  }

  // ---------------------------------------------------------
  // JOINT PIVOT MATH
  // Shifts canvas context origins so arms rotate at the shoulder
  // and legs rotate at the hip without ever detaching from torso.
  // ---------------------------------------------------------
  function armChain(base, shoulderOffsetY, swingDeg, elbowDeg, tiltDeg) {
    const shoulder = { x: base.x, y: base.y + shoulderOffsetY };
    const tilt = ((tiltDeg || 0) * Math.PI) / 180;
    const shoulderAngle = tilt + (swingDeg * Math.PI) / 180;

    const elbow = {
      x: shoulder.x + Math.sin(shoulderAngle) * CONFIG.UPPER_ARM_LENGTH,
      y: shoulder.y + Math.cos(shoulderAngle) * CONFIG.UPPER_ARM_LENGTH,
    };

    const elbowBendAngle = shoulderAngle + (elbowDeg * Math.PI) / 180;
    const hand = {
      x: elbow.x + Math.sin(elbowBendAngle) * CONFIG.LOWER_ARM_LENGTH,
      y: elbow.y + Math.cos(elbowBendAngle) * CONFIG.LOWER_ARM_LENGTH,
    };

    return { shoulder, elbow, hand };
  }

  function legChain(base, swingDeg, kneeDeg) {
    const hip = { x: base.x, y: base.y };
    const hipAngle = (swingDeg * Math.PI) / 180;

    const knee = {
      x: hip.x + Math.sin(hipAngle) * CONFIG.UPPER_LEG_LENGTH,
      y: hip.y + Math.cos(hipAngle) * CONFIG.UPPER_LEG_LENGTH,
    };

    // Knee bends backward (negative kneeDeg bends the shin back behind the line)
    const kneeBendAngle = hipAngle - (kneeDeg * Math.PI) / 180;
    const foot = {
      x: knee.x + Math.sin(kneeBendAngle) * CONFIG.LOWER_LEG_LENGTH,
      y: knee.y + Math.cos(kneeBendAngle) * CONFIG.LOWER_LEG_LENGTH,
    };

    return { hip, knee, foot };
  }

  // ---------------------------------------------------------
  // RENDER PIPELINE
  // Hierarchy chain: Back Limbs -> Torso -> Head -> Front Limbs
  // ---------------------------------------------------------
  function drawPose(ctx, pose, opts) {
    opts = opts || {};
    const color = opts.color || '#1a1a1a';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = CONFIG.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Back limbs (right side = "back" relative to camera-left front)
    if (pose.rightArm) drawLimb(ctx, pose.rightArm.shoulder, pose.rightArm.elbow, pose.rightArm.hand);
    if (pose.rightLeg) drawLimb(ctx, pose.rightLeg.hip, pose.rightLeg.knee, pose.rightLeg.foot);

    // 2. Torso
    line(ctx, pose.torsoBase, pose.torsoTop);

    // 3. Head
    if (pose.headCenter) {
      ctx.beginPath();
      ctx.arc(pose.headCenter.x, pose.headCenter.y, CONFIG.HEAD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Front limbs
    if (pose.leftArm) drawLimb(ctx, pose.leftArm.shoulder, pose.leftArm.elbow, pose.leftArm.hand);
    if (pose.leftLeg) drawLimb(ctx, pose.leftLeg.hip, pose.leftLeg.knee, pose.leftLeg.foot);
  }

  function drawLimb(ctx, a, b, c) {
    line(ctx, a, b);
    line(ctx, b, c);
  }

  function line(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // ---------------------------------------------------------
  // BUILD-MODE STATIC RENDER (used while the user is placing parts)
  // ---------------------------------------------------------
  function drawBuildState(ctx) {
    const { BODY } = window.STICK;
    if (!BODY.torso) return;

    const pose = idlePose(BODY.torso);

    ctx.save();
    // Scale the whole figure up around its own anchor point so the fixed
    // 8/24/10px proportions (sized for a 64px export frame) are actually
    // visible on the larger live preview canvas.
    scaleAroundPoint(ctx, BODY.torso, CONFIG.PREVIEW_SCALE);

    ctx.lineWidth = CONFIG.LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle = '#1a1a1a';

    // Torso always drawn once placed
    line(ctx, pose.torsoBase, pose.torsoTop);

    // Anchor dot at hip
    ctx.beginPath();
    ctx.arc(BODY.torso.x, BODY.torso.y, 3, 0, Math.PI * 2);
    ctx.fill();

    if (BODY.head) {
      ctx.beginPath();
      ctx.arc(pose.headCenter.x, pose.headCenter.y, CONFIG.HEAD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (BODY.arms) {
      drawLimb(ctx, pose.leftArm.shoulder, pose.leftArm.elbow, pose.leftArm.hand);
      drawLimb(ctx, pose.rightArm.shoulder, pose.rightArm.elbow, pose.rightArm.hand);
    }

    if (BODY.legs) {
      drawLimb(ctx, pose.leftLeg.hip, pose.leftLeg.knee, pose.leftLeg.foot);
      drawLimb(ctx, pose.rightLeg.hip, pose.rightLeg.knee, pose.rightLeg.foot);
    }

    ctx.restore();
  }

  // Scales the canvas context around an arbitrary point (instead of the
  // default 0,0 origin) so a figure anchored anywhere on the canvas grows
  // outward from its own hip rather than skewing toward the corner.
  function scaleAroundPoint(ctx, point, scale) {
    ctx.translate(point.x, point.y);
    ctx.scale(scale, scale);
    ctx.translate(-point.x, -point.y);
  }

  // Scaled wrapper for the live preview canvas only. The exporter calls
  // drawPose() directly (unscaled) since its frames are already sized
  // for the fixed proportions; the live canvas is much bigger, so it
  // needs the same scaleAroundPoint treatment as drawBuildState.
  function drawPoseScaled(ctx, pose, anchor, scale, opts) {
    ctx.save();
    scaleAroundPoint(ctx, anchor, scale);
    drawPose(ctx, pose, opts);
    ctx.restore();
  }

  window.ENGINE = {
    computePose,
    drawPose,
    drawPoseScaled,
    drawBuildState,
    idlePose,
    isOneShot,
    isLooping,
  };
})();
