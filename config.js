<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>NEET PG CBT - Instructions</title>
  <link rel="stylesheet" href="style.css" />
  <style>
    .ibox{max-width:900px;margin:30px auto;background:#fff;border-radius:8px;padding:20px;box-shadow:0 4px 18px rgba(0,0,0,.08)}
    .metaRow{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0 16px}
    .pill{background:#eef2f7;padding:10px 12px;border-radius:8px}
    .btn{background:#003366;color:#fff;border:none;padding:12px 18px;border-radius:8px;cursor:pointer;font-weight:700}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    ul{line-height:1.7}
  </style>
</head>
<body>

<header class="topbar">
  <div class="brand">NEET PG CBT</div>
  <div class="meta">
    <span>IST Time: <b id="istNow">--</b></span>
  </div>
</header>

<div class="ibox">
  <h2>Instructions</h2>

  <div class="metaRow">
    <div class="pill">Start (IST): <b id="startIST">--</b></div>
    <div class="pill">End (IST): <b id="endIST">--</b></div>
    <div class="pill">Status: <b id="statusTxt">--</b></div>
  </div>

  <ul>
    <li>Read each question carefully before answering.</li>
    <li>Do not refresh/close the tab during the exam.</li>
    <li>Tab switching may be counted as violations (if enabled).</li>
    <li>Click <b>Submit</b> only when you are finished.</li>
  </ul>

  <p style="margin-top:14px;">
    <button class="btn" id="startBtn" disabled>Start Exam</button>
  </p>

  <p id="msg" style="color:#b00020;font-weight:700;"></p>
</div>

<script src="config.js"></script>
<script>
  // Must be logged in
  const cand = JSON.parse(localStorage.getItem("neet_candidate") || "null");
  if (!cand || !cand.id || !cand.token) location.replace("login.html");

  const istNow = document.getElementById("istNow");
  const startIST = document.getElementById("startIST");
  const endIST = document.getElementById("endIST");
  const statusTxt = document.getElementById("statusTxt");
  const startBtn = document.getElementById("startBtn");
  const msg = document.getElementById("msg");

  startIST.textContent = formatIST(EXAM_START_MS);
  endIST.textContent = formatIST(EXAM_END_MS);

  function tick(){
    istNow.textContent = formatIST(Date.now());

    const now = Date.now();
    if (now < EXAM_START_MS){
      statusTxt.textContent = "Not Started";
      startBtn.disabled = true;
      msg.textContent = "Exam has not started yet.";
    } else if (now > EXAM_END_MS){
      statusTxt.textContent = "Closed";
      startBtn.disabled = true;
      msg.textContent = "Exam time is over.";
    } else {
      statusTxt.textContent = "Live";
      startBtn.disabled = false;
      msg.textContent = "";
    }
  }
  setInterval(tick, 1000); tick();

  startBtn.addEventListener("click", ()=>{
    // hard check again
    if (!isWithinExamWindow()) return;
    // prevent back to instructions after starting
    location.replace("exam.html");
  });

  // prevent back from this page to login after reaching here (optional)
  history.replaceState(null,"",location.href);
</script>
</body>
</html>
