/***************
 NEET-PG CBT ENGINE + BASIC PROCTORING + GOOGLE SHEET SUBMIT
 - Marking: +4 correct, -1 wrong, 0 unattempted
 - Palette states: NotVisited, NotAnswered, Answered, MarkedNoAns, AnsweredMarked
 - Proctoring: visibility/tab switch, blur, copy/paste block, back button block,
               fullscreen exit (best-effort), screenshot on violation
 - On submit: stores locally + posts to Google Sheet (Apps Script Web App)
****************/

// ✅ PASTE your Apps Script Web App URL here:
const API_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

// ===== Candidate gate (must be logged in) =====
function safeJsonParse(str){ try { return JSON.parse(str); } catch { return null; } }
function getCandidate(){ return safeJsonParse(localStorage.getItem("neet_candidate") || ""); }
const candidate = getCandidate();
if (!candidate || !candidate.token || !candidate.id) {
  window.location.href = "login.html";
}

// ====== CONFIG ======
const EXAM = {
  durationSec: 3 * 60 * 60,      // 3 hours
  plusMarks: 4,
  minusMarks: 1,
  maxViolations: 3,             // auto-submit after this
  blockBack: true
};

const LS_KEY = "neet_cbt_state_v2"; // bumped version to avoid old broken data

let state = null;

const el = (id) => document.getElementById(id);
function nowMs(){ return Date.now(); }

function initState() {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const parsed = safeJsonParse(saved);
    if (parsed && parsed.questionsHash === QUESTIONS.length && !parsed.submitted) return parsed;
  }

  const startTime = nowMs();
  return {
    questionsHash: QUESTIONS.length,
    startedAt: startTime,
    endsAt: startTime + EXAM.durationSec * 1000,
    currentIndex: 0,
    violations: 0,
    violationShots: [], // {at, dataUrl}
    _enteredFullscreenOnce: false,
    _lastViolationAt: 0, // anti-spam
    q: QUESTIONS.map(() => ({
      visited: false,
      marked: false,
      selectedIndex: null,
      status: "NotVisited"
    })),
    submitted: false,
    result: null
  };
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function remainingSeconds() {
  const remMs = state.endsAt - nowMs();
  return Math.max(0, Math.floor(remMs / 1000));
}

function updateTimerUI() {
  const rem = remainingSeconds();
  el("timeLeft").textContent = formatTime(rem);
  if (rem <= 0 && !state.submitted) submitExam("Time Up");
}

function computeStatus(i) {
  const q = state.q[i];
  if (!q.visited) return "NotVisited";
  const hasAns = q.selectedIndex !== null;
  if (q.marked && hasAns) return "AnsweredMarked";
  if (q.marked && !hasAns) return "MarkedNoAns";
  if (!q.marked && hasAns) return "Answered";
  return "NotAnswered";
}

function refreshStatuses() {
  state.q.forEach((_, i) => state.q[i].status = computeStatus(i));
}

function renderPalette() {
  const grid = el("paletteGrid");
  grid.innerHTML = "";

  for (let i = 0; i < QUESTIONS.length; i++) {
    const b = document.createElement("button");
    b.className = "pal-btn";
    b.textContent = (i + 1);

    const st = state.q[i].status;
    if (st === "NotVisited") b.classList.add("pal-gray");
    if (st === "NotAnswered") b.classList.add("pal-red");
    if (st === "Answered") b.classList.add("pal-green");
    if (st === "AnsweredMarked") b.classList.add("pal-purple");
    if (st === "MarkedNoAns") b.classList.add("pal-orange");
    if (i === state.currentIndex) b.classList.add("pal-current");

    b.addEventListener("click", () => goTo(i));
    grid.appendChild(b);
  }
}

function renderQuestion() {
  const i = state.currentIndex;
  const qObj = QUESTIONS[i];
  const qState = state.q[i];

  qState.visited = true;

  el("qNo").textContent = `Question ${i + 1}`;
  el("questionText").textContent = qObj.text;

  const optionsWrap = el("options");
  optionsWrap.innerHTML = "";

  qObj.options.forEach((opt, idx) => {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "opt";
    radio.value = idx;
    if (qState.selectedIndex === idx) radio.checked = true;

    radio.addEventListener("change", () => {
      qState.selectedIndex = idx;
      refreshStatuses();
      renderPalette();
      saveState();
    });

    const span = document.createElement("div");
    span.className = "optText";
    span.textContent = `${String.fromCharCode(65 + idx)}. ${opt}`;

    label.appendChild(radio);
    label.appendChild(span);
    optionsWrap.appendChild(label);
  });

  refreshStatuses();
  renderPalette();
  saveState();
}

function goTo(i) {
  if (i < 0 || i >= QUESTIONS.length) return;
  state.currentIndex = i;
  renderQuestion();
}

function clearResponse() {
  const qs = state.q[state.currentIndex];
  qs.selectedIndex = null;
  refreshStatuses();
  renderQuestion();
}

function toggleMarkForReview() {
  const qs = state.q[state.currentIndex];
  qs.marked = !qs.marked;
  refreshStatuses();
  renderPalette();
  saveState();
}

function saveAndNext() {
  refreshStatuses();
  saveState();
  if (state.currentIndex < QUESTIONS.length - 1) {
    state.currentIndex++;
    renderQuestion();
  }
}

function prev() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
}

/*************** PROCTORING ***************/
function updateViolationUI() {
  el("violationsCount").textContent = String(state.violations);
}

async function captureScreenshot() {
  try {
    if (typeof html2canvas === "undefined") return;
    const canvas = await html2canvas(document.body, {useCORS:true, logging:false, scale: 1});
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    state.violationShots.push({ at: new Date().toISOString(), dataUrl });
    saveState();
  } catch {
    // Ignore screenshot failure
  }
}

async function addViolation(reason) {
  if (state.submitted) return;

  // anti-spam: avoid multiple counts in 1 second
  const t = nowMs();
  if (t - (state._lastViolationAt || 0) < 900) return;
  state._lastViolationAt = t;

  state.violations += 1;
  updateViolationUI();

  const note = el("proctorNote");
  if (note) note.textContent = `⚠️ Proctoring Alert: ${reason}. Violations: ${state.violations}/${EXAM.maxViolations}`;

  await captureScreenshot();

  saveState();

  if (state.violations >= EXAM.maxViolations) {
    submitExam(`Auto-submitted: ${state.violations} violations`);
  }
}

async function requestFullscreen() {
  const docEl = document.documentElement;
  try {
    if (docEl.requestFullscreen) await docEl.requestFullscreen();
    else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
  } catch {}
}

function isFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function setupProctoring() {
  // Block copy/paste/context menu
  document.addEventListener("contextmenu", (e)=>e.preventDefault());
  document.addEventListener("copy", (e)=>e.preventDefault());
  document.addEventListener("cut", (e)=>e.preventDefault());
  document.addEventListener("paste", (e)=>e.preventDefault());

  // Tab/app switch
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) addViolation("Tab/App switched (visibility)");
  });

  // Blur
  window.addEventListener("blur", () => addViolation("Left exam window (blur)"));

  // Fullscreen exit (best effort)
  setInterval(() => {
    if (state._enteredFullscreenOnce && !isFullscreenActive()) {
      addViolation("Exited fullscreen");
      state._enteredFullscreenOnce = false; // prevent loop spam
      saveState();
    }
  }, 1500);

  // Back button block
  if (EXAM.blockBack) {
    history.pushState(null, "", location.href);
    window.addEventListener("popstate", () => {
      addViolation("Back button pressed");
      history.pushState(null, "", location.href);
    });
  }
}

/*************** SCORING & SUBMIT ***************/
function scoreExam() {
  let correct = 0, wrong = 0, unattempted = 0;

  state.q.forEach((qs, i) => {
    const correctIndex = QUESTIONS[i].correctIndex;
    if (qs.selectedIndex === null) unattempted++;
    else if (qs.selectedIndex === correctIndex) correct++;
    else wrong++;
  });

  const marks = (correct * EXAM.plusMarks) - (wrong * EXAM.minusMarks);
  const total = QUESTIONS.length * EXAM.plusMarks;
  return { correct, wrong, unattempted, marks, total };
}

async function postResultToSheet() {
  try {
    const cand = getCandidate();
    if (!cand) return;

    const payload = {
      action: "submit",
      token: cand.token,
      id: cand.id,
      name: cand.name || "",
      result: state.result,
      userAgent: navigator.userAgent
    };

    await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    // mark upload ok (for result page)
    state._uploaded = true;
    saveState();
  } catch {
    state._uploaded = false;
    saveState();
  }
}

async function submitExam(reason="Submitted") {
  if (state.submitted) return;

  refreshStatuses();
  const result = scoreExam();

  state.submitted = true;
  state.result = {
    reason,
    ...result,
    submittedAt: new Date().toISOString(),
    violations: state.violations
  };

  saveState();

  // Best-effort upload to sheet
  await postResultToSheet();

  window.location.href = "result.html";
}

/*************** UI BIND ***************/
function bindUI() {
  el("btnPrev").addEventListener("click", prev);
  el("btnClear").addEventListener("click", clearResponse);
  el("btnMark").addEventListener("click", toggleMarkForReview);
  el("btnSaveNext").addEventListener("click", saveAndNext);
  el("btnSubmit").addEventListener("click", () => submitExam("Manual Submit"));

  const fsBtn = el("btnFullscreen");
  if (fsBtn) {
    fsBtn.addEventListener("click", async () => {
      await requestFullscreen();
      state._enteredFullscreenOnce = true;
      saveState();
    });
  }
}

/*************** BOOT ***************/
(function boot() {
  if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) {
    alert("QUESTIONS not loaded. Check questions.js script link.");
    return;
  }

  state = initState();
  updateViolationUI();
  bindUI();
  setupProctoring();

  updateTimerUI();
  setInterval(updateTimerUI, 1000);

  goTo(state.currentIndex);
})();
