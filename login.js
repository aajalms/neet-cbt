/***********************
 LOGIN -> Apps Script -> token stored in localStorage
***********************/

// ✅ PASTE your Apps Script Web App URL here:
const API_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

const msg = document.getElementById("msg");

function setMsg(text, ok=false){
  msg.textContent = text;
  msg.className = ok ? "msg ok" : "msg";
}

function safeJsonParse(str){
  try { return JSON.parse(str); } catch { return null; }
}

// If already logged in, go to exam directly
const existing = safeJsonParse(localStorage.getItem("neet_candidate") || "");
if (existing && existing.token && existing.id) {
  window.location.href = "index.html";
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const id = document.getElementById("cid").value.trim();
  const password = document.getElementById("pwd").value.trim();

  if (!id || !password) return setMsg("Enter Candidate ID and Password.");

  setMsg("Checking...", true);

  try{
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ action:"login", id, password })
    });

    const data = await res.json();

    if (!data.ok) return setMsg(data.error || "Login failed");

    localStorage.setItem("neet_candidate", JSON.stringify({
      id: data.id,
      name: data.name || "",
      token: data.token,
      loginAt: new Date().toISOString()
    }));

    setMsg("Login success. Redirecting...", true);
    window.location.href = "index.html";
  } catch(e){
    setMsg("Network error: " + e);
  }
});
