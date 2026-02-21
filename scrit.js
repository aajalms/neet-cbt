/* =========================
   NEET PG CBT - script.js
   Works with questions.js:
   const questions = [
     { q:"", options:["A","B","C","D"], correct:2, image:"images/x.jpg" }
   ];
========================= */

// --------- Settings ----------
const MARKS_CORRECT = 4;
const NEGATIVE_MARKS = 1;          // Negative marking ON (-1)
const TEST_DURATION_SEC = 210 * 60; // 3h30m as per your screenshot (209:59)
// const TEST_DURATION_SEC = 180 * 60; // use this for 3 hours

// --------- Basic guards ----------
if (!window.questions || !Array.isArray(window.questions)) {
  alert("❌ questions.js NOT loaded.\n\nFix:\n1) index.html must have <script src='questions.js'></script> BEFORE script.js\n2) filename must be exactly questions.js\n3) Clear cache / change ?v=999");
  throw new Error("questions.js not loaded");
}

// --------- State ----------
let currentIndex = 0;
let violations = 0;
let timeLeft = load("timeLeft", TEST_DURATION_SEC);
let startedAt = load("startedAt", Date.now());

// Track per question:
// status: "unseen" | "seen" | "answered" | "review"
// selected: 0..3 or null
let state = load("cbtState", null);
if (!state || state.length !== questions.length) {
  state = questions.map(() => ({ status: "unseen", selected: null }));
  save("cbtState", state);
}

// --------- DOM ----------
const qno = document.getElementById("qno");
const qtext = document.getElementById("qtext");
const optionsDiv = document.getElementById("options");
const qimg = document.getElementById("qimg");

const palGrid = document.getElementById("palGrid");

const timerEl = document.getElementById("timer");
const violEl = document.getElementById("violations");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");
const reviewBtn = document.getElementById("reviewBtn");
const submitBtn = document.getElementById("submitBtn");

const watermark = document.getElementById("watermark");

// modal
const imgModal = document.getElementById("imgModal");
const imgModalPic = document.getElementById("imgModalPic");
const imgClose = document.getElementById("imgClose");

// --------- Watermark with student name ----------
const studentName =
  localStorage.getItem("studentName") ||
  localStorage.getItem("candidateName") ||
  "STUDENT";

watermark.textContent = `${studentName}\nNEET PG CBT`;

// --------- Prevent right-click (basic) ----------
document.addEventListener("contextmenu", (e) => e.preventDefault());

// --------- “Violation” example: tab switch detection ----------
document.addEventListener("visibilitychange", () => {
  if (document.hidden) addViolation("Tab switched");
});

function addViolation(reason) {
  violations += 1;
  violEl.textContent = String(violations);
  save("violations", violations);

  // Optional: auto-submit after X violations
  const MAX_VIOLATIONS = 5;
  if (violations >= MAX_VIOLATIONS) {
    alert("⚠️ Too many violations. Auto-submitting.");
    submitTest();
  }
}

// Load saved violations if any
violations = load("violations", 0);
violEl.textContent = String(violations);

// --------- Timer ----------
function tick() {
  timeLeft -= 1;
  if (timeLeft < 0) timeLeft = 0;
  save("timeLeft", timeLeft);

  timerEl.textContent = formatTime(timeLeft);

  if (timeLeft === 0) {
    alert("⏰ Time up! Submitting now.");
    submitTest();
  }
}
timerEl.textContent = formatTime(timeLeft);
setInterval(tick, 1000);

// --------- Render ----------
buildPalette();
renderQuestion(currentIndex);

prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
nextBtn.addEventListener("click", () => goTo(currentIndex + 1));

clearBtn.addEventListener("click", () => {
  state[currentIndex].selected = null;
  // if it was answered, revert to seen unless review
  if (state[currentIndex].status === "answered") state[currentIndex].status = "seen";
  save("cbtState", state);
  buildPalette();
  renderQuestion(currentIndex);
});

reviewBtn.addEventListener("click", () => {
  // Toggle review
  const st = state[currentIndex];
  if (st.status === "review") {
    st.status = st.selected !== null ? "answered" : "seen";
  } else {
    st.status = "review";
  }
  save("cbtState", state);
  buildPalette();
  renderQuestion(currentIndex);
});

submitBtn.addEventListener("click", () => {
  const ok = confirm("Submit test now?");
  if (ok) submitTest();
});

// --------- Image viewer ----------
function openImageViewer(src) {
  imgModalPic.src = src;
  imgModal.style.display = "block";
  document.body.style.overflow = "hidden";
}
function closeImageViewer() {
  imgModal.style.display = "none";
  imgModalPic.src = "";
  document.body.style.overflow = "";
}
imgClose.addEventListener("click", closeImageViewer);
imgModal.addEventListener("click", (e) => { if (e.target === imgModal) closeImageViewer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeImageViewer(); });

// --------- Functions ----------
function renderQuestion(i) {
  currentIndex = clamp(i, 0, questions.length - 1);

  const q = questions[currentIndex];
  const st = state[currentIndex];

  // mark seen if unseen
  if (st.status === "unseen") st.status = "seen";
  save("cbtState", state);

  qno.textContent = `Question ${currentIndex + 1}.`;
  qtext.textContent = q.q;

  // Image
  if (q.image && String(q.image).trim() !== "") {
    qimg.style.display = "block";
    qimg.src = q.image;
    qimg.onclick = () => openImageViewer(q.image);
  } else {
    qimg.style.display = "none";
    qimg.src = "";
    qimg.onclick = null;
  }

  // Options
  optionsDiv.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const id = `opt_${currentIndex}_${idx}`;
    const label = document.createElement("label");
    label.setAttribute("for", id);

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "option";
    radio.id = id;
    radio.checked = st.selected === idx;

    radio.addEventListener("change", () => {
      st.selected = idx;
      // if review, keep review color, else answered
      if (st.status !== "review") st.status = "answered";
      save("cbtState", state);
      buildPalette();
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(opt));
    optionsDiv.appendChild(label);
  });

  buildPalette();
}

function buildPalette() {
  palGrid.innerHTML = "";

  state.forEach((st, idx) => {
    const btn = document.createElement("button");
    btn.textContent = String(idx + 1);

    // base class
    if (st.status === "unseen") btn.className = "pal-unseen";
    if (st.status === "seen") btn.className = "pal-seen";
    if (st.status === "answered") btn.className = "pal-answered";
    if (st.status === "review") btn.className = "pal-review";

    // current outline
    if (idx === currentIndex) btn.classList.add("pal-current");

    btn.addEventListener("click", () => renderQuestion(idx));
    palGrid.appendChild(btn);
  });
}

function goTo(i) {
  if (i < 0 || i >= questions.length) return;
  renderQuestion(i);
}

function submitTest() {
  // Calculate score
  let correct = 0, wrong = 0, unattempted = 0;

  state.forEach((st, idx) => {
    const sel = st.selected;
    if (sel === null || sel === undefined) {
      unattempted += 1;
      return;
    }
    if (sel === questions[idx].correct) correct += 1;
    else wrong += 1;
  });

  const score = (correct * MARKS_CORRECT) - (wrong * NEGATIVE_MARKS);
  const total = questions.length * MARKS_CORRECT;

  const result = {
    studentName,
    correct,
    wrong,
    unattempted,
    score,
    total,
    negativeMarking: true,
    durationSec: TEST_DURATION_SEC,
    timeLeft,
    submittedAt: new Date().toISOString(),
    answers: state.map((s) => s.selected),
  };

  save("result", result);

  // Clear test runtime items if you want fresh attempt next time:
  // localStorage.removeItem("cbtState");
  // localStorage.removeItem("timeLeft");
  // localStorage.removeItem("violations");

  alert(
    `✅ Submitted!\n\nCorrect: ${correct}\nWrong: ${wrong}\nUnattempted: ${unattempted}\n\nScore: ${score} / ${total}\n(-${NEGATIVE_MARKS} negative ON)`
  );

  // Redirect to result page if you have one:
  // window.location.href = "result.html";
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
