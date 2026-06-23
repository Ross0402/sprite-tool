// ============================================================
// rigging.js
// RIG mode: placing the 13 skeleton joints on the drawing, then
// tracing ONE silhouette lasso around the whole character (replacing
// v1's per-bone cutout lassos), which is triangulated into a mesh and
// skinned to the skeleton. Depends on: app.js, skeleton.js, rig.js,
// mesh.js.
// ============================================================

function rigPointerDown(e) {
  if (APP.mode !== 'rig') return;
  const p = stagePointFromEvent(e);

  if (APP.rigStep === 'joints') {
    const jointName = ALL_JOINTS[APP.rigJointIndex];
    if (!jointName) return;
    APP.sprite.jointPositions[jointName] = p;
    APP.rigJointIndex++;
    if (APP.rigJointIndex >= ALL_JOINTS.length) {
      finishJointPlacement();
    }
    renderSidebar();
    redrawStage();
  } else if (APP.rigStep === 'silhouette') {
    APP.rigCurrentLasso.push(p);
    redrawStage();
  }
  e.preventDefault();
}

function finishJointPlacement() {
  try {
    APP.sprite.bindInfo = RIG.deriveBindInfo(APP.sprite.jointPositions);
    APP.sprite.bindInfo.hipBindPos = APP.sprite.jointPositions.hip;
    APP.rigStep = 'silhouette';
    setStatus('Joints placed. Now trace ONE outline around your whole character.', 'success');
  } catch (err) {
    setStatus('Could not compute the skeleton: ' + err.message, 'error');
  }
}

function undoLastJoint() {
  if (APP.rigStep !== 'joints' || APP.rigJointIndex === 0) return;
  APP.rigJointIndex--;
  delete APP.sprite.jointPositions[ALL_JOINTS[APP.rigJointIndex]];
  renderSidebar();
  redrawStage();
}

function restartRig() {
  APP.rigStep = 'joints';
  APP.rigJointIndex = 0;
  APP.sprite.jointPositions = {};
  APP.sprite.bindInfo = null;
  APP.sprite.silhouette = null;
  APP.sprite.mesh = null;
  APP.rigCurrentLasso = [];
  refreshTabs();
  renderSidebar();
  redrawStage();
}

function undoSilhouettePoint() {
  if (APP.rigCurrentLasso.length > 0) {
    APP.rigCurrentLasso.pop();
    redrawStage();
  }
}

function clearSilhouette() {
  APP.rigCurrentLasso = [];
  redrawStage();
}

function closeSilhouetteAndBuildMesh() {
  if (APP.rigCurrentLasso.length < 3) {
    setStatus('Trace at least 3 points around your character to make an outline.', 'error');
    return;
  }

  const polygon = APP.rigCurrentLasso.slice();

  // Every joint must fall inside (or very near) the silhouette, or the
  // skinning weights will be computed against bone segments outside the
  // mesh entirely, which produces nonsense deformation. Warn but don't
  // hard-block, since a slightly-outside hand/foot tip is common and
  // still produces acceptable results in practice.
  let outsideCount = 0;
  ALL_JOINTS.forEach((j) => {
    const p = APP.sprite.jointPositions[j];
    if (p && !MESH.pointInPolygon(p, polygon)) outsideCount++;
  });

  try {
    const meshGeo = MESH.buildMesh(polygon, 14);
    const skinWeights = MESH.computeSkinWeights(meshGeo.vertices, APP.sprite.jointPositions, SKELETON.bones);
    APP.sprite.silhouette = polygon;
    APP.sprite.mesh = { vertices: meshGeo.vertices, triangles: meshGeo.triangles, skinWeights };
    APP.rigCurrentLasso = [];

    if (outsideCount > 0) {
      setStatus(`Mesh built (${meshGeo.vertices.length} points, ${meshGeo.triangles.length} triangles), but ${outsideCount} joint(s) fall outside your traced outline — those areas may not deform correctly. You can retrace a larger outline from the Rig tab if needed.`, 'error');
    } else {
      setStatus(`Mesh built: ${meshGeo.vertices.length} points, ${meshGeo.triangles.length} triangles. You can now move to Pose.`, 'success');
    }
    refreshTabs();
    renderSidebar();
    redrawStage();
  } catch (err) {
    setStatus('Could not build the mesh: ' + err.message, 'error');
  }
}

function formatBoneName(boneId) {
  return boneId.replace(/_/g, ' ');
}

function bonesById() {
  const map = {};
  SKELETON.bones.forEach((b) => { map[b.id] = b; });
  return map;
}
