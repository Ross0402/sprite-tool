/* ============================================================
   engine.js
   Skeletal rigging math + the three movement state rule-sets.
   Exposes window.ENGINE with a pure-ish API: given a torso anchor,
   a movement name, and a frame "time" (angle in radians), it
   computes every joint position. exporter.js and input.js both
   call into this so animation logic lives in exactly one place.
   ============================================================ */

(function () {
  const { CONFIG } = window.STICK;

  // ---------------------------------------------------------
  // POSE COMPUTATION
  // Returns a full pose object describing every joint, given:
  //   torso  - {x, y} hip anchor point
  //   move   - 'walk' | 'run' | 'jump'
  //   t      - time value (radians) driving the cycle
  //   jumpProgress - 0..1, only used when move === 'jump'
  // ---------------------------------------------------------
  function computePose(torso, move, t, jumpProgress) {
    if (move === 'walk') return walkPose(torso, t);
    if (move === 'run') return runPose(torso, t);
    if (move === 'jump') return jumpPose(torso, jumpProgress != null ? jumpProgress : 0);
    return idlePose(torso);
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

  // ---- A. WALK MODE ----
  function walkPose(torso, t) {
    // Torso: gentle, slow up-and-down vertical wave
    const torsoBob = Math.sin(t) * 1.5;
    const base = { x: torso.x, y: torso.y - torsoBob };
    const shoulder = { x: base.x, y: base.y - CONFIG.TORSO_LENGTH };

    // Thighs/biceps: alternating medium-speed, medium-width sine waves
    const legSwing = Math.sin(t) * 25; // degrees, medium width
    const armSwing = Math.sin(t + Math.PI) * 20; // arms opposite legs

    // Knees: bend backward only during back-swing, straight on forward-swing
    const leftLegSwing = legSwing;
    const rightLegSwing = -legSwing;
    const leftKnee = leftLegSwing < 0 ? Math.abs(leftLegSwing) * 0.9 : 0;
    const rightKnee = rightLegSwing < 0 ? Math.abs(rightLegSwing) * 0.9 : 0;

    // Elbows: constant shallow wave between 15° and 45°
    const elbowWave = 30 + Math.sin(t * 2) * 15; // oscillates 15..45

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, armSwing, elbowWave),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -armSwing, elbowWave),
      leftLeg: legChain(base, leftLegSwing, leftKnee),
      rightLeg: legChain(base, rightLegSwing, rightKnee),
    };
  }

  // ---- B. RUN MODE ----
  function runPose(torso, t) {
    // Torso: tilted forward, fast/high bounce
    const tiltDeg = 12;
    const torsoBob = Math.abs(Math.sin(t * 2)) * 4; // fast, high bounce
    const base = { x: torso.x, y: torso.y - torsoBob };
    const tiltRad = (tiltDeg * Math.PI) / 180;
    const shoulder = {
      x: base.x + Math.sin(tiltRad) * CONFIG.TORSO_LENGTH,
      y: base.y - Math.cos(tiltRad) * CONFIG.TORSO_LENGTH,
    };

    // Thighs/biceps: double speed, wider amplitude
    const legSwing = Math.sin(t * 2) * 45;
    const armSwing = Math.sin(t * 2 + Math.PI) * 40;

    // Knees: bend deeply toward chest during forward swing
    const leftLegSwing = legSwing;
    const rightLegSwing = -legSwing;
    const leftKnee = leftLegSwing > 0 ? leftLegSwing * 1.6 : 10;
    const rightKnee = rightLegSwing > 0 ? rightLegSwing * 1.6 : 10;

    // Elbows: locked at sharp 90 degrees
    const elbowFixed = 90;

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: {
        x: shoulder.x + Math.sin(tiltRad) * CONFIG.HEAD_RADIUS,
        y: shoulder.y - Math.cos(tiltRad) * CONFIG.HEAD_RADIUS,
      },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, armSwing, elbowFixed, tiltDeg),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -armSwing, elbowFixed, tiltDeg),
      leftLeg: legChain(base, leftLegSwing, leftKnee),
      rightLeg: legChain(base, rightLegSwing, rightKnee),
    };
  }

  // ---- C. JUMP MODE ----
  // jumpProgress: 0 = takeoff, 0.5 = peak, 1 = landed
  function jumpPose(torso, jumpProgress) {
    // Simulated gravity arc: parabolic vertical displacement
    const arc = Math.sin(jumpProgress * Math.PI); // 0 -> 1 -> 0
    const torsoLift = arc * 30;
    const base = { x: torso.x, y: torso.y - torsoLift };
    const shoulder = { x: base.x, y: base.y - CONFIG.TORSO_LENGTH };

    // Thighs/biceps: straighten out completely as character leaves ground
    const legStraightFactor = Math.min(1, jumpProgress * 4); // straighten fast on takeoff
    const legSwing = 0; // straight down, no swing

    // Knees: tuck tightly at peak; bend deeply on landing to absorb impact
    let knee;
    if (jumpProgress < 0.15) {
      // landing-absorb feel at the very start (treated as previous landing reset)
      knee = 0;
    } else if (jumpProgress >= 0.35 && jumpProgress <= 0.65) {
      // peak tuck
      const peakFactor = 1 - Math.abs(jumpProgress - 0.5) / 0.15;
      knee = Math.max(0, peakFactor) * 70;
    } else if (jumpProgress > 0.85) {
      // landing absorb
      const landFactor = (jumpProgress - 0.85) / 0.15;
      knee = landFactor * 55;
    } else {
      knee = 10 * legStraightFactor;
    }

    // Elbows: flair outward slightly for balance during the fall
    const fallingPhase = jumpProgress > 0.5 ? (jumpProgress - 0.5) / 0.5 : 0;
    const elbowFlair = 20 + fallingPhase * 25;
    const armOut = 15 + fallingPhase * 10;

    return {
      torsoTop: shoulder,
      torsoBase: base,
      headCenter: { x: shoulder.x, y: shoulder.y - CONFIG.HEAD_RADIUS },
      leftArm: armChain(base, -CONFIG.TORSO_LENGTH, armOut, elbowFlair),
      rightArm: armChain(base, -CONFIG.TORSO_LENGTH, -armOut, elbowFlair),
      leftLeg: legChain(base, legSwing + 4, knee),
      rightLeg: legChain(base, legSwing - 4, knee),
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
  };
})();
