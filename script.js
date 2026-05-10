// ==========================================
// CONFIGURATIONS & UTILS
// ==========================================
const Config = {
    firebase: window.appConfig.firebase
};


const Utils = {
    isToday: (date) => {
        const today = new Date();
        // specific check for valid date objects from utils.js
        if (!(date instanceof Date) && typeof date !== 'string' && typeof date !== 'number') return false;
        const d = new Date(date);
        if (isNaN(d.getTime())) return false;

        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    },
    formatTime: (date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    escapeHTML: (str) => {
        if (!str) return "";
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(Config.firebase);
}
const db = firebase.firestore();
const auth = firebase.auth();

// ==========================================
// DATA MODULES
// ==========================================
const Data = {
    Tasks: {
        fetch: async (userId) => {
            try {
                const snap = await db.collection('tasks').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.error("Error fetching tasks:", e);
                return [];
            }
        },
        add: async (userId, task) => {
            try {
                return await db.collection('tasks').add({ userId, ...task, createdAt: new Date().toISOString() });
            } catch (e) {
                UI.showToast('Failed to add task', 'error');
                throw e;
            }
        },
        update: async (id, data) => {
            try {
                return await db.collection('tasks').doc(id).update(data);
            } catch (e) {
                UI.showToast('Failed to update task', 'error');
                throw e;
            }
        },
        delete: async (id) => {
            try {
                return await db.collection('tasks').doc(id).delete();
            } catch (e) {
                UI.showToast('Failed to delete task', 'error');
                throw e;
            }
        }
    },
    Projects: {
        fetch: async (userId) => {
            try {
                const snap = await db.collection('projects').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
                return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (e) {
                console.error("Error fetching projects:", e);
                return [];
            }
        },
        add: async (userId, data) => {
            try {
                return await db.collection('projects').add({ userId, ...data, createdAt: new Date().toISOString() });
            } catch (e) {
                UI.showToast('Failed to add project', 'error');
                throw e;
            }
        },
        delete: async (id) => {
            try {
                return await db.collection('projects').doc(id).delete();
            } catch (e) {
                UI.showToast('Failed to delete project', 'error');
                throw e;
            }
        }
    }
};

const Schedule = {
    generateSlots: () => {
        const slots = [];
        for (let i = 6; i < 24; i++) slots.push(`${i.toString().padStart(2, '0')}:00`);
        return slots;
    },
    getTaskForSlot: (tasks, slot) => {
        // Simple slot check: is the slot >= start and < end?
        return tasks.find(t => {
            if (!t.timeBlock) return false;
            // Compare HH:MM strings
            return slot >= t.timeBlock.start && slot < t.timeBlock.end;
        });
    },
    checkConflict: (tasks, newStart, newEnd) => {
        return tasks.some(task => {
            if (!task.timeBlock) return false;
            if (task.status === 'completed') return false; // Optional: ignore completed tasks (?) - keeping simple for now

            const taskStart = task.timeBlock.start;
            const taskEnd = task.timeBlock.end;

            // Overlap logic from js/modules/schedule.js
            return (newStart < taskEnd && newEnd > taskStart);
        });
    }
};

// ==========================================
// AUTH MODULE
// ==========================================
const Auth = {
    init: (onLogin, onLogout) => {
        auth.onAuthStateChanged(user => user ? onLogin(user) : onLogout());
    },
    login: async (email, password) => {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },
    signup: async (email, password, name) => {
        try {
            const res = await auth.createUserWithEmailAndPassword(email, password);
            await res.user.updateProfile({ displayName: name });
            await db.collection('users').doc(res.user.uid).set({
                name, email, createdAt: new Date().toISOString()
            });
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },
    logout: () => auth.signOut(),
    guestLogin: async () => {
        return { success: true, user: { uid: 'guest123', displayName: 'Guest User', email: 'guest@local.test' } };
    },
    updateProfile: async (name) => {
        try {
            const user = auth.currentUser;
            if (user) {
                await user.updateProfile({ displayName: name });
                // Also update in Firestore users collection
                await db.collection('users').doc(user.uid).update({ name: name });
                return { success: true };
            } else {
                return { success: false, error: 'No user signed in' };
            }
        } catch (e) { return { success: false, error: e.message }; }
    }
};

// ==========================================
// UI MODULE
// ==========================================
const UI = {
    startClock: () => {
        const update = () => {
            const now = new Date();
            // Time: 09:30:34 AM
            const timeString = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });

            // Date: 12-Jan-26
            const dateString = now.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: '2-digit'
            }).replace(/ /g, '-');

            const dateEl = document.getElementById('systemDate');
            const timeEl = document.getElementById('systemTime');

            if (dateEl) dateEl.textContent = dateString;
            if (timeEl) timeEl.textContent = timeString;

            // Trigger Focus Mode Check every minute
            if (now.getSeconds() === 0) App.detectActiveTask();
        };
        update(); // Initial call
        setInterval(update, 1000);
    },

    toggleTheme: () => {
        const root = document.documentElement;
        const current = root.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';

        if (next === 'light') {
            root.setAttribute('data-theme', 'light');
        } else {
            root.removeAttribute('data-theme'); // Default is dark
        }

        localStorage.setItem('theme', next);
        UI.updateThemeIcon(next);
    },

    updateThemeIcon: (theme) => {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.textContent = theme === 'light' ? '☀️' : '🌙';
        }
    },

    toggleMobileMenu: () => {
        const nav = document.getElementById('sidebarNav');
        const toggleBtn = document.querySelector('.mobile-nav-toggle .toggle-icon');

        if (!nav) return;

        // Check if menu is currently open
        if (nav.classList.contains('active')) {
            // Close Menu
            nav.classList.remove('active');
            if (toggleBtn) toggleBtn.style.transform = 'rotate(0deg)';
        } else {
            // Open Menu
            nav.classList.add('active');
            if (toggleBtn) toggleBtn.style.transform = 'rotate(180deg)';
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

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    },

    showModule: (name) => {
        // Register allowed modules
        const allowedModules = ['dashboard', 'tasks', 'schedule', 'projects', 'goals', 'learning', 'projectDetails'];
        if (!allowedModules.includes(name)) return;

        document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
        const target = document.getElementById(`${name}Module`);
        if (target) target.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        // Simple logic to find nav button
        const btn = Array.from(document.querySelectorAll('.nav-item')).find(b =>
            b.getAttribute('onclick') && b.getAttribute('onclick').includes(name)
        );
        if (btn) btn.classList.add('active');

        const title = name.charAt(0).toUpperCase() + name.slice(1);
        document.getElementById('pageTitle').textContent = title;

        // Mobile: Update Dropdown Title
        const mobileTitle = document.getElementById('currentMobilePage');
        if (mobileTitle) mobileTitle.textContent = title;

        // Mobile: Close Menu after selection
        const nav = document.getElementById('sidebarNav');
        const toggleBtn = document.querySelector('.mobile-nav-toggle .toggle-icon');
        if (nav && nav.classList.contains('active')) {
            nav.classList.remove('active');
            if (toggleBtn) toggleBtn.style.transform = 'rotate(0deg)';
        }
    },

    showModal: (html) => {
        const container = document.getElementById('modalContainer');
        container.innerHTML = html;
        container.classList.add('active');
    },

    closeModal: () => {
        document.getElementById('modalContainer').classList.remove('active');
    },

    renderSchedule: (tasks) => {
        const container = document.getElementById('scheduleModule');
        if (!container) return;

        if (!tasks) tasks = [];
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

            // Generate content
            let content = '';
            let className = 'time-content';

            if (task) {
                className += ' occupied';
                content = `
                    <div class="timeline-task ${task.category}-bg" onclick="App.openEditTask('${task.id}')">
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

    renderProjectsHub: (projects, tasks) => {
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
                            <button class="btn-icon" onclick="event.stopPropagation(); App.deleteProject('${p.id}')">🗑️</button>
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

    renderDashboard: (tasks) => {
        if (!tasks) tasks = [];
        const todayDone = tasks.filter(t => t.status === 'completed' && Utils.isToday(t.createdAt)).length;
        const todayPending = tasks.filter(t => t.status !== 'completed').length;

        document.getElementById('todayDoneCount').textContent = todayDone;
        document.getElementById('todayPendingCount').textContent = todayPending;

        // Productivity Stat
        const totalToday = todayDone + todayPending;
        const productivity = totalToday === 0 ? 0 : Math.round((todayDone / totalToday) * 100);
        const prodEl = document.getElementById('productivityStat');
        if (prodEl) prodEl.textContent = `${productivity}%`;

        // Mini Schedule
        const schedContainer = document.getElementById('miniSchedule');
        const scheduled = tasks.filter(t => t.timeBlock && t.status !== 'completed').sort((a, b) => a.timeBlock.start.localeCompare(b.timeBlock.start));

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

        // Update Focus Mode on Dashboard
        App.detectActiveTask();
    },

    renderFocusTask: (task) => {
        const container = document.getElementById('currentFocusContent');
        if (!container) return;

        if (!task) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No active task right now.</p>
                    <button class="btn btn-primary btn-sm" onclick="showModule('tasks')">Select Task to Start</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="active-focus-item">
                <div class="focus-timer" id="focusTimer">--:--</div>
                <h3 class="focus-task-title">${Utils.escapeHTML(task.title)}</h3>
                <div class="focus-meta">
                    <span class="badge badge-${Utils.escapeHTML(task.category)}">${Utils.escapeHTML(task.category)}</span>
                    <span class="focus-time-range">${Utils.escapeHTML(task.timeBlock.start)} - ${Utils.escapeHTML(task.timeBlock.end)}</span>
                </div>
                <div class="focus-actions">
                    <button class="btn btn-success btn-block" onclick="App.toggleStatus('${task.id}', '${task.status}')">Complete Task</button>
                </div>
            </div>
        `;

        App.startFocusTimer(task.timeBlock.end);
    },

    renderTaskList: (tasks, filter = 'all') => {
        const container = document.getElementById('fullTaskList');
        if (!container) return;

        if (!tasks) tasks = [];
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
            item.className = `task-item ${task.priority}-priority ${status}`;
            item.draggable = true;

            let icon = status === 'completed' ? '✅' : (status === 'in_progress' ? '⏳' : '⬜');

            item.innerHTML = `
                <div class="task-checkbox" onclick="App.toggleStatus('${task.id}', '${status}')">
                    ${icon}
                </div>
                <div class="task-details">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="badge badge-${task.category}">${task.category}</span>
                        ${task.timeBlock ? `<span class="time-badge">🕒 ${task.timeBlock.start} - ${task.timeBlock.end}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon" onclick="App.editTask('${task.id}')">Edit</button>
                    <button class="btn-icon" onclick="App.deleteTask('${task.id}')">Delete</button>
                </div>
            `;

            if (status === 'todo') container.querySelector('#col-todo .kanban-items').appendChild(item);
            else if (status === 'in_progress') container.querySelector('#col-progress .kanban-items').appendChild(item);
            else container.querySelector('#col-done .kanban-items').appendChild(item);
        });
    }
};

// ==========================================
// APP CONTROLLER (Global Functions)
// ==========================================
const App = {
    state: {
        user: null,
        tasks: [],
        projects: []
    },

    init: () => {
        // Attach Auth Event Listeners
        document.getElementById('loginForm').addEventListener('submit', App.handleLogin);
        document.getElementById('signupForm').addEventListener('submit', App.handleSignup);

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                App.openAddTaskModal();
            }
            if (e.key === 'Escape') {
                UI.closeModal();
            }
        });

        Auth.init(
            async (user) => {
                App.state.user = user;
                document.getElementById('authContainer').style.display = 'none';
                document.getElementById('appContainer').style.display = 'flex';
                document.getElementById('userName').textContent = user.displayName || user.email;
                document.getElementById('userAvatar').textContent = (user.displayName || user.email)[0].toUpperCase();

                // Init Theme
                const savedTheme = localStorage.getItem('theme') || 'dark';
                if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
                else document.documentElement.removeAttribute('data-theme');
                UI.updateThemeIcon(savedTheme);

                UI.startClock();
                await App.refresh();
            },
            () => {
                App.state.user = null;
                document.getElementById('authContainer').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
            }
        );
    },

    refresh: async () => {
        if (!App.state.user) return;
        App.state.tasks = await Data.Tasks.fetch(App.state.user.uid);
        App.state.projects = await Data.Projects.fetch(App.state.user.uid);

        UI.renderDashboard(App.state.tasks);
        UI.renderTaskList(App.state.tasks);

        // Refresh active module if needed
        const activeModule = document.querySelector('.module.active');
        if (activeModule && activeModule.id === 'projectsModule') {
            UI.renderProjectsHub(App.state.projects, App.state.tasks);
        }
    },

    // Global Actions (exposed to window for onclick)
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
            if (res.error.includes('auth/user-not-found')) msg = 'User not found.';
            if (res.error.includes('auth/wrong-password')) msg = 'Incorrect password.';
            if (res.error.includes('network')) msg = 'Network error. Try Guest Mode if testing locally.';
            UI.showToast(msg, 'error');
        }
    },

    handleGuestLogin: async () => {
        const res = await Auth.guestLogin();
        App.state.user = res.user;
        UI.showToast('Logged in as Guest', 'info');

        // Manual state update since no firebase auth listener for guest
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';
        document.getElementById('userName').textContent = res.user.displayName;
        document.getElementById('userAvatar').textContent = 'G';

        // Init Theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
        else document.documentElement.removeAttribute('data-theme');
        UI.updateThemeIcon(savedTheme);

        UI.startClock();
        await App.refresh();
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
            UI.showToast(res.error, 'error');
        }
    },

    handleLogout: () => Auth.logout(),

    openAddTaskModal: (startTime = '') => {
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Task</h3></div>
                <form onsubmit="App.handleAddTask(event)">
                    <div class="form-group"><label>Title</label><input id="taskTitle" required autofocus placeholder="What do you need to do?"></div>
                    <div class="form-row">
                        <div class="form-group"><label>Category</label><select id="taskCategory" class="form-select">
                            <option value="work">💼 Work</option><option value="personal">🏠 Personal</option>
                            <option value="study">📚 Study</option><option value="project">🚀 Project</option>
                        </select></div>
                        <div class="form-group"><label>Priority</label><select id="taskPriority" class="form-select">
                            <option value="medium">Medium</option><option value="high">High</option>
                            <option value="low">Low</option>
                        </select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Start</label><input type="time" id="taskStart" value="${startTime}"></div>
                        <div class="form-group"><label>End</label><input type="time" id="taskEnd" value="${startTime ? startTime.split(':')[0] + ':59' : ''}"></div>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Create</button></div>
                </form>
            </div>
        `);
    },

    openAddTaskModalWithTime: (startTime) => {
        App.openAddTaskModal(startTime);
    },

    handleAddTask: async (e) => {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value;
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;

        const start = document.getElementById('taskStart').value;
        const end = document.getElementById('taskEnd').value;

        // Conflict Auto-Check
        if (start && end) {
            if (end <= start) {
                UI.showToast('End time must be after start time', 'error');
                return;
            }

            // Filter out completed tasks for conflict (optional choice, but usually we want to know about active conflicts)
            // Using all tasks for safety
            const hasConflict = Schedule.checkConflict(App.state.tasks, start, end);
            if (hasConflict) {
                if (!confirm('⚠️ Conflict detected! You already have a task at this time. Add anyway?')) {
                    return;
                }
            }
        }

        const taskData = { title, category, priority, status: 'todo' };
        if (start && end) {
            taskData.timeBlock = { start, end };
        }

        await Data.Tasks.add(App.state.user.uid, taskData);
        UI.closeModal();
        App.refresh();
    },

    toggleStatus: async (id, currentStatus) => {
        let newStatus = currentStatus === 'in_progress' ? 'completed' : (currentStatus === 'completed' ? 'todo' : 'in_progress');
        await Data.Tasks.update(id, { status: newStatus });
        App.refresh();
    },

    deleteTask: async (id) => {
        if (confirm('Are you sure you want to delete this task?')) {
            await Data.Tasks.delete(id);
            App.refresh();
        }
    },

    editTask: (id) => {
        const task = App.state.tasks.find(t => t.id === id);
        if (!task) return;

        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>Edit Task</h3></div>
                <form onsubmit="App.handleUpdateTask(event, '${id}')">
                    <div class="form-group"><label>Title</label><input id="taskTitle" required autofocus value="${task.title}"></div>
                    <div class="form-row">
                        <div class="form-group"><label>Category</label><select id="taskCategory" class="form-select">
                            <option value="work" ${task.category === 'work' ? 'selected' : ''}>💼 Work</option>
                            <option value="personal" ${task.category === 'personal' ? 'selected' : ''}>🏠 Personal</option>
                            <option value="study" ${task.category === 'study' ? 'selected' : ''}>📚 Study</option>
                            <option value="project" ${task.category === 'project' ? 'selected' : ''}>🚀 Project</option>
                        </select></div>
                        <div class="form-group"><label>Priority</label><select id="taskPriority" class="form-select">
                            <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                        </select></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Start</label><input type="time" id="taskStart" value="${task.timeBlock ? task.timeBlock.start : ''}"></div>
                        <div class="form-group"><label>End</label><input type="time" id="taskEnd" value="${task.timeBlock ? task.timeBlock.end : ''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Update Task</button>
                    </div>
                </form>
            </div>
        `);
    },

    openEditTask: (id) => App.editTask(id),

    handleUpdateTask: async (e, id) => {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value;
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;
        const start = document.getElementById('taskStart').value;
        const end = document.getElementById('taskEnd').value;

        if ((start && !end) || (!start && end)) {
            UI.showToast('Please provide both start and end time, or none.', 'error');
            return;
        }

        if (start && end && end <= start) {
            UI.showToast('End time must be after start time', 'error');
            return;
        }

        const data = { title, category, priority };
        if (start && end) {
            data.timeBlock = { start, end };
        } else {
            data.timeBlock = firebase.firestore.FieldValue.delete();
        }

        await Data.Tasks.update(id, data);
        UI.closeModal();
        App.refresh();
    },

    openProjectModal: () => {
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>New Project</h3></div>
                <form onsubmit="App.handleAddProject(event)">
                    <div class="form-group"><label>Project Name</label><input id="projectTitle" required autofocus placeholder="Project title"></div>
                    <div class="form-group"><label>Description</label><textarea id="projectDesc" placeholder="What is this project about?"></textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>Icon</label><input id="projectIcon" placeholder="🚀" value="🚀"></div>
                        <div class="form-group"><label>Deadline</label><input type="date" id="projectDeadline"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Project</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleAddProject: async (e) => {
        e.preventDefault();
        const title = document.getElementById('projectTitle').value;
        const description = document.getElementById('projectDesc').value;
        const icon = document.getElementById('projectIcon').value;
        const deadline = document.getElementById('projectDeadline').value;

        await Data.Projects.add(App.state.user.uid, { title, description, icon, deadline });
        UI.closeModal();
        App.refresh();
    },

    deleteProject: async (id) => {
        if (confirm('Are you sure you want to delete this project? Tasks will not be deleted.')) {
            await Data.Projects.delete(id);
            App.refresh();
        }
    },

    openProjectDetails: (id) => {
        const project = App.state.projects.find(p => p.id === id);
        if (!project) return;

        const pTasks = App.state.tasks.filter(t => t.projectId === id);

        // Switch to a dynamic view for project details
        UI.showModule('projectDetails');
        const container = document.getElementById('projectDetailsModule');
        if (!container) return;

        container.innerHTML = `
            <div class="module-header">
                <button class="btn btn-outline btn-sm" onclick="showModule('projects')">← Back to Projects</button>
                <h2>${Utils.escapeHTML(project.icon) || '🚀'} ${Utils.escapeHTML(project.title)}</h2>
            </div>
            <div class="project-info-card">
                <p>${Utils.escapeHTML(project.description) || 'No description provided.'}</p>
                ${project.deadline ? `<p><strong>Deadline:</strong> ${new Date(project.deadline).toLocaleDateString()}</p>` : ''}
            </div>
            <div class="project-tasks-section">
                <h3>Project Tasks</h3>
                <div class="task-list">
                    ${pTasks.length === 0 ? '<p class="empty-state">No tasks linked to this project.</p>' : ''}
                    ${pTasks.map(t => `
                        <div class="task-item ${t.priority}-priority ${t.status}">
                            <div class="task-details">
                                <div class="task-title">${Utils.escapeHTML(t.title)}</div>
                            </div>
                            <div class="task-status">${Utils.escapeHTML(t.status)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    detectActiveTask: () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const activeTask = App.state.tasks.find(t => {
            if (!t.timeBlock || t.status === 'completed') return false;
            return currentTime >= t.timeBlock.start && currentTime < t.timeBlock.end;
        });

        UI.renderFocusTask(activeTask);
    },

    startFocusTimer: (endTimeStr) => {
        if (window.focusInterval) clearInterval(window.focusInterval);

        const updateTimer = () => {
            const now = new Date();
            const [endH, endM] = endTimeStr.split(':').map(Number);
            const endTime = new Date();
            endTime.setHours(endH, endM, 0);

            const diff = endTime - now;
            if (diff <= 0) {
                document.getElementById('focusTimer').textContent = "00:00";
                clearInterval(window.focusInterval);
                UI.showToast("Focus session ended!", "info");
                return;
            }

            const mins = Math.floor(diff / 1000 / 60);
            const secs = Math.floor((diff / 1000) % 60);
            const timerEl = document.getElementById('focusTimer');
            if (timerEl) {
                timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            } else {
                clearInterval(window.focusInterval);
            }
        };

        updateTimer();
        window.focusInterval = setInterval(updateTimer, 1000);
    },

    openEditProfileModal: () => {
        const currentName = App.state.user.displayName || App.state.user.email;
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>Edit Profile</h3><button class="btn-close" onclick="closeModal()">×</button></div>
                <form onsubmit="App.handleUpdateProfile(event)">
                    <div class="form-group">
                        <label>Display Name</label>
                        <input id="editProfileName" type="text" value="${currentName}" required autofocus>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="UI.closeModal()">Cancel</button>
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

        // Handle Guest Mode specially or just mock it
        if (App.state.user.uid === 'guest123') {
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
            // Update local state and UI immediately
            App.state.user.displayName = newName;
            document.getElementById('userName').textContent = newName;
            document.getElementById('userAvatar').textContent = newName[0].toUpperCase();
            UI.closeModal();
        } else {
            UI.showToast(res.error, 'error');
        }
    }
};

// Start App
App.init();

// EXPOSE GLOBALS FOR ONCLICK ATTRIBUTES
window.switchAuthTab = App.switchAuthTab;
window.handleLogout = App.handleLogout;
window.handleGuestLogin = App.handleGuestLogin;
window.showModule = (name) => {
    UI.showModule(name);
    // Trigger render for specific modules
    if (name === 'schedule' && App.state.tasks) UI.renderSchedule(App.state.tasks);
    if (name === 'projects' && App.state.projects) UI.renderProjectsHub(App.state.projects, App.state.tasks);
};
window.openAddTaskModal = App.openAddTaskModal;
window.closeModal = UI.closeModal;
window.openProjectModal = App.openProjectModal;
window.filterTasks = (filter) => UI.renderTaskList(App.state.tasks, filter);
window.App = App; // For deeper access
