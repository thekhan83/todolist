// DOM UI Controller
import { createIcons, icons } from 'lucide';
import confetti from 'canvas-confetti';
import { renderAnalyticsCharts } from './analytics.js';
import { saveThemeToStorage } from './storage.js';

export class UIController {
  constructor(taskManager) {
    this.tm = taskManager;
    this.initDOM();
  }

  initDOM() {
    // DOM Elements
    this.app = document.getElementById('app');
    this.sidebar = document.getElementById('sidebar');
    this.sidebarOverlay = document.getElementById('sidebarOverlay');
    
    // Header & Views
    this.viewTasks = document.getElementById('view-tasks');
    this.viewAnalytics = document.getElementById('view-analytics');
    this.viewTitle = document.getElementById('viewTitle');
    this.viewSubtitle = document.getElementById('viewSubtitle');
    this.searchInput = document.getElementById('searchInput');
    this.clearSearchBtn = document.getElementById('clearSearchBtn');

    // Sidebar Items
    this.categoryList = document.getElementById('categoryList');
    this.streakDaysText = document.getElementById('streakDays');
    this.themeToggleBtn = document.getElementById('themeToggleBtn');

    // Toolbar & Lists
    this.sortSelect = document.getElementById('sortSelect');
    this.activeTasksContainer = document.getElementById('activeTasksContainer');
    this.completedTasksContainer = document.getElementById('completedTasksContainer');
    this.emptyActiveState = document.getElementById('emptyActiveState');
    this.completedSection = document.getElementById('completedSection');
    this.toggleCompletedBtn = document.getElementById('toggleCompletedBtn');
    this.activeTaskCount = document.getElementById('activeTaskCount');
    this.completedTaskCount = document.getElementById('completedTaskCount');

    // Progress Banner
    this.progressHeadline = document.getElementById('progressHeadline');
    this.progressSubtitle = document.getElementById('progressSubtitle');
    this.progressStatText = document.getElementById('progressStatText');
    this.mainProgressBar = document.getElementById('mainProgressBar');

    // Modals & Form
    this.taskModal = document.getElementById('taskModal');
    this.taskForm = document.getElementById('taskForm');
    this.modalTitle = document.getElementById('modalTitle');
    this.subtasksInputContainer = document.getElementById('subtasksInputContainer');
    this.toastContainer = document.getElementById('toastContainer');
  }

  renderAll() {
    this.renderCategories();
    this.renderBadgesAndProgress();
    this.renderTasks();
    this.renderAnalyticsData();
    this.refreshIcons();
  }

  refreshIcons() {
    createIcons({ icons });
  }

  // Toast Notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;
    this.toastContainer.appendChild(toast);
    this.refreshIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Render Sidebar Categories
  renderCategories() {
    this.categoryList.innerHTML = '';
    
    // Add "All Categories" option if desired, or list available ones
    this.tm.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `category-item ${this.tm.categoryFilter === cat.id ? 'active' : ''}`;
      btn.dataset.catId = cat.id;

      const count = this.tm.tasks.filter(t => t.categoryId === cat.id && !t.completed).length;

      btn.innerHTML = `
        <span class="category-dot" style="background-color: ${cat.color}"></span>
        <span>${cat.name}</span>
        <span class="badge">${count}</span>
      `;

      btn.addEventListener('click', () => {
        if (this.tm.categoryFilter === cat.id) {
          this.tm.categoryFilter = null; // Toggle off
        } else {
          this.tm.categoryFilter = cat.id;
        }
        this.renderAll();
      });

      this.categoryList.appendChild(btn);
    });
  }

  // Render Badges, Streaks & Progress Banner
  renderBadgesAndProgress() {
    const counts = this.tm.getCounts();

    document.getElementById('badge-all').textContent = counts.all;
    document.getElementById('badge-today').textContent = counts.today;
    document.getElementById('badge-upcoming').textContent = counts.upcoming;
    document.getElementById('badge-starred').textContent = counts.starred;

    // Streak
    this.streakDaysText.textContent = this.tm.streak.days;

    // Banner
    this.progressHeadline.textContent = `오늘의 완료율: ${counts.completionRate}%`;
    this.progressStatText.textContent = `${counts.completedTotal} / ${counts.all}`;
    this.mainProgressBar.style.width = `${counts.completionRate}%`;

    if (counts.completionRate === 100 && counts.all > 0) {
      this.progressSubtitle.textContent = '🎉 와우! 모든 할 일을 완료하셨습니다. 완벽해요!';
    } else {
      this.progressSubtitle.textContent = '목표를 완성하여 프로그레스 바를 100% 채워보세요.';
    }
  }

  // Render Task Lists (Separating Active tasks and Completed tasks at bottom)
  renderTasks() {
    const { active, completed } = this.tm.getSplitTasks();

    this.activeTaskCount.textContent = active.length;
    this.completedTaskCount.textContent = completed.length;

    // Clear Containers
    this.activeTasksContainer.innerHTML = '';
    this.completedTasksContainer.innerHTML = '';

    // Render Active Tasks
    if (active.length === 0) {
      this.emptyActiveState.classList.remove('hidden');
    } else {
      this.emptyActiveState.classList.add('hidden');
      active.forEach(task => {
        const card = this.createTaskCardElement(task);
        this.activeTasksContainer.appendChild(card);
      });
    }

    // Render Completed Tasks (Placed below in Accordion Section)
    if (completed.length === 0) {
      this.completedSection.classList.add('hidden');
    } else {
      this.completedSection.classList.remove('hidden');
      if (this.tm.completedAccordionOpen) {
        this.completedSection.classList.add('open');
      } else {
        this.completedSection.classList.remove('open');
      }

      completed.forEach(task => {
        const card = this.createTaskCardElement(task);
        this.completedTasksContainer.appendChild(card);
      });
    }

    this.refreshIcons();
  }

  // Create single Task Card DOM Element
  createTaskCardElement(task) {
    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;
    card.dataset.id = task.id;

    const cat = this.tm.categories.find(c => c.id === task.categoryId);
    const catName = cat ? cat.name : '카테고리';
    const catColor = cat ? cat.color : '#6366f1';

    // Due Date format & Overdue check
    let dueDateHTML = '';
    if (task.dueDate) {
      const today = this.tm.getTodayDateString();
      const isOverdue = task.dueDate < today && !task.completed;
      dueDateHTML = `
        <span class="due-date ${isOverdue ? 'overdue' : ''}">
          <i data-lucide="calendar"></i>
          ${task.dueDate} ${task.dueTime || ''} ${isOverdue ? '(마감지남)' : ''}
        </span>
      `;
    }

    // Subtasks snippet
    let subtasksHTML = '';
    if (task.subtasks && task.subtasks.length > 0) {
      const doneCount = task.subtasks.filter(s => s.completed).length;
      const subItemsHTML = task.subtasks.map(sub => `
        <div class="subtask-item ${sub.completed ? 'done' : ''}">
          <input type="checkbox" class="subtask-check" data-task-id="${task.id}" data-sub-id="${sub.id}" ${sub.completed ? 'checked' : ''} />
          <span>${sub.title}</span>
        </div>
      `).join('');

      subtasksHTML = `
        <div class="subtasks-progress">
          <div class="stat-sub">세부 항목 (${doneCount}/${task.subtasks.length})</div>
          ${subItemsHTML}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="checkbox-custom ${task.completed ? 'checked' : ''}" data-action="toggle-complete">
        ${task.completed ? '<i data-lucide="check"></i>' : ''}
      </div>

      <div class="task-content">
        <div class="task-header-line">
          <span class="task-title">${task.title}</span>
          <div class="task-actions">
            <button class="btn-icon star-btn ${task.starred ? 'starred' : ''}" data-action="toggle-star" title="중요 표시">
              <i data-lucide="star"></i>
            </button>
            <button class="btn-icon" data-action="edit-task" title="수정">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn-icon" data-action="delete-task" title="삭제">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>

        <div class="task-meta">
          <span class="meta-badge priority-${task.priority}">
            ${task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'}
          </span>

          <span class="category-tag">
            <span class="category-dot" style="background-color: ${catColor}"></span>
            ${catName}
          </span>

          ${dueDateHTML}
        </div>

        ${task.notes ? `<div class="task-notes">${task.notes}</div>` : ''}
        ${subtasksHTML}
      </div>
    `;

    // Event listeners on card
    card.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      const subCheck = e.target.closest('.subtask-check');

      if (subCheck) {
        this.tm.toggleSubtask(subCheck.dataset.taskId, subCheck.dataset.subId);
        this.renderAll();
        return;
      }

      if (!target) return;

      const action = target.dataset.action;
      if (action === 'toggle-complete') {
        const updated = this.tm.toggleTaskCompletion(task.id);
        if (updated && updated.completed) {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          this.showToast(`'${task.title}' 완료 처리되었습니다! 하단 완료 목록으로 이동합니다.`, 'success');
        } else {
          this.showToast(`'${task.title}' 미완료로 복원되었습니다.`, 'info');
        }
        this.renderAll();
      } else if (action === 'toggle-star') {
        this.tm.toggleTaskStarred(task.id);
        this.renderAll();
      } else if (action === 'edit-task') {
        this.openTaskModal(task);
      } else if (action === 'delete-task') {
        if (confirm(`'${task.title}' 할 일을 삭제하시겠습니까?`)) {
          this.tm.deleteTask(task.id);
          this.showToast('할 일이 삭제되었습니다.', 'warning');
          this.renderAll();
        }
      }
    });

    return card;
  }

  // Analytics Render Call
  renderAnalyticsData() {
    const counts = this.tm.getCounts();
    document.getElementById('statTotalCompleted').textContent = counts.completedTotal;
    document.getElementById('statCompletedSub').textContent = `전체 ${counts.all}개 중 완료율 ${counts.completionRate}%`;
    document.getElementById('statStreakDays').textContent = `${this.tm.streak.days} 일`;

    if (this.tm.currentView === 'analytics') {
      renderAnalyticsCharts(this.tm);
    }
  }

  // Open Task Modal (New or Edit)
  openTaskModal(task = null) {
    this.taskForm.reset();
    this.subtasksInputContainer.innerHTML = '';

    // Populate Category select options
    const catSelect = document.getElementById('taskCategory');
    catSelect.innerHTML = this.tm.categories.map(c => `
      <option value="${c.id}">${c.name}</option>
    `).join('');

    if (task) {
      this.modalTitle.innerHTML = `<i data-lucide="edit-3"></i> 할 일 수정`;
      document.getElementById('taskId').value = task.id;
      document.getElementById('taskTitle').value = task.title;
      document.getElementById('taskNotes').value = task.notes || '';
      document.getElementById('taskCategory').value = task.categoryId;
      document.getElementById('taskPriority').value = task.priority;
      document.getElementById('taskDueDate').value = task.dueDate || '';
      document.getElementById('taskDueTime').value = task.dueTime || '';

      if (task.subtasks) {
        task.subtasks.forEach(s => this.addSubtaskInputField(s.title, s.completed));
      }
    } else {
      this.modalTitle.innerHTML = `<i data-lucide="plus-circle"></i> 새 할 일 작성`;
      document.getElementById('taskId').value = '';
      document.getElementById('taskDueDate').value = this.tm.getTodayDateString();
    }

    this.taskModal.classList.add('open');
    this.refreshIcons();
  }

  closeTaskModal() {
    this.taskModal.classList.remove('open');
  }

  addSubtaskInputField(title = '', completed = false) {
    const div = document.createElement('div');
    div.className = 'subtask-input-item';
    div.innerHTML = `
      <input type="text" class="subtask-text-input" placeholder="세부 수행 항목..." value="${title}" />
      <button type="button" class="btn-icon-xs btn-remove-subtask">&times;</button>
    `;

    div.querySelector('.btn-remove-subtask').addEventListener('click', () => div.remove());
    this.subtasksInputContainer.appendChild(div);
  }

  // Switch View (Tasks vs Analytics)
  switchView(viewName) {
    this.tm.currentView = viewName;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    if (viewName === 'analytics') {
      this.viewTasks.classList.remove('active');
      this.viewAnalytics.classList.add('active');
      this.viewTitle.textContent = '생산성 대시보드 & 리포트 📊';
      this.viewSubtitle.textContent = '완료 현황, 주간 트렌드 및 카테고리 분석을 확인하세요.';
    } else {
      this.viewAnalytics.classList.remove('active');
      this.viewTasks.classList.add('active');
      this.viewTitle.textContent = '오늘도 힘차게 시작해볼까요? 🚀';
      this.viewSubtitle.textContent = '목표를 차근차근 달성하고 생산성을 높여보세요.';
    }

    this.renderAll();
  }
}
