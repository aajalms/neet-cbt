/***********************
  exam.js (COMPLETE + FIXED)
  ✅ Keeps: tab-switch + (optional) blur proctoring, image modal zoom,
           palette states, save state, submit to Apps Script
  ✅ Includes: IST header + start/end lock + shuffle questions/options
  ✅ FIX: iOS Safari radio change delay -> palette turns green instantly on tap
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
window.addEventListener("popstate", () => history.pushState(null, "", location.href));

// ====== IST Header (clock + schedule) ======
const istClock   = document.getElementById("istClock");
const examStartEl= document.getElementById("examStartIST");
const examEndEl  = document.getElementById("examEndIST");

if (istClock && window.formatIST) {
  const tickIST = () => { istClock.textContent = window.formatIST(Date.now()); };
  tickIST();
  setInterval(tickIST, 1000);
}

if (examStartEl && Number.isFinite(window.EXAM_START_MS) && window.formatIST) {
  examStartEl.textContent = window.formatIST(window.EXAM_START_MS);
} else if (examStartEl) {
  examStartEl.textContent = "--";
}

if (examEndEl && Number.isFinite(window.EXAM_END_MS) && window.formatIST) {
  examEndEl.textContent = window.formatIST(window.EXAM_END_MS);
} else if (examEndEl) {
  examEndEl.textContent = "--";
}

// ====== Exam Window Lock (IST) ======
function inWindow(now = Date.now()){
  if (typeof window.isWithinExamWindow !== "function") return true;
  return window.isWithinExamWindow(now);
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

// ✅ Build runtime questions with shuffle
const seedKey = (cand?.candidateId || "guest") + "|" + (cand?.token || "t");

let Q = RAW.map((q, idx) => ({
  ...q,
  id: q.id ?? (idx + 1),
  options: [...(q.options || [])]
}));

// Shuffle question order
Q = seededShuffle(Q, "Q|" + seedKey);

// Shuffle options per question + fix answerIndex (keeps correct answer)
Q = Q.map((q, idx) => {
  const correctText = (q.correctAnswerText || q.options[q.answerIndex] || "").trim();
  const opt = seededShuffle([...q.options], "O|" + seedKey + "|" + q.id + "|" + idx);
  const newAnswerIndex = opt.findIndex(x => String(x).trim() === correctText);
  return { ...q, options: opt, answerIndex: newAnswerIndex >= 0 ? newAnswerIndex : q.answerIndex };
});

const totalQ = Q.length;

// ====== Elements ======
const elTime   = document.getElementById("timeLeft");
const elVio    = document.getElementById("vio");     // your HTML uses id="vio"
const pal      = document.getElementById("pal");
const qTitle   = document.getElementById("qTitle");
const qText    = document.getElementById("qText");
const qImgWrap = document.getElementById("qImgWrap");
const opts     = document.getElementById("opts");

const prevBtn   = document.getElementById("prevBtn");
const nextBtn   = document.getElementById("nextBtn");
const clearBtn  = document.getElementById("clearBtn");
const markBtn   = document.getElementById("markBtn");
const submitBtn = document.getElementById("submitBtn");

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

// If exam window changed / new attempt, keep old startedAt (your choice)
// But clamp current index
if (!Number.isFinite(state.current) || state.current < 0) state.current = 0;
if (state.current >= totalQ) state.current = Math.max(0, totalQ - 1);

// Ensure duration 60 min (or from window.EXAM_DURATION_MIN)
const durationMs = (window.EXAM_DURATION_MIN || 60) * 60 * 1000;

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }
function pad2(n){ return String(n).padStart(2,"0"); }

let submitted = false;

function updateTimer(){
  if (submitted) return;

  // ✅ If window ended during exam => auto-submit
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
    b.type = "button";
    b.textContent = idx + 1;
    b.className = palClass(q.id) + (idx===state.current ? " current":"");
    b.addEventListener("click", () => {
      state.current = idx;
      save();
      render();
    });
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

// ====== Option select (instant palette update, iOS-safe) ======
function setAnswer(qid, idx){
  state.answers[qid] = idx;
  save();
  // update palette + keep current question visible
  renderPalette();
}

function clearAnswer(qid){
  delete state.answers[qid];
  save();
  renderPalette();
}

function toggleMark(qid){
  state.marked[qid] = !state.marked[qid];
  save();
  renderPalette();
}

// ====== Render ======
function render(){
  const q = Q[state.current];
  if(!q) return;

  // title
  if(qTitle) qTitle.textContent = `Question ${state.current+1} of ${totalQ}`;

  // keep line breaks if present
  if(qText) qText.textContent = q.question || "";

  // image
  if(qImgWrap){
    qImgWrap.innerHTML = "";
    if (q.image) {
      const img = document.createElement("img");
      img.src = q.image;
      img.alt = "Question image";
      img.title = "Tap to zoom";
      img.addEventListener("click", () => openImgModal(q.image));
      qImgWrap.appendChild(img);
    }
  }

  // options
  if(opts){
    opts.innerHTML = "";
    const picked = state.answers[q.id];

    (q.options || []).forEach((text, i) => {
      const row = document.createElement("label");
      row.className = "opt";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "opt";
      radio.value = String(i);
      radio.checked = (picked === i);

      const span = document.createElement("span");
      span.className = "optText";
      span.textContent = text;

      // ✅ iOS Safari fix: set answer on pointerdown/touchstart too (instant green)
      const choose = (e) => {
        e.preventDefault(); // prevents double-tap weirdness on iOS
        radio.checked = true;
        setAnswer(q.id, i);
        // after preventDefault, ensure click doesn't get blocked for keyboard users
        // (no action needed)
      };

      row.addEventListener("pointerdown", choose, {passive:false});
      row.addEventListener("touchstart", choose, {passive:false});
      row.addEventListener("click", (e) => {
        // normal browsers
        if (picked !== i) setAnswer(q.id, i);
      });

      row.appendChild(radio);
      row.appendChild(span);
      opts.appendChild(row);
    });
  }

  // violations display
  if(elVio) elVio.textContent = String(state.violations || 0);

  // buttons state
  if(prevBtn) prevBtn.disabled = state.current <= 0;
  if(nextBtn) nextBtn.disabled = state.current >= totalQ - 1;

  // mark button text (optional)
  if(markBtn){
    const isMarked = !!state.marked[q.id];
    markBtn.textContent = isMarked ? "Unmark" : "Mark for Review";
  }

  // palette
  renderPalette();
}

// ====== Controls ======
if(prevBtn){
  prevBtn.addEventListener("click", () => {
    if(state.current > 0){
      state.current -= 1;
      save();
      render();
    }
  });
}

if(nextBtn){
  nextBtn.addEventListener("click", () => {
    if(state.current < totalQ - 1){
      state.current += 1;
      save();
      render();
    }
  });
}

if(clearBtn){
  clearBtn.addEventListener("click", () => {
    const q = Q[state.current];
    if(!q) return;
    clearAnswer(q.id);
    render(); // refresh radios
  });
}

if(markBtn){
  markBtn.addEventListener("click", () => {
    const q = Q[state.current];
    if(!q) return;
    toggleMark(q.id);
    render(); // refresh button label
  });
}

if(submitBtn){
  submitBtn.addEventListener("click", () => {
    if(confirm("Submit exam now?")){
      submitExam(false, "MANUAL_SUBMIT");
    }
  });
}

// ====== Proctoring: tab-switch / blur ======
function addViolation(reason){
  state.violations = (state.violations || 0) + 1;
  save();
  if(elVio) elVio.textContent = String(state.violations);

  // OPTIONAL: if you use blur overlay (set window.PROCTOR_BLUR=true in config)
  if(window.PROCTOR_BLUR === true){
    document.body.classList.add("proctor-blur");
    // remove blur quickly (you can change time)
    setTimeout(() => document.body.classList.remove("proctor-blur"), 1500);
  }

  // OPTIONAL: auto-submit after X violations
  const maxV = Number.isFinite(window.MAX_VIOLATIONS) ? window.MAX_VIOLATIONS : null;
  if(maxV && state.violations >= maxV){
    submitExam(true, "MAX_VIOLATIONS");
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    addViolation("TAB_SWITCH");
  }
});

window.addEventListener("blur", () => {
  // some browsers fire blur on tab switch too
  addViolation("WINDOW_BLUR");
});

// ====== Submit to Apps Script ======
async function submitExam(isAuto=false, reason="SUBMIT"){
  if(submitted) return;
  submitted = true;

  // lock UI
  try{
    if(submitBtn) submitBtn.disabled = true;
    if(prevBtn) prevBtn.disabled = true;
    if(nextBtn) nextBtn.disabled = true;
    if(clearBtn) clearBtn.disabled = true;
    if(markBtn) markBtn.disabled = true;
  }catch{}

  // build payload
  const payload = {
    action: "submit",
    token: cand.token,
    candidateId: cand.candidateId || cand.id || "",
    name: cand.name || "",
    phone: cand.phone || "",
    email: cand.email || "",
    startedAt: state.startedAt,
    endedAt: Date.now(),
    durationMin: (window.EXAM_DURATION_MIN || 60),
    reason,
    isAuto: !!isAuto,
    violations: state.violations || 0,
    answers: state.answers || {},
    marked: state.marked || {},
    // optional: store shuffled question ids order
    qOrder: Q.map(x => x.id)
  };

  // fallback if no API_URL configured
  const API_URL = window.API_URL || window.EXAM_API_URL || "";
  if(!API_URL){
    alert("API_URL not set in config.js. Cannot submit.");
    submitted = false;
    return;
  }

  try{
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if(!res.ok || data.ok === false){
      const msg = data.message || data.error || ("Submit failed (" + res.status + ")");
      alert(msg);
      submitted = false;
      return;
    }

    // mark submitted
    localStorage.setItem("neet_submitted", "yes");

    // store result if server returns it (optional)
    if(data.result){
      localStorage.setItem("neet_result", JSON.stringify(data.result));
    } else {
      // basic local result (optional)
      localStorage.setItem("neet_result", JSON.stringify({ ok:true, reason, endedAt: payload.endedAt }));
    }

    // go result
    location.replace("result.html");
  }catch(err){
    alert("Network error: " + err.message);
    submitted = false;
  }
}

// ====== Start ======
(function init(){
  if(!Array.isArray(Q) || Q.length === 0){
    alert("Questions not loaded. Check questions.js link in exam.html");
    return;
  }

  // update timer immediately + every second
  updateTimer();
  setInterval(updateTimer, 1000);

  // first render
  render();
})();
