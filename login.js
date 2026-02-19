import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/* 🔥 FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let isAdmin = false;

/* 🔄 TOGGLE LOGIN TYPE */
window.toggleLogin = function () {
  isAdmin = !isAdmin;
  document.getElementById("title").innerText = isAdmin ? "Admin Login" : "Student Login";
  document.getElementById("roll").style.display = isAdmin ? "none" : "block";
  document.getElementById("email").style.display = isAdmin ? "block" : "none";
};

/* 🔐 LOGIN */
window.login = async function () {
  const password = document.getElementById("password").value;

  try {
    if (isAdmin) {
      const email = document.getElementById("email").value;
      await signInWithEmailAndPassword(auth, email, password);
      location.href = "admin.html";

    } else {
      const roll = document.getElementById("roll").value;
      const fakeEmail = roll + "@neetpg.local";

      await signInWithEmailAndPassword(auth, fakeEmail, password);

      // Save roll locally
      sessionStorage.setItem("rollNo", roll);
      location.href = "index.html";
    }

  } catch (e) {
    alert("Login failed");
  }
};