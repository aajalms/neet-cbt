window.API_URL = "https://script.google.com/macros/s/AKfycbyrR6uJDuFZBkbrtbjiTuIrKB31alvPWVmz4znmccpqPR_u1TLIqxYfziq9QJObdWBL/exec";
window.EXAM_DURATION_MIN = 60;
window.MARKS_CORRECT = 4;
window.MARKS_WRONG = -1;
// ===== EXAM SCHEDULE (IST) =====
const EXAM_TZ = "Asia/Kolkata";

// ✅ Set your fixed window here (IST). Example: 8:00 AM to 9:00 AM on 1 Mar 2026
const EXAM_START_IST = "2026-03-01T08:00:00+05:30";
const EXAM_END_IST   = "2026-03-01T09:00:00+05:30";

const EXAM_START_MS = Date.parse(EXAM_START_IST);
const EXAM_END_MS   = Date.parse(EXAM_END_IST);

// Show time in IST anywhere
function formatIST(dateOrMs = Date.now()) {
  const d = typeof dateOrMs === "number" ? new Date(dateOrMs) : dateOrMs;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: EXAM_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

function isWithinExamWindow(nowMs = Date.now()) {
  return nowMs >= EXAM_START_MS && nowMs <= EXAM_END_MS;
}
