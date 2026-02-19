<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "neet-cbt.firebaseapp.com",
  projectId: "neet-cbt",
  storageBucket: "neet-cbt.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};

const app = initializeApp(firebaseConfig);

window.db = getFirestore(app);
window.storage = getStorage(app);
window.collection = collection;
window.addDoc = addDoc;
window.ref = ref;
window.uploadBytes = uploadBytes;
window.onSnapshot = onSnapshot;
</script>