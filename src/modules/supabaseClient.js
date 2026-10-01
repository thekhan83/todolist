// Supabase Client & Database Sync Module
import { createClient } from '@supabase/supabase-js';

// Retrieve credentials safely from Vite environment variables (VITE_ prefix required)
const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

export const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Target table name: defaults to 'tasks' where active data resides
export let CURRENT_TABLE = 'tasks';

/**
 * Check if active table exists (prioritizes active 'tasks', supports 'todos')
 */
export async function resolveActiveTable() {
  if (!supabase) return CURRENT_TABLE;
  try {
    // Check if 'tasks' table exists
    const { error: tasksErr } = await supabase.from('tasks').select('id').limit(1);
    if (!tasksErr) {
      CURRENT_TABLE = 'tasks';
      return 'tasks';
    }
    // Fallback: check if 'todos' table exists
    const { error: todosErr } = await supabase.from('todos').select('id').limit(1);
    if (!todosErr) {
      CURRENT_TABLE = 'todos';
      return 'todos';
    }
  } catch (err) {
    console.warn('[Supabase] resolveActiveTable error:', err.message);
  }
  return CURRENT_TABLE;
}

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
 * Fetch all tasks from Supabase (from 'todos' table)
 */
export async function fetchTasksFromSupabase() {
  if (!supabase) return null;
  try {
    await resolveActiveTable();
    const { data, error } = await supabase
      .from(CURRENT_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn(`[Supabase] Fetch notice from ${CURRENT_TABLE}:`, error.message);
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
  if (!supabase) return false;
  try {
    const row = toDbRow(task);
    const { error } = await supabase.from(CURRENT_TABLE).upsert(row);
    if (error) {
      console.warn(`[Supabase] Upsert into ${CURRENT_TABLE} error:`, error.message);
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
  if (!supabase) return false;
  try {
    const { error } = await supabase.from(CURRENT_TABLE).delete().eq('id', id);
    if (error) {
      console.warn(`[Supabase] Delete from ${CURRENT_TABLE} error:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] Delete exception:', err.message);
    return false;
  }
}

/**
 * Batch upload local tasks to Supabase
 */
export async function syncLocalTasksToSupabase(localTasks) {
  if (!supabase || !Array.isArray(localTasks) || localTasks.length === 0) return;
  try {
    const rows = localTasks.map(toDbRow);
    const { error } = await supabase.from(CURRENT_TABLE).upsert(rows);
    if (error) {
      console.warn(`[Supabase] Bulk sync to ${CURRENT_TABLE} error:`, error.message);
    }
  } catch (err) {
    console.warn('[Supabase] Bulk sync exception:', err.message);
  }
}

/**
 * Realtime subscription for multi-device sync
 */
export function subscribeToTaskChanges(onRemoteChange) {
  if (!supabase) return null;
  try {
    const channel = supabase
      .channel('todos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: CURRENT_TABLE },
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
