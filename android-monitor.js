(() => {
  "use strict";

  const IS_ANDROID = /Android/i.test(navigator.userAgent);
  if (!IS_ANDROID) return;

  const STORAGE_KEY = "pa_numworks_session_v1";
  const MIN_AWAY_MS = 1000;
  let blurTimer = null;

  const loadSession = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveSession = (session) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {}
  };

  const showAbsence = (count, durationMs) => {
    const overlay = document.getElementById("absenceOverlay");
    const number = document.getElementById("absenceNumber");
    const duration = document.getElementById("absenceDuration");
    if (!overlay || !number || !duration) return;

    const totalSec = Math.max(0, Math.floor(durationMs / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;

    number.textContent = String(count);
    duration.textContent = min > 0 ? `${min} min ${sec} s` : `${sec} s`;
    overlay.classList.remove("hidden");
  };

  window.addEventListener("blur", () => {
    clearTimeout(blurTimer);

    blurTimer = setTimeout(() => {
      if (document.hidden) return;

      const frame = document.getElementById("numworksFrame");
      if (frame && document.activeElement === frame) return;
      if (document.hasFocus()) return;

      const session = loadSession();
      if (!session?.active || session.currentAway) return;

      session.currentAway = {
        startedAt: Date.now(),
        reason: "perda_foco_android"
      };
      saveSession(session);
    }, 900);
  });

  window.addEventListener("focus", () => {
    clearTimeout(blurTimer);
    if (document.hidden) return;

    const session = loadSession();
    if (!session?.active || session.currentAway?.reason !== "perda_foco_android") return;

    const endedAt = Date.now();
    const startedAt = session.currentAway.startedAt;
    const durationMs = Math.max(0, endedAt - startedAt);
    session.currentAway = null;

    if (durationMs < MIN_AWAY_MS) {
      saveSession(session);
      return;
    }

    session.events = Array.isArray(session.events) ? session.events : [];
    session.events.push({
      type: "absence",
      startedAt,
      endedAt,
      durationMs,
      reason: "perda_foco_android",
      returnedBy: "foco_android"
    });
    saveSession(session);

    const count = session.events.filter(e => e.type === "absence").length;
    showAbsence(count, durationMs);
  });
})();
