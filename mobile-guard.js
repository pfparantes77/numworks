(() => {
  "use strict";

  const STORAGE_KEY = "pa_numworks_session_v1";
  const MIN_MS = 700;
  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || window.matchMedia("(pointer: coarse)").matches;

  if (!IS_MOBILE) return;

  let timer = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function save(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {}
  }

  function formatDuration(ms) {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return min > 0 ? `${min} min ${String(rem).padStart(2, "0")} s` : `${rem} s`;
  }

  function startExternalAway() {
    const s = load();
    if (!s?.active || s.currentAway) return;
    s.currentAway = {
      startedAt: Date.now(),
      reason: "perda_foco_sistema"
    };
    save(s);
  }

  function finishExternalAway() {
    const s = load();
    if (!s?.active || s.currentAway?.reason !== "perda_foco_sistema") return;

    const endedAt = Date.now();
    const startedAt = s.currentAway.startedAt;
    const durationMs = Math.max(0, endedAt - startedAt);
    s.currentAway = null;

    if (durationMs < MIN_MS) {
      save(s);
      return;
    }

    s.events = Array.isArray(s.events) ? s.events : [];
    s.events.push({
      type: "absence",
      startedAt,
      endedAt,
      durationMs,
      reason: "perda_foco_sistema",
      returnedBy: "foco_mobile"
    });
    save(s);

    const absences = s.events.filter(e => e.type === "absence").length;
    const numberEl = document.getElementById("absenceNumber");
    const durationEl = document.getElementById("absenceDuration");
    const overlay = document.getElementById("absenceOverlay");

    if (numberEl) numberEl.textContent = String(absences);
    if (durationEl) durationEl.textContent = formatDuration(durationMs);
    if (overlay) overlay.classList.remove("hidden");
  }

  window.addEventListener("blur", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Mudança real de separador/app é tratada pelo visibilitychange do app.js.
      if (document.hidden) return;

      // Se o documento ainda tem foco, foi uma interação interna, incluindo a NumWorks.
      if (document.hasFocus()) return;

      startExternalAway();
    }, 650);
  });

  window.addEventListener("focus", () => {
    clearTimeout(timer);
    if (!document.hidden) finishExternalAway();
  });
})();
