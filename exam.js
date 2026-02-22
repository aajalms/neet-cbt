// exam.js
function safeParse(s){ try { return JSON.parse(s); } catch { return null; } }

// ---- Login guard
const cand = safeParse(localStorage.getItem("neet_candidate") || "");
if(!cand || !cand.token) location.href = "login.html";

// If already submitted
if(localStorage.getItem("neet_submitted") === "yes"){
  location.href = "result.html";
}

// ---- Config
const durationMs = (window.EXAM_DURATION_MIN || 60) * 60 * 1000;
const MARKS_CORRECT = (window.MARKS_CORRECT ?? 4);
const MARKS_WRONG   = (window.MARKS_WRONG ?? -1);

// ---- DOM
const elTime = document.getElementById("timeLeft");
const elVio  = document.getElementById("vio");
const pal    = document.getElementById("pal");
const qTitle = document.getElementById("qTitle");
const qText  = document.getElementById("qText");
const opts   = document.getElementById("opts");

const qImgWrap = document.getElementById("qImgWrap");
const qImg     = document.getElementById("qImg");
const qImgErr  = document.getElementById("qImgErr");

const prevBtn  = document.getElementById("prevBtn");
const nextBtn  = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");
const markBtn  = document.getElementById("markBtn");
const submitBtn= document.getElementById("submitBtn");

// ---- Local storage keys
const KEY = "neet_exam_state";
const ATTEMPT_KEY = "neet_attempt_nonce";

// ===============================
// CBT SHUFFLE ENGINE
// - Different order per candidate
// - Section-wise shuffle
// - Option shuffle (answerIndex auto-updated)
// - Stable during refresh (attempt nonce stored)
// ===============================

// Stable string hash -> uint32
function hashString(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Seeded RNG
function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArraySeeded(arr, rng){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Section mapping (EDIT if you want)
function getSection(q){
  if(q.section) return q.section;

  // Your default grouping
  if(q.id >= 1 && q.id <= 14) return "Radiology";
  if(q.id >= 15 && q.id <= 30) return "OBG";
  if(q.id >= 31 && q.id <= 60) return "FMT";
  return "General";
}

// Fixed section order like real CBT
const SECTION_ORDER = ["Radiology", "OBG", "FMT", "General"];
// Shuffle section order too? (keep false for CBT-like fixed sections)
const SHUFFLE_SECTIONS_TOO = false;

function shuffleOptionsKeepAnswer(q, rng){
  const indexed = (q.options || []).map((text, idx) => ({ text, idx }));
  shuffleArraySeeded(indexed, rng);

  const newOptions = indexed.map(x => x.text);
  const newAnswerIndex = indexed.findIndex(x => x.idx === q.answerIndex);

  return { ...q, options: newOptions, answerIndex: newAnswerIndex };
}

function getAttemptNonce(){
  let nonce = localStorage.getItem(ATTEMPT_KEY);
  if(!nonce){
    nonce = String(Date.now()); // New attempt
    localStorage.setItem(ATTEMPT_KEY, nonce);
  }
  return nonce;
}

function buildShuffledQuestions(originalQuestions, candidate){
  const attemptNonce = getAttemptNonce();

  const baseSeed = hashString(
    String(candidate.candidateId || "") + "|" +
    String(candidate.token || "") + "|" +
    String(attemptNonce)
  );

  const rngMain = mulberry32(baseSeed);

  const bySection = {};
  for(const q of originalQuestions){
    const s = getSection(q);
    if(!bySection[s]) bySection[s] = [];
    bySection[s].push(q);
  }

  let sections = [...SECTION_ORDER];
  for(const s of Object.keys(bySection)){
    if(!sections.includes(s)) sections.push(s);
  }

  if(SHUFFLE_SECTIONS_TOO){
    shuffleArraySeeded(sections, rngMain);
  }

  const finalQs = [];
  for(const sec of sections){
    const arr = bySection[sec];
    if(!arr || !arr.length) continue;

    const secSeed = hashString(sec + "|" + baseSeed);
    const rngSec = mulberry32(secSeed);

    const shuffledSection = shuffleArraySeeded([...arr], rngSec);

    for(const q of shuffledSection){
      const qSeed = hashString(String(q.id) + "|" + baseSeed);
      const rngQ  = mulberry32(qSeed);
      finalQs.push(shuffleOptionsKeepAnswer(q, rngQ));
    }
  }

  return finalQs;
}

// ---- Load questions (SHUFFLED)
const Q = buildShuffledQuestions(window.questions || [], cand);
const totalQ = Q.length;

// ---- State
const defaultState = () => ({
  startedAt: Date.now(),
  current: 0,
  answers: {},     // qid -> optionIndex (after shuffling)
  marked: {},      // qid -> true/false
  violations: 0
});

let state = safeParse(localStorage.getItem(KEY) || "") || defaultState();

// If question list changed and current index out of range
if(state.current < 0) state.current = 0;
if(state.current >= totalQ) state.current = Math.max(0, totalQ - 1);

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function pad2(n){ return String(n).padStart(2,"0"); }

// ---- Timer
function updateTimer(){
  const elapsed = Date.now() - state.startedAt;
  const left = Math.max(0, durationMs - elapsed);
  const mm = Math.floor(left/60000);
  const ss = Math.floor((left%60000)/1000);
  elTime.textContent = `${pad2(mm)}:${pad2(ss)}`;
  if(left <= 0){
    submitExam(true);
  }
}

// ---- Palette rules
function palClass(qid){
  const a = state.answers[qid];
  const m = !!state.marked[qid];
  if(a === undefined && !m) return "pbtn unanswered";
  if(a !== undefined && !m) return "pbtn answered";
  if(a === undefined && m) return "pbtn review";
  return "pbtn ansreview";
}

function renderPalette(){
  pal.innerHTML = "";
  Q.forEach((q, idx) => {
    const b = document.createElement("button");
    b.textContent = idx + 1;
    b.className = palClass(q.id) + (idx === state.current ? " current":"");
    b.onclick = () => { state.current = idx; save(); render(); };
    pal.appendChild(b);
  });
}

// ---- API helper (NO preflight)
async function api(body){
  const res = await fetch(window.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return await res.json();
}

// ---- Violations
async function logViolation(type, details){
  try{
    await api({
      action:"violation",
      token: cand.token,
      candidateId: cand.candidateId,
      type,
      details,
      ts: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  }catch{}
}

function addViolation(type, details){
  state.violations++;
  save();
  elVio.textContent = String(state.violations);
  logViolation(type, details);
}

// ---- Proctoring (No fullscreen, No blur)
// Disable right click
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Tab switch detection only
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    addViolation("TAB_SWITCH", "User switched tab/minimized");
  }
});

// ---- Render
function render(){
  if(totalQ === 0){
    qTitle.textContent = "No questions loaded";
    qText.textContent = "Check that questions.js has no syntax errors and is included in exam.html.";
    opts.innerHTML = "";
    qImgWrap.hidden = true;
    renderPalette();
    return;
  }

  const q = Q[state.current];

  qTitle.textContent = `Question ${state.current+1} of ${totalQ}`;

  // Remove "MCQ 12:" or "MCQ 12 –" from display only
  const cleanQ = (q.question || "").replace(/^MCQ\s*\d+\s*[:\-–]\s*/i, "");
  qText.textContent = cleanQ;

  // Image render
  if(q.image){
    qImgWrap.hidden = false;
    qImgErr.hidden = true;

    qImg.onload = () => { qImgErr.hidden = true; };
    qImg.onerror = () => { qImgErr.hidden = false; };

    qImg.src = q.image;
  }else{
    qImgWrap.hidden = true;
    qImg.removeAttribute("src");
  }

  // Options
  opts.innerHTML = "";
  const selected = state.answers[q.id];

  (q.options || []).forEach((text, i) => {
    const label = document.createElement("label");
    label.className = "opt";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "opt";
    radio.checked = (selected === i);
    radio.onchange = () => {
      state.answers[q.id] = i;
      save();
      renderPalette();
    };

    const span = document.createElement("span");
    span.textContent = text;

    label.appendChild(radio);
    label.appendChild(span);
    opts.appendChild(label);
  });

  markBtn.textContent = state.marked[q.id] ? "Unmark Review" : "Mark for Review";

  renderPalette();
  elVio.textContent = String(state.violations);
}

// ---- Navigation
prevBtn.onclick = () => { if(state.current > 0){ state.current--; save(); render(); } };
nextBtn.onclick = () => { if(state.current < totalQ-1){ state.current++; save(); render(); } };

clearBtn.onclick = () => {
  const q = Q[state.current];
  delete state.answers[q.id];
  save();
  render();
};

markBtn.onclick = () => {
  const q = Q[state.current];
  state.marked[q.id] = !state.marked[q.id];
  save();
  render();
};

// ---- Scoring
function calcResult(){
  let correct=0, wrong=0, unattempted=0;
  let score=0;

  for(const q of Q){
    const given = state.answers[q.id];
    if(given === undefined){ unattempted++; continue; }
    if(given === q.answerIndex){
      correct++;
      score += MARKS_CORRECT;
    }else{
      wrong++;
      score += MARKS_WRONG;
    }
  }
  return {score, correct, wrong, unattempted};
}

// ---- Submit
submitBtn.onclick = () => submitExam(false);

async function submitExam(auto=false){
  if(localStorage.getItem("neet_submitted")==="yes") return;

  const ok = auto ? true : confirm("Submit exam now?");
  if(!ok) return;

  const elapsedSec = Math.floor((Date.now()-state.startedAt)/1000);
  const r = calcResult();

  const payload = {
    name: cand.name,
    phone: cand.phone,
    email: cand.email,
    candidateId: cand.candidateId,

    score: r.score,
    correct: r.correct,
    wrong: r.wrong,
    unattempted: r.unattempted,

    timeTakenSec: elapsedSec,
    violations: state.violations,

    answers: state.answers, // option indices based on shuffled options
    userAgent: navigator.userAgent
  };

  try{
    const resp = await api({
      action:"submit",
      token: cand.token,
      candidateId: cand.candidateId,
      payload
    });

    if(!resp.ok){
      alert(resp.error || "Submit failed");
      return;
    }

    localStorage.setItem("neet_result", JSON.stringify(payload));
    localStorage.setItem("neet_submitted","yes");

    // Clear attempt nonce so next attempt reshuffles
    localStorage.removeItem(ATTEMPT_KEY);

    location.href = "result.html";
  }catch(e){
    alert("Network error: " + e.message);
  }
}

// ---- Start
render();
setInterval(updateTimer, 500);
