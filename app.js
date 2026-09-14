(() => {
  "use strict";

  // ALTERE ESTE PIN antes de publicar, se desejar.
  const TEACHER_PIN = "3094";

  const STORAGE_KEY = "pa_numworks_session_v1";
  const MIN_AWAY_MS = 700; // ignora perdas de foco extremamente breves
  const $ = (id) => document.getElementById(id);

  const els = {
    welcomeView: $("welcomeView"),
    sessionView: $("sessionView"),
    startForm: $("startForm"),
    studentName: $("studentName"),
    studentNumber: $("studentNumber"),
    studentClass: $("studentClass"),
    recoverButton: $("recoverButton"),
    studentSummary: $("studentSummary"),
    sessionState: $("sessionState"),
    sessionTimer: $("sessionTimer"),
    fullscreenButton: $("fullscreenButton"),
    restoreFullscreenButton: $("restoreFullscreenButton"),
    fullscreenWarning: $("fullscreenWarning"),
    reportButton: $("reportButton"),
    absenceOverlay: $("absenceOverlay"),
    absenceNumber: $("absenceNumber"),
    absenceDuration: $("absenceDuration"),
    continueButton: $("continueButton"),
    pinOverlay: $("pinOverlay"),
    pinForm: $("pinForm"),
    pinInput: $("pinInput"),
    pinError: $("pinError"),
    cancelPinButton: $("cancelPinButton"),
    reportOverlay: $("reportOverlay"),
    closeReportButton: $("closeReportButton"),
    reportStatus: $("reportStatus"),
    reportName: $("reportName"),
    reportNumber: $("reportNumber"),
    reportClass: $("reportClass"),
    reportStart: $("reportStart"),
    reportDuration: $("reportDuration"),
    reportAbsences: $("reportAbsences"),
    reportAwayTime: $("reportAwayTime"),
    reportReloads: $("reportReloads"),
    eventsTableWrap: $("eventsTableWrap"),
    endSessionButton: $("endSessionButton"),
    clearSessionButton: $("clearSessionButton")
  };

  let session = loadSession();
  let timerId = null;
  let blurTimer = null;
  let suppressTracking = true;
  let teacherOverlayOpen = false;
  let fullscreenExitPending = false;

  function now() { return Date.now(); }

  function newSession(name, number, turma) {
    const t = now();
    return {
      version: 1,
      student: { name, number, turma },
      startedAt: t,
      endedAt: null,
      active: true,
      currentAway: null,
      events: [],
      reloads: 0,
      createdAt: t
    };
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession() {
    if (!session) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Se o armazenamento estiver bloqueado, a aplicação continua a funcionar em memória.
    }
  }

  function clearStoredSession() {
    localStorage.removeItem(STORAGE_KEY);
    session = null;
  }

  function formatClock(ms) {
    if (!ms) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(new Date(ms));
  }

  function formatDateTime(ms) {
    if (!ms) return "—";
    return new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(new Date(ms));
  }

  function formatDuration(ms) {
    ms = Math.max(0, Math.round(ms || 0));
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
    if (m > 0) return `${m} min ${String(s).padStart(2, "0")} s`;
    return `${s} s`;
  }

  function formatTimer(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  }

  function sessionEndTime() {
    return session?.endedAt || now();
  }

  function sessionDuration() {
    if (!session) return 0;
    return Math.max(0, sessionEndTime() - session.startedAt);
  }

  function completedAbsences() {
    return (session?.events || []).filter(e => e.type === "absence");
  }

  function totalAwayMs() {
    let total = completedAbsences().reduce((sum, e) => sum + (e.durationMs || 0), 0);
    if (session?.currentAway?.startedAt) {
      total += Math.max(0, sessionEndTime() - session.currentAway.startedAt);
    }
    return total;
  }

  function renderTimer() {
    if (!session) return;
    els.sessionTimer.textContent = formatTimer(sessionDuration());
  }

  function startTimer() {
    clearInterval(timerId);
    renderTimer();
    timerId = setInterval(renderTimer, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
    renderTimer();
  }

  function setView(inSession) {
    els.welcomeView.classList.toggle("hidden", inSession);
    els.sessionView.classList.toggle("hidden", !inSession);
  }

  function renderStudent() {
    if (!session) return;
    const s = session.student;
    els.studentSummary.textContent = `${s.name} · N.º ${s.number} · ${s.turma}`;
    els.sessionState.textContent = session.active ? "Sessão ativa" : "Sessão terminada";
    els.sessionState.className = `badge ${session.active ? "ok" : "warn"}`;
  }

  function requestFullscreen() {
    const target = document.documentElement;
    if (!document.fullscreenElement && target.requestFullscreen) {
      return target.requestFullscreen().catch(() => {});
    }
    return Promise.resolve();
  }

  function isTrackingAllowed() {
    return !!(session && session.active && !suppressTracking && !teacherOverlayOpen);
  }

  function beginAway(reason) {
    if (!isTrackingAllowed() || session.currentAway) return;
    session.currentAway = {
      startedAt: now(),
      reason
    };
    saveSession();
  }

  function finishAway(trigger = "regresso") {
    if (!session?.currentAway) return null;

    const endedAt = now();
    const current = session.currentAway;
    const durationMs = Math.max(0, endedAt - current.startedAt);
    session.currentAway = null;

    // Ignora apenas eventos mínimos, exceto saídas explícitas do ecrã inteiro.
    if (durationMs < MIN_AWAY_MS && current.reason !== "saida_ecra_inteiro") {
      saveSession();
      return null;
    }

    const event = {
      type: "absence",
      startedAt: current.startedAt,
      endedAt,
      durationMs,
      reason: current.reason,
      returnedBy: trigger
    };
    session.events.push(event);
    saveSession();

    els.absenceNumber.textContent = String(completedAbsences().length);
    els.absenceDuration.textContent = formatDuration(durationMs);
    els.absenceOverlay.classList.remove("hidden");
    return event;
  }

  function reasonLabel(reason) {
    const labels = {
      pagina_oculta: "Página/separador deixou de estar visível",
      perda_foco: "Janela perdeu o foco",
      saida_ecra_inteiro: "Saída do ecrã inteiro",
      pagina_abandonada: "Página fechada/recarregada"
    };
    return labels[reason] || reason || "Ausência";
  }

  function eventLabel(event) {
    if (event.type === "absence") return reasonLabel(event.reason);
    if (event.type === "reload") return "Página recarregada / sessão recuperada";
    if (event.type === "ended") return "Sessão terminada pelo professor";
    return event.type;
  }

  function renderReport() {
    if (!session) return;
    const absences = completedAbsences();
    const away = totalAwayMs();

    els.reportName.textContent = session.student.name;
    els.reportNumber.textContent = session.student.number;
    els.reportClass.textContent = session.student.turma;
    els.reportStart.textContent = formatDateTime(session.startedAt);
    els.reportDuration.textContent = formatDuration(sessionDuration());
    els.reportAbsences.textContent = String(absences.length + (session.currentAway ? 1 : 0));
    els.reportAwayTime.textContent = formatDuration(away);
    els.reportReloads.textContent = String(session.reloads || 0);

    const hasIncidents = absences.length > 0 || (session.reloads || 0) > 0 || !!session.currentAway;
    els.reportStatus.className = `report-status ${hasIncidents ? "alert" : "clean"}`;
    els.reportStatus.textContent = hasIncidents
      ? `⚠ Foram detetadas ${absences.length + (session.currentAway ? 1 : 0)} saída(s) e ${session.reloads || 0} recarregamento(s).`
      : "✓ Nenhuma saída ou recarregamento foi detetado.";

    const rows = [];

    for (const ev of session.events || []) {
      if (ev.type === "absence") {
        rows.push({
          time: `${formatClock(ev.startedAt)} → ${formatClock(ev.endedAt)}`,
          kind: eventLabel(ev),
          duration: formatDuration(ev.durationMs)
        });
      } else if (ev.type === "reload") {
        rows.push({
          time: formatClock(ev.at),
          kind: eventLabel(ev),
          duration: "—"
        });
      } else if (ev.type === "ended") {
        rows.push({
          time: formatClock(ev.at),
          kind: eventLabel(ev),
          duration: "—"
        });
      }
    }

    if (session.currentAway) {
      rows.push({
        time: `${formatClock(session.currentAway.startedAt)} → em curso`,
        kind: reasonLabel(session.currentAway.reason),
        duration: formatDuration(now() - session.currentAway.startedAt)
      });
    }

    if (!rows.length) {
      els.eventsTableWrap.innerHTML = '<div class="empty-events">Sem ocorrências registadas.</div>';
      return;
    }

    const escapeHtml = (value) => String(value)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

    els.eventsTableWrap.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Hora</th><th>Ocorrência</th><th>Duração</th></tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.time)}</td>
                <td>${escapeHtml(r.kind)}</td>
                <td>${escapeHtml(r.duration)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function startSession(student) {
    session = newSession(student.name, student.number, student.turma);
    saveSession();
    setView(true);
    renderStudent();
    startTimer();

    // A chamada a fullscreen resulta de uma ação direta do utilizador (submit/click).
    await requestFullscreen();
    els.fullscreenWarning.classList.toggle("hidden", !!document.fullscreenElement);

    // Pequena janela de tolerância para não registar efeitos da própria transição.
    setTimeout(() => { suppressTracking = false; }, 800);
  }

  function recoverExistingSession() {
    if (!session?.active) return;
    session.reloads = (session.reloads || 0) + 1;
    session.events.push({ type: "reload", at: now() });

    // Se a página anterior marcou uma ausência antes do unload, conclui-a agora.
    if (session.currentAway) {
      const endedAt = now();
      const durationMs = Math.max(0, endedAt - session.currentAway.startedAt);
      session.events.push({
        type: "absence",
        startedAt: session.currentAway.startedAt,
        endedAt,
        durationMs,
        reason: session.currentAway.reason || "pagina_abandonada",
        returnedBy: "recuperacao"
      });
      session.currentAway = null;
    }

    saveSession();
    setView(true);
    renderStudent();
    startTimer();
    els.fullscreenWarning.classList.toggle("hidden", !!document.fullscreenElement);
    setTimeout(() => { suppressTracking = false; }, 800);
  }

  els.startForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const student = {
      name: els.studentName.value.trim(),
      number: els.studentNumber.value.trim(),
      turma: els.studentClass.value.trim()
    };
    if (!student.name || !student.number || !student.turma) return;
    await startSession(student);
  });

  els.recoverButton.addEventListener("click", async () => {
    recoverExistingSession();
    await requestFullscreen();
  });

  els.fullscreenButton.addEventListener("click", requestFullscreen);
  els.restoreFullscreenButton.addEventListener("click", requestFullscreen);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(blurTimer);
      beginAway("pagina_oculta");
    } else if (!teacherOverlayOpen) {
      finishAway("visibilidade");
    }
  });

  window.addEventListener("blur", () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      if (!document.hidden) beginAway("perda_foco");
    }, 180);
  });

  window.addEventListener("focus", () => {
    clearTimeout(blurTimer);
    if (!document.hidden && !teacherOverlayOpen && !fullscreenExitPending) {
      finishAway("foco");
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (!session?.active || suppressTracking || teacherOverlayOpen) return;

    const isFull = !!document.fullscreenElement;
    els.fullscreenWarning.classList.toggle("hidden", isFull);

    if (!isFull) {
      fullscreenExitPending = true;
      beginAway("saida_ecra_inteiro");
    } else {
      fullscreenExitPending = false;
      finishAway("ecra_inteiro");
    }
  });

  // pagehide é mais fiável do que beforeunload para persistir a hora de saída.
  window.addEventListener("pagehide", () => {
    if (!session?.active) return;
    if (!session.currentAway) {
      session.currentAway = { startedAt: now(), reason: "pagina_abandonada" };
      saveSession();
    }
  });

  els.continueButton.addEventListener("click", async () => {
    els.absenceOverlay.classList.add("hidden");
    if (!document.fullscreenElement) await requestFullscreen();
  });

  function openTeacherPin() {
    teacherOverlayOpen = true;
    els.pinInput.value = "";
    els.pinError.classList.add("hidden");
    els.pinOverlay.classList.remove("hidden");
    setTimeout(() => els.pinInput.focus(), 0);
  }

  function closeTeacherPin() {
    els.pinOverlay.classList.add("hidden");
    teacherOverlayOpen = false;
  }

  els.reportButton.addEventListener("click", openTeacherPin);
  els.cancelPinButton.addEventListener("click", closeTeacherPin);

  els.pinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (els.pinInput.value !== TEACHER_PIN) {
      els.pinError.classList.remove("hidden");
      els.pinInput.select();
      return;
    }
    els.pinOverlay.classList.add("hidden");
    renderReport();
    els.endSessionButton.classList.toggle("hidden", !session?.active);
    els.clearSessionButton.classList.toggle("hidden", !!session?.active);
    els.reportOverlay.classList.remove("hidden");
  });

  els.closeReportButton.addEventListener("click", () => {
    els.reportOverlay.classList.add("hidden");
    teacherOverlayOpen = false;
  });

  els.endSessionButton.addEventListener("click", () => {
    if (!session?.active) return;

    // Se havia uma ausência em curso, fecha-a no momento em que o professor termina.
    if (session.currentAway) finishAway("fim_sessao");

    session.active = false;
    session.endedAt = now();
    session.events.push({ type: "ended", at: session.endedAt });
    saveSession();
    stopTimer();
    renderStudent();
    renderReport();
    els.endSessionButton.classList.add("hidden");
    els.clearSessionButton.classList.remove("hidden");
  });

  els.clearSessionButton.addEventListener("click", () => {
    if (!session || session.active) return;
    const ok = confirm("Eliminar definitivamente o relatório local desta sessão e preparar uma nova?");
    if (!ok) return;

    clearStoredSession();
    els.reportOverlay.classList.add("hidden");
    teacherOverlayOpen = false;
    suppressTracking = true;
    stopTimer();
    setView(false);
    els.startForm.reset();
    els.recoverButton.classList.add("hidden");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  });

  // Inicialização
  if (session?.active) {
    els.recoverButton.classList.remove("hidden");
  } else if (session && !session.active) {
    // Uma sessão terminada fica consultável pelo botão de retoma, que abre o ambiente
    // apenas para permitir ao professor aceder ao relatório.
    els.recoverButton.textContent = "Consultar sessão terminada";
    els.recoverButton.classList.remove("hidden");
    els.recoverButton.onclick = () => {
      setView(true);
      renderStudent();
      stopTimer();
      suppressTracking = true;
    };
  }
})();
