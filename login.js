// login.js (works with your login.html ids + config.js API_URL)

const msg = document.getElementById("msg");

function setMsg(t, ok = false) {
  msg.textContent = t;
  msg.style.color = ok ? "green" : "crimson";
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ✅ If already logged in -> instructions (not directly exam)
const existing = safeParse(localStorage.getItem("neet_candidate") || "");
if (existing && existing.token) location.replace("instructions.html");

// ✅ Must match login.html button id="loginBtn"
document.getElementById("loginBtn").addEventListener("click", async () => {
  // ✅ Must match login.html input ids
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const candidateId = document.getElementById("cid").value.trim();
  const password = document.getElementById("pwd").value.trim();

  if (!name || !phone || !email || !candidateId || !password) {
    return setMsg("Fill all fields.");
  }

  if (!window.API_URL) {
    return setMsg("API_URL missing (check config.js)");
  }

  setMsg("Checking...", true);

  try {
    const res = await fetch(window.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // ✅ no CORS preflight
      body: JSON.stringify({
        action: "login",
        name, phone, email, candidateId, password
      })
    });

    const data = await res.json();

    if (!data.ok) {
      return setMsg(data.error || "Login failed");
    }

    // ✅ Save what Apps Script returns (keep candidateId field consistent)
    localStorage.setItem("neet_candidate", JSON.stringify({
      token: data.token,
      candidateId: data.candidateId || candidateId,
      name: data.name || name,
      phone: data.phone || phone,
      email: data.email || email
    }));

    // reset exam
    localStorage.removeItem("neet_exam_state");
    localStorage.removeItem("neet_submitted");
    localStorage.removeItem("neet_result");

    // ✅ Go to instructions page (replace = no back)
    location.replace("instructions.html");
  } catch (e) {
    setMsg("Network error: " + e.message);
  }
});

// Show/Hide password (optional)
const pwd = document.getElementById("pwd");
const toggle = document.getElementById("togglePwd");

if (toggle && pwd) {
  toggle.addEventListener("click", () => {
    if (pwd.type === "password") {
      pwd.type = "text";
      toggle.textContent = "🙈";
    } else {
      pwd.type = "password";
      toggle.textContent = "👁";
    }
  });
}
