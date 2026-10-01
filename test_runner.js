// Automated Unit & Integration Test Suite for TaskManager
import assert from 'node:assert';
if (typeof process !== 'undefined' && process.loadEnvFile) {
  try { process.loadEnvFile(); } catch (_) {}
}

// Mock localStorage
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Import TaskManager
const { taskManager } = await import('./src/modules/taskManager.js');

console.log('🧪 Starting To-do Plus Automated Tests...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(description, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`✅ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${description}`);
    console.error(`   Error: ${err.message}`);
  }
}

// 1. Initial State Test
runTest('Initial TaskManager State loads sample data', () => {
  assert.ok(taskManager.tasks.length > 0, 'Initial tasks should be loaded');
  assert.ok(taskManager.categories.length > 0, 'Categories should be initialized');
});

// 2. Create Task Test
runTest('Create new task via saveTask()', () => {
  const initialCount = taskManager.tasks.length;
  taskManager.saveTask({
    title: '테스트용 새 할 일',
    notes: '단위 테스트 노트',
    priority: 'high',
    dueDate: '2026-10-05'
  });
  assert.strictEqual(taskManager.tasks.length, initialCount + 1, 'Task count should increase by 1');
  assert.strictEqual(taskManager.tasks[0].title, '테스트용 새 할 일');
  assert.strictEqual(taskManager.tasks[0].priority, 'high');
  assert.strictEqual(taskManager.tasks[0].completed, false);
});

// 3. Update Task Test
runTest('Update existing task via saveTask()', () => {
  const targetId = taskManager.tasks[0].id;
  taskManager.saveTask({
    id: targetId,
    title: '수정된 할 일 제목',
    priority: 'medium'
  });
  const updatedTask = taskManager.tasks.find(t => t.id === targetId);
  assert.strictEqual(updatedTask.title, '수정된 할 일 제목');
  assert.strictEqual(updatedTask.priority, 'medium');
});

// 4. Toggle Task Completion & Split Tasks Test (Key user requirement)
runTest('Toggle task completion & verify move between Active and Completed lists', () => {
  const target = taskManager.tasks.find(t => !t.completed);
  assert.ok(target, 'Should have an active task');

  const splitBefore = taskManager.getSplitTasks();
  assert.ok(splitBefore.active.some(t => t.id === target.id), 'Task should be in active list');
  assert.ok(!splitBefore.completed.some(t => t.id === target.id), 'Task should NOT be in completed list');

  // Toggle complete
  taskManager.toggleTaskCompletion(target.id);

  const splitAfter = taskManager.getSplitTasks();
  assert.ok(!splitAfter.active.some(t => t.id === target.id), 'Task should leave active list');
  assert.ok(splitAfter.completed.some(t => t.id === target.id), 'Task should enter completed list');

  // Toggle back to incomplete
  taskManager.toggleTaskCompletion(target.id);
  const splitRestored = taskManager.getSplitTasks();
  assert.ok(splitRestored.active.some(t => t.id === target.id), 'Task should restore to active list');
});

// 5. Toggle Subtask Test
runTest('Toggle subtask item completed status', () => {
  taskManager.saveTask({
    title: '서브태스크 포함 할 일',
    subtasks: [
      { id: 'sub-test-1', title: '하위 항목 1', completed: false }
    ]
  });
  const taskWithSub = taskManager.tasks[0];
  assert.strictEqual(taskWithSub.subtasks[0].completed, false);

  taskManager.toggleSubtask(taskWithSub.id, 'sub-test-1');
  assert.strictEqual(taskWithSub.subtasks[0].completed, true);
});

// 6. Filter & Search Test
runTest('Search query filtering works correctly', () => {
  taskManager.searchQuery = '수정된';
  const filtered = taskManager.getFilteredTasks();
  assert.ok(filtered.every(t => t.title.includes('수정된') || t.notes.includes('수정된')), 'Filtered results should contain query');
  taskManager.searchQuery = ''; // reset
});

// 7. Clear Completed Tasks Test
runTest('Clear completed tasks removes all completed items', () => {
  // Ensure at least one task is completed
  if (!taskManager.tasks.some(t => t.completed)) {
    taskManager.toggleTaskCompletion(taskManager.tasks[0].id);
  }
  taskManager.clearCompletedTasks();
  assert.strictEqual(taskManager.tasks.some(t => t.completed), false, 'No completed tasks should remain');
});

// 8. Delete Task Test
runTest('Delete task removes task by ID', () => {
  const targetId = taskManager.tasks[0].id;
  const initialCount = taskManager.tasks.length;
  taskManager.deleteTask(targetId);
  assert.strictEqual(taskManager.tasks.length, initialCount - 1);
  assert.strictEqual(taskManager.tasks.some(t => t.id === targetId), false);
});

// 9. JSON Import & Export Test
runTest('Import JSON restores state', () => {
  const mockData = {
    tasks: [
      { id: 'import-1', title: '복원된 할 일', completed: false, categoryId: 'cat-work', priority: 'high', createdAt: new Date().toISOString() }
    ],
    categories: [
      { id: 'cat-work', name: '업무', color: '#6366f1' }
    ]
  };
  const success = taskManager.importJSON(mockData);
  assert.strictEqual(success, true);
  assert.strictEqual(taskManager.tasks.length, 1);
  assert.strictEqual(taskManager.tasks[0].title, '복원된 할 일');
});

console.log(`\n📊 Test Summary: ${passedTests}/${totalTests} Passed.`);
if (passedTests === totalTests) {
  console.log('🎉 All tests passed successfully with zero errors!');
} else {
  process.exit(1);
}
