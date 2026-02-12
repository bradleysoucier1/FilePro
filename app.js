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
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
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
const folderForm = document.querySelector("#folder-form");
const folderNameInput = document.querySelector("#folder-name");
const currentFolderText = document.querySelector("#current-folder");
const folderList = document.querySelector("#folder-list");
const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#file-input");
const fileList = document.querySelector("#file-list");
const statusText = document.querySelector("#status");
const userEmail = document.querySelector("#user-email");
const uploadProgress = document.querySelector("#upload-progress");

let unsubscribeFiles = null;
let unsubscribeFolders = null;
let activeFolderId = null;

const setStatus = (message, isError = false) => {
  statusText.textContent = message;
  statusText.style.color = isError ? "#fca5a5" : "#86efac";
};

const clearFiles = () => {
  fileList.innerHTML = "";
};

const clearFolders = () => {
  folderList.innerHTML = "";
};

const getFolderIdFromHash = () => {
  const hash = window.location.hash || "";
  const match = hash.match(/^#folder\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const setFolderHash = (folderId) => {
  if (folderId) {
    window.location.hash = `#folder/${encodeURIComponent(folderId)}`;
    return;
  }

  if (window.location.hash) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
};

const renderFiles = (docs) => {
  clearFiles();

  if (docs.length === 0) {
    fileList.innerHTML = "<li>No files in this folder yet.</li>";
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

const renderFolders = (folders) => {
  clearFolders();

  const rootLi = document.createElement("li");
  rootLi.innerHTML = `
    <div>
      <strong>📁 Root</strong><br>
      <small>Open root folder</small>
    </div>
    <div class="file-actions">
      <button type="button" data-open-folder-id="">Go</button>
    </div>
  `;
  folderList.appendChild(rootLi);

  if (folders.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = "<div><small>No subfolders yet.</small></div>";
    folderList.appendChild(li);
    return;
  }

  folders.forEach((folder) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>📁 ${folder.name}</strong><br>
        <small>ID: ${folder.id}</small>
      </div>
      <div class="file-actions">
        <button type="button" data-open-folder-id="${folder.id}">Open</button>
        <button type="button" data-rename-folder-id="${folder.id}" data-folder-name="${folder.name}" class="secondary">Rename</button>
        <button type="button" data-delete-folder-id="${folder.id}" class="danger">Delete</button>
      </div>
    `;
    folderList.appendChild(li);
  });
};

const watchFiles = (uid, folderId) => {
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
      const files = snapshot.docs
        .map((fileDoc) => ({
          id: fileDoc.id,
          ...fileDoc.data(),
        }))
        .filter((file) => (file.folderId || null) === (folderId || null));
      renderFiles(files);
    },
    (error) => {
      setStatus(error.message, true);
    }
  );
};

const watchFolders = (uid) => {
  if (unsubscribeFolders) {
    unsubscribeFolders();
  }

  const foldersQuery = query(
    collection(db, "users", uid, "folders"),
    orderBy("name", "asc")
  );

  unsubscribeFolders = onSnapshot(
    foldersQuery,
    (snapshot) => {
      const folders = snapshot.docs.map((folderDoc) => ({
        id: folderDoc.id,
        ...folderDoc.data(),
      }));
      renderFolders(folders);
    },
    (error) => {
      setStatus(error.message, true);
    }
  );
};

const setCurrentFolderLabel = async (uid, folderId) => {
  if (!folderId) {
    currentFolderText.textContent = "Current folder: Root";
    return;
  }

  const folderRef = doc(db, "users", uid, "folders", folderId);
  const folderSnap = await getDoc(folderRef);

  if (!folderSnap.exists()) {
    setFolderHash(null);
    activeFolderId = null;
    currentFolderText.textContent = "Current folder: Root";
    setStatus("Folder does not exist. Returned to root.", true);
    return;
  }

  const folder = folderSnap.data();
  currentFolderText.textContent = `Current folder: ${folder.name}`;
};

const applyFolderFromHash = async (uid) => {
  activeFolderId = getFolderIdFromHash();
  await setCurrentFolderLabel(uid, activeFolderId);
  watchFiles(uid, activeFolderId);
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

folderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  const name = folderNameInput.value.trim();
  const submitButton = folderForm.querySelector("button[type='submit']");

  if (!user) {
    setStatus("You must be signed in to create a folder.", true);
    return;
  }

  if (!name) {
    setStatus("Folder name cannot be empty.", true);
    return;
  }

  submitButton.disabled = true;
  setStatus("Creating folder...");

  try {
    const folderDoc = await addDoc(collection(db, "users", user.uid, "folders"), {
      name,
      createdAt: Timestamp.now(),
    });

    folderForm.reset();
    setFolderHash(folderDoc.id);
    setStatus("Folder created.");
  } catch (error) {
    setStatus(error.message || "Failed to create folder.", true);
  } finally {
    submitButton.disabled = false;
  }
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
  const storagePath = `users/${user.uid}/${activeFolderId || "root"}/${Date.now()}-${safeName}`;
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
          folderId: activeFolderId || null,
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

folderList.addEventListener("click", async (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    return;
  }

  const openFolderId = target.dataset.openFolderId;
  if (openFolderId !== undefined) {
    setFolderHash(openFolderId || null);
    return;
  }

  const renameFolderId = target.dataset.renameFolderId;
  if (renameFolderId) {
    const currentName = target.dataset.folderName || "";
    const nextName = window.prompt("Rename folder", currentName)?.trim();

    if (!nextName) {
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid, "folders", renameFolderId), {
        name: nextName,
      });
      setStatus("Folder renamed.");
    } catch (error) {
      setStatus(error.message || "Failed to rename folder.", true);
    }

    return;
  }

  const deleteFolderId = target.dataset.deleteFolderId;
  if (!deleteFolderId) {
    return;
  }

  if (!window.confirm("Delete this folder? Files will be moved to Root.")) {
    return;
  }

  target.disabled = true;

  try {
    const filesInFolderQuery = query(
      collection(db, "users", user.uid, "files"),
      where("folderId", "==", deleteFolderId)
    );
    const filesInFolder = await getDocs(filesInFolderQuery);

    for (const fileDoc of filesInFolder.docs) {
      await updateDoc(doc(db, "users", user.uid, "files", fileDoc.id), {
        folderId: null,
      });
    }

    await deleteDoc(doc(db, "users", user.uid, "folders", deleteFolderId));

    if (activeFolderId === deleteFolderId) {
      setFolderHash(null);
    }

    setStatus("Folder deleted. Files moved to Root.");
  } catch (error) {
    setStatus(error.message || "Failed to delete folder.", true);
  } finally {
    target.disabled = false;
  }
});

window.addEventListener("hashchange", async () => {
  const user = auth.currentUser;
  if (!user) {
    return;
  }
  await applyFolderFromHash(user.uid);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userEmail.textContent = `Signed in as ${user.email}`;
    watchFolders(user.uid);
    await applyFolderFromHash(user.uid);
  } else {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    userEmail.textContent = "";
    uploadProgress.textContent = "";
    currentFolderText.textContent = "Current folder: Root";
    clearFiles();
    clearFolders();
    activeFolderId = null;

    if (unsubscribeFiles) {
      unsubscribeFiles();
      unsubscribeFiles = null;
    }

    if (unsubscribeFolders) {
      unsubscribeFolders();
      unsubscribeFolders = null;
    }
  }
});
