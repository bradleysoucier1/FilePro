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
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getBytes,
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
const shareSection = document.querySelector("#share-section");
const shareMeta = document.querySelector("#share-meta");
const shareOpenLink = document.querySelector("#share-open-link");
const shareBackBtn = document.querySelector("#share-back-btn");
const shareFileList = document.querySelector("#share-file-list");
const textFileForm = document.querySelector("#text-file-form");
const textFileNameInput = document.querySelector("#text-file-name");
const textFileContentInput = document.querySelector("#text-file-content");
const saveTextFileBtn = document.querySelector("#save-text-file-btn");
const cancelTextEditBtn = document.querySelector("#cancel-text-edit-btn");

const createRipple = (event) => {
  const button = event.currentTarget;
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const rect = button.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple";

  const diameter = Math.max(rect.width, rect.height);
  const radius = diameter / 2;
  const left = event.clientX - rect.left - radius;
  const top = event.clientY - rect.top - radius;

  ripple.style.width = `${diameter}px`;
  ripple.style.height = `${diameter}px`;
  ripple.style.left = `${left}px`;
  ripple.style.top = `${top}px`;

  const existing = button.querySelector(".ripple");
  if (existing) {
    existing.remove();
  }

  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
};

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest("button");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  createRipple({
    currentTarget: button,
    clientX: event.clientX,
    clientY: event.clientY,
  });
});

let unsubscribeFiles = null;
let unsubscribeFolders = null;
let activeFolderId = null;
let editingTextFile = null;

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

const getShareIdFromHash = () => {
  const hash = window.location.hash || "";
  const match = hash.match(/^#share\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const getShareUrl = (shareId) => `${window.location.origin}${window.location.pathname}#share/${encodeURIComponent(shareId)}`;

const showSection = (section) => {
  authSection.classList.add("hidden");
  appSection.classList.add("hidden");
  shareSection.classList.add("hidden");
  section.classList.remove("hidden");
};

const renderShareFileList = (files = []) => {
  shareFileList.innerHTML = "";

  if (!Array.isArray(files) || files.length === 0) {
    shareFileList.innerHTML = "<li>No files available in this shared folder.</li>";
    return;
  }

  files.forEach((file) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${file.name || "Unnamed file"}</strong><br>
        <small>${(((file.size || 0) / 1024)).toFixed(1)} KB</small>
      </div>
      <div class="file-actions">
        <a href="${file.downloadURL}" target="_blank" rel="noopener noreferrer">Open</a>
      </div>
    `;
    shareFileList.appendChild(li);
  });
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

const sanitizeTxtFileName = (name) => {
  const trimmed = name.trim();
  const safeBase = (trimmed || "untitled")
    .replace(/\.txt$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80) || "untitled";
  return `${safeBase}.txt`;
};

const resetTextFileEditor = () => {
  editingTextFile = null;
  textFileForm.reset();
  saveTextFileBtn.textContent = "Save .txt";
  cancelTextEditBtn.classList.add("hidden");
};

const isTxtFile = (file) => file?.type === "text/plain" || /\.txt$/i.test(file?.name || "");

const decodeUtf8Bytes = (uint8) => {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(uint8);
};

const loadTextContentForEdit = async (fileData) => {
  if (typeof fileData.textContent === "string") {
    return fileData.textContent;
  }

  if (!fileData.storagePath) {
    throw new Error("Text file storage path is missing.");
  }

  try {
    const bytes = await getBytes(ref(storage, fileData.storagePath));
    return decodeUtf8Bytes(bytes);
  } catch (storageError) {
    if (fileData.downloadURL) {
      const response = await fetch(fileData.downloadURL, { cache: "no-store" });
      if (!response.ok) {
        throw storageError;
      }
      return await response.text();
    }

    throw storageError;
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

    const textEditButton = isTxtFile(item)
      ? `<button type="button" data-edit-text-id="${item.id}" class="secondary">Edit text</button>`
      : "";

    const shareButton = item.shareId
      ? `<button type="button" data-unshare-id="${item.id}" data-share-id="${item.shareId}" class="secondary">Unshare</button>
         <button type="button" data-copy-share-id="${item.shareId}" class="secondary">Copy link</button>`
      : `<button type="button" data-share-id="${item.id}" class="secondary">Share</button>`;

    li.innerHTML = `
      <div>
        <strong>${item.name}</strong><br>
        <small>${(item.size / 1024).toFixed(1)} KB • ${uploadedAt.toLocaleString()}</small>
      </div>
      <div class="file-actions">
        <a href="${item.downloadURL}" target="_blank" rel="noopener noreferrer">Open</a>
        ${textEditButton}
        ${shareButton}
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
    const folderShareButtons = folder.shareId
      ? `<button type="button" data-folder-unshare-id="${folder.id}" data-share-id="${folder.shareId}" class="secondary">Unshare</button>
         <button type="button" data-folder-copy-share-id="${folder.shareId}" class="secondary">Copy link</button>`
      : `<button type="button" data-folder-share-id="${folder.id}" class="secondary">Share</button>`;

    li.innerHTML = `
      <div>
        <strong>📁 ${folder.name}</strong><br>
        <small>ID: ${folder.id}</small>
      </div>
      <div class="file-actions">
        <button type="button" data-open-folder-id="${folder.id}">Open</button>
        ${folderShareButtons}
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

const openShareView = async (shareId) => {
  try {
    const sharedDoc = await getDoc(doc(db, "publicShares", shareId));
    if (!sharedDoc.exists()) {
      throw new Error("Shared file link is invalid or expired.");
    }

    const data = sharedDoc.data();
    const isFolderShare = data.kind === "folder";

    if (isFolderShare) {
      shareMeta.textContent = `${data.name || "Shared folder"} • shared by ${data.ownerEmail || "FilePro user"}`;
      shareOpenLink.textContent = "Open folder owner profile";
      shareOpenLink.href = `${window.location.pathname}`;
      renderShareFileList(data.files || []);
      shareFileList.classList.remove("hidden");
    } else {
      shareMeta.textContent = `${data.name || "Shared file"} • shared by ${data.ownerEmail || "FilePro user"}`;
      shareOpenLink.textContent = "Open shared file";
      shareOpenLink.href = data.downloadURL;
      renderShareFileList([]);
      shareFileList.classList.add("hidden");
    }

    showSection(shareSection);
    setStatus("Opened shared link.");
  } catch (error) {
    shareMeta.textContent = "";
    shareOpenLink.href = "#";
    renderShareFileList([]);
    showSection(auth.currentUser ? appSection : authSection);
    setStatus(error.message || "Unable to open shared link.", true);
  }
};

const handleRoute = async (user) => {
  const shareId = getShareIdFromHash();
  if (shareId) {
    if (unsubscribeFiles) {
      unsubscribeFiles();
      unsubscribeFiles = null;
    }
    if (unsubscribeFolders) {
      unsubscribeFolders();
      unsubscribeFolders = null;
    }
    await openShareView(shareId);
    return;
  }

  if (user) {
    showSection(appSection);
    userEmail.textContent = `Signed in as ${user.email}`;
    watchFolders(user.uid);
    await applyFolderFromHash(user.uid);
  } else {
    showSection(authSection);
    userEmail.textContent = "";
    uploadProgress.textContent = "";
    currentFolderText.textContent = "Current folder: Root";
    clearFiles();
    clearFolders();
    activeFolderId = null;
    resetTextFileEditor();

    if (unsubscribeFiles) {
      unsubscribeFiles();
      unsubscribeFiles = null;
    }

    if (unsubscribeFolders) {
      unsubscribeFolders();
      unsubscribeFolders = null;
    }
  }
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

textFileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    setStatus("You must be signed in.", true);
    return;
  }

  const fileName = sanitizeTxtFileName(textFileNameInput.value);
  const content = textFileContentInput.value;

  saveTextFileBtn.disabled = true;

  try {
    const blob = new Blob([content], { type: "text/plain" });
    const storagePath = editingTextFile?.storagePath || `users/${user.uid}/${activeFolderId || "root"}/txt/${Date.now()}-${fileName}`;
    const uploadTask = uploadBytesResumable(ref(storage, storagePath), blob);

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", null, reject, resolve);
    });

    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

    if (editingTextFile) {
      await updateDoc(doc(db, "users", user.uid, "files", editingTextFile.id), {
        name: fileName,
        size: blob.size,
        type: "text/plain",
        downloadURL,
        updatedAt: serverTimestamp(),
        textContent: content,
      });
      setStatus("Text file updated.");
    } else {
      await addDoc(collection(db, "users", user.uid, "files"), {
        name: fileName,
        size: blob.size,
        type: "text/plain",
        storagePath,
        folderId: activeFolderId || null,
        downloadURL,
        createdAt: serverTimestamp(),
        textContent: content,
      });
      setStatus("Text file created.");
    }

    resetTextFileEditor();
  } catch (error) {
    setStatus(error.message || "Failed to save text file.", true);
  } finally {
    saveTextFileBtn.disabled = false;
  }
});

cancelTextEditBtn.addEventListener("click", () => {
  resetTextFileEditor();
  setStatus("Edit cancelled.");
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

  const user = auth.currentUser;
  if (!user) {
    return;
  }

  const editTextId = target.dataset.editTextId;
  if (editTextId) {
    target.disabled = true;
    try {
      const fileDocRef = doc(db, "users", user.uid, "files", editTextId);
      const fileSnap = await getDoc(fileDocRef);

      if (!fileSnap.exists()) {
        throw new Error("Text file no longer exists.");
      }

      const fileData = fileSnap.data();
      const content = await loadTextContentForEdit(fileData);

      editingTextFile = {
        id: editTextId,
        storagePath: fileData.storagePath,
      };
      textFileNameInput.value = fileData.name || "notes.txt";
      textFileContentInput.value = content;
      saveTextFileBtn.textContent = "Update .txt";
      cancelTextEditBtn.classList.remove("hidden");
      textFileNameInput.focus();
      setStatus("Editing text file.");
    } catch (error) {
      setStatus(error.message || "Failed to load text file.", true);
    } finally {
      target.disabled = false;
    }
    return;
  }

  const copyShareId = target.dataset.copyShareId;
  if (copyShareId) {
    try {
      await navigator.clipboard.writeText(getShareUrl(copyShareId));
      setStatus("Share link copied.");
    } catch (error) {
      setStatus("Unable to copy link. Copy it manually: " + getShareUrl(copyShareId), true);
    }
    return;
  }

  const shareFileId = target.dataset.shareId;
  if (shareFileId && !target.dataset.unshareId) {
    target.disabled = true;
    try {
      const fileSnap = await getDoc(doc(db, "users", user.uid, "files", shareFileId));
      if (!fileSnap.exists()) {
        throw new Error("File not found.");
      }
      const fileData = fileSnap.data();
      const shareId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).replace(/[^a-zA-Z0-9-]/g, "");
      await setDoc(doc(db, "publicShares", shareId), {
        ownerUid: user.uid,
        ownerEmail: user.email || "",
        fileId: shareFileId,
        name: fileData.name,
        downloadURL: fileData.downloadURL,
        storagePath: fileData.storagePath,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "files", shareFileId), { shareId });
      setStatus("File shared. Link copied.");
      try { await navigator.clipboard.writeText(getShareUrl(shareId)); } catch {}
    } catch (error) {
      setStatus(error.message || "Failed to share file.", true);
    } finally {
      target.disabled = false;
    }
    return;
  }

  const unshareFileId = target.dataset.unshareId;
  if (unshareFileId) {
    target.disabled = true;
    try {
      const shareId = target.dataset.shareId;
      if (shareId) {
        await deleteDoc(doc(db, "publicShares", shareId));
      }
      await updateDoc(doc(db, "users", user.uid, "files", unshareFileId), { shareId: null });
      setStatus("File unshared.");
    } catch (error) {
      setStatus(error.message || "Failed to unshare file.", true);
    } finally {
      target.disabled = false;
    }
    return;
  }

  const fileId = target.dataset.deleteId;
  const storagePath = target.dataset.storagePath;

  if (!fileId || !storagePath) {
    return;
  }

  target.disabled = true;

  try {
    const fileSnap = await getDoc(doc(db, "users", user.uid, "files", fileId));
    const shareId = fileSnap.exists() ? fileSnap.data().shareId : null;

    await deleteObject(ref(storage, storagePath));
    await deleteDoc(doc(db, "users", user.uid, "files", fileId));
    if (shareId) {
      await deleteDoc(doc(db, "publicShares", shareId));
    }

    if (editingTextFile?.id === fileId) {
      resetTextFileEditor();
    }

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

  const folderCopyShareId = target.dataset.folderCopyShareId;
  if (folderCopyShareId) {
    try {
      await navigator.clipboard.writeText(getShareUrl(folderCopyShareId));
      setStatus("Folder share link copied.");
    } catch {
      setStatus("Unable to copy link. Copy it manually: " + getShareUrl(folderCopyShareId), true);
    }
    return;
  }

  const folderShareId = target.dataset.folderShareId;
  if (folderShareId) {
    target.disabled = true;
    try {
      const folderSnap = await getDoc(doc(db, "users", user.uid, "folders", folderShareId));
      if (!folderSnap.exists()) {
        throw new Error("Folder not found.");
      }
      const folderData = folderSnap.data();
      const filesSnap = await getDocs(query(collection(db, "users", user.uid, "files"), where("folderId", "==", folderShareId)));
      const files = filesSnap.docs.map((d) => {
        const f = d.data();
        return {
          id: d.id,
          name: f.name || "Unnamed file",
          size: f.size || 0,
          type: f.type || "application/octet-stream",
          downloadURL: f.downloadURL || "",
        };
      }).filter((f) => Boolean(f.downloadURL));

      const shareId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).replace(/[^a-zA-Z0-9-]/g, "");
      await setDoc(doc(db, "publicShares", shareId), {
        ownerUid: user.uid,
        ownerEmail: user.email || "",
        kind: "folder",
        folderId: folderShareId,
        name: folderData.name,
        files,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "folders", folderShareId), { shareId });
      setStatus("Folder shared. Link copied.");
      try { await navigator.clipboard.writeText(getShareUrl(shareId)); } catch {}
    } catch (error) {
      setStatus(error.message || "Failed to share folder.", true);
    } finally {
      target.disabled = false;
    }
    return;
  }

  const folderUnshareId = target.dataset.folderUnshareId;
  if (folderUnshareId) {
    target.disabled = true;
    try {
      const shareId = target.dataset.shareId;
      if (shareId) {
        await deleteDoc(doc(db, "publicShares", shareId));
      }
      await updateDoc(doc(db, "users", user.uid, "folders", folderUnshareId), { shareId: null });
      setStatus("Folder unshared.");
    } catch (error) {
      setStatus(error.message || "Failed to unshare folder.", true);
    } finally {
      target.disabled = false;
    }
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

    const folderSnap = await getDoc(doc(db, "users", user.uid, "folders", deleteFolderId));
    const shareId = folderSnap.exists() ? folderSnap.data().shareId : null;

    await deleteDoc(doc(db, "users", user.uid, "folders", deleteFolderId));
    if (shareId) {
      await deleteDoc(doc(db, "publicShares", shareId));
    }

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

shareBackBtn.addEventListener("click", () => {
  if (auth.currentUser) {
    if (activeFolderId) {
      window.location.hash = `#folder/${encodeURIComponent(activeFolderId)}`;
    } else {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      handleRoute(auth.currentUser);
    }
  } else {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    handleRoute(null);
  }
});

window.addEventListener("hashchange", async () => {
  await handleRoute(auth.currentUser);
});

onAuthStateChanged(auth, async (user) => {
  await handleRoute(user);
});
