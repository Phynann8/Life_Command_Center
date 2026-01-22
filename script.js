// ==========================================
// Life Command Center - script.js
// Corrected and documented version
// ==========================================

// -----------------------------
// CONFIGURATIONS & UTILITIES
// -----------------------------
const Config = {
    // Replace the following with your Firebase project config if different.
    firebase: {
        apiKey: "AIzaSyB9IQEjLgnUoGh3-cJZ03pi249aG5_kKlI",
        authDomain: "life-command-center.firebaseapp.com",
        projectId: "life-command-center",
        storageBucket: "life-command-center.firebasestorage.app",
        messagingSenderId: "947642257927",
        appId: "1:947642257927:web:ee8a236024e7ad53ed90a2",
        measurementId: "G-V1G70237X7"
    }
};

// Utilities: handles multiple input date types (ISO string, number, Date, Firestore Timestamp)
const Utils = {
    isToday: (value) => {
        if (!value) return false;
        let d;
        // Firestore Timestamp has toDate()
        if (value && typeof value.toDate === 'function') d = value.toDate();
        else d = new Date(value);

        if (isNaN(d.getTime())) return false;
        const now = new Date();
        return d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
    },
    formatTime: (value) => {
        let d;
        if (value && typeof value.toDate === 'function') d = value.toDate();
        else d = new Date(value);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};

// -----------------------------
// FIREBASE INITIALIZATION
// -----------------------------
if (!firebase.apps.length) {
    firebase.initializeApp(Config.firebase);
}
const db = firebase.firestore();
const auth = firebase.auth();
const FieldValue = firebase.firestore.FieldValue;

// -----------------------------
// DATA MODULE (Firestore ops)
// -----------------------------
const Data = {
    Tasks: {
        fetch: async (userId) => {
            if (!userId) return [];
            const snap = await db.collection('tasks')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        add: async (userId, task) => {
            return db.collection('tasks').add({
                userId,
                ...task,
                createdAt: FieldValue.serverTimestamp()
            });
        },
        update: async (id, data) => db.collection('tasks').doc(id).update(data),
        delete: async (id) => db.collection('tasks').doc(id).delete()
    },
    Projects: {
        fetch: async (userId) => {
            if (!userId) return [];
            const snap = await db.collection('projects')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        add: async (userId, data) => {
            return db.collection('projects').add({ userId, ...data, createdAt: FieldValue.serverTimestamp() });
        },
        update: async (id, data) => db.collection('projects').doc(id).update(data),
        delete: async (id) => db.collection('projects').doc(id).delete()
    },
    Goals: {
        fetch: async (userId) => {
            if (!userId) return [];
            const snap = await db.collection('goals')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        add: async (userId, data) => {
            return db.collection('goals').add({ userId, ...data, createdAt: FieldValue.serverTimestamp() });
        },
        delete: async (id) => db.collection('goals').doc(id).delete()
    },
    Learnings: {
        fetch: async (userId) => {
            if (!userId) return [];
            const snap = await db.collection('learnings')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        add: async (userId, data) => {
            return db.collection('learnings').add({ userId, ...data, createdAt: FieldValue.serverTimestamp() });
        },
        delete: async (id) => db.collection('learnings').doc(id).delete()
    }
};

// -----------------------------
// SCHEDULE HELPERS
// -----------------------------
const Schedule = {
    generateSlots: () => {
        const slots = [];
        for (let i = 6; i < 24; i++) {
            const hour = i.toString().padStart(2, '0');
            slots.push(`${hour}:00`);
            slots.push(`${hour}:30`);
        }
        return slots;
    },
    // getTaskForSlot compares HH:MM strings from task.timeBlock
    getTaskForSlot: (tasks = [], slot) => {
        return tasks.find(t => {
            if (!t.timeBlock) return false;
            return slot >= t.timeBlock.start && slot < t.timeBlock.end;
        });
    },
    // conflict detection using string HH:MM comparisons
    checkConflict: (tasks = [], newStart, newEnd) => {
        return tasks.some(task => {
            if (!task.timeBlock) return false;
            if (task.status === 'completed') return false;
            const taskStart = task.timeBlock.start;
            const taskEnd = task.timeBlock.end;
            return (newStart < taskEnd && newEnd > taskStart);
        });
    }
};

// -----------------------------
// AUTH MODULE
// -----------------------------
const Auth = {
    init: (onLogin, onLogout) => {
        auth.onAuthStateChanged(user => user ? onLogin(user) : onLogout());
    },
    login: async (email, password) => {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message || String(e) };
        }
    },
    signup: async (email, password, name) => {
        try {
            const res = await auth.createUserWithEmailAndPassword(email, password);
            await res.user.updateProfile({ displayName: name });
            await db.collection('users').doc(res.user.uid).set({
                name, email, createdAt: FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message || String(e) };
        }
    },
    logout: () => auth.signOut(),
    guestLogin: async () => {
        // Mock guest user (no Firebase auth)
        return { success: true, user: { uid: 'guest123', displayName: 'Guest User', email: 'guest@local.test' } };
    },
    updateProfile: async (name) => {
        try {
            const user = auth.currentUser;
            if (user) {
                await user.updateProfile({ displayName: name });
                await db.collection('users').doc(user.uid).update({ name: name });
                return { success: true };
            } else {
                return { success: false, error: 'No user signed in' };
            }
        } catch (e) {
            return { success: false, error: e.message || String(e) };
        }
    }
};

// -----------------------------
// UI MODULE (renderers, modals, toasts)
// -----------------------------
const UI = {
    startClock: () => {
        const update = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            const dateString = now.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: '2-digit'
            }).replace(/ /g, '-');

            const dateEl = document.getElementById('systemDate');
            const timeEl = document.getElementById('systemTime');

            if (dateEl) dateEl.textContent = dateString;
            if (timeEl) timeEl.textContent = timeString;
        };
        update();
        setInterval(update, 1000);
    },

    toggleTheme: () => {
        const root = document.documentElement;
        const current = root.getAttribute('data-theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        if (next === 'light') root.setAttribute('data-theme', 'light');
        else root.removeAttribute('data-theme');
        localStorage.setItem('theme', next);
        UI.updateThemeIcon(next);
    },

    updateThemeIcon: (theme) => {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.textContent = theme === 'light' ? '☀️' : '🌙';
        }
    },

    showToast: (message, type = 'info') => {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    },

    showModule: (name) => {
        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        const target = document.getElementById(`${name}Module`);
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const btn = Array.from(document.querySelectorAll('.nav-item')).find(b =>
            b.getAttribute('onclick') && b.getAttribute('onclick').includes(name)
        );
        if (btn) btn.classList.add('active');

        const title = name.charAt(0).toUpperCase() + name.slice(1);
        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = title;

        // close mobile menu if open
        const nav = document.getElementById('sidebarNav');
        if (nav && nav.classList.contains('active')) nav.classList.remove('active');
    },

    showModal: (html) => {
        const container = document.getElementById('modalContainer');
        container.innerHTML = html;
        container.classList.add('active');
    },

    closeModal: () => {
        const container = document.getElementById('modalContainer');
        if (container) {
            container.classList.remove('active');
            container.innerHTML = ''; // clear content to avoid duplicate IDs/events
        }
    },

    renderGoalsHub: (goals = [], projects = [], learnings = [], tasks = []) => {
        const listEl = document.getElementById('goalsList');
        if (!listEl) return;

        if (goals.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><p>No goals set yet.</p></div>';
            return;
        }

        const projectsByGoal = {};
        projects.forEach(p => {
            if (p.goalId) {
                if (!projectsByGoal[p.goalId]) projectsByGoal[p.goalId] = [];
                projectsByGoal[p.goalId].push(p);
            }
        });

        const learningsByGoal = {};
        learnings.forEach(l => {
            if (l.goalId) {
                if (!learningsByGoal[l.goalId]) learningsByGoal[l.goalId] = [];
                learningsByGoal[l.goalId].push(l);
            }
        });

        listEl.innerHTML = goals.map(g => {
            const gProjects = projectsByGoal[g.id] || [];
            const gLearnings = learningsByGoal[g.id] || [];
            return `
                <div class="goal-card">
                    <div class="goal-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <h3>🎯 ${g.title}</h3>
                        <div class="actions">
                            <span class="badge badge-${g.category || 'general'}">${g.category || 'Career'}</span>
                            <button class="btn-icon" onclick="App.deleteGoal('${g.id}')">🗑️</button>
                        </div>
                    </div>
                    <div class="sub-list">
                        <strong>Projects:</strong>
                        ${gProjects.length ? gProjects.map(p => `<span class="tag">🚀 ${p.title}</span>`).join('') : '<span class="text-muted">None</span>'}
                    </div>
                    <div class="sub-list">
                        <strong>Learning:</strong>
                        ${gLearnings.length ? gLearnings.map(l => `<span class="tag">📚 ${l.title}</span>`).join('') : '<span class="text-muted">None</span>'}
                    </div>
                    <div class="goal-actions" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                        <button class="btn btn-sm btn-outline" onclick="App.openProjectModal('${g.id}')">+ Project</button>
                        <button class="btn btn-sm btn-outline" onclick="App.openLearningModal('${g.id}')">+ Learning</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderLearningHub: (learnings = []) => {
        const listEl = document.getElementById('learningList');
        if (!listEl) return;

        if (learnings.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><p>No learning paths set yet.</p></div>';
            return;
        }

        listEl.innerHTML = learnings.map(l => `
             <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                 <h3>📚 ${l.title}</h3>
                 <button class="btn-icon" onclick="App.deleteLearning('${l.id}')">🗑️</button>
             </div>
         `).join('');
    },

    renderSchedule: (tasks = []) => {
        const container = document.getElementById('scheduleModule');
        if (!container) return;

        const slots = Schedule.generateSlots();
        let html = `
            <div class="module-header">
                <h2>📅 Daily Schedule</h2>
                <div class="date-display">${new Date().toLocaleDateString()}</div>
            </div>
            <div class="schedule-timeline">
        `;

        slots.forEach(slot => {
            const task = Schedule.getTaskForSlot(tasks, slot);
            let content = '';
            let className = 'time-content';

            if (task) {
                className += ' occupied';
                content = `
                    <div class="timeline-task ${task.category || ''}-bg" onclick="App.editTask('${task.id}')">
                        <span class="time">${task.timeBlock.start} - ${task.timeBlock.end}</span>
                        <span class="title">${task.title}</span>
                    </div>
                `;
            } else {
                content = `<div class="free-slot" onclick="App.openAddTaskModalWithTime('${slot}')">+</div>`;
            }

            html += `
                <div class="time-row">
                    <div class="time-label">${slot}</div>
                    <div class="${className}">
                        ${content}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    renderProjectsHub: (projects = [], tasks = []) => {
        const container = document.getElementById('projectsModule');
        if (!container) return;

        if (projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🚀 No Active Projects</h3>
                    <p>Start a new project to organize your big goals.</p>
                    <button class="btn btn-primary" onclick="App.openProjectModal()">+ Create Project</button>
                </div>
            `;
            return;
        }

        let html = `
            <div class="module-header">
                <h2>🚀 Active Projects</h2>
                <button class="btn btn-primary btn-sm" onclick="App.openProjectModal()">+ New Project</button>
            </div>
            <div class="projects-grid">
        `;

        projects.forEach(p => {
            const pTasks = tasks.filter(t => t.projectId === p.id);
            const total = pTasks.length;
            const done = pTasks.filter(t => t.status === 'completed').length;
            const progress = total === 0 ? 0 : Math.round((done / total) * 100);

            html += `
                <div class="project-card" onclick="App.openProjectDetails('${p.id}')">
                    <div class="project-header">
                        <div class="project-icon">${p.icon || '🚀'}</div>
                        <div class="project-options">
                            <button class="btn-project btn-outline btn-change" onclick="event.stopPropagation(); App.editProject('${p.id}')">Edit</button>
                            <button class="btn-project btn-outline btn-cancel" onclick="event.stopPropagation(); App.deleteProject('${p.id}')">Delete</button>
                        </div>
                    </div>
                    <h3 class="project-title">${p.title}</h3>
                    <p class="project-desc">${p.description || 'No description'}</p>
                    <div class="project-meta">
                        <span class="task-count">${done}/${total} Tasks</span>
                        <span class="deadline">${p.deadline ? '📅 ' + new Date(p.deadline).toLocaleDateString() : ''}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    renderDashboard: (tasks = []) => {
        const todayDone = tasks.filter(t => t.status === 'completed' && Utils.isToday(t.createdAt)).length;
        const todayPending = tasks.filter(t => t.status !== 'completed' && Utils.isToday(t.createdAt)).length;

        const doneEl = document.getElementById('todayDoneCount');
        const pendingEl = document.getElementById('todayPendingCount');
        if (doneEl) doneEl.textContent = todayDone;
        if (pendingEl) pendingEl.textContent = todayPending;

        const totalToday = todayDone + todayPending;
        const productivity = totalToday === 0 ? 0 : Math.round((todayDone / totalToday) * 100);
        const prodEl = document.getElementById('productivityStat');
        if (prodEl) prodEl.textContent = `${productivity}%`;

        const schedContainer = document.getElementById('miniSchedule');
        const scheduled = tasks.filter(t => t.timeBlock && t.status !== 'completed').sort((a, b) => a.timeBlock.start.localeCompare(b.timeBlock.start));

        if (schedContainer) {
            if (scheduled.length > 0) {
                schedContainer.innerHTML = scheduled.slice(0, 3).map(t => `
                    <div class="schedule-item">
                        <span class="schedule-time">${t.timeBlock.start}</span>
                        <span class="schedule-title">${t.title}</span>
                    </div>
                `).join('');
            } else {
                schedContainer.innerHTML = '<div class="empty-state">No scheduled tasks for today.</div>';
            }
        }
    },

    renderTaskList: (tasks = [], filter = 'all') => {
        const container = document.getElementById('fullTaskList');
        if (!container) return;

        let filtered = [...tasks];
        if (filter === 'today') filtered = tasks.filter(t => Utils.isToday(t.createdAt));
        if (filter === 'upcoming') filtered = tasks.filter(t => t.status !== 'completed');
        if (filter === 'high') filtered = tasks.filter(t => t.priority === 'high');

        if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state">No tasks found.</div>';
            return;
        }

        container.innerHTML = `
            <div class="kanban-board">
                <div class="kanban-column" id="col-todo"><h3>📝 To Do</h3><div class="kanban-items"></div></div>
                <div class="kanban-column" id="col-progress"><h3>🏃 In Progress</h3><div class="kanban-items"></div></div>
                <div class="kanban-column" id="col-done"><h3>✅ Done</h3><div class="kanban-items"></div></div>
            </div>
        `;

        filtered.forEach(task => {
            let status = task.status;
            if (status !== 'in_progress' && status !== 'completed') status = 'todo';

            const item = document.createElement('div');
            item.className = `task-item ${task.priority || 'medium'}-priority ${status}`;
            item.draggable = true;

            let icon = status === 'completed' ? '✅' : (status === 'in_progress' ? '⏳' : '⬜');

            item.innerHTML = `
                <div class="task-checkbox" onclick="App.toggleStatus('${task.id}', '${status}')">
                    ${icon}
                </div>
                <div class="task-details">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="badge badge-${task.category || 'general'}">${task.category || 'general'}</span>
                        ${task.timeBlock ? `<span class="time-badge">🕒 ${task.timeBlock.start} - ${task.timeBlock.end}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-edit" onclick="event.stopPropagation(); App.editTask('${task.id}')">Edit</button>
                    <button class="btn-icon btn-delete" onclick="event.stopPropagation(); App.deleteTask('${task.id}')">Delete</button>
                </div>
            `;

            if (status === 'todo') container.querySelector('#col-todo .kanban-items').appendChild(item);
            else if (status === 'in_progress') container.querySelector('#col-progress .kanban-items').appendChild(item);
            else container.querySelector('#col-done .kanban-items').appendChild(item);
        });
    }
};

// -----------------------------
// APP CONTROLLER
// -----------------------------
const App = {
    state: {
        user: null,
        tasks: [],
        projects: [],
        goals: [],
        learnings: []
    },

    init: () => {
        // Attach Auth Event Listeners
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        if (loginForm) loginForm.addEventListener('submit', App.handleLogin);
        if (signupForm) signupForm.addEventListener('submit', App.handleSignup);

        Auth.init(
            async (user) => {
                App.state.user = user;
                const authContainer = document.getElementById('authContainer');
                const appContainer = document.getElementById('appContainer');
                if (authContainer) authContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = 'flex';
                document.getElementById('userName').textContent = user.displayName || user.email || 'User';
                document.getElementById('userAvatar').textContent = (user.displayName || user.email || 'U')[0].toUpperCase();

                // Theme init
                const savedTheme = localStorage.getItem('theme') || 'dark';
                if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
                else document.documentElement.removeAttribute('data-theme');
                UI.updateThemeIcon(savedTheme);

                UI.startClock();
                await App.refresh();
            },
            () => {
                App.state.user = null;
                const authContainer = document.getElementById('authContainer');
                const appContainer = document.getElementById('appContainer');
                if (authContainer) authContainer.style.display = 'flex';
                if (appContainer) appContainer.style.display = 'none';
            }
        );
    },

    refresh: async () => {
        if (!App.state.user) return;

        const uid = App.state.user.uid;
        try {
            // Fetch everything in parallel
            const [tasks, projects, goals, learnings] = await Promise.all([
                Data.Tasks.fetch(uid),
                Data.Projects.fetch(uid),
                Data.Goals.fetch(uid),
                Data.Learnings.fetch(uid)
            ]);

            App.state.tasks = tasks || [];
            App.state.projects = projects || [];
            App.state.goals = goals || [];
            App.state.learnings = learnings || [];

            UI.renderDashboard(App.state.tasks);
            UI.renderTaskList(App.state.tasks);

            // Re-render active module if needed
            const activeModule = document.querySelector('.module.active');
            if (activeModule && activeModule.id === 'projectsModule') {
                UI.renderProjectsHub(App.state.projects, App.state.tasks);
            }
            // Always refresh Goals/Learning if loaded
            if (App.state.goals) UI.renderGoalsHub(App.state.goals, App.state.projects, App.state.learnings, App.state.tasks);
            if (App.state.learnings) UI.renderLearningHub(App.state.learnings);
        } catch (err) {
            console.error('Refresh error', err);
            UI.showToast('Failed to refresh data. Check console for details.', 'error');
        }
    },

    // Auth & UI helpers
    switchAuthTab: (tab) => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        const tabs = document.querySelectorAll('.auth-tab');
        if (tab === 'login') tabs[0].classList.add('active');
        else tabs[1].classList.add('active');
        document.getElementById(`${tab}Form`).classList.add('active');
    },

    handleLogin: async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        UI.showToast('Authenticating...', 'info');
        const res = await Auth.login(email, password);
        if (res.success) {
            UI.showToast('Welcome back!', 'success');
        } else {
            console.error(res.error);
            let msg = 'Login failed. Please check your credentials.';
            if (res.error && res.error.includes && res.error.includes('auth/user-not-found')) msg = 'User not found.';
            if (res.error && res.error.includes && res.error.includes('auth/wrong-password')) msg = 'Incorrect password.';
            if (res.error && res.error.toLowerCase && res.error.toLowerCase().includes('network')) msg = 'Network error. Try Guest Mode if testing locally.';
            UI.showToast(msg, 'error');
        }
    },

    handleGuestLogin: async () => {
        const res = await Auth.guestLogin();
        App.state.user = res.user;
        UI.showToast('Logged in as Guest', 'info');

        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('userName').textContent = res.user.displayName;
        document.getElementById('userAvatar').textContent = 'G';

        // guest mock state
        App.state.tasks = [];
        App.state.projects = [];
        App.state.goals = [];
        App.state.learnings = [];
        UI.renderDashboard([]);
        UI.renderTaskList([]);
    },

    handleSignup: async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const name = document.getElementById('signupName').value;

        if (password.length < 6) {
            UI.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        const res = await Auth.signup(email, password, name);
        if (res.success) {
            UI.showToast('Account created successfully!', 'success');
        } else {
            UI.showToast(res.error || 'Signup failed', 'error');
        }
    },

    handleLogout: () => Auth.logout(),

    // Task modals & forms
    openAddTaskModal: (startTime = '') => {
        const projectOptions = App.state.projects.map(p => `<option value="${p.id}">🚀 ${p.title}</option>`).join('');
        const learningOptions = App.state.learnings.map(l => `<option value="${l.id}">📚 ${l.title}</option>`).join('');
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Task</h3></div>
                <form onsubmit="App.handleAddTask(event)">
                    <input type="hidden" id="taskId">
                    <div class="form-group"><label for="taskTitle">Title</label><input id="taskTitle" required autofocus placeholder="What do you need to do?"></div>
                    <div class="form-row">
                        <div class="form-group"><label for="taskCategory">Category</label><select id="taskCategory" class="form-select">
                            <option value="work">💼 Work</option><option value="personal">🏠 Personal</option>
                            <option value="study">📚 Study</option><option value="project">🚀 Project</option>
                        </select></div>
                        <div class="form-group"><label for="taskPriority">Priority</label><select id="taskPriority" class="form-select">
                            <option value="medium">Medium</option><option value="high">High</option>
                            <option value="low">Low</option>
                        </select></div>
                    </div>
                    <div class="form-group">
                        <label for="taskParentId">Link to Parent (Optional)</label>
                        <select id="taskParentId" class="form-select">
                            <option value="">-- None --</option>
                            <optgroup label="Projects">${projectOptions}</optgroup>
                            <optgroup label="Learning Paths">${learningOptions}</optgroup>
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label for="taskStart">Start</label><input type="time" id="taskStart" value="${startTime}"></div>
                        <div class="form-group"><label for="taskEnd">End</label><input type="time" id="taskEnd" value="${startTime ? startTime.split(':')[0] + ':59' : ''}"></div>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-outline btn-cancel" onclick="closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Save Task</button></div>
                </form>
            </div>
        `);
    },

    openAddTaskModalWithTime: (startTime) => {
        App.openAddTaskModal(startTime);
    },

    handleAddTask: async (e) => {
        e.preventDefault();
        const id = document.getElementById('taskId').value;
        const title = document.getElementById('taskTitle').value;
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;
        const start = document.getElementById('taskStart').value;
        const end = document.getElementById('taskEnd').value;

        if (start && end) {
            if (end <= start) {
                UI.showToast('End time must be after start time', 'error');
                return;
            }
            const otherTasks = id ? App.state.tasks.filter(t => t.id !== id) : App.state.tasks;
            const hasConflict = Schedule.checkConflict(otherTasks, start, end);
            if (hasConflict) {
                if (!confirm('⚠️ Conflict detected! You already have a task at this time. Save anyway?')) {
                    return;
                }
            }
        }

        const taskData = { title, category, priority, status: 'todo' };

        const parentId = document.getElementById('taskParentId').value;
        if (parentId) {
            const isProject = App.state.projects.find(p => p.id === parentId);
            if (isProject) taskData.projectId = parentId;
            else taskData.learningId = parentId;
        }

        if (start && end) taskData.timeBlock = { start, end };

        try {
            if (id) {
                await Data.Tasks.update(id, taskData);
                UI.showToast('Task updated', 'success');
            } else {
                await Data.Tasks.add(App.state.user.uid, taskData);
                UI.showToast('Task created', 'success');
            }
            UI.closeModal();
            App.refresh();
        } catch (err) {
            console.error('Task save failed', err);
            UI.showToast('Failed to save task', 'error');
        }
    },

    // Toggle status: todo -> in_progress -> completed -> todo
    toggleStatus: async (id, currentStatus) => {
        let newStatus = currentStatus === 'in_progress' ? 'completed' : (currentStatus === 'completed' ? 'todo' : 'in_progress');
        try {
            await Data.Tasks.update(id, { status: newStatus });
            App.refresh();
        } catch (err) {
            console.error('Toggle failed', err);
            UI.showToast('Failed to update status', 'error');
        }
    },

    deleteTask: async (id) => {
        if (confirm('Delete?')) {
            try {
                await Data.Tasks.delete(id);
                App.refresh();
            } catch (err) {
                console.error('Delete failed', err);
                UI.showToast('Failed to delete task', 'error');
            }
        }
    },

    // Profile
    openEditProfileModal: () => {
        const currentName = App.state.user ? (App.state.user.displayName || App.state.user.email) : 'User';
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>Edit Profile</h3><button class="btn-close" onclick="closeModal()">×</button></div>
                <form onsubmit="App.handleUpdateProfile(event)">
                    <div class="form-group">
                        <label for="editProfileName">Display Name</label>
                        <input id="editProfileName" type="text" value="${currentName}" required autofocus>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleUpdateProfile: async (e) => {
        e.preventDefault();
        const newName = document.getElementById('editProfileName').value;

        UI.showToast('Updating profile...', 'info');

        if (App.state.user && App.state.user.uid === 'guest123') {
            App.state.user.displayName = newName;
            document.getElementById('userName').textContent = newName;
            document.getElementById('userAvatar').textContent = newName[0].toUpperCase();
            UI.showToast('Profile updated (Guest Mode)', 'success');
            UI.closeModal();
            return;
        }

        const res = await Auth.updateProfile(newName);
        if (res.success) {
            UI.showToast('Profile updated successfully!', 'success');
            App.state.user.displayName = newName;
            document.getElementById('userName').textContent = newName;
            document.getElementById('userAvatar').textContent = newName[0].toUpperCase();
            UI.closeModal();
        } else {
            UI.showToast(res.error || 'Failed to update profile', 'error');
        }
    },

    // Projects/Goals/Learnings modals and handlers
    openGoalModal: () => {
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Goal</h3></div>
                <form onsubmit="App.handleCreateGoal(event)">
                    <div class="form-group"><label for="goalTitle">Title</label><input id="goalTitle" required autofocus></div>
                    <div class="form-group"><label for="goalCategory">Category</label><select id="goalCategory" class="form-select">
                        <option value="career">💼 Career</option><option value="health">💪 Health</option>
                        <option value="finance">💰 Finance</option><option value="personal">🏠 Personal</option>
                    </select></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Goal</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleCreateGoal: async (e) => {
        e.preventDefault();
        const title = document.getElementById('goalTitle').value;
        const category = document.getElementById('goalCategory').value;
        try {
            await Data.Goals.add(App.state.user.uid, { title, category, status: 'active' });
            UI.showToast('Goal created', 'success');
            UI.closeModal();
            App.refresh();
        } catch (err) { console.error(err); UI.showToast('Error creating goal', 'error'); }
    },

    deleteGoal: async (id) => {
        if (confirm('Delete goal?')) {
            await Data.Goals.delete(id);
            App.refresh();
        }
    },

    openLearningModal: (goalId = '') => {
        const goalOptions = App.state.goals.map(g => `<option value="${g.id}" ${g.id === goalId ? 'selected' : ''}>${g.title}</option>`).join('');
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Learning Path</h3></div>
                <form onsubmit="App.handleCreateLearning(event)">
                    <div class="form-group"><label for="learningTitle">Title</label><input id="learningTitle" required autofocus></div>
                    <div class="form-group"><label for="learningGoalId">Link to Goal (Optional)</label>
                        <select id="learningGoalId" class="form-select"><option value="">-- None --</option>${goalOptions}</select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Path</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleCreateLearning: async (e) => {
        e.preventDefault();
        const title = document.getElementById('learningTitle').value;
        const goalId = document.getElementById('learningGoalId').value;
        try {
            await Data.Learnings.add(App.state.user.uid, { title, goalId, status: 'active' });
            UI.showToast('Learning path created', 'success');
            UI.closeModal();
            App.refresh();
        } catch (err) { console.error(err); UI.showToast('Error creating learning path', 'error'); }
    },

    deleteLearning: async (id) => {
        if (confirm('Delete learning path?')) {
            await Data.Learnings.delete(id);
            App.refresh();
        }
    },
    openProjectModal: (goalId = '') => {
        const goalOptions = App.state.goals.map(g => `<option value="${g.id}" ${g.id === goalId ? 'selected' : ''}>${g.title}</option>`).join('');
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Project</h3></div>
                <form onsubmit="App.handleCreateProject(event)">
                    <input type="hidden" id="projectId">
                    <div class="form-group"><label>Project Title</label><input id="projectTitle" required autofocus placeholder="Project Name"></div>
                    <div class="form-group"><label>Description</label><input id="projectDesc" placeholder="Brief description..."></div>
                    <div class="form-row">
                        <div class="form-group"><label>Link to Goal</label><select id="projectGoalId" class="form-select">
                            <option value="">-- Independent --</option>
                            ${goalOptions}
                        </select></div>
                        <div class="form-group"><label>Icon</label><select id="projectIcon" class="form-select">
                            <option value="🚀">🚀 Rocket</option><option value="💻">💻 Code</option>
                            <option value="🎨">🎨 Design</option><option value="📝">📝 Writing</option>
                        </select></div>
                    </div>
                    <div class="form-group"><label>Deadline</label><input type="date" id="projectDeadline"></div>
                    <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Create Project</button></div>
                </form>
            </div>
        `);
    },

    handleCreateProject: async (e) => {
        e.preventDefault();
        const id = document.getElementById('projectId').value;
        const title = document.getElementById('projectTitle').value;
        const description = document.getElementById('projectDesc').value;
        const deadline = document.getElementById('projectDeadline').value;
        const icon = document.getElementById('projectIcon').value;
        const goalId = document.getElementById('projectGoalId').value;

        try {
            if (id) {
                await Data.Projects.update(id, { title, description, deadline, icon, goalId });
                UI.showToast('Project updated successfully', 'success');
            } else {
                await Data.Projects.add(App.state.user.uid, { title, description, deadline, icon, status: 'active', goalId });
                UI.showToast('Project created successfully', 'success');
            }
            UI.closeModal();
            App.refresh();
        } catch (err) {
            console.error('Save project failed', err);
            UI.showToast('Failed to save project', 'error');
        }
    },
    editProject: (id) => {
        const project = App.state.projects.find(p => p.id === id);
        if (!project) return;

        // CORRECTION: Use the correct function name
        App.openProjectModal();

        setTimeout(() => {
            const header = document.querySelector('.modal-header h3');
            if (header) header.textContent = 'Edit Project';

            // Ensure this hidden input exists in your modal HTML!
            // If not, you need to add <input type="hidden" id="projectId"> to openProjectModal()
            const idInput = document.getElementById('projectId');
            if (idInput) idInput.value = project.id;

            document.getElementById('projectTitle').value = project.title || '';
            document.getElementById('projectDesc').value = project.description || '';
            document.getElementById('projectDeadline').value = project.deadline || '';
            document.getElementById('projectIcon').value = project.icon || '🚀';
            document.getElementById('projectGoalId').value = project.goalId || '';
        }, 50);
    },

    deleteProject: async (id) => {
        if (confirm('Delete this project? This cannot be undone.')) {
            try {
                await Data.Projects.delete(id);
                UI.showToast('Project deleted', 'info');
                App.refresh();
            } catch (err) {
                console.error('Delete project failed', err);
                UI.showToast('Failed to delete project', 'error');
            }
        }
    },


    openGoalModal: () => {
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Goal</h3></div>
                <form onsubmit="App.handleCreateGoal(event)">
                    <div class="form-group"><label>Goal Title</label><input id="goalTitle" required autofocus placeholder="e.g., Become Full Stack Dev"></div>
                    <div class="form-group"><label>Description</label><input id="goalDesc" placeholder="Why do you want this?"></div>
                    <div class="form-group"><label>Category</label><select id="goalCategory" class="form-select">
                        <option value="Career">💼 Career</option>
                        <option value="Personal">🏠 Personal</option>
                        <option value="Health">💪 Health</option>
                        <option value="Financial">💰 Financial</option>
                    </select></div>
                    <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Create Goal</button></div>
                </form>
            </div>
        `);
    },

    handleCreateGoal: async (e) => {
        e.preventDefault();
        const title = document.getElementById('goalTitle').value;
        const description = document.getElementById('goalDesc').value;
        const category = document.getElementById('goalCategory').value;

        try {
            await Data.Goals.add(App.state.user.uid, { title, description, category, status: 'active' });
            UI.showToast('Goal created', 'success');
            UI.closeModal();
            App.refresh();
        } catch (err) {
            console.error('Create goal failed', err);
            UI.showToast('Failed to create goal', 'error');
        }
    },

    openLearningModal: (goalId = '') => {
        const goalOptions = App.state.goals.map(g => `<option value="${g.id}" ${g.id === goalId ? 'selected' : ''}>${g.title}</option>`).join('');
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Learning Path</h3></div>
                <form onsubmit="App.handleCreateLearning(event)">
                    <div class="form-group"><label>Learning Title</label><input id="learningTitle" required autofocus placeholder="e.g., Learn React Patterns"></div>
                    <div class="form-group"><label>Link to Goal</label><select id="learningGoalId" class="form-select">
                        <option value="">-- Independent --</option>
                        ${goalOptions}
                    </select></div>
                    <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Start Learning</button></div>
                </form>
            </div>
        `);
    },

    handleCreateLearning: async (e) => {
        e.preventDefault();
        const title = document.getElementById('learningTitle').value;
        const goalId = document.getElementById('learningGoalId').value;
        try {
            await Data.Learnings.add(App.state.user.uid, { title, goalId, status: 'active' });
            UI.showToast('Learning path created', 'success');
            UI.closeModal();
            App.refresh();
        } catch (err) {
            console.error('Create learning failed', err);
            UI.showToast('Failed to create learning', 'error');
        }
    },

    openProjectDetails: (id) => {
        const project = App.state.projects.find(p => p.id === id);
        if (project) {
            alert(`Project Details: ${project.title}\n(Full details view coming soon!)`);
        }
    },

    editTask: (id) => {
        const task = App.state.tasks.find(t => t.id === id);
        if (!task) return;
        App.openAddTaskModal();
        setTimeout(() => {
            const header = document.querySelector('.modal-header h3');
            if (header) header.textContent = 'Edit Task';
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title || '';
            document.getElementById('taskCategory').value = task.category || 'work';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            if (task.timeBlock) {
                document.getElementById('taskStart').value = task.timeBlock.start;
                document.getElementById('taskEnd').value = task.timeBlock.end;
            }
        }, 50);
    }
};

// -----------------------------
// EXPORT / GLOBALS (for onclick attributes)
// -----------------------------
window.switchAuthTab = App.switchAuthTab;
window.handleLogout = App.handleLogout;
window.handleGuestLogin = App.handleGuestLogin;
window.showModule = (name) => {
    UI.showModule(name);
    if (name === 'schedule' && App.state.tasks) UI.renderSchedule(App.state.tasks);
    if (name === 'projects' && App.state.projects) UI.renderProjectsHub(App.state.projects, App.state.tasks);
};
window.openAddTaskModal = App.openAddTaskModal;
window.closeModal = UI.closeModal;
window.openProjectModal = App.openProjectModal;
window.filterTasks = (filter) => {
    const buttons = document.querySelectorAll('.filter-tag');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${filter}'`)) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    UI.renderTaskList(App.state.tasks, filter);
};
window.App = App; // expose for debugging and modal event handlers

// Start the app
App.init();
