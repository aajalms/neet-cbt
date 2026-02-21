// ===== SETTINGS =====
const TEST_DURATION_MIN = 180;
const MARK_CORRECT = 4;
const MARK_WRONG = -1;
const MARK_UNATTEMPTED = 0;

const MAX_VIOLATIONS = 3; // Auto-submit after this
// Paste your Apps Script Web App URL here (after deploying)
const GOOGLE_SHEET_WEBAPP_URL = ""; // e.g. "https://script.google.com/macros/s/XXXX/exec"

// ===== STATE =====
let state = null;
let userAnswers = [];
let marked = [];
let visited = [];
let currentIndex = 0;
let timerInterval = null;

// ===== INIT =====
(function init(){
  const cand = JSON.parse(localStorage.getItem("candidate") || "null");
  if(!cand){ location.href="login.html"; return; }

  state = JSON.parse(localStorage.getItem("cbt_state") || "null");
  if(!state){ location.href="instructions.html"; return; }

  const n = questions.length;
  userAnswers = (state.answers && state.answers.length) ? state.answers : Array(n).fill(null);
  marked = (state.marked && state.marked.length) ? state.marked : Array(n).fill(false);
  visited = (state.visited && state.visited.length) ? state.visited : Array(n).fill(false);
  currentIndex = state.currentIndex || 0;

  if(!state.timeLeftSec || state.timeLeftSec > TEST_DURATION_MIN*60){
    state.timeLeftSec = TEST_DURATION_MIN * 60;
  }

  // Prevent back (best possible)
  history.pushState(null, "", location.href);
  window.addEventListener("popstate", ()=> history.pushState(null, "", location.href));

  // Render
  renderQuestion();
  renderPalette();
  updateViolationsUI();

  // Timer
  startTimer();

  // Proctoring
  enableProctoring();

  // Auto-save state
  setInterval(saveState, 1500);
})();

// ===== RENDER =====
function renderQuestion(){
  const q = questions[currentIndex];
  visited[currentIndex] = true;

  document.getElementById("qno").innerText = currentIndex + 1;
  document.getElementById("qtext").innerText = q.q;

  const optWrap = document.getElementById("options");
  optWrap.innerHTML = "";

  q.options.forEach((op, idx)=>{
    const label = document.createElement("label");
    label.className = "opt";
    label.innerHTML = `
      <input type="radio" name="opt" value="${idx}" ${userAnswers[currentIndex]===idx ? "checked":""}/>
      <b>${String.fromCharCode(65+idx)}.</b> ${op}
    `;
    label.addEventListener("click", ()=>{
      userAnswers[currentIndex] = idx;
      renderPalette();
      saveState();
    });
    optWrap.appendChild(label);
  });

  renderPalette();
  saveState();
}

function renderPalette(){
  const pal = document.getElementById("palette");
  pal.innerHTML = "";

  questions.forEach((_, i)=>{
    const b = document.createElement("button");
    b.className = "qbtn";
    b.textContent = i + 1;

    const ans = (userAnswers[i] !== null && userAnswers[i] !== undefined);
    const vis = visited[i];
    const m = !!marked[i];

    if(!vis){
      b.style.background = "#bdbdbd"; // Not visited
    } else if(ans && m){
      b.style.background = "linear-gradient(135deg,#27ae60 50%,#8e44ad 50%)"; // Answered+Marked
    } else if(m){
      b.style.background = "#8e44ad"; // Marked
    } else if(ans){
      b.style.background = "#27ae60"; // Answered
    } else {
      b.style.background = "#e74c3c"; // Not answered
    }

    if(i === currentIndex) b.classList.add("current");
    b.onclick = ()=> { currentIndex = i; state.currentIndex = i; renderQuestion(); };
    pal.appendChild(b);
  });
}

// ===== NAVIGATION =====
function prevQ(){
  if(currentIndex > 0){
    currentIndex--;
    state.currentIndex = currentIndex;
    renderQuestion();
  }
}

function saveAndNext(){
  if(currentIndex < questions.length - 1){
    currentIndex++;
    state.currentIndex = currentIndex;
    renderQuestion();
  } else {
    alert("Last question reached. You can submit now.");
  }
}

function clearResponse(){
  userAnswers[currentIndex] = null;
  renderQuestion();
}

function toggleMark(){
  marked[currentIndex] = !marked[currentIndex];
  renderPalette();
  saveState();
}

// ===== TIMER =====
function startTimer(){
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if(state.submitted) return;
    state.timeLeftSec--;
    if(state.timeLeftSec <= 0){
      state.timeLeftSec = 0;
      updateTimerUI();
      submitTest("TIME_OVER");
      return;
    }
    updateTimerUI();
  }, 1000);

  updateTimerUI();
}

function updateTimerUI(){
  const t = state.timeLeftSec;
  const mm = String(Math.floor(t/60)).padStart(2,"0");
  const ss = String(t%60).padStart(2,"0");
  document.getElementById("timer").innerText = `${mm}:${ss}`;
}

// ===== SCORING (+4, -1, 0) =====
function calculateScore(){
  let correct=0, wrong=0, unattempted=0;

  questions.forEach((q,i)=>{
    const sel = userAnswers[i];
    if(sel === null || sel === undefined){
      unattempted++;
    } else if(sel === q.answer){
      correct++;
    } else {
      wrong++;
    }
  });

  const score = (correct*MARK_CORRECT) + (wrong*MARK_WRONG) + (unattempted*MARK_UNATTEMPTED);
  return {score, correct, wrong, unattempted};
}

// ===== SUBMIT =====
function confirmSubmit(){
  if(confirm("Submit test now?")){
    submitTest("MANUAL");
  }
}

async function submitTest(reason){
  if(state.submitted) return;
  state.submitted = true;

  const cand = JSON.parse(localStorage.getItem("candidate") || "null");
  const result = calculateScore();

  const payload = {
    candidateName: cand?.name || "",
    rollNo: cand?.roll || "",
    totalQuestions: questions.length,
    correct: result.correct,
    wrong: result.wrong,
    unattempted: result.unattempted,
    score: result.score,
    violations: state.violations || 0,
    reason,
    submittedAt: Date.now(),
    answers: userAnswers
  };

  localStorage.setItem("result", JSON.stringify(payload));
  localStorage.setItem("userAnswers", JSON.stringify(userAnswers));

  saveState();

  // Save to Google Sheet (Apps Script Web App)
  if(GOOGLE_SHEET_WEBAPP_URL && GOOGLE_SHEET_WEBAPP_URL.startsWith("https://")){
    try{
      await fetch(GOOGLE_SHEET_WEBAPP_URL, {
        method: "POST",
        headers: {"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify(payload)
      });
    }catch(e){
      // ignore
    }
  }

  location.href = "result.html";
}

function saveState(){
  state.answers = userAnswers;
  state.marked = marked;
  state.visited = visited;
  state.currentIndex = currentIndex;
  localStorage.setItem("cbt_state", JSON.stringify(state));
}

// ===== PROCTORING =====
function enableProctoring(){
  // Try fullscreen on first click
  document.addEventListener("click", tryFullscreenOnce, {once:true});

  document.addEventListener("visibilitychange", ()=>{
    if(document.hidden) addViolation("TAB_SWITCH");
  });

  window.addEventListener("blur", ()=> addViolation("WINDOW_BLUR"));

  // Right click block
  document.addEventListener("contextmenu", (e)=> e.preventDefault());

  // Devtools shortcuts block (not perfect)
  document.addEventListener("keydown", (e)=>{
    const k = e.key.toLowerCase();
    if(e.key === "F12" || (e.ctrlKey && e.shiftKey && (k==="i" || k==="j" || k==="c")) || (e.ctrlKey && k==="u")){
      e.preventDefault();
      addViolation("DEVTOOLS_SHORTCUT");
    }
  });

  // Fullscreen exit
  document.addEventListener("fullscreenchange", ()=>{
    if(!document.fullscreenElement){
      addViolation("EXIT_FULLSCREEN");
    }
  });
}

function tryFullscreenOnce(){
  const el = document.documentElement;
  if(el.requestFullscreen){
    el.requestFullscreen().catch(()=>{});
  }
}

function addViolation(type){
  if(state.submitted) return;
  state.violations = (state.violations || 0) + 1;
  updateViolationsUI();
  saveState();

  alert(`Proctoring violation: ${type}\nViolations: ${state.violations}/${MAX_VIOLATIONS}`);

  if(state.violations >= MAX_VIOLATIONS){
    submitTest("AUTO_SUBMIT_VIOLATIONS");
  }
}

function updateViolationsUI(){
  const v = state.violations || 0;
  const el = document.getElementById("viol");
  if(el) el.innerText = v;
}
