// ============================================================
// mesh.js
// Builds a triangulated mesh over a silhouette polygon, assigns each
// vertex skinning weights toward nearby bones (distance-based, top 2
// influencers, normalized), and deforms the mesh given bone transforms.
// Depends on: skeleton.js, fk.js, rig.js (for pointInPolygon).
// ============================================================

const MESH = (function () {
  // ---------------------------------------------------------
  // GRID-BASED TRIANGULATION
  // Lays a regular grid of points over the polygon's bounding box,
  // keeps only points inside the polygon (plus the polygon's own
  // outline points for a clean silhouette edge), and triangulates by
  // splitting each grid cell (2 triangles) when all 4 corners are
  // present. This avoids needing a general Delaunay implementation.
  // ---------------------------------------------------------
  function buildMesh(polygon, spacing) {
    spacing = spacing || 14;
    const bounds = polygonBounds(polygon);

    // Snap grid origin so the silhouette outline points can be matched
    // up cleanly; outline points are added separately and triangulated
    // via boundary fan-triangulation against the nearest interior points.
    const cols = Math.max(1, Math.ceil(bounds.width / spacing));
    const rows = Math.max(1, Math.ceil(bounds.height / spacing));

    // grid[row][col] = vertex index, or -1 if outside the polygon
    const grid = [];
    const vertices = [];

    for (let r = 0; r <= rows; r++) {
      grid.push([]);
      for (let c = 0; c <= cols; c++) {
        const x = bounds.minX + c * spacing;
        const y = bounds.minY + r * spacing;
        if (pointInPolygon({ x, y }, polygon)) {
          grid[r].push(vertices.length);
          vertices.push({ x, y });
        } else {
          grid[r].push(-1);
        }
      }
    }

    // Add the polygon's own outline points as additional vertices, so
    // the mesh's edge matches the traced silhouette exactly instead of
    // a blocky grid boundary.
    const outlineStartIndex = vertices.length;
    polygon.forEach((p) => vertices.push({ x: p.x, y: p.y }));

    // Triangulate grid cells: for each cell with all 4 corners inside,
    // emit 2 triangles.
    const triangles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const cc = grid[r + 1][c];
        const d = grid[r + 1][c + 1];
        if (a >= 0 && b >= 0 && cc >= 0 && d >= 0) {
          triangles.push([a, b, cc]);
          triangles.push([b, d, cc]);
        }
      }
    }

    // Fan-triangulate the outline ring against its centroid-ward nearest
    // interior grid vertex, closing any gap between the blocky interior
    // grid and the traced silhouette edge. For each outline edge (i, i+1),
    // find the single nearest interior vertex and form a triangle — a
    // simple, robust (if not perfectly optimal) boundary stitch.
    const interiorVertices = vertices.slice(0, outlineStartIndex);
    for (let i = 0; i < polygon.length; i++) {
      const p1Idx = outlineStartIndex + i;
      const p2Idx = outlineStartIndex + ((i + 1) % polygon.length);
      const p1 = vertices[p1Idx];
      const p2 = vertices[p2Idx];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      // Find the nearest interior vertex that does NOT produce a
      // degenerate (zero-area) triangle with this outline edge — e.g.
      // a vertex that happens to sit exactly on the same straight line
      // as the edge (common with straight-ish lasso segments, since a
      // regular grid can place points precisely on that line).
      let nearestIdx = -1;
      let nearestDist = Infinity;
      for (let vi = 0; vi < interiorVertices.length; vi++) {
        const v = interiorVertices[vi];
        const area = Math.abs((p2.x - p1.x) * (v.y - p1.y) - (v.x - p1.x) * (p2.y - p1.y)) / 2;
        if (area < 0.01) continue; // degenerate — this vertex is colinear with the edge, skip it
        const d = Math.hypot(v.x - midX, v.y - midY);
        if (d < nearestDist) { nearestDist = d; nearestIdx = vi; }
      }
      if (nearestIdx >= 0) {
        triangles.push([p1Idx, p2Idx, nearestIdx]);
      }
    }

    return { vertices, triangles };
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

  // ---------------------------------------------------------
  // SKINNING WEIGHTS
  // For each vertex, compute distance to each bone's BIND-POSE line
  // segment (fromJoint -> toJoint), keep the closest 2 bones, convert
  // distance to weight via inverse-square falloff, normalize to sum 1.
  // ---------------------------------------------------------
  function distanceToSegment(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * abx, projY = a.y + t * aby;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  function computeSkinWeights(vertices, bindJoints, bones) {
    const EPS = 0.0001;
    return vertices.map((v) => {
      const dists = bones.map((bone) => {
        const a = bindJoints[bone.fromJoint];
        const b = bindJoints[bone.toJoint];
        return { boneId: bone.id, dist: distanceToSegment(v, a, b) };
      });
      dists.sort((x, y) => x.dist - y.dist);
      const top2 = dists.slice(0, 2);
      const weights = top2.map((d) => 1 / (d.dist * d.dist + EPS));
      const sum = weights.reduce((s, w) => s + w, 0);
      return top2.map((d, i) => ({ boneId: d.boneId, weight: weights[i] / sum }));
    });
  }

  // ---------------------------------------------------------
  // DEFORMATION
  // Given bind-pose bone transforms and current-pose bone transforms
  // (from FK.boneTransforms), deform every vertex by blending its
  // per-bone skinned positions according to its weights.
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

  return { buildMesh, computeSkinWeights, deformMesh, pointInPolygon, polygonBounds, distanceToSegment };
})();
