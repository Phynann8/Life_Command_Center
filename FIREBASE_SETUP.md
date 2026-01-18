# 🔥 Firebase Setup Guide

To make the "Life Command Center" work online, you need to create your own free Firebase project.

## Step 1: Create Project
1.  Go to [console.firebase.google.com](https://console.firebase.google.com/).
2.  Click **"Add project"**.
3.  Name it (e.g., `life-command-center`).
4.  Disable Google Analytics (optional, makes setup faster).
5.  Click **"Create project"**.

## Step 2: Enable Database (Firestore)
1.  In the left sidebar, click **Build** -> **Firestore Database**.
2.  Click **"Create database"**.
3.  Choose a location (e.g., `nam5 (us-central)`).
4.  **Important**: Choose **Start in test mode** for now.
    -   *Note*: This allows access for 30 days. Later you can secure it.
5.  Click **Create**.

## Step 3: Enable Authentication
1.  In the left sidebar, click **Build** -> **Authentication**.
2.  Click **"Get started"**.
3.  Click **"Email/Password"**.
4.  Toggle **"Enable"** (leave "Email link" off).
5.  Click **Save**.

## Step 4: Get Your Keys
1.  Click the **Gear Icon ⚙️** (Project Overview) -> **Project settings**.
2.  Scroll down to "Your apps".
3.  Click the **Web icon (`</>`)**.
4.  Nickname the app (e.g., `Web`). Click **Register app**.
5.  You will see a code block called `const firebaseConfig = { ... };`.

## Step 5: Update Your Code
1.  Copy the `firebaseConfig` object from the console.
2.  Open your local file: `e:\Website_Development\Life_Command_Center\script.js`.
3.  **Replace lines 2-10** with your new config.

```javascript
// REPLACE THIS PART IN script.js
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456...",
    appId: "1:123456..."
};
```

## Step 6: Test
Refresh your browser (`index.html`). Sign up correctly this time. It should work!

---

# Alternative: Supabase ⚡

You asked about Supabase. It is a great alternative to Firebase (uses SQL instead of NoSQL).

| Feature | Firebase (Current) | Supabase |
| :--- | :--- | :--- |
| **Database** | NoSQL (Document-based) | PostgreSQL (Table-based) |
| **Effort to Switch** | **Easy** (Just swap config) | **Hard** (Rewrite all DB calls in `script.js`) |
| **Pricing** | Free Tier good | Free Tier excellent |

### How to switch to Supabase?
Since the app is currently written for Firebase, switching to Supabase would require **rewriting 60% of `script.js`**.
1.  Install Supabase JS client (`<script src="...supabase.js">`).
2.  Replace `db.collection('tasks').add(...)` with `supabase.from('tasks').insert(...)`.
3.  Replace Auth login logic.

**Recommendation**: Stick with Firebase for now to get it running quickly. If you want to learn SQL later, we can migrate it.
