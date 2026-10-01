import {
  loadTasksFromStorage,
  saveTasksToStorage,
  loadCategoriesFromStorage,
  saveCategoriesToStorage,
  loadStreakFromStorage,
  saveStreakToStorage
} from './storage.js';
import {
  fetchTasksFromSupabase,
  upsertTaskToSupabase,
  deleteTaskFromSupabase,
  syncLocalTasksToSupabase,
  subscribeToTaskChanges
} from './supabaseClient.js';

class TaskManager {
  constructor() {
    this.tasks = loadTasksFromStorage();
    this.categories = loadCategoriesFromStorage();
    this.streak = loadStreakFromStorage();
    this.currentUser = null;

    // Filters & Navigation State
    this.currentView = 'tasks'; // 'tasks' | 'analytics'
    this.navFilter = 'all'; // 'all' | 'today' | 'upcoming' | 'starred'
    this.categoryFilter = null; // category id or null
    this.pillFilter = 'all'; // 'all' | 'active' | 'high-priority'
    this.sortOption = 'createdAt-desc';
    this.searchQuery = '';
    this.completedAccordionOpen = true;
  }

  // Set logged in user state
  setUser(user) {
    this.currentUser = user;
    if (!user) {
      this.tasks = [];
      this.persist();
    }
  }

  // Getters & Calculations
  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  getUpcomingDateString(days = 3) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // Initialize Supabase Cloud Sync
  async initCloudSync(onSyncChange) {
    this.onSyncChange = onSyncChange;
    try {
      const userId = this.currentUser?.id;
      const remoteTasks = await fetchTasksFromSupabase(userId);
      if (remoteTasks !== null) {
        if (remoteTasks.length > 0) {
          this.tasks = remoteTasks;
          this.persist();
        } else if (this.tasks.length > 0 && userId) {
          // Sync any initial local tasks up for this user
          await syncLocalTasksToSupabase(this.tasks, userId);
        }
        if (typeof this.onSyncChange === 'function') {
          this.onSyncChange({ connected: true, taskCount: this.tasks.length });
        }

        // Realtime subscription for this user
        if (this.realtimeSub?.unsubscribe) {
          try { this.realtimeSub.unsubscribe(); } catch (_) {}
        }
        this.realtimeSub = subscribeToTaskChanges(userId, async () => {
          const updated = await fetchTasksFromSupabase(userId);
          if (updated) {
            this.tasks = updated;
            this.persist();
            if (typeof this.onSyncChange === 'function') {
              this.onSyncChange({ connected: true, taskCount: this.tasks.length, remote: true });
            }
          }
        });
        return true;
      } else {
        if (typeof this.onSyncChange === 'function') {
          this.onSyncChange({ connected: false });
        }
        return false;
      }
    } catch (e) {
      console.warn('[TaskManager] Cloud sync error:', e);
      if (typeof this.onSyncChange === 'function') {
        this.onSyncChange({ connected: false });
      }
      return false;
    }
  }

  // Add or Update Task
  saveTask(taskData) {
    let savedTask = null;
    const userId = this.currentUser?.id || null;

    if (taskData.id) {
      // Update
      const index = this.tasks.findIndex(t => t.id === taskData.id);
      if (index !== -1) {
        this.tasks[index] = {
          ...this.tasks[index],
          ...taskData,
          userId: userId || this.tasks[index].userId
        };
        savedTask = this.tasks[index];
      }
    } else {
      // Create new
      const newTask = {
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        userId: userId,
        title: taskData.title,
        notes: taskData.notes || '',
        categoryId: taskData.categoryId || this.categories[0]?.id || 'cat-work',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate || '',
        dueTime: taskData.dueTime || '',
        completed: false,
        completedAt: null,
        starred: false,
        createdAt: new Date().toISOString(),
        subtasks: taskData.subtasks || []
      };
      this.tasks.unshift(newTask);
      savedTask = newTask;
    }
    this.persist();

    // Async sync to Supabase with user_id
    if (savedTask) {
      upsertTaskToSupabase(savedTask, userId).catch(() => {});
    }
    return savedTask;
  }

  // Toggle Completion
  toggleTaskCompletion(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    if (task.completed) {
      this.updateStreakOnCompletion();
    }

    this.persist();
    upsertTaskToSupabase(task, this.currentUser?.id).catch(() => {});
    return task;
  }

  // Toggle Starred (Important)
  toggleTaskStarred(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.starred = !task.starred;
    this.persist();
    upsertTaskToSupabase(task, this.currentUser?.id).catch(() => {});
  }

  // Delete Task
  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.persist();
    deleteTaskFromSupabase(id).catch(() => {});
  }

  // Clear Completed Tasks
  clearCompletedTasks() {
    const completedTasks = this.tasks.filter(t => t.completed);
    this.tasks = this.tasks.filter(t => !t.completed);
    this.persist();
    completedTasks.forEach(t => deleteTaskFromSupabase(t.id).catch(() => {}));
  }

  // Subtask completion toggle
  toggleSubtask(taskId, subtaskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const sub = task.subtasks.find(s => s.id === subtaskId);
    if (sub) {
      sub.completed = !sub.completed;
      this.persist();
      upsertTaskToSupabase(task, this.currentUser?.id).catch(() => {});
    }
  }

  // Add Category
  addCategory(name, color = '#6366f1') {
    const newCat = {
      id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name,
      color
    };
    this.categories.push(newCat);
    saveCategoriesToStorage(this.categories);
    return newCat;
  }

  // Update Streak logic
  updateStreakOnCompletion() {
    const today = this.getTodayDateString();
    if (this.streak.lastCompletedDate === today) {
      return; // Already counted today
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (this.streak.lastCompletedDate === yesterdayStr) {
      this.streak.days += 1;
    } else {
      this.streak.days = 1;
    }
    this.streak.lastCompletedDate = today;
    saveStreakToStorage(this.streak);
  }

  // Filter & Sort Tasks
  getFilteredTasks() {
    const today = this.getTodayDateString();
    const upcomingLimit = this.getUpcomingDateString(3);

    let list = [...this.tasks];

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      );
    }

    // Category filter
    if (this.categoryFilter) {
      list = list.filter(t => t.categoryId === this.categoryFilter);
    }

    // Nav Filter
    if (this.navFilter === 'today') {
      list = list.filter(t => t.dueDate === today);
    } else if (this.navFilter === 'upcoming') {
      list = list.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= upcomingLimit);
    } else if (this.navFilter === 'starred') {
      list = list.filter(t => t.starred);
    }

    // Toolbar Pill Filter
    if (this.pillFilter === 'active') {
      list = list.filter(t => !t.completed);
    } else if (this.pillFilter === 'high-priority') {
      list = list.filter(t => t.priority === 'high');
    }

    // Sorting
    list.sort((a, b) => {
      if (this.sortOption === 'dueDate-asc') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (this.sortOption === 'priority-desc') {
        const pMap = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      }
      if (this.sortOption === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      // default: createdAt-desc
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return list;
  }

  // Split Active vs Completed tasks for clear separation
  getSplitTasks() {
    const filtered = this.getFilteredTasks();
    return {
      active: filtered.filter(t => !t.completed),
      completed: filtered.filter(t => t.completed)
    };
  }

  // Stats Counters for Nav & Dashboard
  getCounts() {
    const today = this.getTodayDateString();
    const upcomingLimit = this.getUpcomingDateString(3);

    const all = this.tasks.length;
    const todayCount = this.tasks.filter(t => t.dueDate === today && !t.completed).length;
    const upcomingCount = this.tasks.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= upcomingLimit && !t.completed).length;
    const starredCount = this.tasks.filter(t => t.starred && !t.completed).length;

    const completedTotal = this.tasks.filter(t => t.completed).length;
    const completionRate = all > 0 ? Math.round((completedTotal / all) * 100) : 0;

    return {
      all,
      today: todayCount,
      upcoming: upcomingCount,
      starred: starredCount,
      completedTotal,
      completionRate
    };
  }

  // Save to storage
  persist() {
    saveTasksToStorage(this.tasks);
  }

  // Export & Import Data
  exportJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tasks: this.tasks,
      categories: this.categories,
      streak: this.streak
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TodoPlus_Backup_${this.getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(jsonData) {
    if (jsonData && Array.isArray(jsonData.tasks)) {
      this.tasks = jsonData.tasks;
      if (Array.isArray(jsonData.categories)) {
        this.categories = jsonData.categories;
        saveCategoriesToStorage(this.categories);
      }
      this.persist();
      return true;
    }
    return false;
  }

  resetToDefault() {
    localStorage.clear();
    this.tasks = loadTasksFromStorage();
    this.categories = loadCategoriesFromStorage();
    this.streak = loadStreakFromStorage();
    this.persist();
  }
}

export const taskManager = new TaskManager();
