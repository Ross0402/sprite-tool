// ============================================================
// rig.js
// Derives bindInfo (bone lengths, shoulder offsets, rest angles) from
// raw joint click positions captured during rigging, plus cutout
// polygon helpers (point-in-polygon, bounds) used when rasterizing
// each bone's texture. Depends on: skeleton.js.
// ============================================================

// ---- rig.js ----
const RIG = (function () {
  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function deriveBindInfo(jointPositions) {
    const boneLength = {};
    const worldRestAngles = {};

    SKELETON.bones.forEach((bone) => {
      const from = jointPositions[bone.fromJoint];
      const to = jointPositions[bone.toJoint];
      if (!from || !to) {
        throw new Error(`rig.deriveBindInfo: missing joint position for bone "${bone.id}"`);
      }
      boneLength[bone.id] = dist(from, to);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      worldRestAngles[bone.id] = (Math.atan2(dx, -dy) * 180) / Math.PI;
    });

    const relRestAngles = {};
    SKELETON.bones.forEach((bone) => {
      const parentWorld = bone.parent ? worldRestAngles[bone.parent] : 0;
      relRestAngles[bone.id] = worldRestAngles[bone.id] - parentWorld;
    });

    const hip = jointPositions.hip;
    const torsoLen = boneLength.torso;
    const torsoWorldAngle = worldRestAngles.torso;

    function projectShoulder(jointName) {
      const p = jointPositions[jointName];
      if (!p) throw new Error(`rig.deriveBindInfo: missing joint position for "${jointName}"`);
      const vx = p.x - hip.x;
      const vy = p.y - hip.y;
      const rad = (torsoWorldAngle * Math.PI) / 180;
      const alongUnit = { x: Math.sin(rad), y: -Math.cos(rad) };
      const perpUnit = { x: Math.sin(rad + Math.PI / 2), y: -Math.cos(rad + Math.PI / 2) };
      const alongDist = vx * alongUnit.x + vy * alongUnit.y;
      const perpDist = vx * perpUnit.x + vy * perpUnit.y;
      return { along: torsoLen !== 0 ? alongDist / torsoLen : 0, perp: perpDist };
    }

    return {
      boneLength,
      shoulderOffset: {
        L_shoulder: projectShoulder('L_shoulder'),
        R_shoulder: projectShoulder('R_shoulder'),
      },
      restAnglesRelative: relRestAngles,
      hipBindPos: { x: hip.x, y: hip.y },
    };
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function polygonBounds(polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygon.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  return { deriveBindInfo, pointInPolygon, polygonBounds };
})();
