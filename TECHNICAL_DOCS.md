# 🧘 Technical Manual: Life Command Center

## 1. System Overview
**Type**: Personal Productivity Dashboard (SPA)
**Backend**: Firebase (Firestore Auth + Database)
**Frontend**: Vanilla JS
**Key Feature**: "Focus Mode" aimed at ADHD/Productivity (Time-blocked task execution).

## 2. Code Logic Analysis (`script.js`)

### A. The "Focus Mode" Loop
**Function**: `Schedule.detectActiveTask()` (Implemented)
**Triggers**: Runs every 30 seconds (`setInterval` in `App.startFocusDetection()`).
**Logic**:
1.  Gets current system time (HH:MM) via `Schedule.getCurrentTime()`.
2.  Scans tasks array for tasks with `timeBlock` property.
3.  Finds a task where `currentTime >= task.timeBlock.start` AND `currentTime < task.timeBlock.end`.
4.  If found, `UI.renderFocusMode()` displays:
    *   **Focus Card** with task details, category, and time range.
    *   **Countdown Timer** (`UI.startFocusTimer()`) showing time remaining (updates every second).
    *   **Action Buttons**: Complete Task, Skip.
5.  Timer changes color to orange when <5 minutes remaining, red when expired.

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
