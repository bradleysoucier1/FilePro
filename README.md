# FilePro

A lightweight personal file storage app using Firebase Auth, Firestore, and Firebase Storage.

## Features

- Email/password sign-up and sign-in
- Google sign-in with popup
- Create folders and navigate directly with hash routes like `/#folder/<folder-id>`
- Rename and delete folders
- Create and edit `.txt` files directly in-app
- Share and unshare files/folders with hash links like `/#share/<share-id>`
- Upload files to Firebase Storage (root or selected folder)
- Store file metadata in Firestore
- List user folders/files in real time
- Open and delete uploaded files

## Run locally

Because the app uses browser ES modules, run it with a local web server:

```bash
python3 -m http.server 4173
```

Then open: `http://localhost:4173`.

## Firebase requirements

Enable the following in your Firebase project:

1. **Authentication**
   - Email/Password provider
   - Google provider
2. **Firestore Database** (in production or test mode)
3. **Storage**

### Suggested Firestore security rules

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/files/{fileId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/folders/{folderId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /publicShares/{shareId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Suggested Storage security rules

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
