# Firestore Database Connection Debugging Guide

## Problem
**Error**: "Some manuscript partitions failed to synchronize" / "Creation failure: Access denied or network instability."

**UI Location**: Dashboard shows "No projects found" with yellow/red error alerts about network instability.

---

## Root Cause Flow

```
App.tsx (lines 393-501)
    ↓
Firestore query fails: collection(db, 'projects')
    ↓
onSnapshot listener catches error (line 488)
    ↓
Notification: "Some manuscript partitions failed to synchronize."
    ↓
Stops trying to load projects
```

---

## How to Debug (Step by Step)

### **1. Open Browser DevTools Console**

**Chrome/Firefox/Safari:**
- Press `F12` or `Cmd+Option+I` (Mac)
- Go to **Console** tab
- Look for red/orange errors

**Expected output when failing:**
```
Firestore Error:  {"error":"[projectfailed: Missing or insufficient permissions.]","isQuotaExceeded":false,"operationType":"list","path":"projects","authInfo":{...}}
```

---

### **2. Check Firebase Configuration**

**File**: `firebase-applet-config.json`

**What to verify:**
```json
{
  "projectId": "YOUR_PROJECT_ID",
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_PROJECT.firebaseapp.com",
  "databaseURL": "https://YOUR_PROJECT.firebaseio.com"
}
```

**Action**: 
- Is `projectId` correct?
- Is `apiKey` present and valid?
- Compare against your Firebase Console project

---

### **3. Check Authentication State**

**In Console, run:**
```javascript
// Is user authenticated?
const auth = window.firebase?.auth?.currentUser;
console.log("User UID:", auth?.uid);
console.log("User Email:", auth?.email);
console.log("Is Anonymous:", auth?.isAnonymous);
```

**Expected:**
- If logged in: UID and email should appear
- If guest mode: `isAnonymous: true`
- If NOT authenticated: `null`

**If null or anonymous, try:**
1. Log out (Disconnect Session in sidebar)
2. Log back in with Google
3. Check if error persists

---

### **4. Check Firestore Security Rules**

**File**: `firestore.rules`

**Current rule should allow:**
```
allow read, write: if request.auth.uid == resource.data.ownerId
allow read, write: if request.auth.uid in resource.data.collaborators
```

**Problem**: If rules are restrictive, user may not be able to query projects.

**To fix:**
1. Go to Firebase Console → Firestore → Rules
2. Replace with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.ownerId || 
        request.auth.uid in resource.data.collaborators ||
        !exists(resource)
      );
    }
    match /projects/{projectId}/{subcollection}/{document=**} {
      allow read, write: if request.auth != null && (
        request.auth.uid == get(/databases/$(database)/documents/projects/$(projectId)).data.ownerId ||
        request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.collaborators
      );
    }
  }
}
```
3. **Publish** the rules

---

### **5. Check Network Tab**

**In DevTools:**
- Go to **Network** tab
- Filter by `firebaseio.com`
- Reload the page
- Look for failed requests with **403** (Permission) or **504** (Timeout) status

**If 403 Permission Denied:**
- Issue is Firestore security rules (step 4)

**If 504 Timeout:**
- Firestore service is down or network unreachable

**If CORS error:**
- Firebase domain not whitelisted in your app

---

### **6. Check Firestore Quotas**

**Firebase Console:**
1. Go to Firestore Database
2. Check **Quota** or **Usage** tab
3. If **Read/Write Operations** quota exceeded:
   - Upgrade to **Blaze Plan** (pay-as-you-go)
   - Or wait for daily reset (midnight UTC)

---

### **7. Enable Firestore Logging**

**In your app (add to `src/main.tsx` temporarily):**

```typescript
import { enableLogging } from 'firebase/firestore';
enableLogging(true);
```

This will print detailed Firestore requests/responses in console.

---

## Common Error Messages & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `permission-denied` | Security rules block query | Update `firestore.rules` |
| `unauthenticated` | User not logged in | Log in with Google or Guest |
| `unavailable` | Firestore service down | Wait & retry, or check Firebase status |
| `deadline-exceeded` | Request timeout | Check network, reduce query size |
| `resource-exhausted` | Quota exceeded | Upgrade Firebase plan |
| `failed-precondition` | Document missing/malformed | Check document structure in console |

---

## App.tsx Error Handling

**Lines 488–495**: Error handler logs notification but doesn't retry.

**Current:**
```typescript
}, (err) => {
  console.error(`Snapshot Query ${idx} failed:`, err);
  initialFires.add(idx);
  if (initialFires.size === queries.length) {
    setIsProjectsLoading(false);
    addNotification("Some manuscript partitions failed to synchronize.", "info");
  }
});
```

**Better approach** (add exponential backoff retry):
```typescript
}, (err) => {
  console.error(`Snapshot Query ${idx} failed:`, err);
  
  // Log detailed error
  if (err.code === 'permission-denied') {
    addNotification('Access denied. Check Firestore security rules.', 'error');
  } else if (err.code === 'unauthenticated') {
    addNotification('Not authenticated. Please log in again.', 'error');
  } else {
    addNotification(`Sync failed: ${err.message}`, 'error');
  }
  
  initialFires.add(idx);
  if (initialFires.size === queries.length) {
    setIsProjectsLoading(false);
  }
});
```

---

## Quick Checklist

- [ ] User is authenticated (check Console: `firebase.auth.currentUser`)
- [ ] Firebase config (`firebase-applet-config.json`) is correct
- [ ] Firestore security rules allow reads from `projects` collection
- [ ] Firebase quota not exceeded (check Console → Usage)
- [ ] Network tab shows successful requests to `firebaseio.com`
- [ ] No CORS errors in Console
- [ ] Firestore service status is **Green** (check [status.firebase.google.com](https://status.firebase.google.com))

---

## Still Not Working?

**Add temporary logging to App.tsx (lines 393–406):**

```typescript
useEffect(() => {
  if (!user) {
    setProjects([]);
    setIsProjectsLoading(false);
    return;
  }

  // DEBUG: Log auth state
  console.log('[Project Sync Debug]', {
    userId: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
    authProvider: user.providerData[0]?.providerId
  });

  const queries = [
    query(collection(db, 'projects'), where('ownerId', '==', user.uid)),
    query(collection(db, 'projects'), where('collaborators', 'array-contains', user.uid))
  ];

  // ... rest of code
```

Then **screenshot the Console output** and check:
- User UID matches Firestore documents
- Queries are structured correctly
- Error codes are specific

---

## References

- [Firebase Firestore Error Codes](https://firebase.google.com/docs/firestore/troubleshoot)
- [Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)
- [Quota Limits](https://firebase.google.com/docs/firestore/quotas)
