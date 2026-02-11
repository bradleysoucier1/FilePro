import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCQMwNjsfoGci5FJbt7_qbObf71dg-PLfU",
  authDomain: "filepro-38c07.firebaseapp.com",
  projectId: "filepro-38c07",
  storageBucket: "filepro-38c07.firebasestorage.app",
  messagingSenderId: "357529685419",
  appId: "1:357529685419:web:7850a7c57b9bd0a89d56ee",
  measurementId: "G-WT4WJXNE1B",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

if (await isSupported()) {
  getAnalytics(app);
}

const authSection = document.querySelector("#auth-section");
const appSection = document.querySelector("#app-section");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const authForm = document.querySelector("#auth-form");
const signupBtn = document.querySelector("#signup-btn");
const googleBtn = document.querySelector("#google-btn");
const logoutBtn = document.querySelector("#logout-btn");
const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#file-input");
const fileList = document.querySelector("#file-list");
const statusText = document.querySelector("#status");
const userEmail = document.querySelector("#user-email");
const uploadProgress = document.querySelector("#upload-progress");

let unsubscribeFiles = null;

const setStatus = (message, isError = false) => {
  statusText.textContent = message;
  statusText.style.color = isError ? "#fca5a5" : "#86efac";
};

const clearFiles = () => {
  fileList.innerHTML = "";
};

const renderFiles = (docs) => {
  clearFiles();

  if (docs.length === 0) {
    fileList.innerHTML = "<li>No files uploaded yet.</li>";
    return;
  }

  docs.forEach((item) => {
    const li = document.createElement("li");
    const uploadedAt = item.createdAt?.toDate?.() || new Date();

    li.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        <small>${(item.size / 1024).toFixed(1)} KB • ${uploadedAt.toLocaleString()}</small>
      </div>
      <div class="file-actions">
        <a href="${item.downloadURL}" target="_blank" rel="noopener noreferrer">Open</a>
        <button type="button" data-delete-id="${item.id}" data-storage-path="${item.storagePath}" class="secondary">Delete</button>
      </div>
    `;

    fileList.appendChild(li);
  });
};

const watchFiles = (uid) => {
  if (unsubscribeFiles) {
    unsubscribeFiles();
  }

  const filesQuery = query(
    collection(db, "users", uid, "files"),
    orderBy("createdAt", "desc")
  );

  unsubscribeFiles = onSnapshot(
    filesQuery,
    (snapshot) => {
      const files = snapshot.docs.map((fileDoc) => ({
        id: fileDoc.id,
        ...fileDoc.data(),
      }));
      renderFiles(files);
    },
    (error) => {
      setStatus(error.message, true);
    }
  );
};

const provider = new GoogleAuthProvider();

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
    setStatus("Signed in successfully.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

signupBtn.addEventListener("click", async () => {
  try {
    await createUserWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
    setStatus("Account created and signed in.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

googleBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
    setStatus("Signed in with Google.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  setStatus("Logged out.");
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  const file = fileInput.files?.[0];

  if (!user || !file) {
    setStatus("Please sign in and choose a file.", true);
    return;
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `users/${user.uid}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on(
    "state_changed",
    (snapshot) => {
      const percent = Math.round(
        (snapshot.bytesTransferred / snapshot.totalBytes) * 100
      );
      uploadProgress.textContent = `Upload progress: ${percent}%`;
    },
    (error) => {
      uploadProgress.textContent = "";
      setStatus(error.message, true);
    },
    async () => {
      try {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "users", user.uid, "files"), {
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          storagePath,
          downloadURL,
          createdAt: serverTimestamp(),
        });

        uploadProgress.textContent = "";
        uploadForm.reset();
        setStatus("File uploaded successfully.");
      } catch (error) {
        uploadProgress.textContent = "";
        setStatus(error.message, true);
      }
    }
  );
});

fileList.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const fileId = target.dataset.deleteId;
  const storagePath = target.dataset.storagePath;
  const user = auth.currentUser;

  if (!fileId || !storagePath || !user) {
    return;
  }

  target.disabled = true;

  try {
    await deleteObject(ref(storage, storagePath));
    await deleteDoc(doc(db, "users", user.uid, "files", fileId));
    setStatus("File deleted.");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    target.disabled = false;
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userEmail.textContent = `Signed in as ${user.email}`;
    watchFiles(user.uid);
  } else {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    userEmail.textContent = "";
    uploadProgress.textContent = "";
    clearFiles();

    if (unsubscribeFiles) {
      unsubscribeFiles();
      unsubscribeFiles = null;
    }
  }
});
