# Life Command Center - Developer Guide 📘

This guide explains the architecture, code structure, and how to maintain the Life Command Center (LCC) application.

## 🏗️ Architecture Overview

The application is a **Single Page Application (SPA)** built with Vanilla JavaScript.
- **Frontend**: HTML, CSS, JS. No build system (Webpack/Parcels) required.
- **Backend**: Firebase Firestore (Database) & Authentication.
- **State**: Managed in global variables (`currentUser`, `currentTasks`, etc.) within `script.js`.

## 📂 File Structure

- **`index.html`**: The main entry point. Contains the HTML structure for all "modules" (Dashboard, Tasks, Projects, etc.). Modules are div containers toggled via JS.
- **`styles.css`**: Global styles using CSS Variables for theming (Light/Dark).
- **`script.js`**: Contains ALL application logic.
    -   Firebase Init
    -   Auth Logic (Login/Signup)
    -   Navigation (Module switching)
    -   CRUD Operations (Tasks, Projects, Goals)
    -   focus Mode Logic (Timer)
- **`filter-system.js`**: Handles task filtering (All, Today, Upcoming).

## 🛠️ Key Systems

### 1. Navigation ("Modules")
The app doesn't use URL routing. Instead, it hides/shows `<div>` elements with the class `.module`.
```javascript
function showModule(moduleName) {
    // Hides all .module elements
    // Shows #moduleNameModule
}
```

### 2. Data Loading
When a user logs in, `loadData()` is called. It triggers:
- `loadTasks()`
- `loadProjects()`
- `loadGoals()`
- `loadLearning()`

Each function fetches from Firestore and renders the HTML immediately.

### 3. Dynamic HTML Generation
The app generates HTML strings in JavaScript strings (using backticks \`\`) and injects them into the DOM.
**Important**: When editing HTML in `script.js`, ALWAYS ensure you use backticks (\`) for multi-line strings.

### 4. Firebase Schema
- **Collections**:
    -   `users`: `{ name, email, createdAt }`
    -   `tasks`: `{ title, priority, category, status, userId, timeBlock: {start, end} }`
    -   `projects`: `{ title, status, description, userId }`
    -   `goals`: `{ title, deadline, status, userId }`
    -   `learning_courses`: `{ title, platform, userId }`

## 🐛 Common Issues & Fixes

### "SyntaxError: Invalid or unexpected token"
- **Cause**: Usually missing backticks (\`) around HTML templates in `script.js`.
- **Fix**: Check `modalHtml` variables or `innerHTML` assignments.

### Data Not Loading
- **Cause**: Firebase Config might be invalid or expired.
- **Fix**: Check `firebaseConfig` object at the top of `script.js`. Ensure you aren't using the demo credentials in production.

## 🚀 Adding a New Feature

1.  **HTML**: Add a new `<div id="newModule" class="module">` in `index.html`.
2.  **Nav**: Add a button in `<aside>` in `index.html`.
3.  **JS**:
    -   Add `loadNewFeature()` function.
    -   Add `renderNewFeature()` function.
    -   Add Hook in `loadData()` to call your load function.

## 🔒 Security
- Currently, API keys are exposed in `script.js`. This is standard for Firebase Client SDKs, but you must ensure your **Firestore Security Rules** in the Firebase Console prevent unauthorized access.
    -   Rule pattern: `allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;`
