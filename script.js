// FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyDBS9rEkJPMx3eAd9TmwTwjlfGgu_lRBGE",
    authDomain: "it-asset-system-2091b.firebaseapp.com",
    projectId: "it-asset-system-2091b",
    storageBucket: "it-asset-system-2091b.firebasestorage.app",
    messagingSenderId: "788162777362",
    appId: "1:788162777362:web:29481f4c345dae382063cb",
    measurementId: "G-VNHV6QEDWP"
};

// INITIALIZE FIREBASE
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// STATE MANAGEMENT
let currentUser = null;
let currentTasks = [];

/* ============================
   AUTH HANDLING
   ============================ */

auth.onAuthStateChanged(user => {
    if (user) {
        // User logged in
        currentUser = user;
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';

        // Update Sidebar info
        document.getElementById('userName').textContent = user.displayName || user.email.split('@')[0];
        document.getElementById('userAvatar').textContent = (user.displayName || user.email)[0].toUpperCase();

        // Load Data
        loadData();
    } else {
        // User logged out
        currentUser = null;
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
    }
});

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    // Select specific tab button (simple logic for MVP)
    const buttons = document.querySelectorAll('.auth-tab');
    if (tab === 'login') buttons[0].classList.add('active');
    else buttons[1].classList.add('active');

    document.getElementById(`${tab}Form`).classList.add('active');
}

// LOGIN
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('authMessage');

    try {
        await auth.signInWithEmailAndPassword(email, password);
        msg.textContent = '';
    } catch (error) {
        msg.textContent = error.message;
        msg.className = 'auth-message error';
    }
});

// SIGNUP
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;
    const msg = document.getElementById('authMessage');

    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        // Update display name
        await result.user.updateProfile({ displayName: name });
        // Create user document inside 'users' collection for syncing other data easily later
        await db.collection('users').doc(result.user.uid).set({
            name: name,
            email: email,
            createdAt: new Date().toISOString()
        });

        msg.textContent = '';
    } catch (error) {
        msg.textContent = error.message;
        msg.className = 'auth-message error';
    }
});

function handleLogout() {
    auth.signOut();
}

/* ============================
   UI & NAVIGATION
   ============================ */

function showModule(moduleName) {
    // Hide all modules
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    // Show selected
    document.getElementById(`${moduleName}Module`).classList.add('active');

    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Finding button by onclick attribute for MVP speed
    const navButtons = Array.from(document.querySelectorAll('.nav-item'));
    const btn = navButtons.find(b => b.getAttribute('onclick').includes(moduleName));
    if (btn) btn.classList.add('active');

    // Update Title
    document.getElementById('pageTitle').textContent =
        moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    // Special handling for projects module placeholder
    if (moduleName === 'projects' && document.getElementById('dashboardProjectList')) {
        updateProjectPlaceholder();
    }
}

/* ============================
   DATA HANDLING
   ============================ */

async function loadData() {
    loadTasks();
    // loadProjects();
    // loadGoals();
}

// LOAD TASKS
async function loadTasks() {
    if (!currentUser) return;

    const snapshot = await db.collection('tasks')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();

    currentTasks = [];
    snapshot.forEach(doc => {
        currentTasks.push({ id: doc.id, ...doc.data() });
    });

    renderDashboard();
}

// RENDER DASHBOARD
function renderDashboard() {
    const todayDone = currentTasks.filter(t => t.status === 'completed' && isToday(new Date(t.createdAt))).length;
    const todayPending = currentTasks.filter(t => t.status !== 'completed').length;

    document.getElementById('todayDoneCount').textContent = todayDone;
    document.getElementById('todayPendingCount').textContent = todayPending;

    // Update Mini Schedule
    const scheduleContainer = document.getElementById('miniSchedule');
    if (scheduleContainer) {
        // Filter tasks that have timeBlocks
        const scheduledTasks = currentTasks.filter(t => t.timeBlock && t.status !== 'completed')
            .sort((a, b) => a.timeBlock.start.localeCompare(b.timeBlock.start));

        if (scheduledTasks.length > 0) {
            scheduleContainer.innerHTML = '';
            scheduledTasks.slice(0, 3).forEach(task => {
                scheduleContainer.innerHTML += `
                    <div class="schedule-item">
                        <span class="schedule-time">${task.timeBlock.start}</span>
                        <span class="schedule-title">${task.title}</span>
                    </div>
                `;
            });
        } else {
            scheduleContainer.innerHTML = '<div class="empty-state">No scheduled tasks for today.</div>';
        }
    }

    renderTaskList();
    updateProjectPlaceholder();
}

// RENDER TASK LIST (Full View)
function renderTaskList() {
    const listContainer = document.getElementById('fullTaskList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (currentTasks.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No tasks found. Create one!</div>';
        return;
    }

    currentTasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `task-item ${task.priority}-priority ${task.status}`;
        item.innerHTML = `
            <div class="task-checkbox" onclick="toggleTaskStatus('${task.id}', '${task.status}')">
                ${task.status === 'completed' ? '✓' : ''}
            </div>
            <div class="task-details">
                <div class="task-title">${task.title}</div>
                <div class="task-meta">
                    <span class="badg badge-${task.category}">${task.category}</span>
                    ${task.timeBlock ? `<span class="time-badge">🕒 ${task.timeBlock.start} - ${task.timeBlock.end}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-icon" onclick="deleteTask('${task.id}')">🗑️</button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

// UTILS
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

function updateClock() {
    const now = new Date();
    document.getElementById('systemClock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

/* ============================
   TASK MANAGEMENT ACTIONS
   ============================ */

// ADD TASK MODAL HTML INJECTION
function openAddTaskModal() {
    const modalHtml = `
        <div class="modal-card">
            <div class="modal-header">
                <h3>Create New Task</h3>
                <button class="btn-close" onclick="closeModal()">×</button>
            </div>
            <form id="addTaskForm">
                <div class="form-group">
                    <label>Task Title</label>
                    <input type="text" id="taskTitle" required placeholder="What needs to be done?" autofocus>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="taskCategory" class="form-select">
                            <option value="work">💼 Work</option>
                            <option value="study">📚 Study</option>
                            <option value="project">🚀 Project</option>
                            <option value="personal">🏠 Personal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="taskPriority" class="form-select">
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Start Time (Optional)</label>
                        <input type="time" id="taskStart">
                    </div>
                    <div class="form-group">
                        <label>End Time (Optional)</label>
                        <input type="time" id="taskEnd">
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Task</button>
                </div>
            </form>
        </div>
    `;

    showModal(modalHtml);

    // Attach Event Listener
    document.getElementById('addTaskForm').addEventListener('submit', handleAddTask);
}

// HANDLE ADD TASK
async function handleAddTask(e) {
    e.preventDefault();
    if (!currentUser) return;

    const title = document.getElementById('taskTitle').value;
    const category = document.getElementById('taskCategory').value;
    const priority = document.getElementById('taskPriority').value;
    const start = document.getElementById('taskStart').value;
    const end = document.getElementById('taskEnd').value;

    const newTask = {
        userId: currentUser.uid,
        title: title,
        status: 'todo',
        priority: priority,
        category: category,
        timeBlock: (start && end) ? { start, end } : null,
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection('tasks').add(newTask);
        closeModal();
        loadTasks(); // Refresh list
    } catch (error) {
        console.error("Error adding task: ", error);
        alert("Failed to add task. Check console.");
    }
}

// TOGGLE TASK STATUS
async function toggleTaskStatus(taskId, currentStatus) {
    const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
    try {
        await db.collection('tasks').doc(taskId).update({
            status: newStatus
        });
        loadTasks();
    } catch (error) {
        console.error("Error updating task: ", error);
    }
}

// DELETE TASK
async function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
        await db.collection('tasks').doc(taskId).delete();
        loadTasks();
    } catch (error) {
        console.error("Error deleting task: ", error);
    }
}

// UPDATE PROJECT PLACEHOLDER (Added for safe load)
function updateProjectPlaceholder() {
    const list = document.getElementById('dashboardProjectList');
    if (list) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No projects yet.</p>
                <button class="btn btn-link btn-sm" onclick="showModule('projects')">Create Project</button>
            </div>
        `;
    }
}

/* ============================
   MODAL SYSTEM
   ============================ */

function showModal(content) {
    const container = document.getElementById('modalContainer');
    if (container) {
        container.innerHTML = content;
        container.classList.add('active');
    }
}

function closeModal() {
    const container = document.getElementById('modalContainer');
    if (container) {
        container.classList.remove('active');
    }
}

// CLICK OUTSIDE TO CLOSE
const modalContainer = document.getElementById('modalContainer');
if (modalContainer) {
    modalContainer.addEventListener('click', (e) => {
        if (e.target.id === 'modalContainer') closeModal();
    });
}

/* ============================
   TASK FILTERING SYSTEM
   ============================ */

let currentFilter = 'all'; // Track active filter

function filterTasks(filterType) {
    currentFilter = filterType;
    
    // Update filter button states
    document.querySelectorAll('.filter-tag').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Apply filter and re-render
    renderTaskList();
}

function getFilteredTasks() {
    let filtered = [...currentTasks];
    
    switch(currentFilter) {
        case 'all':
            return filtered;
            
        case 'today':
            return filtered.filter(task => {
                if (task.timeBlock) {
                    return isToday(new Date());
                }
                return isToday(new Date(task.createdAt));
            });
            
        case 'upcoming':
            return filtered.filter(task => task.status !== 'completed');
            
        case 'high':
            return filtered.filter(task => task.priority === 'high');
            
        default:
            return filtered;
    }
}


/* ============================
   TASK EDITING SYSTEM
   ============================ */

function editTask(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const modalHtml = 
        <div class="modal-card">
            <div class="modal-header">
                <h3>Edit Task</h3>
                <button class="btn-close" onclick="closeModal()"></button>
            </div>
            <form id="editTaskForm">
                <input type="hidden" id="editTaskId" value="">
                <div class="form-group">
                    <label>Task Title</label>
                    <input type="text" id="editTaskTitle" required value="" autofocus>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Category</label>
                        <select id="editTaskCategory" class="form-select">
                            <option value="work" > Work</option>
                            <option value="study" > Study</option>
                            <option value="project" > Project</option>
                            <option value="personal" > Personal</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Priority</label>
                        <select id="editTaskPriority" class="form-select">
                            <option value="low" >Low</option>
                            <option value="medium" >Medium</option>
                            <option value="high" >High</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Start Time (Optional)</label>
                        <input type="time" id="editTaskStart" value="">
                    </div>
                    <div class="form-group">
                        <label>End Time (Optional)</label>
                        <input type="time" id="editTaskEnd" value="">
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Task</button>
                </div>
            </form>
        </div>
    ;
    
    showModal(modalHtml);
    
    document.getElementById('editTaskForm').addEventListener('submit', handleEditTask);
}

async function handleEditTask(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const taskId = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTaskTitle').value;
    const category = document.getElementById('editTaskCategory').value;
    const priority = document.getElementById('editTaskPriority').value;
    const start = document.getElementById('editTaskStart').value;
    const end = document.getElementById('editTaskEnd').value;
    
    const updates = {
        title: title,
        priority: priority,
        category: category,
        timeBlock: (start && end) ? { start, end } : null
    };
    
    try {
        await db.collection('tasks').doc(taskId).update(updates);
        closeModal();
        loadTasks();
    } catch (error) {
        console.error("Error updating task: ", error);
        alert("Failed to update task. Check console.");
    }
}


/* ============================
   TASK SEARCH SYSTEM
   ============================ */

let currentSearchTerm = '';

function searchTasks(searchTerm) {
    currentSearchTerm = searchTerm.toLowerCase();
    renderTaskList();
}

function getSearchedAndFilteredTasks() {
    let tasks = currentFilter === 'all' ? currentTasks : getFilteredTasks();
    
    if (currentSearchTerm) {
        tasks = tasks.filter(task => 
            task.title.toLowerCase().includes(currentSearchTerm) ||
            task.category.toLowerCase().includes(currentSearchTerm)
        );
    }
    
    return tasks;
}


/* ============================
   FEATURE 4: ACTIVE TASK FOCUS + TIMER
   ============================ */

let activeTask = null;
let focusTimerInterval = null;

function detectActiveTask() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    // Find task with time block matching current time
    const active = currentTasks.find(task => {
        if (!task.timeBlock || task.status === 'completed') return false;
        return currentTime >= task.timeBlock.start && currentTime <= task.timeBlock.end;
    });
    
    if (active && active.id !== (activeTask ? activeTask.id : null)) {
        setActiveTask(active);
    } else if (!active && activeTask) {
        clearActiveTask();
    }
}

function setActiveTask(task) {
    activeTask = task;
    renderFocusCard();
    startFocusTimer();
}

function clearActiveTask() {
    activeTask = null;
    if (focusTimerInterval) clearInterval(focusTimerInterval);
    renderFocusCard();
}

function renderFocusCard() {
    const container = document.getElementById('currentFocusContent');
    if (!container) return;
    
    if (!activeTask) {
        container.innerHTML = 
            <div class="empty-state">
                <p>No active task right now.</p>
                <button class="btn btn-outline btn-sm" onclick="showModule('tasks')">View Tasks</button>
            </div>
        ;
        return;
    }
    
    container.innerHTML = 
        <div class="focus-task-display">
            <div class="focus-task-title"></div>
            <div class="focus-task-meta">
                <span class="badg badge-"></span>
                <span class="badg priority-"> priority</span>
            </div>
            <div class="focus-timer" id="focusTimer">00:00</div>
            <div class="focus-actions">
                <button class="btn btn-primary btn-sm" onclick="completeActiveTask()"> Complete</button>
                <button class="btn btn-outline btn-sm" onclick="clearActiveTask()"> Pause</button>
            </div>
        </div>
    ;
}

function startFocusTimer() {
    if (focusTimerInterval) clearInterval(focusTimerInterval);
    
    focusTimerInterval = setInterval(() => {
        if (!activeTask || !activeTask.timeBlock) return;
        
        const now = new Date();
        const [endHour, endMin] = activeTask.timeBlock.end.split(':').map(Number);
        const endTime = new Date(now);
        endTime.setHours(endHour, endMin, 0, 0);
        
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        
        const timerEl = document.getElementById('focusTimer');
        if (timerEl) {
            timerEl.textContent = ${minutes.toString().padStart(2, '0')}:;
        }
        
        if (remaining === 0) {
            clearInterval(focusTimerInterval);
        }
    }, 1000);
}

async function completeActiveTask() {
    if (!activeTask) return;
    await toggleTaskStatus(activeTask.id, activeTask.status);
    clearActiveTask();
}

// Auto-detect every minute
setInterval(detectActiveTask, 60000);
detectActiveTask(); // Initial check


/* ============================
   FEATURE 6: PROJECTS MODULE
   ============================ */

let currentProjects = [];

async function loadProjects() {
    if (!currentUser) return;
    
    // In a real app we'd load this once or cache it
    const snapshot = await db.collection('projects')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
        
    currentProjects = [];
    snapshot.forEach(doc => {
        currentProjects.push({ id: doc.id, ...doc.data() });
    });
    
    renderProjectsView();
    updateDashboardProjects();
}

function renderProjectsView() {
    const projectsModule = document.getElementById('projectsModule');
    if (!projectsModule) return;
    
    let html = '<div class="projects-view">';
    html += '<div class="module-header"><h2> Projects</h2>';
    html += '<button class="btn btn-primary btn-sm" onclick="openAddProjectModal()">+ New Project</button></div>';
    
    if (currentProjects.length === 0) {
        html += '<div class="empty-state">No projects yet. Create your first project!</div>';
    } else {
        html += '<div class="projects-grid">';
        currentProjects.forEach(project => {
            // Calculate progress based on tasks linked to this project
            // Note: need to ensure tasks have projectId
            const projectTasks = currentTasks.filter(t => t.projectId === project.id);
            const completed = projectTasks.filter(t => t.status === 'completed').length;
            const total = projectTasks.length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            html += 
                <div class="project-card">
                    <div class="project-header">
                        <h3></h3>
                        <span class="badge badge-"></span>
                    </div>
                    <p class="project-description"></p>
                    <div class="project-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: %"></div>
                        </div>
                        <span class="progress-text">/ tasks (%)</span>
                    </div>
                    <div class="project-actions">
                        <button class="btn btn-icon" onclick="deleteProject('')"></button>
                    </div>
                </div>
            ;
        });
        html += '</div>';
    }
    
    html += '</div>';
    projectsModule.innerHTML = html;
}

function updateDashboardProjects() {
    const container = document.getElementById('dashboardProjectList');
    if (!container) return;
    
    if (currentProjects.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No projects yet.</p></div>';
        return;
    }
    
    const activeProjects = currentProjects.filter(p => p.status !== 'completed').slice(0, 3);
    container.innerHTML = activeProjects.map(project => {
        const projectTasks = currentTasks.filter(t => t.projectId === project.id);
        const completed = projectTasks.filter(t => t.status === 'completed').length;
        const total = projectTasks.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return 
            <div class="dashboard-project-item" onclick="showModule('projects')">
                <div class="project-mini-title"></div>
                <div class="progress-bar-mini">
                    <div class="progress-fill" style="width: %"></div>
                </div>
            </div>
        ;
    }).join('');
}

function openAddProjectModal() {
    const modalHtml = 
        <div class="modal-card">
            <div class="modal-header">
                <h3>Create New Project</h3>
                <button class="btn-close" onclick="closeModal()"></button>
            </div>
            <form id="addProjectForm">
                <div class="form-group">
                    <label>Project Title</label>
                    <input type="text" id="projectTitle" required placeholder="e.g., Build Website" autofocus>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="projectDescription" rows="3" placeholder="Description..."></textarea>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="projectStatus" class="form-select">
                        <option value="active">Active</option>
                        <option value="planning">Planning</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Create Project</button>
                </div>
            </form>
        </div>
    ;
    
    showModal(modalHtml);
    document.getElementById('addProjectForm').addEventListener('submit', handleAddProject);
}

async function handleAddProject(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const newProject = {
        userId: currentUser.uid,
        title: document.getElementById('projectTitle').value,
        description: document.getElementById('projectDescription').value,
        status: document.getElementById('projectStatus').value,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.collection('projects').add(newProject);
        closeModal();
        loadProjects();
    } catch (error) {
        console.error("Error adding project: ", error);
        alert("Failed to add project.");
    }
}

async function deleteProject(projectId) {
    if (!confirm('Delete this project?')) return;
    try {
        await db.collection('projects').doc(projectId).delete();
        loadProjects();
    } catch (error) {
        console.error("Error deleting project: ", error);
    }
}
// Update showModule to trigger loadProjects
const originalShowModuleForProjects = showModule;
showModule = function(moduleName) {
    originalShowModuleForProjects(moduleName);
    if (moduleName === 'projects') {
        loadProjects();
    }
};
// Also load projects initially
// This should be called in loadData
const originalLoadDataForProjects = loadData;
loadData = function() {
    originalLoadDataForProjects();
    loadProjects();
};

/* ============================
   FEATURE 7: GOALS SYSTEM
   ============================ */

let currentGoals = [];

async function loadGoals() {
    if (!currentUser) return;
    
    const snapshot = await db.collection('goals')
        .where('userId', '==', currentUser.uid)
        .orderBy('deadline', 'asc')
        .get();
        
    currentGoals = [];
    snapshot.forEach(doc => {
        currentGoals.push({ id: doc.id, ...doc.data() });
    });
    
    renderGoalsView();
}

function renderGoalsView() {
    const goalsModule = document.getElementById('goalsModule');
    if (!goalsModule) return;
    
    let html = '<div class="goals-view">';
    html += '<div class="module-header"><h2> Goals</h2>';
    html += '<button class="btn btn-primary btn-sm" onclick="openAddGoalModal()">+ New Goal</button></div>';
    
    if (currentGoals.length === 0) {
        html += '<div class="empty-state">No goals set yet. Aim high!</div>';
    } else {
        html += '<div class="goals-grid">';
        currentGoals.forEach(goal => {
            // Visualize Deadline
            const today = new Date();
            const deadline = new Date(goal.deadline);
            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
            let timeLeftClass = daysLeft < 7 ? 'urgent' : '';
            
            html += 
                <div class="card goal-card">
                    <div class="card-header">
                        <h3></h3>
                        <span class="badge badge-"></span>
                    </div>
                    <p class="goal-description"></p>
                    <div class="goal-meta">
                        <span class="deadline "> Due:  ( days left)</span>
                    </div>
                    <div class="goal-actions">
                         <button class="btn btn-icon" onclick="deleteGoal('')"></button>
                    </div>
                </div>
            ;
        });
        html += '</div>';
    }
    
    html += '</div>';
    goalsModule.innerHTML = html;
}

function openAddGoalModal() {
    const modalHtml = 
        <div class="modal-card">
            <div class="modal-header">
                <h3>Set New Goal</h3>
                <button class="btn-close" onclick="closeModal()"></button>
            </div>
            <form id="addGoalForm">
                <div class="form-group">
                    <label>Goal Title</label>
                    <input type="text" id="goalTitle" required placeholder="e.g., Run a Marathon" autofocus>
                </div>
                <div class="form-group">
                    <label>Description (Success Criteria)</label>
                    <textarea id="goalDescription" rows="3" placeholder="What does success look like?"></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Deadline</label>
                        <input type="date" id="goalDeadline" required>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select id="goalStatus" class="form-select">
                            <option value="active">In Progress</option>
                            <option value="achieved">Achieved</option>
                            <option value="paused">Paused</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Set Goal</button>
                </div>
            </form>
        </div>
    ;
    
    showModal(modalHtml);
    document.getElementById('addGoalForm').addEventListener('submit', handleAddGoal);
}

async function handleAddGoal(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const newGoal = {
        userId: currentUser.uid,
        title: document.getElementById('goalTitle').value,
        description: document.getElementById('goalDescription').value,
        deadline: document.getElementById('goalDeadline').value,
        status: document.getElementById('goalStatus').value,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.collection('goals').add(newGoal);
        closeModal();
        loadGoals();
    } catch (error) {
        console.error("Error adding goal: ", error);
        alert("Failed to add goal.");
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Delete this goal?')) return;
    try {
        await db.collection('goals').doc(goalId).delete();
        loadGoals();
    } catch (error) {
        console.error("Error deleting goal: ", error);
    }
}

// Hook into showModule
const showModuleForGoals = showModule;
showModule = function(moduleName) {
    showModuleForGoals(moduleName);
    if (moduleName === 'goals') {
        loadGoals();
    }
}


/* ============================
   FEATURE 8: LEARNING MODULE
   ============================ */

let currentCourses = [];

async function loadLearning() {
    if (!currentUser) return;
    
    const snapshot = await db.collection('learning_courses')
        .where('userId', '==', currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
        
    currentCourses = [];
    snapshot.forEach(doc => {
        currentCourses.push({ id: doc.id, ...doc.data() });
    });
    
    renderLearningView();
}

function renderLearningView() {
    const learnModule = document.getElementById('learningModule');
    if (!learnModule) return;
    
    let html = '<div class="learning-view">';
    html += '<div class="module-header"><h2> Learning Paths</h2>';
    html += '<button class="btn btn-primary btn-sm" onclick="openAddCourseModal()">+ Add Course</button></div>';
    
    if (currentCourses.length === 0) {
        html += '<div class="empty-state">No courses added. What do you want to learn?</div>';
    } else {
        html += '<div class="learning-grid">';
        currentCourses.forEach(course => {
            html += 
                <div class="card learning-card">
                    <div class="card-header">
                        <h3></h3>
                        <span class="badg badge-study"></span>
                    </div>
                    <p></p>
                    <div class="learning-actions">
                         <button class="btn btn-primary btn-sm" onclick="alert('Detailed lesson view coming in Phase 4.5!')">Continue Learning</button>
                         <button class="btn btn-icon" onclick="deleteCourse('')"></button>
                    </div>
                </div>
            ;
        });
        html += '</div>';
    }
    html += '</div>';
    learnModule.innerHTML = html;
}

function openAddCourseModal() {
    const modalHtml = 
        <div class="modal-card">
            <div class="modal-header">
                <h3>Add New Course</h3>
                <button class="btn-close" onclick="closeModal()"></button>
            </div>
            <form id="addCourseForm">
                <div class="form-group">
                    <label>Course Title</label>
                    <input type="text" id="courseTitle" required placeholder="e.g., Advanced React Patterns" autofocus>
                </div>
                <div class="form-group">
                    <label>Platform / Source</label>
                    <input type="text" id="coursePlatform" placeholder="e.g., Udemy, Coursera, Book">
                </div>
                 <div class="form-group">
                    <label>Description</label>
                    <textarea id="courseDescription" rows="2"></textarea>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Course</button>
                </div>
            </form>
        </div>
    ;
    
    showModal(modalHtml);
    document.getElementById('addCourseForm').addEventListener('submit', handleAddCourse);
}

async function handleAddCourse(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const newCourse = {
        userId: currentUser.uid,
        title: document.getElementById('courseTitle').value,
        platform: document.getElementById('coursePlatform').value,
        description: document.getElementById('courseDescription').value,
        createdAt: new Date().toISOString()
    };
    
    try {
        await db.collection('learning_courses').add(newCourse);
        closeModal();
        loadLearning();
    } catch (error) {
        console.error("Error adding course: ", error);
        alert("Failed");
    }
}

async function deleteCourse(id) {
    if (!confirm('Delete this course?')) return;
    await db.collection('learning_courses').doc(id).delete();
    loadLearning();
}

// Hook into showModule
const showModuleForLearning = showModule;
showModule = function(moduleName) {
    showModuleForLearning(moduleName);
    if (moduleName === 'learning') {
        loadLearning();
    }
}


/* ============================
   FEATURE 10, 11, 12: POLISH (Analytics, Shortcuts, Notifications)
   ============================ */

/* FEATURE 11: KEYBOARD SHORTCUTS */
document.addEventListener('keydown', (e) => {
    // Ctrl+K -> Quick Task
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openAddTaskModal();
    }
    // Esc -> Close Modal
    if (e.key === 'Escape') {
        closeModal();
    }
});

/* FEATURE 12: NOTIFICATIONS */
function requestNotificationPermission() {
    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
}
// Request on load
setTimeout(requestNotificationPermission, 3000);

function sendNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'favicon.ico' });
    }
}

/* FEATURE 10: ANALYTICS (Simple render) */
// enhancing renderDashboard to show a productivity score
function calculateProductivity() {
    const completed = currentTasks.filter(t => t.status === 'completed').length;
    const total = currentTasks.length;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
}
// update productivity stat
setInterval(() => {
    const prodEl = document.querySelector('.stat-value'); // First one is Prod
    if (prodEl) prodEl.textContent = calculateProductivity() + '%';
}, 5000);


/* ============================
   FEATURE 13: THEME TOGGLE
   ============================ */
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('lcc-theme', next);
}

// Init Theme
const savedTheme = localStorage.getItem('lcc-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// Add toggle button to sidebar footer
function addThemeBtn() {
    const footer = document.querySelector('.sidebar-footer');
    if (footer && !document.getElementById('themeBtn')) {
        const btn = document.createElement('button');
        btn.id = 'themeBtn';
        btn.className = 'btn-icon';
        btn.innerHTML = '';
        btn.onclick = toggleTheme;
        btn.style.marginRight = '10px';
        footer.insertBefore(btn, footer.firstChild);
    }
}
setInterval(addThemeBtn, 1000);

/* ============================
   FEATURE 14, 15, 16, 17: ADVANCED TASK FEATURES (Data Model Support)
   ============================ */

// Note: Full UI for subtasks/recurring requires larger refactor of the modal.
// For now, we update the Task Data Model to support these fields in Firestore
// so they are ready for Phase 2 UI.

// Feature 16: Recurring Logic (Skeleton)
function checkRecurringTasks() {
    // This would run daily to clone recurring tasks
    console.log("Checking recurring tasks...");
}
// Run once on load
checkRecurringTasks();

