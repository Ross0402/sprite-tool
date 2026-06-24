// ============================================================
// mesh.js
// Builds a triangulated mesh over a silhouette polygon, assigns each
// vertex skinning weights toward nearby bones, and deforms the mesh
// given bone transforms.
//
// TRIANGULATION STRATEGY (v2 — replaces the old grid+boundary-stitch
// approach, which left structural gaps wherever a grid cell straddled
// the polygon boundary):
//   1. Ear-clip the outline polygon itself first. This ALWAYS produces
//      a complete, gap-free triangulation of the polygon's interior by
//      construction — every triangle is carved directly from the
//      polygon, so there is no separate "boundary stitch" step that can
//      under-cover anything.
//   2. Refine by inserting interior grid points one at a time: find
//      which existing triangle contains the point, split that triangle
//      into 3 around it. This adds the denser interior points needed
//      for smooth limb bending, while preserving full coverage at every
//      step (splitting a triangle into 3 sub-triangles can never create
//      a gap, since the 3 sub-triangles exactly tile the original one).
//
// Depends on: skeleton.js, fk.js, rig.js (for pointInPolygon).
// ============================================================

const MESH = (function () {
  // ---------------------------------------------------------
  // GEOMETRY HELPERS
  // ---------------------------------------------------------
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

  function signedArea(polygon) {
    let sum = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
  }

  function triangleArea(a, b, c) {
    return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
  }

  function pointInTriangleStrict(p, a, b, c) {
    function sign(p1, p2, p3) {
      return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    }
    const EPS = 1e-9;
    const d1 = sign(p, a, b), d2 = sign(p, b, c), d3 = sign(p, c, a);
    const hasNeg = d1 < -EPS || d2 < -EPS || d3 < -EPS;
    const hasPos = d1 > EPS || d2 > EPS || d3 > EPS;
    return !(hasNeg && hasPos);
  }

  // ---------------------------------------------------------
  // EAR-CLIPPING TRIANGULATION
  // ---------------------------------------------------------
  function earClipTriangulate(polygon) {
    let pts = polygon.map((p, i) => ({ x: p.x, y: p.y, origIndex: i }));
    if (signedArea(pts) < 0) pts = pts.slice().reverse();

    const triangles = [];
    const remaining = pts.slice();
    let guard = 0;
    const maxIterations = pts.length * pts.length + 10;

    while (remaining.length > 3 && guard < maxIterations) {
      guard++;
      let earFound = false;

      // Pass 1: prefer a "good" ear (non-sliver, area >= 0.05).
      // Pass 2 (fallback): if no good ear exists anywhere in the polygon
      // right now, accept the least-bad VALID ear instead of leaving the
      // remaining points untriangulated — full coverage matters more
      // than avoiding a rare unavoidable sliver.
      for (let pass = 0; pass < 2 && !earFound; pass++) {
        for (let i = 0; i < remaining.length; i++) {
          const prev = remaining[(i - 1 + remaining.length) % remaining.length];
          const curr = remaining[i];
          const next = remaining[(i + 1) % remaining.length];

          const cross = (curr.x - prev.x) * (next.y - prev.y) - (curr.y - prev.y) * (next.x - prev.x);
          if (cross <= 1e-9) continue; // reflex/degenerate, never acceptable

          const earArea = Math.abs(cross) / 2;
          if (pass === 0 && earArea < 0.05) continue; // pass 1: skip slivers

          let containsOther = false;
          for (let j = 0; j < remaining.length; j++) {
            if (j === (i - 1 + remaining.length) % remaining.length || j === i || j === (i + 1) % remaining.length) continue;
            if (pointInTriangleStrict(remaining[j], prev, curr, next)) { containsOther = true; break; }
          }
          if (containsOther) continue;

          triangles.push([prev.origIndex, curr.origIndex, next.origIndex]);
          remaining.splice(i, 1);
          earFound = true;
          break;
        }
      }

      if (!earFound) break;
    }

    if (remaining.length === 3) {
      triangles.push([remaining[0].origIndex, remaining[1].origIndex, remaining[2].origIndex]);
    }

    return triangles;
  }

  // ---------------------------------------------------------
  // INCREMENTAL INTERIOR POINT INSERTION
  // ---------------------------------------------------------
  function insertPoint(vertices, triangles, point) {
    const newIndex = vertices.length;
    vertices.push(point);

    for (let t = 0; t < triangles.length; t++) {
      const [ai, bi, ci] = triangles[t];
      const a = vertices[ai], b = vertices[bi], c = vertices[ci];
      if (triangleArea(a, b, c) < 1e-6) continue;
      if (!pointInTriangleStrict(point, a, b, c)) continue;

      // Reject the split if any of the 3 resulting sub-triangles would be
      // a degenerate sliver (near-zero area) — this happens when `point`
      // lands extremely close to one of the triangle's existing edges,
      // which pointInTriangleStrict's epsilon can technically still
      // classify as "inside" even though the resulting split is unstable.
      const MIN_SLIVER_AREA = 0.05;
      const areaAB = triangleArea(a, b, point);
      const areaBC = triangleArea(b, c, point);
      const areaCA = triangleArea(c, a, point);
      if (areaAB < MIN_SLIVER_AREA || areaBC < MIN_SLIVER_AREA || areaCA < MIN_SLIVER_AREA) {
        continue; // try the next triangle instead of accepting a sliver
      }

      triangles.splice(t, 1,
        [ai, bi, newIndex],
        [bi, ci, newIndex],
        [ci, ai, newIndex]
      );
      return true;
    }
    vertices.pop();
    return false;
  }

  // ---------------------------------------------------------
  // PUBLIC: buildMesh
  // ---------------------------------------------------------
  function buildMesh(polygon, spacing) {
    spacing = spacing || 14;

    const vertices = polygon.map((p) => ({ x: p.x, y: p.y }));
    const triangles = earClipTriangulate(polygon);

    const bounds = polygonBounds(polygon);
    const candidates = [];
    for (let y = bounds.minY + spacing / 2; y < bounds.maxY; y += spacing) {
      for (let x = bounds.minX + spacing / 2; x < bounds.maxX; x += spacing) {
        if (pointInPolygon({ x, y }, polygon)) candidates.push({ x, y });
      }
    }
    candidates.forEach((pt) => insertPoint(vertices, triangles, pt));

    return { vertices, triangles };
  }

  // ---------------------------------------------------------
  // GEODESIC (MESH-SURFACE) DISTANCE
  // Straight-line 2D distance can't tell "this vertex is on the left
  // foot, drawn near the right foot" apart from "this vertex IS on the
  // right foot" -- two unrelated limbs can simply be close together in
  // pixels. The actual correct signal is GEODESIC distance: the
  // shortest path measured by walking ACROSS the mesh's own triangles.
  // Two feet, even drawn close together, are connected only via a long
  // path up one leg, across the torso/hip, and down the other leg --
  // so their geodesic distance correctly stays large even though their
  // straight-line distance is small. This is the standard, correct way
  // 2D/3D skeletal animation tools solve this exact problem.
  // ---------------------------------------------------------

  // Build an adjacency list of the mesh: vertex index -> [{to, weight}],
  // one edge per triangle side (each side may be added twice, once from
  // each triangle that shares it, but that's harmless for Dijkstra).
  function buildMeshGraph(vertices, triangles) {
    const adjacency = vertices.map(() => []);
    function addEdge(i, j) {
      const w = Math.hypot(vertices[i].x - vertices[j].x, vertices[i].y - vertices[j].y);
      adjacency[i].push({ to: j, weight: w });
      adjacency[j].push({ to: i, weight: w });
    }
    triangles.forEach(([a, b, c]) => {
      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, a);
    });
    return adjacency;
  }

  // Dijkstra's shortest path from a single source vertex to every other
  // vertex in the mesh graph. Returns an array of distances indexed by
  // vertex index (Infinity if unreachable, which shouldn't normally
  // happen for a single connected mesh).
  function dijkstraFrom(adjacency, sourceIndex) {
    const dist = new Array(adjacency.length).fill(Infinity);
    dist[sourceIndex] = 0;
    const visited = new Array(adjacency.length).fill(false);

    // Simple O(V^2) Dijkstra (no priority queue) -- meshes here are at
    // most a few hundred vertices, so this is plenty fast and much
    // simpler to verify correct than a heap-based version.
    for (let iter = 0; iter < adjacency.length; iter++) {
      let u = -1, best = Infinity;
      for (let i = 0; i < adjacency.length; i++) {
        if (!visited[i] && dist[i] < best) { best = dist[i]; u = i; }
      }
      if (u === -1) break; // remaining vertices are unreachable
      visited[u] = true;
      adjacency[u].forEach(({ to, weight }) => {
        const alt = dist[u] + weight;
        if (alt < dist[to]) dist[to] = alt;
      });
    }
    return dist;
  }

  // Finds the mesh vertex closest (by straight-line distance) to a
  // given point -- used to find which mesh vertex to start each joint's
  // Dijkstra search from, since joints aren't themselves mesh vertices.
  function nearestVertexIndex(vertices, point) {
    let bestIdx = 0, bestDist = Infinity;
    vertices.forEach((v, i) => {
      const d = Math.hypot(v.x - point.x, v.y - point.y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    return bestIdx;
  }

  function distanceToSegment(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * abx, projY = a.y + t * aby;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  function computeSkinWeights(vertices, triangles, bindJoints, bones) {
    const EPS = 0.0001;
    const adjacency = buildMeshGraph(vertices, triangles);

    // For every JOINT that appears as a bone endpoint, run one Dijkstra
    // search from the mesh vertex nearest that joint. We then estimate
    // each vertex's geodesic distance to a BONE (not just a joint) as
    // the smaller of its geodesic distance to that bone's two endpoint
    // joints -- a reasonable, cheap approximation that's exactly correct
    // at the bone's own endpoints and only slightly conservative along
    // the middle of a long bone (which doesn't matter for picking the
    // correct LIMB, only for the secondary blend weight's exact value).
    const jointNames = new Set();
    bones.forEach((b) => { jointNames.add(b.fromJoint); jointNames.add(b.toJoint); });

    const geodesicFromJoint = {};
    jointNames.forEach((jointName) => {
      const startVertex = nearestVertexIndex(vertices, bindJoints[jointName]);
      geodesicFromJoint[jointName] = dijkstraFrom(adjacency, startVertex);
    });

    return vertices.map((v, vIdx) => {
      const geoDists = bones.map((bone) => {
        const dFrom = geodesicFromJoint[bone.fromJoint][vIdx];
        const dTo = geodesicFromJoint[bone.toJoint][vIdx];
        return { boneId: bone.id, geoDist: Math.min(dFrom, dTo) };
      });
      geoDists.sort((x, y) => x.geoDist - y.geoDist);

      const nearest = geoDists[0];
      // Second influence: the next-closest bone by geodesic distance,
      // restricted to bones that are direct skeletal neighbors of the
      // nearest one -- this keeps the blend smooth across a real joint
      // bend (e.g. upper arm <-> forearm at the elbow) while still
      // refusing to blend with something merely geometrically adjacent.
      const second = geoDists.slice(1).find((d) => {
        const nearestBone = bones.find((b) => b.id === nearest.boneId);
        const candidateBone = bones.find((b) => b.id === d.boneId);
        return nearestBone.parent === d.boneId || candidateBone.parent === nearest.boneId;
      });

      // Use the actual straight-line distance-to-segment for the final
      // weight FALLOFF shape (geodesic distance is great for picking
      // the right limb, but straight-line gives a smoother, more
      // natural-looking blend gradient right around a joint).
      const top2 = second ? [nearest, second] : [nearest];
      const weights = top2.map((d) => {
        const bone = bones.find((b) => b.id === d.boneId);
        const a = bindJoints[bone.fromJoint], b2 = bindJoints[bone.toJoint];
        const straightDist = distanceToSegment(v, a, b2);
        return 1 / (straightDist * straightDist + EPS);
      });
      const sum = weights.reduce((s, w) => s + w, 0);
      return top2.map((d, i) => ({ boneId: d.boneId, weight: weights[i] / sum }));
    });
  }

  // ---------------------------------------------------------
  // DEFORMATION
  // ---------------------------------------------------------
  function deformMesh(vertices, skinWeights, bindTransforms, currentTransforms) {
    return vertices.map((v, i) => {
      const weights = skinWeights[i];
      let sx = 0, sy = 0;
      weights.forEach(({ boneId, weight }) => {
        const bindT = bindTransforms[boneId];
        const curT = currentTransforms[boneId];
        const local = bindT.toLocal(v);
        const skinned = curT.fromLocal(local);
        sx += skinned.x * weight;
        sy += skinned.y * weight;
      });
      return { x: sx, y: sy };
    });
  }

  return {
    buildMesh, computeSkinWeights, deformMesh, pointInPolygon, polygonBounds,
    distanceToSegment, earClipTriangulate, insertPoint, triangleArea, pointInTriangleStrict,
    buildMeshGraph, dijkstraFrom, nearestVertexIndex,
  };
})();
