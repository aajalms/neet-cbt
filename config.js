// ==============================
// config.js
// ==============================

// ✅ Google Apps Script Web App URL
window.API_URL =
  "https://script.google.com/macros/s/AKfycbyrR6uJDuFZBkbrtbjiTuIrKB31alvPWVmz4znmccpqPR_u1TLIqxYfziq9QJObdWBL/exec";

// ✅ Exam settings
window.EXAM_DURATION_MIN = 60;
window.MARKS_CORRECT = 4;
window.MARKS_WRONG = -1;

// ==============================
// ✅ EXAM SCHEDULE (IST)
// ==============================
window.EXAM_TZ = "Asia/Kolkata";

// ✅ Set your fixed window here (IST)
window.EXAM_START_IST = "2026-02-25T08:00:00+05:30";
window.EXAM_END_IST   = "2026-02-26T09:00:00+05:30";

// Parsed milliseconds (used by pages)
window.EXAM_START_MS = Date.parse(window.EXAM_START_IST);
window.EXAM_END_MS   = Date.parse(window.EXAM_END_IST);

// ✅ Show time in IST anywhere
window.formatIST = function formatIST(dateOrMs = Date.now()) {
  const d = typeof dateOrMs === "number" ? new Date(dateOrMs) : dateOrMs;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: window.EXAM_TZ,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
};

// ✅ Check if now is within exam window
window.isWithinExamWindow = function isWithinExamWindow(nowMs = Date.now()) {
  // If schedule not configured correctly, allow access
  if (!Number.isFinite(window.EXAM_START_MS) || !Number.isFinite(window.EXAM_END_MS)) return true;
  return nowMs >= window.EXAM_START_MS && nowMs <= window.EXAM_END_MS;
};
