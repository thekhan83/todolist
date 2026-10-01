// Supabase Client & Database Sync Module
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://lprgogivagoubpkwcltg.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcmdvZ2l2YWdvdWJwa3djbHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NTAyNDQsImV4cCI6MjEwNjQyNjI0NH0.IllUVvx5NCjv9R3Y94nKp78VsdNmRdDDkuOJo9Hrmug';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to convert app Task model to Supabase DB Row
export function toDbRow(task) {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes || '',
    category_id: task.categoryId || task.category_id || 'cat-work',
    priority: task.priority || 'medium',
    due_date: task.dueDate || task.due_date || '',
    due_time: task.dueTime || task.due_time || '',
    completed: Boolean(task.completed),
    completed_at: task.completedAt || task.completed_at || null,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    starred: Boolean(task.starred),
    created_at: task.createdAt || task.created_at || new Date().toISOString()
  };
}

// Helper to convert Supabase DB Row to app Task model
export function fromDbRow(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes || '',
    categoryId: row.category_id || row.categoryId || 'cat-work',
    priority: row.priority || 'medium',
    dueDate: row.due_date || row.dueDate || '',
    dueTime: row.due_time || row.dueTime || '',
    completed: Boolean(row.completed),
    completedAt: row.completed_at || row.completedAt || null,
    subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
    starred: Boolean(row.starred),
    createdAt: row.created_at || row.createdAt || new Date().toISOString()
  };
}

/**
 * Fetch all tasks from Supabase
 */
export async function fetchTasksFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Fetch tasks notice:', error.message);
      return null;
    }
    return (data || []).map(fromDbRow);
  } catch (err) {
    console.warn('[Supabase] Connection error:', err.message);
    return null;
  }
}

/**
 * Upsert (insert or update) a task in Supabase
 */
export async function upsertTaskToSupabase(task) {
  try {
    const row = toDbRow(task);
    const { error } = await supabase.from('tasks').upsert(row);
    if (error) {
      console.warn('[Supabase] Upsert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Upsert exception:', err.message);
    return false;
  }
}

/**
 * Delete a task in Supabase
 */
export async function deleteTaskFromSupabase(id) {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      console.warn('[Supabase] Delete error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Delete exception:', err.message);
    return false;
  }
}

/**
 * Batch upload local tasks to Supabase if Supabase is empty
 */
export async function syncLocalTasksToSupabase(localTasks) {
  if (!Array.isArray(localTasks) || localTasks.length === 0) return;
  try {
    const rows = localTasks.map(toDbRow);
    const { error } = await supabase.from('tasks').upsert(rows);
    if (error) {
      console.warn('[Supabase] Bulk sync error:', error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Bulk sync exception:', err.message);
  }
}

/**
 * Realtime subscription for multi-device sync
 */
export function subscribeToTaskChanges(onRemoteChange) {
  try {
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          if (typeof onRemoteChange === 'function') {
            onRemoteChange(payload);
          }
        }
      )
      .subscribe();

    return channel;
  } catch (err) {
    console.warn('[Supabase] Realtime subscription failed:', err);
    return null;
  }
}
