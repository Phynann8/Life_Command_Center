// ==========================================
// Life Command Center - script.js
// Enhanced version with all features
// ==========================================

// -----------------------------
// CONSTANTS
// -----------------------------
const Constants = {
    FOCUS_CHECK_INTERVAL: 30000,        // 30 seconds
    TIMER_UPDATE_INTERVAL: 1000,         // 1 second
    SEARCH_DEBOUNCE_DELAY: 300,          // 300ms
    POMODORO_WORK: 25 * 60 * 1000,       // 25 minutes
    POMODORO_SHORT_BREAK: 5 * 60 * 1000, // 5 minutes
    POMODORO_LONG_BREAK: 15 * 60 * 1000, // 15 minutes
    TASK_STATUS: {
        TODO: 'todo',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed'
    },
    PRIORITY: {
        HIGH: 'high',
        MEDIUM: 'medium',
        LOW: 'low'
    },
    CATEGORY: {
        WORK: 'work',
        STUDY: 'study',
        PROJECT: 'project',
        PERSONAL: 'personal'
    },
    RECURRENCE: {
        NONE: 'none',
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly'
    }
};

// -----------------------------
// CONFIGURATIONS & UTILITIES
// -----------------------------
const Config = {
    // Application configuration
    offlineMode: true, // Force offline mode for now

    // Supabase project configuration
    supabase: {
        url: "https://kieasvupsiyrtpulrafw.supabase.co",
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZWFzdnVwc2l5cnRwdWxyYWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDI1MDYsImV4cCI6MjA4NDYxODUwNn0.dX8a2PXeAliJRtWA2s802lQeUYTfY9R4mk9292JYKpE"
    }
};

// -----------------------------
// UTILITY FUNCTIONS
// -----------------------------
const Utils = {
    // Date utilities
    isToday: (value) => {
        if (!value) return false;
        const d = new Date(value);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        return d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
    },
    formatTime: (value) => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    formatDate: (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString();
    },
    // Performance utilities
    debounce: (fn, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    },
    throttle: (fn, delay) => {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return fn(...args);
            }
        };
    },
    memoize: (fn) => {
        const cache = new Map();
        return (...args) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) return cache.get(key);
            const result = fn(...args);
            cache.set(key, result);
            return result;
        };
    },
    // Security utilities
    escapeHtml: (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return Utils.escapeHtml(input.trim());
    },
    // Validation utilities
    validateEmail: (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    validateUrl: (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    // Array utilities
    groupBy: (array, key) => {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },
    // Storage utilities
    setLocalStorage: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('LocalStorage set failed:', e);
        }
    },
    getLocalStorage: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('LocalStorage get failed:', e);
            return defaultValue;
        }
    },
    // Convert snake_case to camelCase for JS objects
    snakeToCamel: (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(Utils.snakeToCamel);
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            acc[camelKey] = Utils.snakeToCamel(obj[key]);
            return acc;
        }, {});
    },
    // Convert camelCase to snake_case for database
    camelToSnake: (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(Utils.camelToSnake);
        return Object.keys(obj).reduce((acc, key) => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            acc[snakeKey] = Utils.camelToSnake(obj[key]);
            return acc;
        }, {});
    }
};

// -----------------------------
// ERROR HANDLER
// -----------------------------
const ErrorHandler = {
    handle: (error, context = 'Unknown') => {
        console.error(`[${context}]`, error);
        const message = ErrorHandler.getUserFriendlyMessage(error);
        UI.showToast(message, 'error');
        return message;
    },
    getUserFriendlyMessage: (error) => {
        if (!error) return 'An error occurred. Please try again.';
        if (typeof error === 'string') return error;
        // Supabase error handling
        if (error.message) {
            const errorMessages = {
                'Invalid login credentials': 'Invalid email or password.',
                'User already registered': 'Email already in use.',
                'Password should be at least 6 characters': 'Password is too weak (min 6 characters).',
                'Unable to validate email address: invalid format': 'Invalid email format.',
                'Email not confirmed': 'Please confirm your email address.'
            };
            return errorMessages[error.message] || error.message;
        }
        return error.message || 'An error occurred. Please try again.';
    }
};

// -----------------------------
// SUPABASE INITIALIZATION
// -----------------------------
const supabaseClient = Config.offlineMode ? {
    auth: {
        getSession: () => Promise.resolve({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
        getUser: () => Promise.resolve({ data: { user: null } }),
        signInWithPassword: () => Promise.resolve({ error: { message: 'Offline mode' } }),
        signUp: () => Promise.resolve({ error: { message: 'Offline mode' } }),
        signOut: () => Promise.resolve(),
        updateUser: () => Promise.resolve({ data: { user: null } })
    },
    from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }), order: () => Promise.resolve({ data: [] }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'mock_id' }, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) })
    }),
    channel: () => ({
        on: () => ({ subscribe: () => { } })
    })
} : supabase.createClient(Config.supabase.url, Config.supabase.anonKey);


// -----------------------------
// DATA VALIDATION
// -----------------------------
const TaskValidator = {
    validate: (task) => {
        const errors = [];
        if (!task.title || task.title.trim().length === 0) {
            errors.push('Title is required');
        }
        if (task.title && task.title.length > 200) {
            errors.push('Title too long (max 200 characters)');
        }
        if (task.timeBlock) {
            if (!task.timeBlock.start || !task.timeBlock.end) {
                errors.push('Both start and end times are required');
            } else if (task.timeBlock.end <= task.timeBlock.start) {
                errors.push('End time must be after start time');
            }
        }
        if (task.priority && !Object.values(Constants.PRIORITY).includes(task.priority)) {
            errors.push('Invalid priority value');
        }
        if (task.status && !Object.values(Constants.TASK_STATUS).includes(task.status)) {
            errors.push('Invalid status value');
        }
        return { valid: errors.length === 0, errors };
    }
};

// -----------------------------
// DATA MODULE (Supabase ops)
// -----------------------------
// -----------------------------
// MOCK DATA MODULE (Local Storage)
// -----------------------------
const MockData = {
    _subscriptions: {},
    _get: (key) => {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch { return []; }
    },
    _set: (key, val) => {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (e) { console.error('LocalStorage error:', e); }
    },
    _genId: () => 'mock_' + Date.now() + Math.random().toString(36).substr(2, 5),

    Tasks: {
        fetch: async (uid) => MockData._get(`tasks_${uid}`),
        listen: (uid, cb) => {
            cb(MockData._get(`tasks_${uid}`));
            return () => { };
        },
        add: async (uid, task) => {
            const tasks = MockData._get(`tasks_${uid}`);
            const newTask = { ...task, id: MockData._genId(), user_id: uid, created_at: new Date().toISOString() };
            tasks.unshift(newTask);
            MockData._set(`tasks_${uid}`, tasks);
            return { id: newTask.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const tasks = MockData._get(`tasks_${uid}`);
            const idx = tasks.findIndex(t => t.id === id);
            if (idx > -1) {
                tasks[idx] = { ...tasks[idx], ...data };
                MockData._set(`tasks_${uid}`, tasks);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const tasks = MockData._get(`tasks_${uid}`);
            const newTasks = tasks.filter(t => t.id !== id);
            MockData._set(`tasks_${uid}`, newTasks);
        },
        search: async (uid, q) => {
            const tasks = MockData._get(`tasks_${uid}`);
            if (!q) return tasks;
            const lowerQ = q.toLowerCase();
            return tasks.filter(t => t.title.toLowerCase().includes(lowerQ));
        }
    },
    Projects: {
        fetch: async (uid) => MockData._get(`projects_${uid}`),
        listen: (uid, cb) => { cb(MockData._get(`projects_${uid}`)); return () => { }; },
        add: async (uid, data) => {
            const items = MockData._get(`projects_${uid}`);
            const newItem = { ...data, id: MockData._genId(), user_id: uid };
            items.unshift(newItem);
            MockData._set(`projects_${uid}`, items);
            return { id: newItem.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`projects_${uid}`);
            const idx = items.findIndex(t => t.id === id);
            if (idx > -1) {
                items[idx] = { ...items[idx], ...data };
                MockData._set(`projects_${uid}`, items);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`projects_${uid}`);
            MockData._set(`projects_${uid}`, items.filter(t => t.id !== id));
        }
    },
    Goals: {
        fetch: async (uid) => MockData._get(`goals_${uid}`),
        listen: (uid, cb) => { cb(MockData._get(`goals_${uid}`)); return () => { }; },
        add: async (uid, data) => {
            const items = MockData._get(`goals_${uid}`);
            const newItem = { ...data, id: MockData._genId(), user_id: uid };
            items.unshift(newItem);
            MockData._set(`goals_${uid}`, items);
            return { id: newItem.id };
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`goals_${uid}`);
            MockData._set(`goals_${uid}`, items.filter(t => t.id !== id));
        }
    },
    Learnings: {
        fetch: async (uid) => MockData._get(`learnings_${uid}`),
        listen: (uid, cb) => { cb(MockData._get(`learnings_${uid}`)); return () => { }; },
        add: async (uid, data) => {
            const items = MockData._get(`learnings_${uid}`);
            const newItem = { ...data, id: MockData._genId(), user_id: uid };
            items.unshift(newItem);
            MockData._set(`learnings_${uid}`, items);
            return { id: newItem.id };
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`learnings_${uid}`);
            MockData._set(`learnings_${uid}`, items.filter(t => t.id !== id));
        }
    },
    Templates: {
        fetch: async (uid) => MockData._get(`templates_${uid}`),
        listen: (uid, cb) => { cb(MockData._get(`templates_${uid}`)); return () => { }; },
        add: async (uid, data) => {
            const items = MockData._get(`templates_${uid}`);
            const newItem = { ...data, id: MockData._genId(), user_id: uid };
            items.unshift(newItem);
            MockData._set(`templates_${uid}`, items);
            return { id: newItem.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`templates_${uid}`);
            const idx = items.findIndex(t => t.id === id);
            if (idx > -1) {
                items[idx] = { ...items[idx], ...data };
                MockData._set(`templates_${uid}`, items);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`templates_${uid}`);
            MockData._set(`templates_${uid}`, items.filter(t => t.id !== id));
        }
    },
    Habits: {
        fetch: async (uid) => MockData._get(`habits_${uid}`),
        listen: (uid, cb) => { cb(MockData._get(`habits_${uid}`)); return () => { }; },
        add: async (uid, data) => {
            const items = MockData._get(`habits_${uid}`);
            const newItem = { ...data, id: MockData._genId(), user_id: uid };
            items.unshift(newItem);
            MockData._set(`habits_${uid}`, items);
            return { id: newItem.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`habits_${uid}`);
            const idx = items.findIndex(t => t.id === id);
            if (idx > -1) {
                items[idx] = { ...items[idx], ...data };
                MockData._set(`habits_${uid}`, items);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`habits_${uid}`);
            MockData._set(`habits_${uid}`, items.filter(t => t.id !== id));
        },
        markComplete: async (id, date) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`habits_${uid}`);
            const habit = items.find(h => h.id === id);
            if (habit) {
                const completedDates = habit.completedDates || [];
                if (!completedDates.includes(date)) {
                    completedDates.push(date);
                    habit.completedDates = completedDates;

                    if (RecurrenceManager && RecurrenceManager.calculateStreak) {
                        const streakData = RecurrenceManager.calculateStreak(completedDates);
                        habit.currentStreak = streakData.current;
                        habit.longestStreak = Math.max(habit.longestStreak || 0, streakData.longest);
                    }

                    MockData._set(`habits_${uid}`, items);
                }
            }
        }
    },
    // YouTube Content Command Center - Channels Module
    Channels: {
        fetch: async (uid) => MockData._get(`channels_${uid}`),
        listen: (uid, cb) => {
            cb(MockData._get(`channels_${uid}`));
            return () => { };
        },
        add: async (uid, data) => {
            const items = MockData._get(`channels_${uid}`);
            const newItem = {
                ...data,
                id: MockData._genId(),
                user_id: uid,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            items.unshift(newItem);
            MockData._set(`channels_${uid}`, items);
            return { id: newItem.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`channels_${uid}`);
            const idx = items.findIndex(c => c.id === id);
            if (idx > -1) {
                items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
                MockData._set(`channels_${uid}`, items);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`channels_${uid}`);
            MockData._set(`channels_${uid}`, items.filter(c => c.id !== id));
        }
    },
    // YouTube Content Command Center - Content Vault Module
    ContentVault: {
        fetch: async (uid, channelId = null) => {
            const items = MockData._get(`content_vault_${uid}`);
            if (channelId) {
                return items.filter(item => item.channel_id === channelId);
            }
            return items;
        },
        listen: (uid, cb, channelId = null) => {
            const items = MockData._get(`content_vault_${uid}`);
            if (channelId) {
                cb(items.filter(item => item.channel_id === channelId));
            } else {
                cb(items);
            }
            return () => { };
        },
        add: async (uid, data) => {
            const items = MockData._get(`content_vault_${uid}`);
            const newItem = {
                ...data,
                id: MockData._genId(),
                user_id: uid,
                state: data.state || 'research',
                media_assets: data.media_assets || [],
                linked_tasks: data.linked_tasks || [],
                linked_goals: data.linked_goals || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            items.unshift(newItem);
            MockData._set(`content_vault_${uid}`, items);
            return { id: newItem.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`content_vault_${uid}`);
            const idx = items.findIndex(v => v.id === id);
            if (idx > -1) {
                items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
                MockData._set(`content_vault_${uid}`, items);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`content_vault_${uid}`);
            MockData._set(`content_vault_${uid}`, items.filter(v => v.id !== id));
        },
        addMediaAsset: async (videoId, asset) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`content_vault_${uid}`);
            const video = items.find(v => v.id === videoId);
            if (video) {
                const newAsset = {
                    ...asset,
                    id: MockData._genId(),
                    created_at: new Date().toISOString()
                };
                video.media_assets = video.media_assets || [];
                video.media_assets.push(newAsset);
                video.updated_at = new Date().toISOString();
                MockData._set(`content_vault_${uid}`, items);
                return { id: newAsset.id };
            }
        },
        updateState: async (id, newState) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`content_vault_${uid}`);
            const idx = items.findIndex(v => v.id === id);
            if (idx > -1) {
                items[idx].state = newState;
                items[idx].updated_at = new Date().toISOString();
                MockData._set(`content_vault_${uid}`, items);
            }
        }
    },

    // Prompts Library for AI Content Generation
    Prompts: {
        fetch: async (uid, channelId = null) => {
            const items = MockData._get(`prompts_${uid}`);
            if (channelId) {
                return items.filter(item => item.channel_id === channelId || item.channel_id === null);
            }
            return items;
        },
        listen: (uid, cb, channelId = null) => {
            const items = MockData._get(`prompts_${uid}`);
            if (channelId) {
                cb(items.filter(item => item.channel_id === channelId || item.channel_id === null));
            } else {
                cb(items);
            }
            return () => { };
        },
        add: async (uid, data) => {
            const items = MockData._get(`prompts_${uid}`);
            const newItem = {
                ...data,
                id: MockData._genId(),
                user_id: uid,
                category: data.category || 'general',
                variables: data.variables || [],
                rating: data.rating || 0,
                use_count: 0,
                is_favorite: false,
                niche_preset: data.niche_preset || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            items.unshift(newItem);
            MockData._set(`prompts_${uid}`, items);
            return { id: newItem.id };
        },
        update: async (id, data) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`prompts_${uid}`);
            const idx = items.findIndex(p => p.id === id);
            if (idx > -1) {
                items[idx] = { ...items[idx], ...data, updated_at: new Date().toISOString() };
                MockData._set(`prompts_${uid}`, items);
            }
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`prompts_${uid}`);
            MockData._set(`prompts_${uid}`, items.filter(p => p.id !== id));
        },
        toggleFavorite: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`prompts_${uid}`);
            const prompt = items.find(p => p.id === id);
            if (prompt) {
                prompt.is_favorite = !prompt.is_favorite;
                prompt.updated_at = new Date().toISOString();
                MockData._set(`prompts_${uid}`, items);
            }
        },
        setRating: async (id, rating) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`prompts_${uid}`);
            const prompt = items.find(p => p.id === id);
            if (prompt) {
                prompt.rating = Math.max(0, Math.min(5, rating));
                prompt.updated_at = new Date().toISOString();
                MockData._set(`prompts_${uid}`, items);
            }
        },
        incrementUseCount: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`prompts_${uid}`);
            const prompt = items.find(p => p.id === id);
            if (prompt) {
                prompt.use_count = (prompt.use_count || 0) + 1;
                prompt.last_used_at = new Date().toISOString();
                prompt.updated_at = new Date().toISOString();
                MockData._set(`prompts_${uid}`, items);
            }
        }
    },

    // Prompt History - Tracks all AI generations
    PromptHistory: {
        fetch: async (uid, limit = 50) => {
            const items = MockData._get(`prompt_history_${uid}`);
            return items.slice(0, limit);
        },
        listen: (uid, cb) => {
            cb(MockData._get(`prompt_history_${uid}`));
            return () => { };
        },
        add: async (uid, data) => {
            const items = MockData._get(`prompt_history_${uid}`);
            const newItem = {
                ...data,
                id: MockData._genId(),
                user_id: uid,
                prompt_id: data.prompt_id || null,
                channel_id: data.channel_id || null,
                video_id: data.video_id || null,
                input_variables: data.input_variables || {},
                output_result: data.output_result || '',
                ai_service: data.ai_service || 'unknown',
                model: data.model || 'unknown',
                tokens_used: data.tokens_used || 0,
                cost_estimate: data.cost_estimate || 0,
                duration_ms: data.duration_ms || 0,
                success: data.success !== false,
                error_message: data.error_message || null,
                created_at: new Date().toISOString()
            };
            items.unshift(newItem);
            // Keep only last 500 history items
            if (items.length > 500) {
                items.splice(500);
            }
            MockData._set(`prompt_history_${uid}`, items);
            return { id: newItem.id };
        },
        getStats: async (uid) => {
            const items = MockData._get(`prompt_history_${uid}`);
            return {
                totalGenerations: items.length,
                successCount: items.filter(h => h.success).length,
                failureCount: items.filter(h => !h.success).length,
                totalTokens: items.reduce((sum, h) => sum + (h.tokens_used || 0), 0),
                totalCost: items.reduce((sum, h) => sum + (h.cost_estimate || 0), 0),
                avgDuration: items.length > 0 ?
                    items.reduce((sum, h) => sum + (h.duration_ms || 0), 0) / items.length : 0
            };
        }
    },

    // Niche Presets - Pre-configured prompt styles per niche
    NichePresets: {
        fetch: async () => {
            // Return built-in niche presets
            return [
                { id: 'gaming', name: 'Gaming', icon: '🎮', toneKeywords: ['exciting', 'epic', 'intense', 'fun'], colorScheme: '#9147ff' },
                { id: 'educational', name: 'Educational', icon: '📚', toneKeywords: ['clear', 'informative', 'engaging', 'professional'], colorScheme: '#2196f3' },
                { id: 'tech', name: 'Tech', icon: '💻', toneKeywords: ['innovative', 'cutting-edge', 'sleek', 'modern'], colorScheme: '#00bcd4' },
                { id: 'asmr', name: 'ASMR', icon: '🎧', toneKeywords: ['relaxing', 'soothing', 'gentle', 'calming'], colorScheme: '#9c27b0' },
                { id: 'vlog', name: 'Vlog', icon: '📹', toneKeywords: ['personal', 'authentic', 'relatable', 'fun'], colorScheme: '#ff5722' },
                { id: 'music', name: 'Music', icon: '🎵', toneKeywords: ['rhythmic', 'vibrant', 'emotional', 'dynamic'], colorScheme: '#e91e63' },
                { id: 'cooking', name: 'Cooking', icon: '🍳', toneKeywords: ['delicious', 'fresh', 'homemade', 'appetizing'], colorScheme: '#ff9800' },
                { id: 'fitness', name: 'Fitness', icon: '💪', toneKeywords: ['energetic', 'motivating', 'powerful', 'healthy'], colorScheme: '#4caf50' }
            ];
        }
    },

    // Media Assets - Generated images and videos
    MediaAssets: {
        fetch: async (uid, limit = 100) => {
            const items = MockData._get(`media_assets_${uid}`);
            return items.slice(0, limit);
        },
        listen: (uid, cb) => {
            cb(MockData._get(`media_assets_${uid}`));
            return () => { };
        },
        add: async (uid, data) => {
            const items = MockData._get(`media_assets_${uid}`);
            const newItem = {
                ...data,
                id: MockData._genId(),
                user_id: uid,
                type: data.type || 'image', // image, video
                url: data.url || '',
                prompt: data.prompt || '',
                status: data.status || 'completed', // pending, processing, completed, failed
                metadata: data.metadata || {},
                is_favorite: false,
                created_at: new Date().toISOString()
            };
            items.unshift(newItem);
            MockData._set(`media_assets_${uid}`, items);
            return { id: newItem.id };
        },
        delete: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`media_assets_${uid}`);
            MockData._set(`media_assets_${uid}`, items.filter(m => m.id !== id));
        },
        toggleFavorite: async (id) => {
            const uid = App.state.user?.uid || 'guest';
            const items = MockData._get(`media_assets_${uid}`);
            const asset = items.find(m => m.id === id);
            if (asset) {
                asset.is_favorite = !asset.is_favorite;
                MockData._set(`media_assets_${uid}`, items);
            }
        }
    }
};

// -----------------------------
// DATA MODULE (Supabase ops)
// -----------------------------
const SupabaseData = {
    // Real-time subscriptions storage
    _subscriptions: {},

    // Helper to convert DB row to app format (snake_case to camelCase)
    _toAppFormat: (row) => {
        if (!row) return null;
        return Utils.snakeToCamel(row);
    },

    // Helper to convert app data to DB format (camelCase to snake_case)
    _toDbFormat: (data) => {
        return Utils.camelToSnake(data);
    },

    Tasks: {
        // Fetch once
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Tasks.fetch');
                return [];
            }
        },
        // Real-time listener
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `tasks_${userId}`;
            // Unsubscribe existing subscription
            if (Data._subscriptions[key]) {
                Data._subscriptions[key].unsubscribe();
            }

            // Initial fetch
            Data.Tasks.fetch(userId).then(callback);

            // Setup realtime subscription
            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
                    async () => {
                        // Refetch on any change
                        const tasks = await Data.Tasks.fetch(userId);
                        callback(tasks);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, task) => {
            // Validate
            const validation = TaskValidator.validate(task);
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }
            // Sanitize
            const sanitized = {
                ...task,
                title: Utils.sanitizeInput(task.title),
                description: task.description ? Utils.sanitizeInput(task.description) : null
            };
            try {
                const dbData = Data._toDbFormat({ userId, ...sanitized });
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: data.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Tasks.add');
                throw error;
            }
        },
        update: async (id, updateData) => {
            // Validate if title is being updated
            if (updateData.title) {
                const validation = TaskValidator.validate(updateData);
                if (!validation.valid) {
                    throw new Error(validation.errors.join(', '));
                }
            }
            // Sanitize
            const sanitized = { ...updateData };
            if (sanitized.title) sanitized.title = Utils.sanitizeInput(sanitized.title);
            if (sanitized.description) sanitized.description = Utils.sanitizeInput(sanitized.description);

            try {
                const dbData = Data._toDbFormat(sanitized);
                const { error } = await supabaseClient
                    .from('tasks')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Tasks.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('tasks')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Tasks.delete');
                throw error;
            }
        },
        search: async (userId, query) => {
            if (!userId || !query) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('tasks')
                    .select('*')
                    .eq('user_id', userId)
                    .or(`title.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`);
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Tasks.search');
                return [];
            }
        }
    },
    Projects: {
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('projects')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Projects.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `projects_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Projects.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` },
                    async () => {
                        const projects = await Data.Projects.fetch(userId);
                        callback(projects);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({ userId, ...data });
                const { data: result, error } = await supabaseClient
                    .from('projects')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Projects.add');
                throw error;
            }
        },
        update: async (id, data) => {
            try {
                const dbData = Data._toDbFormat(data);
                const { error } = await supabaseClient
                    .from('projects')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Projects.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('projects')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Projects.delete');
                throw error;
            }
        }
    },
    Goals: {
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('goals')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Goals.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `goals_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Goals.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
                    async () => {
                        const goals = await Data.Goals.fetch(userId);
                        callback(goals);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({ userId, ...data });
                const { data: result, error } = await supabaseClient
                    .from('goals')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Goals.add');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('goals')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Goals.delete');
                throw error;
            }
        }
    },
    Templates: {
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('templates')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Templates.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `templates_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Templates.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'templates', filter: `user_id=eq.${userId}` },
                    async () => {
                        const templates = await Data.Templates.fetch(userId);
                        callback(templates);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({ userId, ...data });
                const { data: result, error } = await supabaseClient
                    .from('templates')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Templates.add');
                throw error;
            }
        },
        update: async (id, data) => {
            try {
                const dbData = Data._toDbFormat(data);
                const { error } = await supabaseClient
                    .from('templates')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Templates.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('templates')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Templates.delete');
                throw error;
            }
        }
    },
    Habits: {
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('habits')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Habits.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `habits_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Habits.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
                    async () => {
                        const habits = await Data.Habits.fetch(userId);
                        callback(habits);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({ userId, ...data });
                const { data: result, error } = await supabaseClient
                    .from('habits')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Habits.add');
                throw error;
            }
        },
        update: async (id, data) => {
            try {
                const dbData = Data._toDbFormat(data);
                const { error } = await supabaseClient
                    .from('habits')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Habits.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('habits')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Habits.delete');
                throw error;
            }
        },
        markComplete: async (id, date) => {
            try {
                const habit = App.state.habits.find(h => h.id === id);
                if (!habit) return;

                const completedDates = habit.completedDates || [];
                const dateStr = date || new Date().toISOString().split('T')[0];

                if (!completedDates.includes(dateStr)) {
                    completedDates.push(dateStr);
                    const streak = RecurrenceManager.calculateStreak(completedDates);
                    await Data.Habits.update(id, {
                        completedDates,
                        currentStreak: streak.current,
                        longestStreak: Math.max(streak.current, habit.longestStreak || 0)
                    });
                }
            } catch (error) {
                ErrorHandler.handle(error, 'Habits.markComplete');
            }
        }
    },
    Learnings: {
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('learnings')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Learnings.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `learnings_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Learnings.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'learnings', filter: `user_id=eq.${userId}` },
                    async () => {
                        const learnings = await Data.Learnings.fetch(userId);
                        callback(learnings);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({ userId, ...data });
                const { data: result, error } = await supabaseClient
                    .from('learnings')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Learnings.add');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('learnings')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Learnings.delete');
                throw error;
            }
        }
    },
    // YouTube Content Command Center - Channels Module
    Channels: {
        fetch: async (userId) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('channels')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Channels.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `channels_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Channels.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'channels', filter: `user_id=eq.${userId}` },
                    async () => {
                        const channels = await Data.Channels.fetch(userId);
                        callback(channels);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({ userId, ...data, isActive: true });
                const { data: result, error } = await supabaseClient
                    .from('channels')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Channels.add');
                throw error;
            }
        },
        update: async (id, data) => {
            try {
                const dbData = Data._toDbFormat(data);
                const { error } = await supabaseClient
                    .from('channels')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Channels.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('channels')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Channels.delete');
                throw error;
            }
        }
    },
    // YouTube Content Command Center - Content Vault Module
    ContentVault: {
        fetch: async (userId, channelId = null) => {
            if (!userId) return [];
            try {
                let query = supabaseClient
                    .from('content_vault')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (channelId) {
                    query = query.eq('channel_id', channelId);
                }

                const { data, error } = await query;
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'ContentVault.fetch');
                return [];
            }
        },
        listen: (userId, callback, channelId = null) => {
            if (!userId) return null;
            const key = channelId ? `content_vault_${userId}_${channelId}` : `content_vault_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.ContentVault.fetch(userId, channelId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'content_vault', filter: `user_id=eq.${userId}` },
                    async () => {
                        const content = await Data.ContentVault.fetch(userId, channelId);
                        callback(content);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({
                    userId,
                    ...data,
                    state: data.state || 'research',
                    mediaAssets: data.mediaAssets || [],
                    linkedTasks: data.linkedTasks || [],
                    linkedGoals: data.linkedGoals || []
                });
                const { data: result, error } = await supabaseClient
                    .from('content_vault')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'ContentVault.add');
                throw error;
            }
        },
        update: async (id, data) => {
            try {
                const dbData = Data._toDbFormat(data);
                const { error } = await supabaseClient
                    .from('content_vault')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'ContentVault.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('content_vault')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'ContentVault.delete');
                throw error;
            }
        },
        updateState: async (id, newState) => {
            try {
                const { error } = await supabaseClient
                    .from('content_vault')
                    .update({ state: newState, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'ContentVault.updateState');
                throw error;
            }
        }
    },

    // Prompts Library for AI Content Generation
    Prompts: {
        fetch: async (userId, channelId = null) => {
            if (!userId) return [];
            try {
                let query = supabaseClient
                    .from('prompts')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (channelId) {
                    query = query.or(`channel_id.eq.${channelId},channel_id.is.null`);
                }

                const { data, error } = await query;
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.fetch');
                return [];
            }
        },
        listen: (userId, callback, channelId = null) => {
            if (!userId) return null;
            const key = channelId ? `prompts_${userId}_${channelId}` : `prompts_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.Prompts.fetch(userId, channelId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'prompts', filter: `user_id=eq.${userId}` },
                    async () => {
                        const prompts = await Data.Prompts.fetch(userId, channelId);
                        callback(prompts);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({
                    userId,
                    ...data,
                    category: data.category || 'general',
                    variables: data.variables || [],
                    rating: data.rating || 0,
                    useCount: 0,
                    isFavorite: false,
                    nichePreset: data.nichePreset || null
                });
                const { data: result, error } = await supabaseClient
                    .from('prompts')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.add');
                throw error;
            }
        },
        update: async (id, data) => {
            try {
                const dbData = Data._toDbFormat(data);
                const { error } = await supabaseClient
                    .from('prompts')
                    .update(dbData)
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.update');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('prompts')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.delete');
                throw error;
            }
        },
        toggleFavorite: async (id) => {
            try {
                // First fetch current state
                const { data: prompt, error: fetchError } = await supabaseClient
                    .from('prompts')
                    .select('is_favorite')
                    .eq('id', id)
                    .single();
                if (fetchError) throw fetchError;

                const { error } = await supabaseClient
                    .from('prompts')
                    .update({ is_favorite: !prompt.is_favorite, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.toggleFavorite');
                throw error;
            }
        },
        setRating: async (id, rating) => {
            try {
                const { error } = await supabaseClient
                    .from('prompts')
                    .update({ rating: Math.max(0, Math.min(5, rating)), updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.setRating');
                throw error;
            }
        },
        incrementUseCount: async (id) => {
            try {
                const { data: prompt, error: fetchError } = await supabaseClient
                    .from('prompts')
                    .select('use_count')
                    .eq('id', id)
                    .single();
                if (fetchError) throw fetchError;

                const { error } = await supabaseClient
                    .from('prompts')
                    .update({
                        use_count: (prompt.use_count || 0) + 1,
                        last_used_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'Prompts.incrementUseCount');
                throw error;
            }
        }
    },

    // Prompt History - Tracks all AI generations
    PromptHistory: {
        fetch: async (userId, limit = 50) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('prompt_history')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'PromptHistory.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `prompt_history_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.PromptHistory.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'prompt_history', filter: `user_id=eq.${userId}` },
                    async () => {
                        const history = await Data.PromptHistory.fetch(userId);
                        callback(history);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({
                    userId,
                    promptId: data.promptId || null,
                    channelId: data.channelId || null,
                    videoId: data.videoId || null,
                    inputVariables: data.inputVariables || {},
                    outputResult: data.outputResult || '',
                    aiService: data.aiService || 'unknown',
                    model: data.model || 'unknown',
                    tokensUsed: data.tokensUsed || 0,
                    costEstimate: data.costEstimate || 0,
                    durationMs: data.durationMs || 0,
                    success: data.success !== false,
                    errorMessage: data.errorMessage || null
                });
                const { data: result, error } = await supabaseClient
                    .from('prompt_history')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'PromptHistory.add');
                throw error;
            }
        },
        getStats: async (userId) => {
            if (!userId) return { totalGenerations: 0, successCount: 0, failureCount: 0, totalTokens: 0, totalCost: 0, avgDuration: 0 };
            try {
                const { data, error } = await supabaseClient
                    .from('prompt_history')
                    .select('success, tokens_used, cost_estimate, duration_ms')
                    .eq('user_id', userId);
                if (error) throw error;

                const items = data || [];
                return {
                    totalGenerations: items.length,
                    successCount: items.filter(h => h.success).length,
                    failureCount: items.filter(h => !h.success).length,
                    totalTokens: items.reduce((sum, h) => sum + (h.tokens_used || 0), 0),
                    totalCost: items.reduce((sum, h) => sum + (h.cost_estimate || 0), 0),
                    avgDuration: items.length > 0 ?
                        items.reduce((sum, h) => sum + (h.duration_ms || 0), 0) / items.length : 0
                };
            } catch (error) {
                ErrorHandler.handle(error, 'PromptHistory.getStats');
                return { totalGenerations: 0, successCount: 0, failureCount: 0, totalTokens: 0, totalCost: 0, avgDuration: 0 };
            }
        }
    },

    // Niche Presets - Pre-configured prompt styles per niche
    NichePresets: {
        fetch: async () => {
            // Return built-in niche presets (same as MockData)
            return [
                { id: 'fitness', name: 'Fitness', icon: '💪', toneKeywords: ['energetic', 'motivating', 'powerful', 'healthy'], colorScheme: '#4caf50' }
            ];
        }
    },

    // Media Assets - Generated images and videos
    MediaAssets: {
        fetch: async (userId, limit = 100) => {
            if (!userId) return [];
            try {
                const { data, error } = await supabaseClient
                    .from('media_assets')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                if (error) throw error;
                return (data || []).map(Data._toAppFormat);
            } catch (error) {
                ErrorHandler.handle(error, 'MediaAssets.fetch');
                return [];
            }
        },
        listen: (userId, callback) => {
            if (!userId) return null;
            const key = `media_assets_${userId}`;
            if (Data._subscriptions[key]) Data._subscriptions[key].unsubscribe();

            Data.MediaAssets.fetch(userId).then(callback);

            const channel = supabaseClient
                .channel(key)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'media_assets', filter: `user_id=eq.${userId}` },
                    async () => {
                        const assets = await Data.MediaAssets.fetch(userId);
                        callback(assets);
                    }
                )
                .subscribe();

            Data._subscriptions[key] = channel;
            return () => channel.unsubscribe();
        },
        add: async (userId, data) => {
            try {
                const dbData = Data._toDbFormat({
                    userId,
                    type: data.type || 'image',
                    url: data.url,
                    prompt: data.prompt,
                    status: data.status,
                    metadata: data.metadata || {},
                    isFavorite: false
                });
                const { data: result, error } = await supabaseClient
                    .from('media_assets')
                    .insert(dbData)
                    .select()
                    .single();
                if (error) throw error;
                return { id: result.id };
            } catch (error) {
                ErrorHandler.handle(error, 'MediaAssets.add');
                throw error;
            }
        },
        delete: async (id) => {
            try {
                const { error } = await supabaseClient
                    .from('media_assets')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'MediaAssets.delete');
                throw error;
            }
        },
        toggleFavorite: async (id) => {
            try {
                // First fetch current state
                const { data: asset, error: fetchError } = await supabaseClient
                    .from('media_assets')
                    .select('is_favorite')
                    .eq('id', id)
                    .single();
                if (fetchError) throw fetchError;

                const { error } = await supabaseClient
                    .from('media_assets')
                    .update({ is_favorite: !asset.is_favorite })
                    .eq('id', id);
                if (error) throw error;
            } catch (error) {
                ErrorHandler.handle(error, 'MediaAssets.toggleFavorite');
                throw error;
            }
        }
    }
};

// Toggle Data Source
const Data = Config.offlineMode ? MockData : SupabaseData;


// -----------------------------
// RECURRENCE MANAGER
// -----------------------------
const RecurrenceManager = {
    scheduleNext: async (task, recurrence) => {
        const nextDate = RecurrenceManager.getNextDate(recurrence);
        if (!nextDate) return;

        const nextTask = {
            ...task,
            timeBlock: task.timeBlock ? {
                start: task.timeBlock.start,
                end: task.timeBlock.end
            } : undefined,
            dueDate: nextDate.toISOString().split('T')[0],
            recurrence: task.recurrence,
            parentTaskId: task.id // Track original task
        };

        // Schedule for next occurrence
        setTimeout(async () => {
            try {
                await Data.Tasks.add(App.state.user.uid, nextTask);
            } catch (error) {
                ErrorHandler.handle(error, 'RecurrenceManager.scheduleNext');
            }
        }, 1000);
    },

    getNextDate: (recurrence) => {
        const now = new Date();
        const next = new Date(now);

        switch (recurrence) {
            case 'daily':
                next.setDate(next.getDate() + 1);
                break;
            case 'weekly':
                next.setDate(next.getDate() + 7);
                break;
            case 'monthly':
                next.setMonth(next.getMonth() + 1);
                break;
            default:
                return null;
        }

        return next;
    },

    checkAndCreateRecurring: async (tasks) => {
        // Check completed tasks with recurrence
        const recurringTasks = tasks.filter(t =>
            t.status === 'completed' &&
            t.recurrence &&
            t.recurrence !== 'none' &&
            !t.nextOccurrenceCreated
        );

        for (const task of recurringTasks) {
            const nextDate = RecurrenceManager.getNextDate(task.recurrence);
            if (nextDate && nextDate <= new Date()) {
                await RecurrenceManager.scheduleNext(task, task.recurrence);
                // Mark as processed
                await Data.Tasks.update(task.id, { nextOccurrenceCreated: true });
            }
        }
    },

    calculateStreak: (completedDates) => {
        if (!completedDates || completedDates.length === 0) {
            return { current: 0, longest: 0 };
        }

        const sorted = [...completedDates].sort().reverse();
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < sorted.length; i++) {
            const date = new Date(sorted[i]);
            date.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((today - date) / (1000 * 60 * 60 * 24));

            if (daysDiff === i) {
                if (i === 0) currentStreak = 1;
                else currentStreak++;
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 0;
            }
        }

        longestStreak = Math.max(longestStreak, tempStreak);

        return { current: currentStreak, longest: longestStreak };
    }
};

// -----------------------------
// POMODORO TIMER
// -----------------------------
const Pomodoro = {
    state: {
        isRunning: false,
        isBreak: false,
        timeLeft: Constants.POMODORO_WORK,
        interval: null,
        sessionCount: 0
    },

    start: (taskId = null) => {
        if (Pomodoro.state.isRunning) {
            Pomodoro.pause();
            return;
        }

        Pomodoro.state.isRunning = true;
        Pomodoro.state.taskId = taskId;

        const updateTimer = () => {
            if (Pomodoro.state.timeLeft <= 0) {
                Pomodoro.complete();
                return;
            }

            Pomodoro.state.timeLeft -= 1000;
            Pomodoro.updateUI();
        };

        Pomodoro.state.interval = setInterval(updateTimer, 1000);
        Pomodoro.updateUI();
        UI.showToast('🍅 Pomodoro started!', 'success');

        // Request notification permission
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    pause: () => {
        if (Pomodoro.state.interval) {
            clearInterval(Pomodoro.state.interval);
            Pomodoro.state.interval = null;
        }
        Pomodoro.state.isRunning = false;
        Pomodoro.updateUI();
    },

    reset: () => {
        Pomodoro.pause();
        Pomodoro.state.timeLeft = Pomodoro.state.isBreak
            ? Constants.POMODORO_SHORT_BREAK
            : Constants.POMODORO_WORK;
        Pomodoro.updateUI();
    },

    complete: () => {
        Pomodoro.pause();
        Pomodoro.state.sessionCount++;

        if (Pomodoro.state.isBreak) {
            // Break finished, start work session
            Pomodoro.state.isBreak = false;
            Pomodoro.state.timeLeft = Constants.POMODORO_WORK;
            UI.showToast('Break finished! Ready to work?', 'info');
        } else {
            // Work session finished, start break
            Pomodoro.state.isBreak = true;
            Pomodoro.state.timeLeft = Pomodoro.state.sessionCount % 4 === 0
                ? Constants.POMODORO_LONG_BREAK
                : Constants.POMODORO_SHORT_BREAK;
            UI.showToast('🍅 Pomodoro complete! Time for a break.', 'success');

            // Browser notification
            if (Notification.permission === 'granted') {
                new Notification('Pomodoro Complete!', {
                    body: 'Great work! Time for a break.',
                    icon: '🍅'
                });
            }

            // Track time if task is linked
            if (Pomodoro.state.taskId) {
                TimeTracker.recordSession(Pomodoro.state.taskId, Constants.POMODORO_WORK);
            }
        }

        Pomodoro.updateUI();
    },

    updateUI: () => {
        const minutes = Math.floor(Pomodoro.state.timeLeft / 60000);
        const seconds = Math.floor((Pomodoro.state.timeLeft % 60000) / 1000);
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        let pomodoroEl = document.getElementById('pomodoroDisplay');
        if (!pomodoroEl) {
            // Create pomodoro display if it doesn't exist
            const focusCard = document.querySelector('.focus-card');
            if (focusCard) {
                pomodoroEl = document.createElement('div');
                pomodoroEl.id = 'pomodoroDisplay';
                pomodoroEl.className = 'pomodoro-display';
                focusCard.querySelector('.focus-content').appendChild(pomodoroEl);
            }
        }

        if (pomodoroEl) {
            pomodoroEl.innerHTML = `
                <div class="pomodoro-controls">
                    <button class="btn btn-sm ${Pomodoro.state.isRunning ? 'btn-outline' : 'btn-primary'}" 
                        onclick="Pomodoro.start()">
                        ${Pomodoro.state.isRunning ? '⏸️ Pause' : '▶️ Start'}
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="Pomodoro.reset()">🔄 Reset</button>
                </div>
                <div class="pomodoro-timer">${display}</div>
                <div class="pomodoro-info">
                    ${Pomodoro.state.isBreak ? '☕ Break Time' : '🍅 Work Session'} | 
                    Sessions: ${Pomodoro.state.sessionCount}
                </div>
            `;
        }
    }
};

// -----------------------------
// TIME TRACKER
// -----------------------------
const TimeTracker = {
    recordSession: async (taskId, duration) => {
        try {
            const task = App.state.tasks.find(t => t.id === taskId);
            if (!task) return;

            const currentTime = task.trackedTime || 0;
            await Data.Tasks.update(taskId, {
                trackedTime: currentTime + duration,
                lastTrackedAt: new Date().toISOString()
            });
        } catch (error) {
            ErrorHandler.handle(error, 'TimeTracker.recordSession');
        }
    },

    getTotalTime: (taskId) => {
        const task = App.state.tasks.find(t => t.id === taskId);
        if (!task || !task.trackedTime) return 0;
        return task.trackedTime;
    },

    formatTime: (ms) => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
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
    },
    // Get current time in HH:MM format
    getCurrentTime: () => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    },
    // Detect active task based on current time
    detectActiveTask: (tasks = []) => {
        const currentTime = Schedule.getCurrentTime();
        return tasks.find(task => {
            if (!task.timeBlock || task.status === 'completed') return false;
            const start = task.timeBlock.start;
            const end = task.timeBlock.end;
            return currentTime >= start && currentTime < end;
        });
    },
    // Calculate time remaining until end of time block
    getTimeRemaining: (endTime) => {
        const now = new Date();
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        const endDate = new Date(now);
        endDate.setHours(endHours, endMinutes, 0, 0);

        // If end time is tomorrow (past midnight)
        if (endDate < now) {
            endDate.setDate(endDate.getDate() + 1);
        }

        const diff = endDate - now;
        if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0 };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return { hours, minutes, seconds, total: diff };
    }
};

// -----------------------------
// AUTH MODULE (Supabase)
// -----------------------------
const Auth = {
    _getUser: () => {
        try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; }
    },
    _setUser: (user) => localStorage.setItem('auth_user', JSON.stringify(user)),

    init: (onLogin, onLogout) => {
        if (Config.offlineMode) {
            const user = Auth._getUser();
            if (user) onLogin(user);
            else onLogout();
            return;
        }

        // Check initial session
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                onLogin({
                    uid: session.user.id,
                    email: session.user.email,
                    displayName: session.user.user_metadata?.name || session.user.email?.split('@')[0]
                });
            } else {
                onLogout();
            }
        });

        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                onLogin({
                    uid: session.user.id,
                    email: session.user.email,
                    displayName: session.user.user_metadata?.name || session.user.email?.split('@')[0]
                });
            } else {
                onLogout();
            }
        });
    },
    login: async (email, password) => {
        if (Config.offlineMode) {
            if (password.length < 6) return { success: false, error: 'Password too short' };
            const user = { uid: 'u_' + email, email, displayName: email.split('@')[0] };
            Auth._setUser(user);
            return { success: true };
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message || String(e) };
        }
    },
    signup: async (email, password, name) => {
        if (Config.offlineMode) {
            if (password.length < 6) return { success: false, error: 'Password too short' };
            const user = { uid: 'u_' + email, email, displayName: name || email.split('@')[0] };
            Auth._setUser(user);
            return { success: true };
        }

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { name }
                }
            });
            if (error) throw error;

            // Create user profile in users table
            if (data.user) {
                await supabaseClient.from('users').insert({
                    id: data.user.id,
                    name,
                    email
                });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message || String(e) };
        }
    },
    logout: async () => {
        if (Config.offlineMode) {
            localStorage.removeItem('auth_user');
            return;
        }
        await supabaseClient.auth.signOut();
    },
    guestLogin: async () => {
        const user = { uid: 'guest123', displayName: 'Guest User', email: 'guest@local.test' };
        if (Config.offlineMode) {
            Auth._setUser(user);
        }
        return { success: true, user };
    },
    updateProfile: async (name) => {
        if (Config.offlineMode) {
            const user = Auth._getUser();
            if (user) {
                user.displayName = name;
                Auth._setUser(user);
                return { success: true };
            }
            return { success: false, error: 'No user signed in' };
        }

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            if (user) {
                // Update auth metadata
                await supabaseClient.auth.updateUser({
                    data: { name }
                });
                // Update users table
                await supabaseClient.from('users').update({ name }).eq('id', user.id);
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

    showLoading: (element, message = 'Loading...') => {
        if (!element) return;
        element.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
    },

    hideLoading: (element) => {
        if (!element) return;
        const loadingState = element.querySelector('.loading-state');
        if (loadingState) loadingState.remove();
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

    renderTemplatesHub: (templates = []) => {
        const listEl = document.getElementById('templatesList');
        if (!listEl) return;

        if (templates.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <h3>📋 No Templates</h3>
                    <p>Create templates to speed up task creation.</p>
                    <button class="btn btn-primary" onclick="App.openTemplateModal()">+ Create Template</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = templates.map(t => `
            <div class="template-card card">
                <div class="template-header">
                    <h3>${Utils.escapeHtml(t.name || 'Untitled Template')}</h3>
                    <div class="template-actions">
                        <button class="btn-icon" onclick="App.useTemplate('${t.id}')" title="Use Template">📝</button>
                        <button class="btn-icon" onclick="App.editTemplate('${t.id}')" title="Edit">✏️</button>
                        <button class="btn-icon" onclick="App.deleteTemplate('${t.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
                <div class="template-preview">
                    <p><strong>Title:</strong> ${Utils.escapeHtml(t.title || 'N/A')}</p>
                    ${t.category ? `<p><strong>Category:</strong> ${t.category}</p>` : ''}
                    ${t.priority ? `<p><strong>Priority:</strong> ${t.priority}</p>` : ''}
                    ${t.tags && t.tags.length > 0 ? `<p><strong>Tags:</strong> ${t.tags.map(tag => `<span class="tag">${Utils.escapeHtml(tag)}</span>`).join('')}</p>` : ''}
                </div>
            </div>
        `).join('');
    },

    renderHabitsHub: (habits = []) => {
        const listEl = document.getElementById('habitsList');
        if (!listEl) return;

        if (habits.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <h3>🎯 No Habits</h3>
                    <p>Start tracking your daily habits to build consistency.</p>
                    <button class="btn btn-primary" onclick="App.openHabitModal()">+ Create Habit</button>
                </div>
            `;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        listEl.innerHTML = habits.map(h => {
            const isCompletedToday = h.completedDates && h.completedDates.includes(today);
            const streak = h.currentStreak || 0;
            const longestStreak = h.longestStreak || 0;

            return `
                <div class="habit-card card">
                    <div class="habit-header">
                        <h3>${Utils.escapeHtml(h.name)}</h3>
                        <button class="btn-icon" onclick="App.deleteHabit('${h.id}')">🗑️</button>
                    </div>
                    <div class="habit-stats">
                        <div class="stat-item">
                            <span class="stat-label">Current Streak</span>
                            <span class="stat-value">${streak} 🔥</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Longest Streak</span>
                            <span class="stat-value">${longestStreak} 🏆</span>
                        </div>
                    </div>
                    <div class="habit-actions">
                        <button class="btn ${isCompletedToday ? 'btn-outline' : 'btn-primary'}" 
                            onclick="App.toggleHabit('${h.id}')">
                            ${isCompletedToday ? '✅ Completed Today' : 'Mark Complete'}
                        </button>
                    </div>
                    <div class="habit-calendar">
                        ${UI.renderHabitCalendar(h.completedDates || [])}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderHabitCalendar: (completedDates) => {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const isCompleted = completedDates.includes(dateStr);
            const isToday = i === 0;

            days.push(`
                <div class="habit-day ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}" 
                    title="${dateStr}">
                </div>
            `);
        }

        return `<div class="habit-calendar-grid">${days.join('')}</div>`;
    },

    renderAnalytics: (tasks = [], habits = []) => {
        const container = document.getElementById('analyticsContent');
        if (!container) return;

        // Calculate statistics
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const totalTimeTracked = tasks.reduce((sum, t) => sum + (t.trackedTime || 0), 0);
        const avgTimePerTask = completedTasks > 0 ? Math.round(totalTimeTracked / completedTasks / 60000) : 0;

        // Category breakdown
        const categoryStats = Utils.groupBy(tasks, 'category');
        const categoryBreakdown = Object.entries(categoryStats).map(([cat, tasks]) => ({
            category: cat,
            count: tasks.length,
            completed: tasks.filter(t => t.status === 'completed').length
        }));

        // Weekly completion trend (last 7 days)
        const weeklyTrend = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayTasks = tasks.filter(t => {
                if (!t.completedAt) return false;
                const completedDate = t.completedAt.toDate ? t.completedAt.toDate() : new Date(t.completedAt);
                return completedDate.toISOString().split('T')[0] === dateStr;
            });
            weeklyTrend.push({ date: dateStr, count: dayTasks.length });
        }

        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h3>📊 Overview</h3>
                    <div class="stat-row">
                        <div class="stat-item">
                            <span class="stat-label">Total Tasks</span>
                            <span class="stat-value">${totalTasks}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Completion Rate</span>
                            <span class="stat-value">${completionRate}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Time Tracked</span>
                            <span class="stat-value">${TimeTracker.formatTime(totalTimeTracked)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Avg Time/Task</span>
                            <span class="stat-value">${avgTimePerTask} min</span>
                        </div>
                    </div>
                </div>

                <div class="analytics-card">
                    <h3>📈 Weekly Trend</h3>
                    <div class="chart-container">
                        ${UI.renderBarChart(weeklyTrend)}
                    </div>
                </div>

                <div class="analytics-card">
                    <h3>🏷️ Category Breakdown</h3>
                    <div class="category-stats">
                        ${categoryBreakdown.map(stat => `
                            <div class="category-stat-item">
                                <div class="category-label">${stat.category || 'Uncategorized'}</div>
                                <div class="category-bar">
                                    <div class="category-bar-fill" style="width: ${totalTasks > 0 ? (stat.count / totalTasks * 100) : 0}%"></div>
                                </div>
                                <div class="category-count">${stat.count} tasks (${stat.completed} done)</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="analytics-card">
                    <h3>🎯 Habit Stats</h3>
                    <div class="habit-stats-summary">
                        ${habits.length > 0 ? `
                            <p>Total Habits: ${habits.length}</p>
                            <p>Active Streaks: ${habits.filter(h => (h.currentStreak || 0) > 0).length}</p>
                            <p>Total Streak Days: ${habits.reduce((sum, h) => sum + (h.currentStreak || 0), 0)}</p>
                        ` : '<p>No habits tracked yet.</p>'}
                    </div>
                </div>
            </div>
        `;
    },

    renderBarChart: (data) => {
        const max = Math.max(...data.map(d => d.count), 1);
        return `
            <div class="bar-chart">
                ${data.map(d => {
            const height = (d.count / max) * 100;
            const date = new Date(d.date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            return `
                        <div class="bar-item">
                            <div class="bar" style="height: ${height}%"></div>
                            <div class="bar-label">${dayName}</div>
                            <div class="bar-value">${d.count}</div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    },

    renderDependencyGraph: (taskId) => {
        const task = App.state.tasks.find(t => t.id === taskId);
        if (!task || !task.dependencies || task.dependencies.length === 0) {
            return '<p>No dependencies</p>';
        }

        const deps = task.dependencies.map(depId => App.state.tasks.find(t => t.id === depId)).filter(Boolean);

        return `
            <div class="dependency-graph">
                <h4>Dependencies</h4>
                ${deps.map(dep => `
                    <div class="dependency-item ${dep.status === 'completed' ? 'completed' : 'pending'}">
                        <span class="dep-status">${dep.status === 'completed' ? '✅' : '⏳'}</span>
                        <span class="dep-title">${Utils.escapeHtml(dep.title)}</span>
                        ${dep.status !== 'completed' ? '<span class="dep-blocker">Blocks this task</span>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
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

        // Render focus mode
        UI.renderFocusMode(tasks);
    },

    renderFocusMode: (tasks = []) => {
        const focusContainer = document.getElementById('currentFocusContent');
        if (!focusContainer) return;

        const activeTask = Schedule.detectActiveTask(tasks);

        if (activeTask) {
            const timeRemaining = Schedule.getTimeRemaining(activeTask.timeBlock.end);
            const categoryEmoji = {
                'work': '💼',
                'study': '📚',
                'project': '🚀',
                'personal': '🏠'
            }[activeTask.category] || '📋';

            focusContainer.innerHTML = `
                <div class="focus-active">
                    <div class="focus-task-header">
                        <span class="focus-category">${categoryEmoji} ${activeTask.category || 'Task'}</span>
                        <span class="focus-time-range">${activeTask.timeBlock.start} - ${activeTask.timeBlock.end}</span>
                    </div>
                    <h2 class="focus-task-title">${activeTask.title}</h2>
                    <div class="focus-timer" id="focusTimer">
                        ${timeRemaining.hours.toString().padStart(2, '0')}:${timeRemaining.minutes.toString().padStart(2, '0')}:${timeRemaining.seconds.toString().padStart(2, '0')}
                    </div>
                    <div class="focus-actions">
                        <button class="btn btn-primary btn-sm" onclick="App.completeFocusTask('${activeTask.id}')">Complete Task</button>
                        <button class="btn btn-outline btn-sm" onclick="App.skipFocusTask()">Skip</button>
                    </div>
                </div>
            `;

            // Start countdown timer if not already running
            if (!window.focusTimerInterval) {
                UI.startFocusTimer(activeTask.timeBlock.end);
            }
        } else {
            focusContainer.innerHTML = `
                <div class="empty-state">
                    <p>No active task right now.</p>
                    <button class="btn btn-primary btn-sm" onclick="showModule('tasks')">View Tasks</button>
                </div>
            `;
            // Clear timer if no active task
            if (window.focusTimerInterval) {
                clearInterval(window.focusTimerInterval);
                window.focusTimerInterval = null;
            }
        }
    },

    startFocusTimer: (endTime) => {
        // Clear existing timer if any
        if (window.focusTimerInterval) {
            clearInterval(window.focusTimerInterval);
        }

        const updateTimer = () => {
            const timerEl = document.getElementById('focusTimer');
            if (!timerEl) {
                clearInterval(window.focusTimerInterval);
                window.focusTimerInterval = null;
                return;
            }

            const remaining = Schedule.getTimeRemaining(endTime);

            if (remaining.total <= 0) {
                timerEl.textContent = '00:00:00';
                timerEl.style.color = 'var(--accent-red)';
                UI.showToast('⏰ Time block ended!', 'info');
                clearInterval(window.focusTimerInterval);
                window.focusTimerInterval = null;

                // Refresh to update focus mode
                setTimeout(() => App.refresh(), 1000);
                return;
            }

            const hours = remaining.hours.toString().padStart(2, '0');
            const minutes = remaining.minutes.toString().padStart(2, '0');
            const seconds = remaining.seconds.toString().padStart(2, '0');
            timerEl.textContent = `${hours}:${minutes}:${seconds}`;

            // Change color when less than 5 minutes remaining
            if (remaining.total < 5 * 60 * 1000) {
                timerEl.style.color = 'var(--accent-orange)';
            } else {
                timerEl.style.color = 'var(--accent-primary)';
            }
        };

        updateTimer(); // Initial update
        window.focusTimerInterval = setInterval(updateTimer, 1000);
    },

    renderTaskList: (tasks = [], filter = 'all', searchQuery = '') => {
        const container = document.getElementById('fullTaskList');
        if (!container) return;

        // Show loading state if tasks are being fetched
        if (tasks === null || tasks === undefined) {
            UI.showLoading(container, 'Loading tasks...');
            return;
        }

        let filtered = [...tasks];

        // Apply search filter
        if (searchQuery && searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(task =>
                task.title?.toLowerCase().includes(query) ||
                task.description?.toLowerCase().includes(query) ||
                task.category?.toLowerCase().includes(query)
            );
        }

        // Apply status filter
        if (filter === 'today') filtered = filtered.filter(t => Utils.isToday(t.createdAt));
        if (filter === 'upcoming') filtered = filtered.filter(t => t.status !== 'completed');
        if (filter === 'high') filtered = filtered.filter(t => t.priority === 'high');

        if (filtered.length === 0) {
            const emptyMessage = searchQuery
                ? `No tasks found matching "${searchQuery}"`
                : 'No tasks found.';
            container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
            return;
        }

        container.innerHTML = `
            <div class="kanban-board">
                <div class="kanban-column" id="col-todo"><h3>📝 To Do</h3><div class="kanban-items" ondrop="Kanban.handleDrop(event, 'todo')" ondragover="Kanban.handleDragOver(event)"></div></div>
                <div class="kanban-column" id="col-progress"><h3>🏃 In Progress</h3><div class="kanban-items" ondrop="Kanban.handleDrop(event, 'in_progress')" ondragover="Kanban.handleDragOver(event)"></div></div>
                <div class="kanban-column" id="col-done"><h3>✅ Done</h3><div class="kanban-items" ondrop="Kanban.handleDrop(event, 'completed')" ondragover="Kanban.handleDragOver(event)"></div></div>
            </div>
        `;

        filtered.forEach(task => {
            let status = task.status;
            if (status !== 'in_progress' && status !== 'completed') status = 'todo';

            const item = document.createElement('div');
            item.className = `task-item ${task.priority || 'medium'}-priority ${status}`;
            item.draggable = true;
            item.id = `task-${task.id}`;
            item.dataset.taskId = task.id;
            item.dataset.currentStatus = status;

            // Drag event handlers
            item.addEventListener('dragstart', Kanban.handleDragStart);
            item.addEventListener('dragend', Kanban.handleDragEnd);

            let icon = status === 'completed' ? '✅' : (status === 'in_progress' ? '⏳' : '⬜');

            // Sanitize task title to prevent XSS
            const safeTitle = Utils.escapeHtml(task.title);
            const safeCategory = task.category || 'general';
            const tagsHtml = task.tags && task.tags.length > 0
                ? task.tags.map(tag => `<span class="tag">${Utils.escapeHtml(tag)}</span>`).join('')
                : '';
            const timeTracked = task.trackedTime ? TimeTracker.formatTime(task.trackedTime) : '';
            const dependenciesHtml = task.dependencies && task.dependencies.length > 0
                ? `<div class="task-dependencies">🔗 Depends on ${task.dependencies.length} task(s)</div>`
                : '';
            const dueDateHtml = task.dueDate
                ? `<span class="due-date ${Utils.isToday(new Date(task.dueDate)) ? 'due-today' : ''}">📅 ${Utils.formatDate(task.dueDate)}</span>`
                : '';

            item.innerHTML = `
                <div class="task-checkbox" onclick="App.toggleStatus('${task.id}', '${status}')">
                    ${icon}
                </div>
                <div class="task-details">
                    <div class="task-title">${safeTitle}</div>
                    ${task.description ? `<div class="task-description">${Utils.escapeHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span class="badge badge-${safeCategory}">${safeCategory}</span>
                        ${task.timeBlock ? `<span class="time-badge">🕒 ${task.timeBlock.start} - ${task.timeBlock.end}</span>` : ''}
                        ${dueDateHtml}
                        ${timeTracked ? `<span class="time-tracked">⏱️ ${timeTracked}</span>` : ''}
                    </div>
                    ${tagsHtml ? `<div class="task-tags">${tagsHtml}</div>` : ''}
                    ${dependenciesHtml}
                </div>
                <div class="task-actions">
                    ${task.timeBlock ? `<button class="btn-icon" onclick="event.stopPropagation(); Pomodoro.start('${task.id}')" title="Start Pomodoro">🍅</button>` : ''}
                    <button class="btn-icon btn-edit" onclick="event.stopPropagation(); App.editTask('${task.id}')" aria-label="Edit task">Edit</button>
                    <button class="btn-icon btn-delete" onclick="event.stopPropagation(); App.deleteTask('${task.id}')" aria-label="Delete task">Delete</button>
                </div>
            `;

            const targetColumn = status === 'todo' ? '#col-todo' :
                status === 'in_progress' ? '#col-progress' : '#col-done';
            container.querySelector(`${targetColumn} .kanban-items`).appendChild(item);
        });
    }
};

// -----------------------------
// KANBAN DRAG & DROP
// -----------------------------
const Kanban = {
    draggedElement: null,
    handleDragStart: (e) => {
        Kanban.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    },
    handleDragEnd: (e) => {
        e.target.classList.remove('dragging');
        // Remove placeholder if exists
        const placeholder = document.querySelector('.drag-placeholder');
        if (placeholder) placeholder.remove();
    },
    handleDragOver: (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const afterElement = Kanban.getDragAfterElement(e.target.closest('.kanban-items'), e.clientY);
        const placeholder = document.querySelector('.drag-placeholder') || document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = '60px';
        placeholder.style.border = '2px dashed var(--accent-blue)';
        placeholder.style.borderRadius = 'var(--radius-md)';
        placeholder.style.margin = 'var(--space-sm) 0';

        if (!document.querySelector('.drag-placeholder')) {
            if (afterElement == null) {
                e.target.closest('.kanban-items').appendChild(placeholder);
            } else {
                e.target.closest('.kanban-items').insertBefore(placeholder, afterElement);
            }
        }
    },
    getDragAfterElement: (container, y) => {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },
    handleDrop: async (e, newStatus) => {
        e.preventDefault();
        const placeholder = document.querySelector('.drag-placeholder');
        if (placeholder) placeholder.remove();

        if (!Kanban.draggedElement) return;

        const taskId = Kanban.draggedElement.dataset.taskId;
        const oldStatus = Kanban.draggedElement.dataset.currentStatus;

        if (newStatus === oldStatus) {
            Kanban.draggedElement.classList.remove('dragging');
            return;
        }

        // Optimistic update
        const task = App.state.tasks.find(t => t.id === taskId);
        if (task) {
            const originalStatus = task.status;
            task.status = newStatus;
            UI.renderTaskList(App.state.tasks, window.currentFilter || 'all', window.currentSearchQuery || '');

            try {
                await Data.Tasks.update(taskId, { status: newStatus });
                UI.showToast('Task moved', 'success');
            } catch (error) {
                // Rollback on error
                task.status = originalStatus;
                UI.renderTaskList(App.state.tasks, window.currentFilter || 'all', window.currentSearchQuery || '');
                ErrorHandler.handle(error, 'Kanban.handleDrop');
            }
        }

        Kanban.draggedElement = null;
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
        learnings: [],
        searchQuery: '',
        currentFilter: 'all',
        // YouTube Content Command Center
        channels: [],
        activeChannel: null,  // Currently selected channel ID
        contentVault: [],

        // AI Prompts
        prompts: [],
        promptFilter: 'all',
        // Media Studio
        mediaAssets: [],
        mediaFilter: 'all',
        mediaGenType: 'image'
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

                // YouTube Content Command Center Listeners
                const uid = user.uid;
                Data.Channels.listen(uid, (channels) => {
                    App.state.channels = channels || [];
                    // Ensure active channel logic if needed
                });
                Data.ContentVault.listen(uid, (content) => {
                    App.state.contentVault = content || [];
                    if (document.getElementById('contentModule') && document.getElementById('contentModule').style.display !== 'none') {
                        App.renderContentHub();
                    }
                }, App.state.activeChannel);

                // Prompt Library Listeners
                Data.Prompts.listen(uid, (prompts) => {
                    App.state.prompts = prompts || [];
                    if (document.getElementById('promptsModule') && document.getElementById('promptsModule').style.display !== 'none') {
                        App.renderPromptHub();
                    }
                    if (App.updatePromptStats) App.updatePromptStats();
                });
                Data.PromptHistory.listen(uid, () => {
                    if (App.updatePromptStats) App.updatePromptStats();
                });

                // Media Studio Listeners
                Data.MediaAssets.listen(uid, (assets) => {
                    App.state.mediaAssets = assets || [];
                    if (document.getElementById('mediaModule') && document.getElementById('mediaModule').style.display !== 'none') {
                        App.renderMediaWorkbench();
                    }
                });

                // Start focus mode detection (check every 30 seconds)
                App.startFocusDetection();

                // Initialize notifications
                Notifications.init();

                // Check due tasks every hour
                setInterval(() => {
                    Notifications.checkDueTasks();
                }, 60 * 60 * 1000);

                // Check recurring tasks daily
                setInterval(() => {
                    RecurrenceManager.checkAndCreateRecurring(App.state.tasks);
                }, 24 * 60 * 60 * 1000);
            },
            () => {
                App.state.user = null;
                const authContainer = document.getElementById('authContainer');
                const appContainer = document.getElementById('appContainer');
                if (authContainer) authContainer.style.display = 'flex';
                if (appContainer) appContainer.style.display = 'none';

                // Clear focus detection on logout
                if (window.focusDetectionInterval) {
                    clearInterval(window.focusDetectionInterval);
                    window.focusDetectionInterval = null;
                }
                if (window.focusTimerInterval) {
                    clearInterval(window.focusTimerInterval);
                    window.focusTimerInterval = null;
                }
            }
        );
    },

    startFocusDetection: () => {
        // Clear existing interval if any
        if (window.focusDetectionInterval) {
            clearInterval(window.focusDetectionInterval);
        }

        // Check for active tasks every 30 seconds
        window.focusDetectionInterval = setInterval(() => {
            if (App.state.user && App.state.tasks) {
                UI.renderFocusMode(App.state.tasks);
            }
        }, 30000); // 30 seconds

        // Initial check
        if (App.state.user && App.state.tasks) {
            UI.renderFocusMode(App.state.tasks);
        }
    },

    completeFocusTask: async (taskId) => {
        try {
            await Data.Tasks.update(taskId, { status: 'completed' });
            UI.showToast('Task completed! 🎉', 'success');
            App.refresh();
        } catch (err) {
            console.error('Complete task failed', err);
            UI.showToast('Failed to complete task', 'error');
        }
    },

    skipFocusTask: () => {
        UI.showToast('Focus session skipped', 'info');
        App.refresh();
    },

    refresh: async () => {
        if (!App.state.user) return;

        const uid = App.state.user.uid;
        try {
            // Use real-time listeners if not already set up
            if (!App.state._listenersSetup) {
                // Setup real-time listeners
                Data.Tasks.listen(uid, (tasks) => {
                    App.state.tasks = tasks || [];
                    UI.renderDashboard(App.state.tasks);
                    UI.renderTaskList(App.state.tasks, App.state.currentFilter, App.state.searchQuery);
                    UI.renderFocusMode(App.state.tasks);
                });

                // Setup listeners for other collections
                Data.Projects.listen(uid, (projects) => {
                    App.state.projects = projects || [];
                    const activeModule = document.querySelector('.module.active');
                    if (activeModule && activeModule.id === 'projectsModule') {
                        UI.renderProjectsHub(App.state.projects, App.state.tasks);
                    }
                });

                Data.Goals.listen(uid, (goals) => {
                    App.state.goals = goals || [];
                    UI.renderGoalsHub(App.state.goals, App.state.projects, App.state.learnings, App.state.tasks);
                });

                Data.Learnings.listen(uid, (learnings) => {
                    App.state.learnings = learnings || [];
                    UI.renderLearningHub(App.state.learnings);
                });

                Data.Templates.listen(uid, (templates) => {
                    App.state.templates = templates || [];
                    const activeModule = document.querySelector('.module.active');
                    if (activeModule && activeModule.id === 'templatesModule') {
                        UI.renderTemplatesHub(App.state.templates);
                    }
                });

                Data.Habits.listen(uid, (habits) => {
                    App.state.habits = habits || [];
                    const activeModule = document.querySelector('.module.active');
                    if (activeModule && activeModule.id === 'habitsModule') {
                        UI.renderHabitsHub(App.state.habits);
                    }
                    if (activeModule && activeModule.id === 'analyticsModule') {
                        UI.renderAnalytics(App.state.tasks, App.state.habits);
                    }
                });

                // YouTube Content Command Center Listeners
                Data.Channels.listen(uid, (channels) => {
                    App.state.channels = channels || [];
                    // Restore active channel from localStorage
                    const savedChannel = localStorage.getItem('activeChannel');
                    if (savedChannel && App.state.channels.find(c => c.id === savedChannel)) {
                        App.state.activeChannel = savedChannel;
                    }
                    // Update channel select dropdown
                    const select = document.getElementById('channelSelect');
                    if (select) {
                        select.innerHTML = '<option value="">All Channels</option>' +
                            App.state.channels.map(c =>
                                `<option value="${c.id}" ${App.state.activeChannel === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
                            ).join('');
                    }
                });

                Data.ContentVault.listen(uid, (content) => {
                    // Filter by active channel if set
                    if (App.state.activeChannel) {
                        App.state.contentVault = (content || []).filter(v => v.channelId === App.state.activeChannel);
                    } else {
                        App.state.contentVault = content || [];
                    }

                    const activeModule = document.querySelector('.module.active');
                    if (activeModule && activeModule.id === 'contentModule') {
                        App.renderContentHub();
                    }
                });

                Data.Prompts.listen(uid, (prompts) => {
                    // Filter by active channel if set
                    if (App.state.activeChannel) {
                        App.state.prompts = (prompts || []).filter(p => p.channelId === App.state.activeChannel || !p.channelId);
                    } else {
                        App.state.prompts = prompts || [];
                    }

                    const activeModule = document.querySelector('.module.active');
                    if (activeModule && activeModule.id === 'promptsModule') {
                        App.renderPromptHub();
                        App.updatePromptStats();
                    }
                });

                App.state._listenersSetup = true;
            } else {
                // Fallback: fetch once if listeners fail
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
                UI.renderTaskList(App.state.tasks, App.state.currentFilter, App.state.searchQuery);

                const activeModule = document.querySelector('.module.active');
                if (activeModule && activeModule.id === 'projectsModule') {
                    UI.renderProjectsHub(App.state.projects, App.state.tasks);
                }
                if (App.state.goals) UI.renderGoalsHub(App.state.goals, App.state.projects, App.state.learnings, App.state.tasks);
                if (App.state.learnings) UI.renderLearningHub(App.state.learnings);
                UI.renderFocusMode(App.state.tasks);
            }
        } catch (err) {
            ErrorHandler.handle(err, 'App.refresh');
        }
    },

    handleTaskSearch: Utils.debounce((query) => {
        App.state.searchQuery = query;
        window.currentSearchQuery = query;
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.style.display = query ? 'block' : 'none';
        }
        UI.renderTaskList(App.state.tasks, App.state.currentFilter, query);
    }, Constants.SEARCH_DEBOUNCE_DELAY),

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
    openAddTaskModal: (startTime = '', template = null) => {
        const projectOptions = App.state.projects.map(p => `<option value="${p.id}">🚀 ${p.title}</option>`).join('');
        const learningOptions = App.state.learnings.map(l => `<option value="${l.id}">📚 ${l.title}</option>`).join('');
        const templateOptions = App.state.templates ? App.state.templates.map(t => `<option value="${t.id}">📋 ${t.name}</option>`).join('') : '';

        // Pre-fill from template if provided
        const taskData = template || {};

        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>${template ? 'Edit Task' : 'New Task'}</h3></div>
                <form onsubmit="App.handleAddTask(event)">
                    <input type="hidden" id="taskId">
                    ${templateOptions ? `
                    <div class="form-group">
                        <label for="taskTemplate">Use Template (Optional)</label>
                        <select id="taskTemplate" class="form-select" onchange="App.loadTaskTemplate(this.value)">
                            <option value="">-- None --</option>
                            ${templateOptions}
                        </select>
                    </div>
                    ` : ''}
                    <div class="form-group"><label for="taskTitle">Title</label><input id="taskTitle" required autofocus placeholder="What do you need to do?" value="${taskData.title || ''}"></div>
                    <div class="form-group"><label for="taskDescription">Description (Optional)</label><textarea id="taskDescription" rows="3" placeholder="Add details...">${taskData.description || ''}</textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label for="taskCategory">Category</label><select id="taskCategory" class="form-select">
                            <option value="work" ${taskData.category === 'work' ? 'selected' : ''}>💼 Work</option>
                            <option value="personal" ${taskData.category === 'personal' ? 'selected' : ''}>🏠 Personal</option>
                            <option value="study" ${taskData.category === 'study' ? 'selected' : ''}>📚 Study</option>
                            <option value="project" ${taskData.category === 'project' ? 'selected' : ''}>🚀 Project</option>
                        </select></div>
                        <div class="form-group"><label for="taskPriority">Priority</label><select id="taskPriority" class="form-select">
                            <option value="medium" ${taskData.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${taskData.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="low" ${taskData.priority === 'low' ? 'selected' : ''}>Low</option>
                        </select></div>
                    </div>
                    <div class="form-group">
                        <label for="taskTags">Tags (comma-separated)</label>
                        <input id="taskTags" type="text" placeholder="urgent, meeting, review" value="${taskData.tags ? taskData.tags.join(', ') : ''}">
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
                        <div class="form-group"><label for="taskStart">Start</label><input type="time" id="taskStart" value="${taskData.timeBlock?.start || startTime}"></div>
                        <div class="form-group"><label for="taskEnd">End</label><input type="time" id="taskEnd" value="${taskData.timeBlock?.end || (startTime ? startTime.split(':')[0] + ':59' : '')}"></div>
                    </div>
                    <div class="form-group">
                        <label for="taskDueDate">Due Date (Optional)</label>
                        <input type="date" id="taskDueDate" value="${taskData.dueDate || ''}">
                    </div>
                    <div class="form-group">
                        <label for="taskRecurrence">Repeat</label>
                        <select id="taskRecurrence" class="form-select">
                            <option value="none">None</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div class="form-group" id="taskDependenciesGroup" style="display:none;">
                        <label for="taskDependencies">Depends On (Select tasks that must complete first)</label>
                        <select id="taskDependencies" class="form-select" multiple>
                            <!-- Populated dynamically -->
                        </select>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-outline btn-cancel" onclick="closeModal()">Cancel</button> <button type="submit" class="btn btn-primary">Save Task</button></div>
                </form>
            </div>
        `);

        // Populate dependencies dropdown
        if (App.state.tasks && App.state.tasks.length > 0) {
            const depsSelect = document.getElementById('taskDependencies');
            if (depsSelect) {
                depsSelect.innerHTML = App.state.tasks
                    .filter(t => t.status !== 'completed')
                    .map(t => `<option value="${t.id}">${Utils.escapeHtml(t.title)}</option>`)
                    .join('');
            }
        }
    },

    loadTaskTemplate: (templateId) => {
        const template = App.state.templates?.find(t => t.id === templateId);
        if (!template) return;

        document.getElementById('taskTitle').value = template.title || '';
        document.getElementById('taskDescription').value = template.description || '';
        document.getElementById('taskCategory').value = template.category || 'work';
        document.getElementById('taskPriority').value = template.priority || 'medium';
        if (template.tags) {
            document.getElementById('taskTags').value = template.tags.join(', ');
        }
        if (template.timeBlock) {
            document.getElementById('taskStart').value = template.timeBlock.start || '';
            document.getElementById('taskEnd').value = template.timeBlock.end || '';
        }
    },

    openAddTaskModalWithTime: (startTime) => {
        App.openAddTaskModal(startTime);
    },

    handleAddTask: async (e) => {
        e.preventDefault();
        const id = document.getElementById('taskId')?.value;
        const title = document.getElementById('taskTitle').value;
        const description = document.getElementById('taskDescription')?.value || '';
        const category = document.getElementById('taskCategory').value;
        const priority = document.getElementById('taskPriority').value;
        const start = document.getElementById('taskStart')?.value;
        const end = document.getElementById('taskEnd')?.value;
        const dueDate = document.getElementById('taskDueDate')?.value;
        const recurrence = document.getElementById('taskRecurrence')?.value || 'none';
        const tagsInput = document.getElementById('taskTags')?.value || '';
        const dependencies = Array.from(document.getElementById('taskDependencies')?.selectedOptions || []).map(opt => opt.value);

        // Parse tags
        const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

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

        const taskData = {
            title,
            description,
            category,
            priority,
            status: 'todo',
            tags: tags.length > 0 ? tags : undefined,
            dependencies: dependencies.length > 0 ? dependencies : undefined,
            recurrence: recurrence !== 'none' ? recurrence : undefined,
            dueDate: dueDate || undefined
        };

        const parentId = document.getElementById('taskParentId')?.value;
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

                // Handle recurrence
                if (recurrence !== 'none') {
                    RecurrenceManager.scheduleNext(taskData, recurrence);
                }
            }
            UI.closeModal();
            App.refresh();
        } catch (err) {
            ErrorHandler.handle(err, 'App.handleAddTask');
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

    openProjectDetails: (id) => {
        const project = App.state.projects.find(p => p.id === id);
        if (project) {
            alert(`Project Details: ${project.title}\n(Full details view coming soon!)`);
        }
    },

    editTask: (id) => {
        const task = App.state.tasks.find(t => t.id === id);
        if (!task) return;
        App.openAddTaskModal('', task);
        setTimeout(() => {
            const header = document.querySelector('.modal-header h3');
            if (header) header.textContent = 'Edit Task';
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title || '';
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskCategory').value = task.category || 'work';
            document.getElementById('taskPriority').value = task.priority || 'medium';
            if (task.tags) {
                document.getElementById('taskTags').value = task.tags.join(', ');
            }
            if (task.dueDate) {
                document.getElementById('taskDueDate').value = task.dueDate;
            }
            if (task.recurrence) {
                document.getElementById('taskRecurrence').value = task.recurrence;
            }
            if (task.timeBlock) {
                document.getElementById('taskStart').value = task.timeBlock.start;
                document.getElementById('taskEnd').value = task.timeBlock.end;
            }
            if (task.dependencies && task.dependencies.length > 0) {
                const depsSelect = document.getElementById('taskDependencies');
                if (depsSelect) {
                    task.dependencies.forEach(depId => {
                        const option = depsSelect.querySelector(`option[value="${depId}"]`);
                        if (option) option.selected = true;
                    });
                }
            }

            // Show dependency graph
            if (task.dependencies && task.dependencies.length > 0) {
                const depsGroup = document.getElementById('taskDependenciesGroup');
                if (depsGroup) {
                    depsGroup.style.display = 'block';
                    depsGroup.innerHTML += UI.renderDependencyGraph(id);
                }
            }
        }, 50);
    },

    // Template Management
    openTemplateModal: (templateId = null) => {
        const template = templateId ? App.state.templates?.find(t => t.id === templateId) : null;
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>${template ? 'Edit Template' : 'New Template'}</h3></div>
                <form onsubmit="App.handleSaveTemplate(event)">
                    <input type="hidden" id="templateId" value="${template?.id || ''}">
                    <div class="form-group"><label>Template Name</label><input id="templateName" required value="${template?.name || ''}" placeholder="e.g., Daily Standup"></div>
                    <div class="form-group"><label>Task Title</label><input id="templateTitle" required value="${template?.title || ''}"></div>
                    <div class="form-group"><label>Description</label><textarea id="templateDescription" rows="3">${template?.description || ''}</textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>Category</label><select id="templateCategory" class="form-select">
                            <option value="work" ${template?.category === 'work' ? 'selected' : ''}>💼 Work</option>
                            <option value="personal" ${template?.category === 'personal' ? 'selected' : ''}>🏠 Personal</option>
                            <option value="study" ${template?.category === 'study' ? 'selected' : ''}>📚 Study</option>
                            <option value="project" ${template?.category === 'project' ? 'selected' : ''}>🚀 Project</option>
                        </select></div>
                        <div class="form-group"><label>Priority</label><select id="templatePriority" class="form-select">
                            <option value="medium" ${template?.priority === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="high" ${template?.priority === 'high' ? 'selected' : ''}>High</option>
                            <option value="low" ${template?.priority === 'low' ? 'selected' : ''}>Low</option>
                        </select></div>
                    </div>
                    <div class="form-group"><label>Tags (comma-separated)</label><input id="templateTags" value="${template?.tags ? template.tags.join(', ') : ''}"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Template</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleSaveTemplate: async (e) => {
        e.preventDefault();
        const id = document.getElementById('templateId').value;
        const name = document.getElementById('templateName').value;
        const title = document.getElementById('templateTitle').value;
        const description = document.getElementById('templateDescription').value;
        const category = document.getElementById('templateCategory').value;
        const priority = document.getElementById('templatePriority').value;
        const tagsInput = document.getElementById('templateTags').value;
        const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

        try {
            const templateData = { name, title, description, category, priority, tags: tags.length > 0 ? tags : undefined };
            if (id) {
                await Data.Templates.update(id, templateData);
                UI.showToast('Template updated', 'success');
            } else {
                await Data.Templates.add(App.state.user.uid, templateData);
                UI.showToast('Template created', 'success');
            }
            UI.closeModal();
            App.refresh();
        } catch (error) {
            ErrorHandler.handle(error, 'App.handleSaveTemplate');
        }
    },

    useTemplate: (templateId) => {
        const template = App.state.templates?.find(t => t.id === templateId);
        if (!template) return;
        App.openAddTaskModal('', template);
    },

    editTemplate: (id) => {
        App.openTemplateModal(id);
    },

    deleteTemplate: async (id) => {
        if (confirm('Delete this template?')) {
            try {
                await Data.Templates.delete(id);
                App.refresh();
            } catch (error) {
                ErrorHandler.handle(error, 'App.deleteTemplate');
            }
        }
    },

    // Habit Management
    openHabitModal: (habitId = null) => {
        const habit = habitId ? App.state.habits?.find(h => h.id === habitId) : null;
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>${habit ? 'Edit Habit' : 'New Habit'}</h3></div>
                <form onsubmit="App.handleSaveHabit(event)">
                    <input type="hidden" id="habitId" value="${habit?.id || ''}">
                    <div class="form-group"><label>Habit Name</label><input id="habitName" required value="${habit?.name || ''}" placeholder="e.g., Morning Exercise"></div>
                    <div class="form-group"><label>Description</label><textarea id="habitDescription" rows="2">${habit?.description || ''}</textarea></div>
                    <div class="form-group"><label>Icon</label><input id="habitIcon" value="${habit?.icon || '🎯'}" placeholder="🎯"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Save Habit</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleSaveHabit: async (e) => {
        e.preventDefault();
        const id = document.getElementById('habitId').value;
        const name = document.getElementById('habitName').value;
        const description = document.getElementById('habitDescription').value;
        const icon = document.getElementById('habitIcon').value;

        try {
            const habitData = { name, description, icon };
            if (id) {
                await Data.Habits.update(id, habitData);
                UI.showToast('Habit updated', 'success');
            } else {
                await Data.Habits.add(App.state.user.uid, habitData);
                UI.showToast('Habit created', 'success');
            }
            UI.closeModal();
            App.refresh();
        } catch (error) {
            ErrorHandler.handle(error, 'App.handleSaveHabit');
        }
    },

    toggleHabit: async (id) => {
        try {
            await Data.Habits.markComplete(id);
            App.refresh();
        } catch (error) {
            ErrorHandler.handle(error, 'App.toggleHabit');
        }
    },

    deleteHabit: async (id) => {
        if (confirm('Delete this habit?')) {
            try {
                await Data.Habits.delete(id);
                App.refresh();
            } catch (error) {
                ErrorHandler.handle(error, 'App.deleteHabit');
            }
        }
    },

    // =========================================
    // YOUTUBE CONTENT COMMAND CENTER FUNCTIONS
    // =========================================

    // Channel Management
    switchChannel: async (channelId) => {
        App.state.activeChannel = channelId || null;
        localStorage.setItem('activeChannel', channelId);

        // Refresh content vault and prompts with channel filter
        if (App.state.user) {
            const content = await Data.ContentVault.fetch(App.state.user.uid, channelId || null);
            App.state.contentVault = content;

            const prompts = await Data.Prompts.fetch(App.state.user.uid, channelId || null);
            App.state.prompts = prompts;

            const activeModule = document.querySelector('.module.active');
            if (activeModule && activeModule.id === 'contentModule') App.renderContentHub();
            if (activeModule && activeModule.id === 'promptsModule') App.renderPromptHub();
        }

        UI.showToast(channelId ? 'Channel switched' : 'Showing all channels', 'info');
    },

    openChannelManager: () => {
        const channels = App.state.channels || [];

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>📺 Manage Channels</h2>
                    <button class="btn-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="channel-list" id="channelManagerList">
                        ${channels.length === 0 ? '<div class="empty-state"><p>No channels yet. Create your first channel!</p></div>' :
                channels.map(c => `
                                <div class="channel-item">
                                    <div class="channel-color" style="background: ${c.brandColor || '#58a6ff'}"></div>
                                    <div class="channel-details">
                                        <div class="channel-name">${Utils.escapeHtml(c.name)}</div>
                                        <div class="channel-niche">${Utils.escapeHtml(c.niche || 'General')}</div>
                                    </div>
                                    <div class="channel-item-actions">
                                        <button class="btn-icon" onclick="App.editChannel('${c.id}')" title="Edit">✏️</button>
                                        <button class="btn-icon" onclick="App.deleteChannel('${c.id}')" title="Delete">🗑️</button>
                                    </div>
                                </div>
                            `).join('')
            }
                    </div>
                    <button class="btn btn-primary" onclick="App.openChannelModal()">+ Add New Channel</button>
                </div>
            </div>
        `;
        UI.showModal(modalHtml);
    },

    openChannelModal: (channelId = null) => {
        const channel = channelId ? App.state.channels.find(c => c.id === channelId) : null;

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${channel ? '✏️ Edit Channel' : '📺 New Channel'}</h2>
                    <button class="btn-close" onclick="UI.closeModal()">×</button>
                </div>
                <form id="channelForm" onsubmit="App.handleSaveChannel(event, '${channelId || ''}')">
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Channel Name</label>
                            <input type="text" id="channelName" value="${channel ? Utils.escapeHtml(channel.name) : ''}" required placeholder="e.g., Tech Tips Weekly">
                        </div>
                        <div class="form-group">
                            <label>Niche / Category</label>
                            <select id="channelNiche">
                                <option value="gaming" ${channel?.niche === 'gaming' ? 'selected' : ''}>Gaming</option>
                                <option value="educational" ${channel?.niche === 'educational' ? 'selected' : ''}>Educational</option>
                                <option value="tech" ${channel?.niche === 'tech' ? 'selected' : ''}>Tech</option>
                                <option value="asmr" ${channel?.niche === 'asmr' ? 'selected' : ''}>ASMR</option>
                                <option value="vlog" ${channel?.niche === 'vlog' ? 'selected' : ''}>Vlog</option>
                                <option value="music" ${channel?.niche === 'music' ? 'selected' : ''}>Music</option>
                                <option value="cooking" ${channel?.niche === 'cooking' ? 'selected' : ''}>Cooking</option>
                                <option value="fitness" ${channel?.niche === 'fitness' ? 'selected' : ''}>Fitness</option>
                                <option value="other" ${channel?.niche === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Brand Color</label>
                                <input type="color" id="channelColor" value="${channel?.brandColor || '#58a6ff'}">
                            </div>
                            <div class="form-group">
                                <label>YouTube URL (optional)</label>
                                <input type="url" id="channelUrl" value="${channel?.youtubeUrl || ''}" placeholder="https://youtube.com/@...">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Target Audience</label>
                            <input type="text" id="channelAudience" value="${channel?.audiencePersona || ''}" placeholder="e.g., Young professionals interested in productivity">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">${channel ? 'Update' : 'Create'} Channel</button>
                    </div>
                </form>
            </div>
        `;
        UI.showModal(modalHtml);
    },

    handleSaveChannel: async (e, channelId) => {
        e.preventDefault();

        const channelData = {
            name: document.getElementById('channelName').value,
            niche: document.getElementById('channelNiche').value,
            brandColor: document.getElementById('channelColor').value,
            youtubeUrl: document.getElementById('channelUrl').value,
            audiencePersona: document.getElementById('channelAudience').value
        };

        try {
            if (channelId) {
                await Data.Channels.update(channelId, channelData);
                UI.showToast('Channel updated', 'success');
            } else {
                await Data.Channels.add(App.state.user.uid, channelData);
                UI.showToast('Channel created', 'success');
            }
            UI.closeModal();
            App.refreshChannels();
        } catch (error) {
            ErrorHandler.handle(error, 'App.handleSaveChannel');
        }
    },

    editChannel: (id) => {
        App.openChannelModal(id);
    },

    deleteChannel: async (id) => {
        if (confirm('Delete this channel? All associated videos will be unlinked.')) {
            try {
                await Data.Channels.delete(id);
                App.refreshChannels();
                UI.showToast('Channel deleted', 'success');
            } catch (error) {
                ErrorHandler.handle(error, 'App.deleteChannel');
            }
        }
    },

    refreshChannels: async () => {
        if (!App.state.user) return;

        const channels = await Data.Channels.fetch(App.state.user.uid);
        App.state.channels = channels || [];

        // Update channel select dropdown
        const select = document.getElementById('channelSelect');
        if (select) {
            select.innerHTML = '<option value="">All Channels</option>' +
                App.state.channels.map(c =>
                    `<option value="${c.id}" ${App.state.activeChannel === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
                ).join('');
        }
    },

    // Content Hub Management
    openVideoModal: (videoId = null) => {
        const video = videoId ? App.state.contentVault.find(v => v.id === videoId) : null;
        const channels = App.state.channels || [];

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${video ? '✏️ Edit Video' : '🎬 New Video'}</h2>
                    <button class="btn-close" onclick="UI.closeModal()">×</button>
                </div>
                <form id="videoForm" onsubmit="App.handleSaveVideo(event, '${videoId || ''}')">
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Video Title</label>
                            <input type="text" id="videoTitle" value="${video ? Utils.escapeHtml(video.title) : ''}" required placeholder="e.g., 10 Tips for Better Productivity">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Channel</label>
                                <select id="videoChannel" required>
                                    <option value="">Select Channel...</option>
                                    ${channels.map(c =>
            `<option value="${c.id}" ${video?.channelId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
        ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>State</label>
                                <select id="videoState">
                                    <option value="research" ${video?.state === 'research' ? 'selected' : ''}>🔍 Research</option>
                                    <option value="scripting" ${video?.state === 'scripting' ? 'selected' : ''}>📝 Scripting</option>
                                    <option value="recording" ${video?.state === 'recording' ? 'selected' : ''}>🎙️ Recording</option>
                                    <option value="editing" ${video?.state === 'editing' ? 'selected' : ''}>✂️ Editing</option>
                                    <option value="review" ${video?.state === 'review' ? 'selected' : ''}>👀 Review</option>
                                    <option value="scheduled" ${video?.state === 'scheduled' ? 'selected' : ''}>📅 Scheduled</option>
                                    <option value="published" ${video?.state === 'published' ? 'selected' : ''}>✅ Published</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Description / Script Notes</label>
                            <textarea id="videoDescription" rows="3" placeholder="Brief description or script outline...">${video?.description || ''}</textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Target Keywords</label>
                                <input type="text" id="videoKeywords" value="${video?.keywords?.join(', ') || ''}" placeholder="comma, separated, keywords">
                            </div>
                            <div class="form-group">
                                <label>Scheduled Date (optional)</label>
                                <input type="date" id="videoScheduledDate" value="${video?.scheduledDate || ''}">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">${video ? 'Update' : 'Create'} Video</button>
                    </div>
                </form>
            </div>
        `;
        UI.showModal(modalHtml);
    },

    handleSaveVideo: async (e, videoId) => {
        e.preventDefault();

        const keywordsInput = document.getElementById('videoKeywords').value;
        const keywords = keywordsInput ? keywordsInput.split(',').map(k => k.trim()).filter(k => k) : [];

        const videoData = {
            title: document.getElementById('videoTitle').value,
            channelId: document.getElementById('videoChannel').value,
            state: document.getElementById('videoState').value,
            description: document.getElementById('videoDescription').value,
            keywords: keywords,
            scheduledDate: document.getElementById('videoScheduledDate').value || null
        };

        try {
            if (videoId) {
                await Data.ContentVault.update(videoId, videoData);
                UI.showToast('Video updated', 'success');
            } else {
                await Data.ContentVault.add(App.state.user.uid, videoData);
                UI.showToast('Video created', 'success');
            }
            UI.closeModal();
            App.refreshContentVault();
        } catch (error) {
            ErrorHandler.handle(error, 'App.handleSaveVideo');
        }
    },

    deleteVideo: async (id) => {
        if (confirm('Delete this video?')) {
            try {
                await Data.ContentVault.delete(id);
                App.refreshContentVault();
                UI.showToast('Video deleted', 'success');
            } catch (error) {
                ErrorHandler.handle(error, 'App.deleteVideo');
            }
        }
    },

    filterContent: (filter) => {
        App.state.contentFilter = filter;

        // Update active filter button
        document.querySelectorAll('.content-filters .filter-tag').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase().includes(filter === 'all' ? 'all' : filter)) {
                btn.classList.add('active');
            }
        });

        App.renderContentHub();
    },

    refreshContentVault: async () => {
        if (!App.state.user) return;

        const content = await Data.ContentVault.fetch(App.state.user.uid, App.state.activeChannel);
        App.state.contentVault = content || [];
        App.renderContentHub();
    },

    renderContentHub: () => {
        const content = App.state.contentVault || [];
        const filter = App.state.contentFilter || 'all';

        // Filter content by state
        const filtered = filter === 'all' ? content : content.filter(v => v.state === filter);

        // Update pipeline counts
        const states = ['research', 'scripting', 'recording', 'editing', 'review', 'scheduled', 'published'];
        states.forEach(state => {
            const countEl = document.getElementById(`${state}Count`);
            if (countEl) {
                countEl.textContent = content.filter(v => v.state === state).length;
            }
        });

        // Render content list
        const listEl = document.getElementById('contentList');
        if (!listEl) return;

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <h3>🎬 No Videos ${filter !== 'all' ? `in "${filter}"` : ''}</h3>
                    <p>${filter !== 'all' ? 'No videos in this stage yet.' : 'Start creating content for your YouTube channels.'}</p>
                    <button class="btn btn-primary" onclick="App.openVideoModal()">+ Create Video</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(video => {
            const channel = App.state.channels.find(c => c.id === video.channelId);
            return `
                <div class="content-card" onclick="App.openVideoModal('${video.id}')">
                    <div class="content-thumbnail">🎬</div>
                    <div class="content-info">
                        <h4 class="content-title">${Utils.escapeHtml(video.title)}</h4>
                        <div class="content-meta">
                            ${channel ? `
                                <span class="content-channel">
                                    <span class="channel-dot" style="background: ${channel.brandColor || '#58a6ff'}"></span>
                                    ${Utils.escapeHtml(channel.name)}
                                </span>
                            ` : ''}
                            <span class="content-state ${video.state}">${video.state}</span>
                            ${video.scheduledDate ? `<span>📅 ${video.scheduledDate}</span>` : ''}
                        </div>
                        ${video.description ? `<p class="content-description">${Utils.escapeHtml(video.description)}</p>` : ''}
                    </div>
                    <div class="content-actions" onclick="event.stopPropagation()">
                        <button class="btn-icon" onclick="App.openVideoModal('${video.id}')" title="Edit">✏️</button>
                        <button class="btn-icon" onclick="App.deleteVideo('${video.id}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // =========================================
    // PROMPT LIBRARY FUNCTIONS
    // =========================================

    openPromptModal: (promptId = null) => {
        const prompt = promptId ? App.state.prompts.find(p => p.id === promptId) : null;
        const channels = App.state.channels || [];

        // Helper to generate stars HTML
        const starsHtml = (rating) => {
            return [1, 2, 3, 4, 5].map(i =>
                `<span class="star ${i <= rating ? 'active' : ''}" onclick="App.ratePrompt('${promptId}', ${i})">★</span>`
            ).join('');
        };

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${prompt ? '✏️ Edit Prompt' : '✨ New Prompt Template'}</h2>
                    <button class="btn-close" onclick="UI.closeModal()">×</button>
                </div>
                <form id="promptForm" onsubmit="App.handleSavePrompt(event, '${promptId || ''}')">
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Prompt Title</label>
                            <input type="text" id="promptTitle" value="${prompt ? Utils.escapeHtml(prompt.title) : ''}" required placeholder="e.g., YouTube Video Script Generator">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Category</label>
                                <select id="promptCategory">
                                    <option value="general" ${prompt?.category === 'general' ? 'selected' : ''}>General</option>
                                    <option value="title" ${prompt?.category === 'title' ? 'selected' : ''}>📺 Title/Headline</option>
                                    <option value="description" ${prompt?.category === 'description' ? 'selected' : ''}>📝 Description</option>
                                    <option value="script" ${prompt?.category === 'script' ? 'selected' : ''}>🎬 Script</option>
                                    <option value="thumbnail" ${prompt?.category === 'thumbnail' ? 'selected' : ''}>🖼️ Thumbnail Idea</option>
                                    <option value="image" ${prompt?.category === 'image' ? 'selected' : ''}>🎨 Image Gen</option>
                                    <option value="video" ${prompt?.category === 'video' ? 'selected' : ''}>🎥 B-Roll Gen</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Linked Channel (Optional)</label>
                                <select id="promptChannel">
                                    <option value="">All Channels</option>
                                    ${channels.map(c =>
            `<option value="${c.id}" ${prompt?.channelId === c.id ? 'selected' : ''}>${Utils.escapeHtml(c.name)}</option>`
        ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Prompt Template</label>
                            <div class="variable-hint">Use {{variableName}} to create dynamic inputs. They will be detected automatically.</div>
                            <textarea id="promptContent" class="prompt-editor" oninput="App.detectVariables()" required placeholder="Write a script about {{topic}} for a {{audience}} audience...">${prompt?.content || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Detected Variables</label>
                            <div id="variableList" class="variable-list">
                                <!-- Variables will appear here -->
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        ${prompt ? `<div class="prompt-rating">${starsHtml(prompt.rating || 0)}</div>` : '<div></div>'}
                        <button type="submit" class="btn btn-primary">${prompt ? 'Update' : 'Create'} Prompt</button>
                    </div>
                </form>
            </div>
        `;
        UI.showModal(modalHtml);
        setTimeout(App.detectVariables, 100);
    },

    handleSavePrompt: async (e, promptId) => {
        e.preventDefault();

        const content = document.getElementById('promptContent').value;
        const variables = App.extractVariables(content);

        const promptData = {
            title: document.getElementById('promptTitle').value,
            category: document.getElementById('promptCategory').value,
            channelId: document.getElementById('promptChannel').value || null,
            content: content,
            variables: variables,
            updated_at: new Date().toISOString()
        };

        try {
            if (promptId) {
                await Data.Prompts.update(promptId, promptData);
                UI.showToast('Prompt updated', 'success');
            } else {
                await Data.Prompts.add(App.state.user.uid, promptData);
                UI.showToast('Prompt created', 'success');
            }
            UI.closeModal();
            App.refreshPrompts();
        } catch (error) {
            ErrorHandler.handle(error, 'App.handleSavePrompt');
        }
    },

    deletePrompt: async (id) => {
        if (confirm('Delete this prompt template?')) {
            try {
                await Data.Prompts.delete(id);
                App.refreshPrompts();
                UI.showToast('Prompt deleted', 'success');
            } catch (error) {
                ErrorHandler.handle(error, 'App.deletePrompt');
            }
        }
    },

    toggleFavoritePrompt: async (id) => {
        try {
            await Data.Prompts.toggleFavorite(id);
            App.refreshPrompts();
        } catch (error) {
            ErrorHandler.handle(error, 'App.toggleFavoritePrompt');
        }
    },

    ratePrompt: async (id, rating) => {
        try {
            await Data.Prompts.setRating(id, rating);
            App.refreshPrompts();
            // Re-open modal if open to update stars
            const modalTitle = document.querySelector('.modal-header h2');
            if (modalTitle && modalTitle.textContent.includes('Edit Prompt')) {
                // Update stars visually without full reload
                const stars = document.querySelectorAll('.prompt-rating .star');
                stars.forEach((star, index) => {
                    if (index < rating) star.classList.add('active');
                    else star.classList.remove('active');
                });
            }
        } catch (error) {
            ErrorHandler.handle(error, 'App.ratePrompt');
        }
    },

    extractVariables: (content) => {
        const regex = /{{([^}]+)}}/g;
        const variables = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const varName = match[1].trim();
            if (!variables.includes(varName)) {
                variables.push(varName);
            }
        }
        return variables;
    },

    detectVariables: () => {
        const content = document.getElementById('promptContent').value;
        const variables = App.extractVariables(content);
        const listEl = document.getElementById('variableList');

        if (variables.length === 0) {
            listEl.innerHTML = '<span class="text-muted" style="font-size: 11px;">No variables detected yet. Type {{name}} to add one.</span>';
            return;
        }

        listEl.innerHTML = variables.map(v =>
            `<span class="variable-tag">{{${v}}}</span>`
        ).join('');
    },

    refreshPrompts: async () => {
        if (!App.state.user) return;
        const prompts = await Data.Prompts.fetch(App.state.user.uid, App.state.activeChannel);
        App.state.prompts = prompts || [];
        App.renderPromptHub();
        App.updatePromptStats();
    },

    filterPrompts: (filter) => {
        App.state.promptFilter = filter;

        // Update active filter button
        document.querySelectorAll('.prompt-categories .filter-tag').forEach(btn => {
            btn.classList.remove('active');
            // Simple check for text content match or specific ID if I added IDs
            if ((filter === 'all' && btn.textContent === 'All') ||
                (filter === 'favorites' && btn.textContent.includes('Favorites')) ||
                btn.textContent.toLowerCase().includes(filter)) {
                btn.classList.add('active');
            } else {
                // Ensure 'All' isn't active if not selected
                if (filter !== 'all' && btn.textContent === 'All') btn.classList.remove('active');
            }
        });

        App.renderPromptHub();
    },

    renderPromptHub: () => {
        const prompts = App.state.prompts || [];
        const filter = App.state.promptFilter || 'all';
        const listEl = document.getElementById('promptList');

        if (!listEl) return;

        let filtered = prompts;
        if (filter === 'favorites') {
            filtered = prompts.filter(p => p.isFavorite);
        } else if (filter !== 'all') {
            filtered = prompts.filter(p => p.category === filter);
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <h3>✨ No Prompts Found</h3>
                    <p>Try adjusting your filters or create a new prompt.</p>
                    <button class="btn btn-primary" onclick="App.openPromptModal()">+ Create Prompt</button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = filtered.map(prompt => {
            const channel = App.state.channels?.find(c => c.id === prompt.channelId);
            const variablesHtml = (prompt.variables || []).map(v =>
                `<span class="prompt-variable">{{${v}}}</span>`
            ).join('');

            const starsHtml = [1, 2, 3, 4, 5].map(i =>
                `<span class="star ${i <= (prompt.rating || 0) ? 'active' : ''}">★</span>`
            ).join('');

            return `
                <div class="prompt-card ${prompt.isFavorite ? 'favorite' : ''}" onclick="App.openPromptModal('${prompt.id}')">
                    <div class="prompt-header">
                        <div class="prompt-info">
                            <span class="prompt-category ${prompt.category}">${prompt.category}</span>
                            ${channel ? `<span class="prompt-category" style="background:${channel.brandColor}20; color:${channel.brandColor}; border:1px solid ${channel.brandColor}">${channel.name}</span>` : ''}
                        </div>
                        <button class="prompt-favorite-btn ${prompt.isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); App.toggleFavoritePrompt('${prompt.id}')">
                            ${prompt.isFavorite ? '⭐' : '☆'}
                        </button>
                    </div>
                    <h4 class="prompt-title">${Utils.escapeHtml(prompt.title)}</h4>
                    <div class="prompt-content">${Utils.escapeHtml(prompt.content)}</div>
                    <div class="prompt-variables">${variablesHtml}</div>
                    <div class="prompt-meta">
                        <div class="prompt-rating">${starsHtml}</div>
                        <div class="prompt-actions">
                             <button class="btn-icon" onclick="event.stopPropagation(); App.runPrompt('${prompt.id}')" title="Run Prompt">▶️</button>
                             <span class="prompt-use-count" title="Used times">↺ ${prompt.useCount || 0}</span>
                             <button class="btn-icon" onclick="event.stopPropagation(); App.deletePrompt('${prompt.id}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    updatePromptStats: async () => {
        if (!App.state.user) return;
        const history = await Data.PromptHistory.fetch(App.state.user.uid);
        const stats = await Data.PromptHistory.getStats(App.state.user.uid);
        const prompts = App.state.prompts || [];

        // Update Stats Cards
        if (document.getElementById('totalPromptsCount'))
            document.getElementById('totalPromptsCount').textContent = prompts.length;
        if (document.getElementById('totalGenerations'))
            document.getElementById('totalGenerations').textContent = stats.totalGenerations;
        if (document.getElementById('totalTokensUsed'))
            document.getElementById('totalTokensUsed').textContent = stats.totalTokens.toLocaleString();
        if (document.getElementById('totalCost'))
            document.getElementById('totalCost').textContent = '$' + stats.totalCost.toFixed(4);

        // Update History List (Last 5)
        const historyListEl = document.getElementById('promptHistoryList');
        if (historyListEl) {
            if (history.length === 0) {
                historyListEl.innerHTML = '<div class="empty-state small"><p>No generation history yet.</p></div>';
            } else {
                historyListEl.innerHTML = history.slice(0, 5).map(h => {
                    const statusClass = h.success ? 'success' : 'error';
                    const icon = h.success ? '✅' : '❌';
                    const date = new Date(h.created_at).toLocaleDateString();
                    return `
                        <div class="history-item">
                            <div class="history-icon">${icon}</div>
                            <div class="history-info">
                                <div class="history-title">Generated Content</div>
                                <div class="history-meta">${date} • ${h.model} • ${h.tokens_used} tokens</div>
                            </div>
                            <span class="history-status ${statusClass}">${h.success ? 'Success' : 'Failed'}</span>
                        </div>
                    `;
                }).join('');
            }
        }
    },

    viewPromptHistory: () => {
        alert("Full history view coming in next update!");
    },

    runPrompt: (promptId) => {
        const prompt = App.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        const variables = prompt.variables || [];
        const variableInputs = variables.map(v => `
            <div class="form-group">
                <label>${v}</label>
                <input type="text" name="var_${v}" required placeholder="Value for ${v}" class="form-control">
            </div>
        `).join('');

        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>🚀 Run Prompt: ${Utils.escapeHtml(prompt.title)}</h2>
                    <button class="btn-close" onclick="UI.closeModal()">×</button>
                </div>
                <!-- IMPORTANT: Form must capture submit event on the FORM element, not the button -->
                <form id="promptRunForm" onsubmit="App.handleGenerate(event, '${promptId}')">
                    <div class="modal-body">
                        <p class="text-muted small" style="margin-bottom:1rem; font-style:italic;">${Utils.escapeHtml(prompt.content.substring(0, 100))}${prompt.content.length > 100 ? '...' : ''}</p>
                        ${variableInputs.length > 0 ? variableInputs : '<p>No variables to configure. Ready to generate?</p>'}
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="btn btn-primary">✨ Generate</button>
                    </div>
                </form>
            </div>
        `;
        UI.showModal(modalHtml);
    },

    handleGenerate: async (e, promptId) => {
        e.preventDefault();
        const prompt = App.state.prompts.find(p => p.id === promptId);
        if (!prompt) return;

        // Collect inputs
        const formData = new FormData(e.target);
        const inputVariables = {};
        if (prompt.variables) {
            prompt.variables.forEach(v => {
                inputVariables[v] = formData.get(`var_${v}`);
            });
        }

        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) {
            btn.textContent = 'Generating...';
            btn.disabled = true;
        }

        UI.showToast('Generating content...', 'info');

        // SIMULATE AI DELAY
        setTimeout(async () => {
            try {
                // Mock Generation Logic
                let output = prompt.content;
                // Replace variables
                for (const [key, val] of Object.entries(inputVariables)) {
                    output = output.replace(new RegExp(`{{${key}}}`, 'g'), val || `[${key}]`);
                }

                // Add some "AI" flavor
                output = output + "\n\n--- AI GENERATED ---\nBased on your input, here is the result. (This is a mock generation for now).";

                // Save to History (Mock)
                await Data.PromptHistory.add(App.state.user.uid, {
                    prompt_id: prompt.id,
                    channel_id: prompt.channelId,
                    input_variables: inputVariables,
                    output_result: output,
                    ai_service: 'Mock AI',
                    model: 'gpt-4o-mini',
                    tokens_used: Math.floor(Math.random() * 500) + 20,
                    cost_estimate: 0.005,
                    duration_ms: 1200,
                    success: true
                });

                // Increment usage
                await Data.Prompts.incrementUseCount(prompt.id);

                UI.showToast('Generation complete!', 'success');
                UI.closeModal();
                App.refreshPrompts();

                // Show Result Modal
                UI.showModal(`
                    <div class="modal">
                        <div class="modal-header">
                            <h2>✨ Generation Result</h2>
                            <button class="btn-close" onclick="UI.closeModal()">×</button>
                        </div>
                        <div class="modal-body">
                            <textarea class="prompt-editor" readonly style="height:300px;">${Utils.escapeHtml(output)}</textarea>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" onclick="UI.showToast('Copied to clipboard!', 'success'); // In real app: navigator.clipboard.writeText(...)">📋 Copy</button>
                            <button class="btn btn-outline" onclick="UI.closeModal()">Close</button>
                        </div>
                    </div>
                `);

            } catch (err) {
                ErrorHandler.handle(err, 'App.handleGenerate');
                if (btn) {
                    btn.textContent = 'Retry';
                    btn.disabled = false;
                }
            }
        }, 1500);
    },

    // Media Studio
    openMediaGenerator: () => {
        showModule('media');
        App.refreshMedia();
    },

    refreshMedia: async () => {
        if (!App.state.user) return;
        const assets = await Data.MediaAssets.fetch(App.state.user.uid);
        App.state.mediaAssets = assets || [];
        App.renderMediaWorkbench();
    },

    setMediaType: (type) => {
        App.state.mediaGenType = type;
        const btnImage = document.getElementById('btnTypeImage');
        const btnVideo = document.getElementById('btnTypeVideo');
        if (btnImage) btnImage.classList.toggle('active', type === 'image');
        if (btnVideo) btnVideo.classList.toggle('active', type === 'video');

        const promptInput = document.getElementById('mediaPromptInput');
        if (promptInput) {
            promptInput.placeholder = type === 'image'
                ? "Describe the image you want to generate..."
                : "Describe the video scene (movement, camera angle)...";
        }
    },

    filterMedia: (filter) => {
        App.state.mediaFilter = filter;
        App.renderMediaWorkbench();
    },

    renderMediaWorkbench: () => {
        const assets = App.state.mediaAssets || [];
        const uniqueAssets = Array.from(new Set(assets.map(a => a.id)))
            .map(id => assets.find(a => a.id === id));

        const filter = App.state.mediaFilter;
        let filtered = uniqueAssets;

        const tabBtns = document.querySelectorAll('.media-gallery-panel .tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase().includes(filter === 'all' ? 'all' : filter === 'favorites' ? 'favorites' : filter)) {
                btn.classList.add('active');
            }
        });

        if (filter === 'favorites') {
            filtered = uniqueAssets.filter(a => a.isFavorite);
        } else if (filter !== 'all') {
            filtered = uniqueAssets.filter(a => a.type === filter);
        }

        const listEl = document.getElementById('mediaList');
        if (!listEl) return;

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <h3>No Media Found</h3>
                    <p>Try different filters or generate something new.</p>
                </div>`;
        } else {
            listEl.innerHTML = filtered.map(asset => {
                const isVideo = asset.type === 'video';
                const url = asset.url || (isVideo ? 'https://via.placeholder.com/640x360?text=Video+Placeholder' : 'https://via.placeholder.com/512?text=AI+Image');

                return `
                    <div class="media-card ${asset.type}" onclick="App.previewMedia('${asset.id}')">
                        <img src="${url}" alt="${Utils.escapeHtml(asset.prompt)}" loading="lazy">
                        <div class="media-overlay">
                            ${asset.isFavorite ? '<span>⭐</span>' : ''}
                            <span class="badge">${asset.type === 'image' ? 'IMG' : 'VID'}</span>
                            <button class="btn-icon-sm" onclick="event.stopPropagation(); App.deleteMedia('${asset.id}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (document.getElementById('mediaCount')) {
            document.getElementById('mediaCount').textContent = `${uniqueAssets.length} Assets`;
        }
    },

    generateMedia: async () => {
        const promptInput = document.getElementById('mediaPromptInput');
        const prompt = promptInput.value.trim();
        if (!prompt) {
            UI.showToast('Please enter a prompt', 'error');
            return;
        }

        const type = App.state.mediaGenType;
        const style = document.getElementById('mediaStyle').value;
        const ratio = document.getElementById('mediaAspectRatio').value;

        const btn = document.querySelector('.generator-form .btn-primary');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `Generating ${type}... <span class="spinner">⏳</span>`;

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const mockData = {
                type: type,
                prompt: prompt,
                url: type === 'image'
                    ? `https://via.placeholder.com/512/${Math.floor(Math.random() * 16777215).toString(16)}/ffffff?text=${encodeURIComponent(prompt.substring(0, 20))}`
                    : `https://via.placeholder.com/640x360/000000/ffffff?text=${encodeURIComponent(prompt.substring(0, 20))}`,
                metadata: { style, ratio },
                status: 'completed'
            };

            await Data.MediaAssets.add(App.state.user.uid, mockData);

            UI.showToast(`${type === 'image' ? 'Image' : 'Video'} generated successfully!`, 'success');
            promptInput.value = '';
            App.refreshMedia();

        } catch (error) {
            ErrorHandler.handle(error, 'App.generateMedia');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    deleteMedia: async (id) => {
        if (confirm('Delete this asset?')) {
            try {
                await Data.MediaAssets.delete(id);
                UI.showToast('Asset deleted', 'success');
                App.refreshMedia();
            } catch (error) {
                ErrorHandler.handle(error, 'App.deleteMedia');
            }
        }
    },

    previewMedia: (id) => {
        const asset = App.state.mediaAssets.find(a => a.id === id);
        if (!asset) return;
        const modalHtml = `
            <div class="modal">
                <div class="modal-header">
                    <h2>${asset.type === 'image' ? 'Image' : 'Video'} Preview</h2>
                    <button class="btn-close" onclick="UI.closeModal()">×</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <img src="${asset.url}" style="max-width: 100%; max-height: 60vh; border-radius: 8px;">
                    <p style="margin-top: 16px; font-style: italic;">"${Utils.escapeHtml(asset.prompt)}"</p>
                    <div class="media-meta" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
                        ${asset.metadata?.style || 'Unknown Style'} • ${asset.metadata?.ratio || '1:1'} • ${new Date(asset.created_at).toLocaleDateString()}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="App.toggleFavoriteMedia('${asset.id}')">${asset.isFavorite ? 'Unfavorite' : 'Favorite ⭐'}</button>
                    <button class="btn btn-primary" onclick="UI.closeModal()">Close</button>
                </div>
            </div>
        `;
        UI.showModal(modalHtml);
    },

    toggleFavoriteMedia: async (id) => {
        try {
            await Data.MediaAssets.toggleFavorite(id);
            UI.closeModal();
            App.refreshMedia();
        } catch (error) {
            ErrorHandler.handle(error, 'App.toggleFavoriteMedia');
        }
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
    if (name === 'templates' && App.state.templates) UI.renderTemplatesHub(App.state.templates);
    if (name === 'habits' && App.state.habits) UI.renderHabitsHub(App.state.habits);
    if (name === 'analytics') UI.renderAnalytics(App.state.tasks, App.state.habits);
    if (name === 'content') {
        App.refreshChannels();
        App.refreshContentVault();
    }
    if (name === 'prompts') {
        App.refreshPrompts();
    }
};
window.openAddTaskModal = App.openAddTaskModal;
window.closeModal = UI.closeModal;
window.openProjectModal = App.openProjectModal;
window.filterTasks = (filter) => {
    App.state.currentFilter = filter;
    window.currentFilter = filter;
    const buttons = document.querySelectorAll('.filter-tag');
    buttons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${filter}'`)) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    UI.renderTaskList(App.state.tasks, filter, App.state.searchQuery);
};
window.App = App; // expose for debugging and modal event handlers

// -----------------------------
// CALENDAR INTEGRATION
// -----------------------------
const CalendarExport = {
    generateICal: (tasks = []) => {
        const events = tasks
            .filter(t => t.timeBlock && t.status !== 'completed')
            .map(task => {
                const start = CalendarExport.parseTimeToDate(task.timeBlock.start);
                const end = CalendarExport.parseTimeToDate(task.timeBlock.end);

                return `BEGIN:VEVENT
UID:${task.id}@lcc
DTSTART:${CalendarExport.formatICalDate(start)}
DTEND:${CalendarExport.formatICalDate(end)}
SUMMARY:${task.title.replace(/,/g, '\\,')}
DESCRIPTION:${(task.description || '').replace(/,/g, '\\,')}
STATUS:CONFIRMED
END:VEVENT`;
            });

        const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Life Command Center//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events.join('\n')}
END:VCALENDAR`;

        const blob = new Blob([ical], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lcc-calendar-${new Date().toISOString().split('T')[0]}.ics`;
        a.click();
        URL.revokeObjectURL(url);

        UI.showToast('Calendar exported! Import into Google Calendar, Outlook, etc.', 'success');
    },

    parseTimeToDate: (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    },

    formatICalDate: (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
};

// -----------------------------
// COLLABORATION
// -----------------------------
const Collaboration = {
    shareProject: async (projectId, email) => {
        if (Config.offlineMode) {
            UI.showToast('Sharing not available in offline mode', 'info');
            return;
        }
        try {
            const project = App.state.projects.find(p => p.id === projectId);
            if (!project) throw new Error('Project not found');

            // In a real app, you'd send an invitation via email/Supabase Edge Functions
            // For now, we'll just add to shared_projects table
            const { error } = await supabaseClient.from('shared_projects').insert({
                project_id: projectId,
                shared_by: App.state.user.uid,
                shared_with_email: email
            });
            if (error) throw error;

            UI.showToast(`Project shared with ${email}`, 'success');
        } catch (error) {
            ErrorHandler.handle(error, 'Collaboration.shareProject');
        }
    },

    openShareModal: (projectId) => {
        UI.showModal(`
            <div class="modal-card">
                <div class="modal-header"><h3>Share Project</h3></div>
                <form onsubmit="Collaboration.handleShare(event, '${projectId}')">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="shareEmail" required placeholder="user@example.com">
                    </div>
                    <div class="form-group">
                        <label>Permission</label>
                        <select id="sharePermission" class="form-select">
                            <option value="view">View Only</option>
                            <option value="edit">Can Edit</option>
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Share</button>
                    </div>
                </form>
            </div>
        `);
    },

    handleShare: async (e, projectId) => {
        e.preventDefault();
        const email = document.getElementById('shareEmail').value;
        await Collaboration.shareProject(projectId, email);
        UI.closeModal();
    }
};

// -----------------------------
// EXPORT/IMPORT
// -----------------------------
const DataExport = {
    exportAll: () => {
        const data = {
            tasks: App.state.tasks,
            projects: App.state.projects,
            goals: App.state.goals,
            learnings: App.state.learnings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `life-command-center-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        UI.showToast('Data exported successfully!', 'success');
    },

    exportCSV: () => {
        const tasks = App.state.tasks;
        const headers = ['Title', 'Category', 'Priority', 'Status', 'Due Date', 'Time Tracked', 'Tags'];
        const rows = tasks.map(task => [
            task.title || '',
            task.category || '',
            task.priority || '',
            task.status || '',
            task.dueDate || '',
            task.trackedTime ? TimeTracker.formatTime(task.trackedTime) : '',
            task.tags ? task.tags.join('; ') : ''
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        UI.showToast('CSV exported successfully!', 'success');
    },

    import: async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    if (!data.tasks && !data.projects && !data.goals) {
                        throw new Error('Invalid file format');
                    }

                    const uid = App.state.user.uid;
                    let imported = 0;

                    if (data.tasks) {
                        for (const task of data.tasks) {
                            try {
                                await Data.Tasks.add(uid, task);
                                imported++;
                            } catch (err) {
                                console.error('Failed to import task:', err);
                            }
                        }
                    }

                    if (data.projects) {
                        for (const project of data.projects) {
                            try {
                                await Data.Projects.add(uid, project);
                                imported++;
                            } catch (err) {
                                console.error('Failed to import project:', err);
                            }
                        }
                    }

                    UI.showToast(`Imported ${imported} items successfully!`, 'success');
                    App.refresh();
                    resolve();
                } catch (error) {
                    ErrorHandler.handle(error, 'DataExport.import');
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }
};

// -----------------------------
// NOTIFICATIONS & REMINDERS
// -----------------------------
const Notifications = {
    init: () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },

    show: (title, options = {}) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: options.body || '',
                icon: options.icon || '⚡',
                badge: '⚡',
                tag: options.tag || 'lcc-notification',
                ...options
            });
        }
    },

    scheduleReminder: (taskId, reminderTime) => {
        const task = App.state.tasks.find(t => t.id === taskId);
        if (!task) return;

        const now = new Date();
        const reminder = new Date(reminderTime);
        const delay = reminder.getTime() - now.getTime();

        if (delay > 0) {
            setTimeout(() => {
                Notifications.show(`Reminder: ${task.title}`, {
                    body: task.description || 'Don\'t forget this task!',
                    tag: `task-${taskId}`
                });
            }, delay);
        }
    },

    checkDueTasks: () => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        App.state.tasks.forEach(task => {
            if (task.dueDate && task.dueDate === today && task.status !== 'completed') {
                Notifications.show(`Task Due Today: ${task.title}`, {
                    body: 'This task is due today!',
                    tag: `due-${task.id}`
                });
            }
        });
    }
};

// -----------------------------
// KEYBOARD SHORTCUTS
// -----------------------------
const KeyboardShortcuts = {
    init: () => {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K: Quick add task
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (App.state.user) {
                    App.openAddTaskModal();
                }
            }

            // Ctrl/Cmd + /: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                const searchInput = document.getElementById('taskSearchInput');
                if (searchInput) {
                    searchInput.focus();
                    showModule('tasks');
                }
            }

            // Escape: Close modals
            if (e.key === 'Escape') {
                UI.closeModal();
            }

            // Number keys for navigation (when not in input)
            if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                if (e.key === '1') {
                    e.preventDefault();
                    showModule('dashboard');
                } else if (e.key === '2') {
                    e.preventDefault();
                    showModule('tasks');
                } else if (e.key === '3') {
                    e.preventDefault();
                    showModule('projects');
                } else if (e.key === '4') {
                    e.preventDefault();
                    showModule('goals');
                } else if (e.key === '5') {
                    e.preventDefault();
                    showModule('schedule');
                }
            }
        });
    }
};

// -----------------------------
// OFFLINE MODE PATCHES
// -----------------------------
if (Config.offlineMode && typeof MockData !== 'undefined') {
    MockData._trigger = (key, val) => {
        const cbs = MockData._subscriptions[key] || [];
        cbs.forEach(cb => cb(val));
    };

    // Wrap _set to trigger updates
    const originalSet = MockData._set;
    MockData._set = (key, val) => {
        originalSet(key, val);
        MockData._trigger(key, val);
    };

    // Helper to patch listen
    const patchListen = (resource, prefix) => {
        if (MockData[resource]) {
            MockData[resource].listen = (uid, cb) => {
                const key = `${prefix}_${uid}`;
                if (!MockData._subscriptions[key]) MockData._subscriptions[key] = [];
                MockData._subscriptions[key].push(cb);
                cb(MockData._get(key));
                return () => {
                    if (MockData._subscriptions[key])
                        MockData._subscriptions[key] = MockData._subscriptions[key].filter(c => c !== cb);
                };
            };
        }
    };

    patchListen('Tasks', 'tasks');
    patchListen('Projects', 'projects');
    patchListen('Goals', 'goals');
    patchListen('Learnings', 'learnings');
    patchListen('Templates', 'templates');
    patchListen('Habits', 'habits');
    patchListen('Channels', 'channels');
    patchListen('ContentVault', 'content_vault');
    patchListen('Prompts', 'prompts');
    patchListen('PromptHistory', 'prompt_history');
}

// Start the app
App.init();
KeyboardShortcuts.init();