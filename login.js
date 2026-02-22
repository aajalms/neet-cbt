// login.js (works with your login.html ids + config.js API_URL)

const msg = document.getElementById("msg");

function setMsg(t, ok=false){
  msg.textContent = t;
  msg.style.color = ok ? "green" : "crimson";
}

function safeParse(s){ try{return JSON.parse(s)}catch{return null} }

// If already logged in, go to exam
const existing = safeParse(localStorage.getItem("neet_candidate")||"");
if (existing && existing.token) location.href = "exam.html";

// ✅ Must match login.html button id="loginBtn"
document.getElementById("loginBtn").addEventListener("click", async () => {

  // ✅ Must match login.html input ids
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const candidateId = document.getElementById("cid").value.trim();
  const password = document.getElementById("pwd").value.trim();

  if(!name || !phone || !email || !candidateId || !password){
    return setMsg("Fill all fields.");
  }

  if(!window.API_URL){
    return setMsg("API_URL missing (check config.js)", false);
  }

  setMsg("Checking...", true);

  try{
    const res = await fetch(window.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // no CORS preflight
      body: JSON.stringify({
        action: "login",
        name, phone, email, candidateId, password
      })
    });

    const data = await res.json();

    if(!data.ok){
      return setMsg(data.error || "Login failed");
    }

    // ✅ save exactly what Apps Script returns
    localStorage.setItem("neet_candidate", JSON.stringify({
      token: data.token,
      candidateId: data.candidateId,
      name: data.name,
      phone: data.phone,
      email: data.email
    }));

    // reset exam
    localStorage.removeItem("neet_exam_state");
    localStorage.removeItem("neet_submitted");
    localStorage.removeItem("neet_result");

    location.href = "exam.html";
  }catch(e){
    setMsg("Network error: " + e.message);
  }
});

const pwd = document.getElementById("pwd");
const toggle = document.getElementById("togglePwd");

if (toggle) {
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
