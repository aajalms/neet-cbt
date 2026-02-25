// ==============================
// login.js
// ==============================

const msgEl = document.getElementById("msg");

function setMsg(text, ok = false) {
  msgEl.textContent = text;
  msgEl.style.color = ok ? "#1b5e20" : "#c62828";
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ✅ If already logged in -> go to instructions
(function autoRedirectIfLoggedIn() {
  const existing = safeParse(localStorage.getItem("neet_candidate") || "");
  if (existing && existing.token) {
    location.replace("instructions.html");
  }
})();

// ✅ Toggle password (used by the eye button in HTML)
function togglePassword() {
  const pwd = document.getElementById("pwd");
  pwd.type = pwd.type === "password" ? "text" : "password";
}
window.togglePassword = togglePassword;

// ✅ Main login function (called from HTML onclick)
async function login() {
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const candidateId = document.getElementById("cid").value.trim();
  const password = document.getElementById("pwd").value.trim();

  if (!fullName || !phone || !email || !candidateId || !password) {
    return setMsg("Fill all fields.");
  }

  if (!window.API_URL) {
    return setMsg("API_URL missing (check config.js).");
  }

  setMsg("Checking...", true);

  try {
    const res = await fetch(window.API_URL, {
      method: "POST",
      // ✅ text/plain avoids CORS preflight for Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "login",
        name: fullName,
        phone,
        email,
        candidateId,
        password,
      }),
    });

    // Apps Script sometimes returns text; parse safely
    const raw = await res.text();
    const data = safeParse(raw);

    if (!data) {
      return setMsg("Invalid server response. Check Apps Script output.");
    }

    if (!data.ok) {
      return setMsg(data.error || "Login failed.");
    }

    // ✅ Save session
    localStorage.setItem(
      "neet_candidate",
      JSON.stringify({
        token: data.token,
        candidateId: data.candidateId || candidateId,
        name: data.name || fullName,
        phone: data.phone || phone,
        email: data.email || email,
      })
    );

    // ✅ Reset exam state so each login starts fresh
    localStorage.removeItem("neet_exam_state");
    localStorage.removeItem("neet_submitted");
    localStorage.removeItem("neet_result");

    setMsg("Login success. Redirecting...", true);
    location.replace("instructions.html");
  } catch (e) {
    setMsg("Network error: " + e.message);
  }
}

window.login = login;
