# 🧘 Technical Manual: Life Command Center

## 1. System Overview
**Type**: Personal Productivity Dashboard (SPA)
**Backend**: Firebase (Firestore Auth + Database)
**Frontend**: Vanilla JS
**Key Feature**: "Focus Mode" aimed at ADHD/Productivity (Time-blocked task execution).

## 2. Code Logic Analysis (`script.js`)

### A. The "Focus Mode" Loop
**Function**: `detectActiveTask()` (Lines 663-678)
**Triggers**: Runs every 60 seconds (`setInterval`).
**Logic**:
1.  Gets current system time (HH:MM).
2.  Scans `currentTasks` array.
3.  Finds a task where `currentTime >= task.start` AND `currentTime <= task.end`.
4.  If found, calls `setActiveTask(task)` which:
    *   Switches the UI to show the **Focus Card** (Line 706).
    *   Starts a countdown timer (`startFocusTimer`) showing time remaining for that block.

### B. Kanban Board Rendering
**Function**: `renderTaskList()`
**Logic**:
*   Constructs 3 HTML columns strings: `#col-todo`, `#col-progress`, `#col-done`.
*   Iterates through tasks and injects them based on `task.status`.
*   **Drag & Drop**: Uses HTML5 Native DnD API (`ondragstart`, `ondrop`).
    *   When dropped, it performs an **Optimistic Update** (Updates UI array first) before calling Firestore, making the UI feel instant.

### C. Date Handling ("Today" Filter)
**Function**: `isToday(date)`
**Usage**: Used in `renderDashboard()` to count "Today's Done" vs "Pending".
**Logic**: Compares `date.getDate()`, `Month`, and `Year` with `new Date()`. Crucial for the "Daily Reset" feel of the dashboard.

## 3. Data Dictionary (Firestore/NoSQL)

**Collections**:

| Collection | Document Structure (JSON) | Notes |
| :--- | :--- | :--- |
| **`tasks`** | `{ title, category, priority, status, timeBlock: {start, end}, userId, createdAt }` | `userId` links task to user (Multi-user ready). |
| **`projects`** | `{ title, description, userId }` | Parent container for tasks (Loose relationship via `projectId`). |
| **`users`** | `{ name, email, createdAt }` | Basic profile data. |

## 4. Security & Configuration
**Auth**: Firebase Email/Password.
**Security**:
*   Code relies on `userId` filtering in queries (`.where('userId', '==', currentUser.uid)`).
*   **Critical**: Must ensure Firestore Rules enforce this `userId` check on the server side to prevent data leaks.
