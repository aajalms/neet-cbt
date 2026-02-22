function safeParse(s){ try{return JSON.parse(s)}catch{return null} }
const cand = safeParse(localStorage.getItem("neet_candidate")||"");
if(!cand || !cand.token) location.href = "login.html";

if(localStorage.getItem("neet_submitted")==="yes"){
  location.href = "result.html";
}

const Q = window.questions || [];
const totalQ = Q.length;

const elTime = document.getElementById("timeLeft");
const elVio = document.getElementById("vio");
const pal = document.getElementById("pal");
const qTitle = document.getElementById("qTitle");
const qText = document.getElementById("qText");
const opts = document.getElementById("opts");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");
const markBtn = document.getElementById("markBtn");
const submitBtn = document.getElementById("submitBtn");

const KEY = "neet_exam_state";

const defaultState = () => ({
  startedAt: Date.now(),
  current: 0,
  answers: {},     // qid -> optionIndex
  marked: {},      // qid -> true/false
  violations: 0
});

let state = safeParse(localStorage.getItem(KEY) || "") || defaultState();

// Ensure duration 60 min
const durationMs = (window.EXAM_DURATION_MIN || 60) * 60 * 1000;

function save(){ localStorage.setItem(KEY, JSON.stringify(state)); }

function pad2(n){ return String(n).padStart(2,"0"); }

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
    b.className = palClass(q.id) + (idx===state.current ? " current":"");
    b.onclick = () => { state.current = idx; save(); render(); };
    pal.appendChild(b);
  });
}

function render(){
  const q = Q[state.current];
  qTitle.textContent = `Question ${state.current+1} of ${totalQ}`;
  qText.textContent = q.question;

  opts.innerHTML = "";
  const selected = state.answers[q.id];

  q.options.forEach((text, i) => {
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

prevBtn.onclick = () => { if(state.current>0){ state.current--; save(); render(); } };
nextBtn.onclick = () => { if(state.current<totalQ-1){ state.current++; save(); render(); } };

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

async function api(body){
  const res = await fetch(window.API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  return await res.json();
}

async function logViolation(type, details){
  try{
    await api({ action:"violation", token:cand.token, candidateId:cand.candidateId, type, details });
  }catch{}
}

function addViolation(type, details){
  state.violations++;
  save();
  elVio.textContent = String(state.violations);
  logViolation(type, details);
}

function requestFullscreen(){
  const el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
}

document.addEventListener("contextmenu", (e)=> e.preventDefault()); // disable right click

document.addEventListener("visibilitychange", () => {
  if(document.hidden) addViolation("TAB_SWITCH", "visibilitychange hidden");
});

window.addEventListener("blur", () => addViolation("FOCUS_LOST", "window blur"));

document.addEventListener("fullscreenchange", () => {
  if(!document.fullscreenElement) addViolation("FULLSCREEN_EXIT", "fullscreen exited");
});

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
    score: r.score,
    correct: r.correct,
    wrong: r.wrong,
    unattempted: r.unattempted,
    timeTakenSec: elapsedSec,
    violations: state.violations,
    answers: state.answers,
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
    location.href = "result.html";
  }catch(e){
    alert("Network error: " + e.message);
  }
}

// start
render();
setInterval(updateTimer, 500);
setInterval(()=>{ try{requestFullscreen();}catch{} }, 15000);
