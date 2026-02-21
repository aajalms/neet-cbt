// script.js (TOP)
if (typeof questions === "undefined" || !Array.isArray(questions)) {
  alert("ERROR: questions.js not loaded!\n\nCheck:\n1) file name is exactly questions.js\n2) same folder as index.html\n3) committed to GitHub\n4) case-sensitive on GitHub Pages");
  throw new Error("questions.js not loaded");
}

// ===== SETTINGS =====
const TEST_DURATION_SECONDS = 180 * 60; // 3 hours
const STORAGE_KEY = "neet_cbt_state_v1";

// ===== STATE =====
let state = {
  currentIndex: 0,
  timeLeft: TEST_DURATION_SECONDS,
  // per question:
  // visited: boolean
  // marked: boolean
  // selected: number | null
  visited: Array(questions.length).fill(false),
  marked: Array(questions.length).fill(false),
  selected: Array(questions.length).fill(null),
  submitted: false,
};

// ===== LOAD/SAVE =====
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    // basic validation
    if (parsed && parsed.selected && parsed.selected.length === questions.length) {
      state = parsed;
    }
  } catch (e) {}
}

// ===== TIMER =====
let timerHandle = null;
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function startTimer() {
  const timerEl = document.getElementById("timer");
  timerEl.textContent = formatTime(state.timeLeft);

  timerHandle = setInterval(() => {
    if (state.submitted) return;

    state.timeLeft--;
    if (state.timeLeft < 0) {
      state.timeLeft = 0;
      timerEl.textContent = formatTime(0);
      clearInterval(timerHandle);
      submitTest(true);
      return;
    }
    timerEl.textContent = formatTime(state.timeLeft);
    saveState();
  }, 1000);
}

// ===== UI RENDER =====
function getStatus(i) {
  // status logic:
  // Not Visited: !visited
  // Not Answered: visited && selected == null && !marked
  // Marked: marked && selected == null
  // Answered: selected != null && !marked
  // Answered & Marked: selected != null && marked
  if (!state.visited[i]) return "notVisited";
  const sel = state.selected[i];
  const mk = state.marked[i];
  if (sel === null && mk) return "marked";
  if (sel === null && !mk) return "notAnswered";
  if (sel !== null && mk) return "answeredMarked";
  return "answered";
}

function renderPalette() {
  const pal = document.getElementById("palette");
  pal.innerHTML = "";

  for (let i = 0; i < questions.length; i++) {
    const btn = document.createElement("button");
    btn.className = `pbtn ${getStatus(i)} ${i === state.currentIndex ? "current" : ""}`;
    btn.textContent = i + 1;
    btn.onclick = () => {
      goToQuestion(i);
    };
    pal.appendChild(btn);
  }
}

function renderQuestion() {
  const i = state.currentIndex;
  const q = questions[i];

  // mark visited
  state.visited[i] = true;

  document.getElementById("qno").textContent = `Question ${i + 1} of ${questions.length}`;
  document.getElementById("qtext").textContent = q.question;

  const optWrap = document.getElementById("options");
  optWrap.innerHTML = "";

  q.options.forEach((opt, idx) => {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "option";
    radio.value = idx;

    if (state.selected[i] === idx) radio.checked = true;

    radio.onchange = () => {
      state.selected[i] = idx;
      saveState();
      renderPalette();
      renderStatusLine();
    };

    label.appendChild(radio);
    label.appendChild(document.createTextNode(`${String.fromCharCode(65 + idx)}. ${opt}`));
    optWrap.appendChild(label);
  });

  renderPalette();
  renderStatusLine();
  saveState();
}

function renderStatusLine() {
  const el = document.getElementById("statusLine");
  const i = state.currentIndex;

  const mk = state.marked[i] ? "Marked" : "Not Marked";
  const sel = state.selected[i] === null ? "Not Answered" : `Answered (Option ${String.fromCharCode(65 + state.selected[i])})`;
  el.textContent = `${sel} • ${mk}`;
}

function goToQuestion(i) {
  state.currentIndex = i;
  renderQuestion();
}

function nextQuestion() {
  if (state.currentIndex < questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  }
}

function prevQuestion() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    renderQuestion();
  }
}

// ===== ACTIONS =====
function clearResponse() {
  const i = state.currentIndex;
  state.selected[i] = null;
  saveState();
  renderQuestion();
}

function toggleMarkForReview() {
  const i = state.currentIndex;
  state.marked[i] = !state.marked[i];
  saveState();
  renderPalette();
  renderStatusLine();
}

function saveAndNext() {
  // selection already stored on change
  nextQuestion();
}

function computeSummary() {
  let notVisited = 0, notAnswered = 0, answered = 0, marked = 0, answeredMarked = 0;

  for (let i = 0; i < questions.length; i++) {
    const st = getStatus(i);
    if (st === "notVisited") notVisited++;
    else if (st === "notAnswered") notAnswered++;
    else if (st === "answered") answered++;
    else if (st === "marked") marked++;
    else if (st === "answeredMarked") answeredMarked++;
  }
  return { notVisited, notAnswered, answered, marked, answeredMarked };
}

function submitTest(auto = false) {
  if (state.submitted) return;

  const sum = computeSummary();
  const msg =
    `Confirm Submit?\n\n` +
    `Answered: ${sum.answered}\n` +
    `Marked: ${sum.marked}\n` +
    `Answered & Marked: ${sum.answeredMarked}\n` +
    `Not Answered: ${sum.notAnswered}\n` +
    `Not Visited: ${sum.notVisited}\n\n` +
    (auto ? `Time is up. Test will be auto-submitted.` : ``);

  if (!auto) {
    const ok = confirm(msg);
    if (!ok) return;
  }

  // score (no negative as per your message; can be changed)
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    if (state.selected[i] === questions[i].answer) score += 4;
  }

  state.submitted = true;
  saveState();
  clearInterval(timerHandle);

  alert(`Test Submitted!\n\nScore: ${score} / ${questions.length * 4}`);
  // You can redirect to result.html if you have it:
  // window.location.href = "result.html";
}

// ===== INIT =====
function init() {
  loadState();

  document.getElementById("btnPrev").onclick = prevQuestion;
  document.getElementById("btnClear").onclick = clearResponse;
  document.getElementById("btnMark").onclick = toggleMarkForReview;
  document.getElementById("btnSaveNext").onclick = saveAndNext;
  document.getElementById("btnSubmit").onclick = () => submitTest(false);

  // if already submitted, block interactions but allow view
  renderQuestion();
  startTimer();

  // keyboard shortcuts (optional)
  document.addEventListener("keydown", (e) => {
    if (state.submitted) return;
    if (e.key === "ArrowRight") nextQuestion();
    if (e.key === "ArrowLeft") prevQuestion();
  });
}

init();
