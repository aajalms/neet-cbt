/* =========================
   NEET PG CBT - script.js
   Requires: questions.js -> window.questions = [...]
   ========================= */

(() => {
  // ---------- CONFIG ----------
  const TEST_DURATION_SECONDS = 180 * 60; // 180 min
  const MARKS_CORRECT = 4;
  const MARKS_WRONG = -1;
  const MARKS_UNATTEMPTED = 0;

  const MAX_VIOLATIONS = 3; // auto-submit after this many
  const REQUIRE_FULLSCREEN = false; // set true if you want to enforce fullscreen (desktop)

  // ---------- STATE ----------
  let questions = [];
  let idx = 0;

  // answers: null = unattempted, 0/1/2/3 = selected option index
  let userAnswers = [];
  // status: "notVisited" | "notAnswered" | "answered"
  let visitStatus = [];
  // markForReview: boolean
  let marked = [];

  // timer
  let remaining = TEST_DURATION_SECONDS;
  let timerInterval = null;

  // proctoring state
  let proctor = {
    violations: 0,
    log: []
  };

  // ---------- HELPERS ----------
  const $ = (id) => document.getElementById(id);

  function loadQuestions() {
    if (!window.questions || !Array.isArray(window.questions) || window.questions.length === 0) {
      alert("questions.js not loaded or window.questions is empty!");
      return false;
    }
    questions = window.questions;
    return true;
  }

  function saveState() {
    const state = {
      idx,
      remaining,
      userAnswers,
      visitStatus,
      marked,
      proctor
    };
    localStorage.setItem("cbt_state", JSON.stringify(state));
    localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
  }

  function loadState() {
    const saved = JSON.parse(localStorage.getItem("cbt_state") || "null");
    if (!saved) return false;

    idx = saved.idx ?? 0;
    remaining = saved.remaining ?? TEST_DURATION_SECONDS;
    userAnswers = saved.userAnswers ?? [];
    visitStatus = saved.visitStatus ?? [];
    marked = saved.marked ?? [];
    proctor = saved.proctor ?? { violations: 0, log: [] };

    return true;
  }

  function initArrays() {
    const n = questions.length;

    if (!Array.isArray(userAnswers) || userAnswers.length !== n) {
      userAnswers = Array(n).fill(null);
    }
    if (!Array.isArray(visitStatus) || visitStatus.length !== n) {
      visitStatus = Array(n).fill("notVisited");
    }
    if (!Array.isArray(marked) || marked.length !== n) {
      marked = Array(n).fill(false);
    }
  }

  function formatTime(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function setHeader() {
    if ($("timer")) $("timer").innerText = formatTime(remaining);
    if ($("violations")) $("violations").innerText = proctor.violations;
    if ($("markingLine")) $("markingLine").innerText = `Marking: +${MARKS_CORRECT} / ${MARKS_WRONG} / ${MARKS_UNATTEMPTED}`;
  }

  function ensureCandidate() {
    const cand = JSON.parse(localStorage.getItem("candidate") || "null");
    if (!cand) {
      location.href = "login.html";
      return null;
    }
    if ($("candName")) $("candName").innerText = cand.name || "";
    if ($("candRoll")) $("candRoll").innerText = cand.roll || "";
    return cand;
  }

  // ---------- PALETTE ----------
  function statusColor(i) {
    // Priority:
    // Not visited (grey)
    // Marked (purple) or Answered+Marked (mixed)
    // Answered (green)
    // Not answered (red)
    const visited = visitStatus[i] !== "notVisited";
    const answered = userAnswers[i] !== null && userAnswers[i] !== undefined;
    const isMarked = !!marked[i];

    if (!visited) return "notVisited";
    if (isMarked && answered) return "answeredMarked";
    if (isMarked && !answered) return "marked";
    if (answered) return "answered";
    return "notAnswered";
  }

  function updatePalette() {
    const pal = $("palette");
    if (!pal) return;

    pal.innerHTML = "";
    for (let i = 0; i < questions.length; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `palBtn ${statusColor(i)} ${i === idx ? "current" : ""}`;
      btn.innerText = String(i + 1);
      btn.addEventListener("click", () => {
        goTo(i);
      });
      pal.appendChild(btn);
    }
  }

  // ---------- RENDER ----------
  function renderQuestion() {
    const qObj = questions[idx];

    // Mark visited
    if (visitStatus[idx] === "notVisited") {
      visitStatus[idx] = "notAnswered";
    }

    // Question title/number
    if ($("qNo")) $("qNo").innerText = `Question ${idx + 1}`;
    if ($("questionText")) $("questionText").innerText = qObj.q || ""; // FIX: qObj.q

    // Options
    const opts = $("options");
    if (opts) {
      opts.innerHTML = "";

      (qObj.options || []).forEach((op, optIdx) => {
        const wrap = document.createElement("label");
        wrap.className = "optionRow";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "opt";
        input.value = String(optIdx);
        input.checked = userAnswers[idx] === optIdx;

        input.addEventListener("change", () => {
          userAnswers[idx] = optIdx;
          visitStatus[idx] = "answered";
          saveState();
          updatePalette();
        });

        const letter = String.fromCharCode(65 + optIdx);
        const text = document.createElement("span");
        text.innerHTML = `<b>${letter}.</b> ${op}`;

        wrap.appendChild(input);
        wrap.appendChild(text);
        opts.appendChild(wrap);
      });
    }

    // Mark for review button text
    if ($("btnMark")) {
      $("btnMark").innerText = marked[idx] ? "Unmark Review" : "Mark for Review";
    }

    // Disable previous at first question
    if ($("btnPrev")) $("btnPrev").disabled = (idx === 0);

    updatePalette();
    setHeader();
    saveState();
  }

  // ---------- NAVIGATION ----------
  function goTo(i) {
    idx = Math.min(Math.max(0, i), questions.length - 1);
    renderQuestion();
  }

  function nextQuestion() {
    if (idx < questions.length - 1) {
      idx++;
      renderQuestion();
    }
  }

  function prevQuestion() {
    if (idx > 0) {
      idx--;
      renderQuestion();
    }
  }

  function clearResponse() {
    userAnswers[idx] = null;
    // if visited but not answered -> keep notAnswered
    if (visitStatus[idx] !== "notVisited") visitStatus[idx] = "notAnswered";
    saveState();
    renderQuestion();
  }

  function toggleMarkForReview() {
    marked[idx] = !marked[idx];
    saveState();
    renderQuestion();
  }

  function saveAndNext() {
    // If answered, mark answered; if not, ensure notAnswered when visited
    if (userAnswers[idx] !== null && userAnswers[idx] !== undefined) {
      visitStatus[idx] = "answered";
    } else if (visitStatus[idx] !== "notVisited") {
      visitStatus[idx] = "notAnswered";
    }
    saveState();
    nextQuestion();
  }

  // ---------- SUBMIT + RESULT ----------
  function computeResult() {
    let correct = 0, wrong = 0, unattempted = 0;
    let score = 0;

    for (let i = 0; i < questions.length; i++) {
      const sel = userAnswers[i];
      if (sel === null || sel === undefined) {
        unattempted++;
        score += MARKS_UNATTEMPTED;
      } else if (sel === questions[i].correct) { // FIX: correct key
        correct++;
        score += MARKS_CORRECT;
      } else {
        wrong++;
        score += MARKS_WRONG;
      }
    }

    return {
      total: questions.length,
      correct,
      wrong,
      unattempted,
      score,
      submittedAt: Date.now()
    };
  }

  function submitTest(force = false) {
    if (!force) {
      const ok = confirm("Submit test now? You cannot change answers after submission.");
      if (!ok) return;
    }

    if (timerInterval) clearInterval(timerInterval);

    const result = computeResult();
    localStorage.setItem("result", JSON.stringify(result));
    localStorage.setItem("cbt_state", JSON.stringify({
      idx,
      remaining,
      userAnswers,
      visitStatus,
      marked,
      proctor
    }));
    localStorage.setItem("userAnswers", JSON.stringify(userAnswers));

    // go to result page
    location.href = "result.html";
  }

  // ---------- TIMER ----------
  function startTimer() {
    setHeader();
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        remaining = 0;
        setHeader();
        submitTest(true);
        return;
      }
      setHeader();
      saveState();
    }, 1000);
  }

  // ---------- PROCTORING (BASIC / CLIENT-SIDE) ----------
  function addViolation(reason) {
    proctor.violations++;
    proctor.log.push({ t: Date.now(), reason });

    setHeader();
    saveState();

    // show banner if present
    if ($("proctorMsg")) {
      $("proctorMsg").innerText = `Proctoring alert: ${reason} (Violations: ${proctor.violations})`;
      $("proctorMsg").style.display = "block";
    }

    if (proctor.violations >= MAX_VIOLATIONS) {
      alert("Maximum violations reached. Test will be auto-submitted.");
      submitTest(true);
    }
  }

  function setupProctoring() {
    // Prevent back navigation (best-effort)
    history.pushState(null, "", location.href);
    window.addEventListener("popstate", () => {
      history.pushState(null, "", location.href);
      addViolation("Back navigation attempt");
    });

    // Tab switch / visibility
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) addViolation("Tab/app switched");
    });

    // Fullscreen enforcement (desktop best)
    if (REQUIRE_FULLSCREEN) {
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) addViolation("Exited fullscreen");
      });
    }

    // Right click / copy (optional deterrents)
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("copy", (e) => e.preventDefault());
    document.addEventListener("cut", (e) => e.preventDefault());
    document.addEventListener("paste", (e) => e.preventDefault());
  }

  // ---------- BIND UI ----------
  function bindButtons() {
    if ($("btnPrev")) $("btnPrev").addEventListener("click", prevQuestion);
    if ($("btnNext")) $("btnNext").addEventListener("click", saveAndNext);
    if ($("btnClear")) $("btnClear").addEventListener("click", clearResponse);
    if ($("btnMark")) $("btnMark").addEventListener("click", toggleMarkForReview);
    if ($("btnSubmit")) $("btnSubmit").addEventListener("click", () => submitTest(false));
  }

  // ---------- BOOT ----------
  function boot() {
    ensureCandidate();

    if (!loadQuestions()) return;

    // load saved progress if any
    loadState();
    initArrays();

    // Ensure idx in range
    idx = Math.min(Math.max(0, idx), questions.length - 1);

    bindButtons();
    setupProctoring();
    startTimer();
    renderQuestion();
  }

  window.addEventListener("load", boot);

  // Expose submit for debugging if needed
  window.__submitTest = submitTest;

})();
