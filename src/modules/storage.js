// LocalStorage persistence & initial mock data

const STORAGE_KEYS = {
  TASKS: 'taskpulse_tasks_v1',
  CATEGORIES: 'taskpulse_categories_v1',
  THEME: 'taskpulse_theme_v1',
  STREAK: 'taskpulse_streak_v1'
};

const DEFAULT_CATEGORIES = [
  { id: 'cat-work', name: '업무 (Work)', color: '#6366f1' },
  { id: 'cat-personal', name: '개인 (Personal)', color: '#10b981' },
  { id: 'cat-study', name: '공부 (Study)', color: '#06b6d4' },
  { id: 'cat-health', name: '건강 (Health)', color: '#f59e0b' }
];

const getTodayFormatted = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const INITIAL_MOCK_TASKS = [
  {
    id: 'task-1',
    title: '🚀 To-Do List PRD 및 기능 설계 검토',
    notes: '요구사항 정의서(PRD) 검토 및 미완료/완료 목록 분리 UX 점검',
    categoryId: 'cat-work',
    priority: 'high',
    dueDate: getTodayFormatted(0),
    dueTime: '18:00',
    completed: true,
    completedAt: new Date().toISOString(),
    starred: true,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    subtasks: [
      { id: 'sub-1', title: 'PRD 작성', completed: true },
      { id: 'sub-2', title: '완료 항목 아코디언 배치', completed: true }
    ]
  },
  {
    id: 'task-2',
    title: '📊 주간 업무 생산성 리포트 확인하기',
    notes: 'TaskPulse 대시보드 통계 차트 기능 테스트',
    categoryId: 'cat-work',
    priority: 'medium',
    dueDate: getTodayFormatted(1),
    dueTime: '14:00',
    completed: false,
    completedAt: null,
    starred: true,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    subtasks: [
      { id: 'sub-3', title: 'Chart.js 연동', completed: true },
      { id: 'sub-4', title: '카테고리별 통계 데이터 검증', completed: false }
    ]
  },
  {
    id: 'task-3',
    title: '💧 매일 물 2리터 마시기 & 30분 산책',
    notes: '건강한 라이프스타일 유지',
    categoryId: 'cat-health',
    priority: 'low',
    dueDate: getTodayFormatted(0),
    dueTime: '21:00',
    completed: false,
    completedAt: null,
    starred: false,
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    subtasks: []
  },
  {
    id: 'task-4',
    title: '📚 모던 JavaScript 핵심 개념 복습',
    notes: '비동기 처리, 모듈 시스템, ES6+ 문법 정리',
    categoryId: 'cat-study',
    priority: 'medium',
    dueDate: getTodayFormatted(2),
    dueTime: '20:00',
    completed: false,
    completedAt: null,
    starred: false,
    createdAt: new Date().toISOString(),
    subtasks: []
  }
];

export const loadTasksFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (!raw) {
      saveTasksToStorage(INITIAL_MOCK_TASKS);
      return INITIAL_MOCK_TASKS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load tasks from storage', e);
    return INITIAL_MOCK_TASKS;
  }
};

export const saveTasksToStorage = (tasks) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.error('Failed to save tasks', e);
  }
};

export const loadCategoriesFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!raw) {
      saveCategoriesToStorage(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CATEGORIES;
  }
};

export const saveCategoriesToStorage = (categories) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories', e);
  }
};

export const loadThemeFromStorage = () => {
  return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
};

export const saveThemeToStorage = (theme) => {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
};

export const loadStreakFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STREAK);
    return raw ? JSON.parse(raw) : { days: 1, lastCompletedDate: getTodayFormatted(0) };
  } catch (e) {
    return { days: 1, lastCompletedDate: getTodayFormatted(0) };
  }
};

export const saveStreakToStorage = (streak) => {
  localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify(streak));
};
