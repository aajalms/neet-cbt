/***********************
  exam.js
  ✅ Keeps: tab-switch + blur proctoring
  ✅ Adds: IST start/end time restriction
  ✅ Adds: shuffle questions + options (answerIndex fixed)
***********************/

function safeParse(s){ try{ return JSON.parse(s) }catch{ return null } }

// ====== Candidate session ======
const cand = safeParse(localStorage.getItem("neet_candidate") || "");
if(!cand || !cand.token){
  location.replace("login.html");
}

// If already submitted, go to result
if(localStorage.getItem("neet_submitted") === "yes"){
  location.replace("result.html");
}

// ✅ prevent back navigation during exam
history.replaceState(null, "", location.href);
window.addEventListener("popstate", () => {
  history.pushState(null, "", location.href);
});

// ====== IST Exam Window (Requires config.js values) ======
function parseMs(v){
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : NaN;
}

const START_MS = parseMs(window.EXAM_START_IST);
const END_MS   = parseMs(window.EXAM_END_IST);

function inWindow(now = Date.now()){
  if(!Number.isFinite(START_MS) || !Number.isFinite(END_MS)) return true; // if not set, allow
  return now >= START_MS && now <= END_MS;
}

if(!inWindow()){
  alert("Exam is not live now (check start/end time).");
  location.replace("instructions.html");
}

// ====== Questions (from questions.js) ======
const RAW = window.questions || [];

// ====== Shuffle helpers (seeded) ======
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seedStr) {
  const seed = xmur3(seedStr)();
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ✅ Build runtimeQuestions (shuffled + options shuffled with fixed answerIndex)
const seedKey = (cand?.candidateId || "guest") + "|" + (cand?.token || "t");

let Q = RAW.map(q => ({ ...q, options: [...(q.options || [])] }));

// Shuffle question order
Q = seededShuffle(Q, "Q|" + seedKey);

// Shuffle options per question + fix answerIndex
Q = Q.map((q, idx) => {
  const correctText = q.options[q.answerIndex];
  const opt = seededShuffle([...q.options], "O|" + seedKey + "|" + (q.id ?? idx));
  const newAnswerIndex = opt.indexOf(correctText);
  return { ...q, options: opt, answerIndex: newAnswerIndex };
});

const totalQ = Q.length;

// ====== Elements ======
const elTime  = document.getElementById("timeLeft");
const elVio   = document.getElementById("vio");
const pal     = document.getElementById("pal");
const qTitle  = document.getElementById("qTitle");
const qText   = document.getElementById("qText");
const qImgWrap= document.getElementById("qImgWrap");
const opts    = document.getElementById("opts");

const prevBtn  = document.getElementById("prevBtn");
const nextBtn  = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");
const markBtn  = document.getElementById("markBtn");
const submitBtn= document.getElementById("submitBtn");

// ====== Storage key ======
const KEY = "neet_exam_state";

const defaultState = () => ({
  startedAt: Date.now(),
  current: 0,
  answers: {},     // qid -> optionIndex
  marked: {},      // qid -> true/false
  violations: 0
});

let state = safeParse(localStorage.getItem(KEY) || "") || defaultState();

// Ensure duration 60 min (or from window.EXAM_DURATION_MIN)
const durationMs = (window.EXAM_DURATION_MIN || 60) * 60 * 1000;

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function pad2(n){ return String(n).padStart(2,"0"); }

function updateTimer(){
  // ✅ if exam window ended during attempt -> auto submit
  if(!inWindow()){
    submitExam(true, "TIME_WINDOW_ENDED");
    return;
  }

  const elapsed = Date.now() - state.startedAt;
  const left = Math.max(0, durationMs - elapsed);

  const mm = Math.floor(left/60000);
  const ss = Math.floor((left%60000)/1000);

  if (elTime) elTime.textContent = `${pad2(mm)}:${pad2(ss)}`;

  if(left <= 0){
    submitExam(true, "DURATION_ENDED");
  }
}

function palClass(qid){
  const a = state.answers[qid];
  const m = !!state.marked[qid];
  if(a === undefined && !m) return "pbtn unanswered";
  if(a !== undefined && !m) return "pbtn answered";
  if(a === undefined && m) return "pbtn review";
  return "pbtn ansreview";
}

function renderPalette(){
  if(!pal) return;
  pal.innerHTML = "";
  Q.forEach((q, idx) => {
    const b = document.createElement("button");
    b.textContent = idx + 1;
    b.className = palClass(q.id) + (idx===state.current ? " current":"");
    b.onclick = () => { state.current = idx; save(); render(); };
    pal.appendChild(b);
  });
}

/* =======================
   ✅ IMAGE MODAL (ZOOM)
======================= */
const imgModal    = document.getElementById("imgModal");
const imgModalPic = document.getElementById("imgModalPic");
const imgCloseBtn = document.getElementById("imgCloseBtn");
const imgFullBtn  = document.getElementById("imgFullBtn");

function openImgModal(src){
  if(!imgModal || !imgModalPic) return;
  imgModalPic.src = src;
  imgModal.classList.add("show");
  imgModal.setAttribute("aria-hidden", "false");
}

function closeImgModal(){
  if(!imgModal) return;
  imgModal.classList.remove("show");
  imgModal.setAttribute("aria-hidden", "true");
}

if(imgCloseBtn) imgCloseBtn.addEventListener("click", closeImgModal);

if(imgModal){
  imgModal.addEventListener("click", (e) => {
    if (e.target === imgModal) closeImgModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeImgModal();
});

if(imgFullBtn){
  imgFullBtn.addEventListener("click", async () => {
    try{
      if (imgModalPic && imgModalPic.requestFullscreen) {
        await imgModalPic.requestFullscreen();
      } else if (imgModal && imgModal.requestFullscreen) {
        await imgModal.requestFullscreen();
      } else {
        alert("Fullscreen not supported on this device/browser.");
      }
    }catch(err){
      alert("Fullscreen blocked: " + err.message);
    }
  });
}

function render(){
  const q = Q[state.current];
  if(!q) return;

  if(qTitle) qTitle.textContent = `Question ${state.current+1} of ${totalQ}`;
  if(qText)  qText.textContent  = q.question || "";

  if(qImgWrap){
    qImgWrap.innerHTML = "";
    if (q.image) {
      qImgWrap.className = "qimg-wrap";
      const img = document.createElement("img");
      img.className = "qimg";
      img.src = q.image;
      img.alt = "Question image";
      img.title = "Tap to zoom";
      img.onclick = () => openImgModal(q.image);
      qImgWrap.appendChild(img);
    } else {
      qImgWrap.className = "";
    }
  }

  if(opts){
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
  }

  if(markBtn) markBtn.textContent = state.marked[q.id] ? "Unmark Review" : "Mark for Review";

  renderPalette();
  if(elVio) elVio.textContent = String(state.violations);
}

// ====== Navigation buttons ======
if(prevBtn){
  prevBtn.onclick = () => {
    if(state.current > 0){
      state.current--;
      save();
      render();
    }
  };
}

if(nextBtn){
  nextBtn.onclick = () => {
    if(state.current < totalQ - 1){
      state.current++;
      save();
      render();
    }
  };
}

if(clearBtn){
  clearBtn.onclick = () => {
    const q = Q[state.current];
    if(!q) return;
    delete state.answers[q.id];
    save();
    render();
  };
}

if(markBtn){
  markBtn.onclick = () => {
    const q = Q[state.current];
    if(!q) return;
    state.marked[q.id] = !state.marked[q.id];
    save();
    render();
  };
}

// ====== Result calculation ======
function calcResult(){
  let correct=0, wrong=0, unattempted=0;
  let score=0;

  for(const q of Q){
    const given = state.answers[q.id];
    if(given === undefined){ unattempted++; continue; }
    if(given === q.answerIndex){
      correct++;
      score += (window.MARKS_CORRECT ?? 4);
    }else{
      wrong++;
      score += (window.MARKS_WRONG ?? -1);
    }
  }
  return {score, correct, wrong, unattempted};
}

// ====== API ======
async function api(body){
  const res = await fetch(window.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function logViolation(type, details){
  try{
    await api({
      action: "violation",
      token: cand.token,
      candidateId: (cand.candidateId || cand.id || cand.cid || ""),
      type,
      details
    });
  }catch{}
}

function addViolation(type, details){
  state.violations++;
  save();
  if(elVio) elVio.textContent = String(state.violations);
  logViolation(type, details);
}

// ✅ Disable right click
document.addEventListener("contextmenu", (e)=> e.preventDefault());

// ✅ Proctoring events
document.addEventListener("visibilitychange", () => {
  if(document.hidden) addViolation("TAB_SWITCH", "visibilitychange hidden");
});
window.addEventListener("blur", () => addViolation("FOCUS_LOST", "window blur"));

// ====== Submit ======
if(submitBtn){
  submitBtn.onclick = () => submitExam(false, "MANUAL");
}

async function submitExam(auto=false, reason=""){
  if(localStorage.getItem("neet_submitted") === "yes") return;

  const ok = auto ? true : confirm("Submit exam now?");
  if(!ok) return;

  const elapsedSec = Math.floor((Date.now()-state.startedAt)/1000);
  const r = calcResult();

  const payload = {
    name: cand.name,
    phone: cand.phone,
    email: cand.email,
    candidateId: (cand.candidateId || cand.id || cand.cid || ""),
    score: r.score,
    correct: r.correct,
    wrong: r.wrong,
    unattempted: r.unattempted,
    timeTakenSec: elapsedSec,
    violations: state.violations,
    answers: state.answers,
    userAgent: navigator.userAgent,
    submitReason: reason || (auto ? "AUTO" : "MANUAL"),
    submittedAtIST: (new Date()).toISOString()
  };

  try{
    const resp = await api({
      action: "submit",
      token: cand.token,
      candidateId: payload.candidateId,
      payload
    });

    if(!resp.ok){
      alert(resp.error || "Submit failed");
      return;
    }

    localStorage.setItem("neet_result", JSON.stringify(payload));
    localStorage.setItem("neet_submitted","yes");

    // ✅ replace to prevent back
    location.replace("result.html");
  }catch(e){
    alert("Network error: " + e.message);
  }
}

// ====== Start ======
render();
setInterval(updateTimer, 500);
