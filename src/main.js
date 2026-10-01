// TaskPulse Main Entry Point
import { taskManager } from './modules/taskManager.js';
import { UIController } from './modules/uiController.js';
import { loadThemeFromStorage, saveThemeToStorage } from './modules/storage.js';

document.addEventListener('DOMContentLoaded', () => {
  const ui = new UIController(taskManager);

  // Cloud Sync Status Badge Handler
  const cloudSyncBadge = document.getElementById('cloudSyncStatus');
  const cloudSyncText = document.getElementById('cloudSyncText');

  const updateSyncUI = (status) => {
    if (!cloudSyncBadge || !cloudSyncText) return;
    if (status && status.connected) {
      cloudSyncBadge.className = 'cloud-sync-badge synced';
      cloudSyncText.textContent = '클라우드 연동됨';
      cloudSyncBadge.title = 'Supabase PostgreSQL DB와 실시간 연동 중입니다.';
    } else {
      cloudSyncBadge.className = 'cloud-sync-badge local';
      cloudSyncText.textContent = '로컬 모드';
      cloudSyncBadge.title = 'Supabase tasks 테이블 생성 후 자동 연동됩니다.';
    }
  };

  // Initialize Supabase Cloud Sync
  taskManager.initCloudSync((status) => {
    updateSyncUI(status);
    ui.renderAll();
  });

  // Theme Setup
  const currentTheme = loadThemeFromStorage();
  document.documentElement.setAttribute('data-theme', currentTheme);

  ui.themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    saveThemeToStorage(nextTheme);
    ui.renderAll();
  });

  // Mobile Sidebar Drawer
  const mobileSidebarOpen = document.getElementById('mobileSidebarOpen');
  const mobileSidebarClose = document.getElementById('mobileSidebarClose');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  const toggleMobileSidebar = (open) => {
    if (open) {
      ui.sidebar.classList.add('open');
      sidebarOverlay.classList.add('open');
    } else {
      ui.sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('open');
    }
  };

  mobileSidebarOpen.addEventListener('click', () => toggleMobileSidebar(true));
  mobileSidebarClose.addEventListener('click', () => toggleMobileSidebar(false));
  sidebarOverlay.addEventListener('click', () => toggleMobileSidebar(false));

  // Navigation View Switcher (Tasks vs Analytics)
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      ui.switchView(view);
      toggleMobileSidebar(false);
    });
  });

  // Navigation Filter Click
  document.querySelectorAll('.nav-filter[data-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-filter').forEach(f => f.classList.remove('active'));
      e.currentTarget.classList.add('active');
      taskManager.navFilter = e.currentTarget.dataset.filter;
      taskManager.categoryFilter = null; // reset category filter
      ui.renderAll();
      toggleMobileSidebar(false);
    });
  });

  // Category Add
  document.getElementById('btnAddCategory').addEventListener('click', () => {
    const catName = prompt('새 카테고리 이름을 입력하세요 (예: 사이드 프로젝트):');
    if (catName && catName.trim()) {
      const colors = ['#6366f1', '#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      taskManager.addCategory(catName.trim(), randomColor);
      ui.showToast(`'${catName}' 카테고리가 추가되었습니다.`, 'success');
      ui.renderAll();
    }
  });

  // Toolbar Filter Pills
  document.querySelectorAll('.pill[data-pill]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      taskManager.pillFilter = e.currentTarget.dataset.pill;
      ui.renderAll();
    });
  });

  // Sort Select
  ui.sortSelect.addEventListener('change', (e) => {
    taskManager.sortOption = e.target.value;
    ui.renderAll();
  });

  // Search Input
  ui.searchInput.addEventListener('input', (e) => {
    taskManager.searchQuery = e.target.value;
    if (e.target.value.trim()) {
      ui.clearSearchBtn.classList.remove('hidden');
    } else {
      ui.clearSearchBtn.classList.add('hidden');
    }
    ui.renderAll();
  });

  ui.clearSearchBtn.addEventListener('click', () => {
    ui.searchInput.value = '';
    taskManager.searchQuery = '';
    ui.clearSearchBtn.classList.add('hidden');
    ui.renderAll();
  });

  // Cmd/Ctrl + K shortcut for search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      ui.searchInput.focus();
    }
  });

  // Collapsible Completed Tasks Section Toggle
  ui.toggleCompletedBtn.addEventListener('click', (e) => {
    // Avoid triggering accordion toggle if user clicked "Clear completed" button
    if (e.target.closest('#btnClearCompleted')) return;

    taskManager.completedAccordionOpen = !taskManager.completedAccordionOpen;
    ui.renderAll();
  });

  // Clear Completed Tasks
  document.getElementById('btnClearCompleted').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('완료된 할 일을 모두 삭제하시겠습니까?')) {
      taskManager.clearCompletedTasks();
      ui.showToast('완료된 항목이 비워졌습니다.', 'info');
      ui.renderAll();
    }
  });

  // Open Modal Buttons
  document.getElementById('btnOpenNewTaskModal').addEventListener('click', () => ui.openTaskModal());
  document.getElementById('btnEmptyAddTask')?.addEventListener('click', () => ui.openTaskModal());

  // Modal Cancel & Close
  document.getElementById('btnCloseModal').addEventListener('click', () => ui.closeTaskModal());
  document.getElementById('btnCancelModal').addEventListener('click', () => ui.closeTaskModal());

  // Add Subtask Field Button in Modal
  document.getElementById('btnAddSubtaskItem').addEventListener('click', () => {
    ui.addSubtaskInputField('', false);
  });

  // Task Form Submit (Create / Edit)
  ui.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;

    const notes = document.getElementById('taskNotes').value.trim();
    const categoryId = document.getElementById('taskCategory').value;
    const priority = document.getElementById('taskPriority').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const dueTime = document.getElementById('taskDueTime').value;

    // Collect subtasks
    const subtaskInputs = ui.subtasksInputContainer.querySelectorAll('.subtask-input-item');
    const subtasks = [];
    subtaskInputs.forEach((item, index) => {
      const text = item.querySelector('.subtask-text-input').value.trim();
      if (text) {
        subtasks.push({
          id: 'sub-' + index + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          title: text,
          completed: false
        });
      }
    });

    taskManager.saveTask({
      id: id || null,
      title,
      notes,
      categoryId,
      priority,
      dueDate,
      dueTime,
      subtasks: subtasks.length > 0 ? subtasks : undefined
    });

    ui.closeTaskModal();
    ui.showToast(id ? '할 일이 수정되었습니다.' : '새 할 일이 등록되었습니다! ✨', 'success');
    ui.renderAll();
  });

  // Data Export & Import & Reset
  document.getElementById('btnExportData').addEventListener('click', () => {
    taskManager.exportJSON();
    ui.showToast('JSON 백업 파일이 다운로드 되었습니다.', 'success');
  });

  document.getElementById('importFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        if (taskManager.importJSON(jsonData)) {
          ui.showToast('데이터 복구가 완료되었습니다.', 'success');
          ui.renderAll();
        } else {
          ui.showToast('올바르지 않은 JSON 파일 형식입니다.', 'warning');
        }
      } catch (err) {
        ui.showToast('파일 읽기에 실패했습니다.', 'warning');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btnResetData').addEventListener('click', () => {
    if (confirm('샘플 데이터로 초기화하시겠습니까? 기존 설정이 리셋됩니다.')) {
      taskManager.resetToDefault();
      ui.showToast('샘플 데이터로 초기화되었습니다.', 'info');
      ui.renderAll();
    }
  });

  // Initial Render
  ui.renderAll();
});
