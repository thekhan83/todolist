// To-do Plus Main Entry Point
import { taskManager } from './modules/taskManager.js';
import { UIController } from './modules/uiController.js';
import { loadThemeFromStorage, saveThemeToStorage } from './modules/storage.js';
import {
  signInUser,
  signUpUser,
  signOutUser,
  getCurrentSession,
  onAuthStateChange
} from './modules/supabaseClient.js';

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
      cloudSyncBadge.title = 'Supabase todos DB와 실시간 연동 중입니다.';
    } else {
      cloudSyncBadge.className = 'cloud-sync-badge local';
      cloudSyncText.textContent = '로컬 모드';
      cloudSyncBadge.title = 'Supabase 연결 대기 중입니다.';
    }
  };

  // Auth DOM Elements
  const authScreen = document.getElementById('authScreen');
  const appContainer = document.getElementById('app');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const authForm = document.getElementById('authForm');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const authPasswordConfirmGroup = document.getElementById('authPasswordConfirmGroup');
  const authPasswordConfirm = document.getElementById('authPasswordConfirm');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authSubmitText = document.getElementById('authSubmitText');
  const authTitle = document.getElementById('authTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const authSwitchBtn = document.getElementById('authSwitchBtn');
  const authSwitchPrompt = document.getElementById('authSwitchPrompt');
  const authAlert = document.getElementById('authAlert');

  // User Profile & Logout Elements
  const userProfileWidget = document.getElementById('userProfileWidget');
  const userEmailBadge = document.getElementById('userEmailBadge');
  const btnLogout = document.getElementById('btnLogout');
  const sidebarUserWidget = document.getElementById('sidebarUserWidget');
  const sidebarUserEmail = document.getElementById('sidebarUserEmail');
  const btnSidebarLogout = document.getElementById('btnSidebarLogout');

  let authMode = 'login'; // 'login' | 'signup'

  const showAuthAlert = (type, message) => {
    if (!authAlert) return;
    authAlert.className = `auth-alert ${type}`;
    authAlert.textContent = message;
    authAlert.classList.remove('hidden');
  };

  const hideAuthAlert = () => {
    if (authAlert) authAlert.classList.add('hidden');
  };

  const setAuthMode = (mode) => {
    authMode = mode;
    hideAuthAlert();
    if (mode === 'signup') {
      tabSignup?.classList.add('active');
      tabLogin?.classList.remove('active');
      if (authTitle) authTitle.textContent = '회원가입';
      if (authSubtitle) authSubtitle.textContent = '새 계정을 만들고 나만의 할 일을 안전하게 보관하세요.';
      if (authPasswordConfirmGroup) authPasswordConfirmGroup.classList.remove('hidden');
      if (authPasswordConfirm) authPasswordConfirm.required = true;
      if (authSubmitText) authSubmitText.textContent = '회원가입 완료하기';
      if (authSwitchPrompt) authSwitchPrompt.textContent = '이미 계정이 있으신가요?';
      if (authSwitchBtn) authSwitchBtn.textContent = '로그인하기';
    } else {
      tabLogin?.classList.add('active');
      tabSignup?.classList.remove('active');
      if (authTitle) authTitle.textContent = '로그인';
      if (authSubtitle) authSubtitle.textContent = '로그인하여 나만의 할 일 목록을 안전하게 관리하세요.';
      if (authPasswordConfirmGroup) authPasswordConfirmGroup.classList.add('hidden');
      if (authPasswordConfirm) authPasswordConfirm.required = false;
      if (authSubmitText) authSubmitText.textContent = '로그인';
      if (authSwitchPrompt) authSwitchPrompt.textContent = '계정이 아직 없으신가요?';
      if (authSwitchBtn) authSwitchBtn.textContent = '회원가입하기';
    }
    ui.refreshIcons();
  };

  tabLogin?.addEventListener('click', () => setAuthMode('login'));
  tabSignup?.addEventListener('click', () => setAuthMode('signup'));
  authSwitchBtn?.addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  });

  const updateAuthState = (user) => {
    if (user) {
      // Logged in: show app, hide auth screen
      authScreen?.classList.add('hidden');
      if (appContainer) appContainer.style.display = 'flex';

      const email = user.email || '사용자';
      if (userEmailBadge) userEmailBadge.textContent = email;
      if (sidebarUserEmail) sidebarUserEmail.textContent = email;
      userProfileWidget?.classList.remove('hidden');
      sidebarUserWidget?.classList.remove('hidden');

      taskManager.setUser(user);
      taskManager.initCloudSync((status) => {
        updateSyncUI(status);
        ui.renderAll();
      });
      ui.renderAll();
    } else {
      // Logged out: hide app, show auth screen
      authScreen?.classList.remove('hidden');
      if (appContainer) appContainer.style.display = 'none';
      userProfileWidget?.classList.add('hidden');
      sidebarUserWidget?.classList.add('hidden');

      taskManager.setUser(null);
      ui.renderAll();
    }
    ui.refreshIcons();
  };

  // Auth Form Submission
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthAlert();

    const email = authEmail?.value.trim();
    const password = authPassword?.value;

    if (!email || !password) {
      showAuthAlert('error', '이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (password.length < 6) {
      showAuthAlert('error', '비밀번호는 최소 6자리 이상이어야 합니다.');
      return;
    }

    if (authMode === 'signup') {
      const confirm = authPasswordConfirm?.value;
      if (password !== confirm) {
        showAuthAlert('error', '비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    if (authSubmitBtn) authSubmitBtn.disabled = true;
    if (authSubmitText) authSubmitText.textContent = authMode === 'signup' ? '가입 처리 중...' : '로그인 중...';

    try {
      if (authMode === 'signup') {
        const res = await signUpUser(email, password);
        if (res?.session) {
          showAuthAlert('success', '회원가입이 완료되었습니다!');
          updateAuthState(res.user);
        } else {
          showAuthAlert('success', '가입 인증 메일이 발송되었습니다! 메일함(스팸함 포함)의 확인 링크를 누른 후 로그인해 주세요.');
          setAuthMode('login');
        }
      } else {
        const res = await signInUser(email, password);
        showAuthAlert('success', '로그인 성공!');
        updateAuthState(res.user);
      }
    } catch (err) {
      console.error('Auth error:', err);
      let msg = err.message || '인증 처리 중 오류가 발생했습니다.';
      if (msg.includes('Invalid login credentials')) {
        msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (msg.includes('User already registered')) {
        msg = '이미 등록된 이메일 주소입니다. 로그인해 주세요.';
      } else if (msg.includes('Email not confirmed')) {
        msg = '이메일 인증이 완료되지 않았습니다. 메일함의 링크를 클릭하여 인증해 주세요.';
      }
      showAuthAlert('error', msg);
    } finally {
      if (authSubmitBtn) authSubmitBtn.disabled = false;
      if (authSubmitText) authSubmitText.textContent = authMode === 'signup' ? '회원가입 완료하기' : '로그인';
    }
  });

  // Logout Handlers
  const handleLogout = async () => {
    try {
      await signOutUser();
      updateAuthState(null);
      setAuthMode('login');
      if (authEmail) authEmail.value = '';
      if (authPassword) authPassword.value = '';
      if (authPasswordConfirm) authPasswordConfirm.value = '';
      ui.showToast('성공적으로 로그아웃되었습니다.', 'info');
    } catch (err) {
      console.error('Logout error:', err);
      ui.showToast('로그아웃 처리 중 오류가 발생했습니다.', 'warning');
    }
  };

  btnLogout?.addEventListener('click', handleLogout);
  btnSidebarLogout?.addEventListener('click', handleLogout);

  // Check Initial Session
  getCurrentSession().then((session) => {
    updateAuthState(session?.user || null);
  }).catch(() => {
    updateAuthState(null);
  });

  // Listen for Auth State Changes
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      updateAuthState(null);
    } else if (session?.user) {
      updateAuthState(session.user);
    }
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
