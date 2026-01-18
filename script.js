// ==========================================
// CONFIGURATIONS & UTILS
// ==========================================
const Config = {
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
            const snap = await db.collection('tasks').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        add: async (userId, task) => {
            return db.collection('tasks').add({ userId, ...task, createdAt: new Date().toISOString() });
        },
        update: async (id, data) => db.collection('tasks').doc(id).update(data),
        delete: async (id) => db.collection('tasks').doc(id).delete()
    },
    Projects: {
        fetch: async (userId) => {
            const snap = await db.collection('projects').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        add: async (userId, data) => {
            return db.collection('projects').add({ userId, ...data, createdAt: new Date().toISOString() });
        },
        delete: async (id) => db.collection('projects').doc(id).delete()
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

    /* // --- MOBILE MENU FUNCTIONALITY ---
    toggleMobileMenu: () => {
        const nav = document.getElementById('sidebarNav');
        const toggleBtn = document.querySelector('.mobile-nav-toggle .toggle-icon');

        // Check if menu is currently open
        if (nav.classList.contains('active')) {
            // Close Menu
            nav.classList.remove('active');
            toggleBtn.style.transform = 'rotate(0deg)'; // Reset arrow rotation
        } else {
            // Open Menu
            nav.classList.add('active'); // CSS handles animation
            toggleBtn.style.transform = 'rotate(180deg)'; // Rotate arrow up
        }
    }, */

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
    },

    renderTaskList: (tasks, filter = 'all') => {
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

        // Mock data for guest
        App.state.tasks = [];
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
                    <div class="modal-footer"><button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Create</button></div>
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
        if (confirm('Delete?')) {
            await Data.Tasks.delete(id);
            App.refresh();
        }
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
