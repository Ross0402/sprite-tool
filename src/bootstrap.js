// ============================================================
// bootstrap.js
// Initial load: brings in the built-in stickman immediately (no
// drawing or manual rigging step required) and triggers the first
// render. Must load LAST, after every other script.
// ============================================================
loadBuiltInStickman();
refreshTabs();
renderSidebar();
redrawStage();
renderTimeline();
