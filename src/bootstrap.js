// ============================================================
// bootstrap.js
// Initial render call. Must load LAST, after every other script,
// since it calls functions defined in app.js / ui.js / render.js.
// ============================================================

/* ============================================================
   BOOTSTRAP — initial render on page load. Without this the sidebar,
   tab states, and stage canvas all stay blank until the user's first
   click, since every render function above is only ever invoked from
   inside an event handler.
   ============================================================ */
initDrawCanvasIfNeeded();
refreshTabs();
renderSidebar();
redrawStage();
