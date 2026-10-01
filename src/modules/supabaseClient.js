// Supabase Client, Auth & Database Sync Module
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

// Target table name: defaults to 'todos' with user_id and RLS policies
export let CURRENT_TABLE = 'todos';

/**
 * Check if active table exists (prioritizes 'todos', falls back to 'tasks' if needed)
 */
export async function resolveActiveTable() {
  if (!supabase) return CURRENT_TABLE;
  try {
    const { error: todosErr } = await supabase.from('todos').select('id').limit(1);
    if (!todosErr) {
      CURRENT_TABLE = 'todos';
      return 'todos';
    }
    const { error: tasksErr } = await supabase.from('tasks').select('id').limit(1);
    if (!tasksErr) {
      CURRENT_TABLE = 'tasks';
      return 'tasks';
    }
  } catch (err) {
    console.warn('[Supabase] resolveActiveTable error:', err.message);
  }
  return CURRENT_TABLE;
}

// ==========================================
// Authentication APIs
// ==========================================

/**
 * Sign up with Email and Password
 */
export async function signUpUser(email, password) {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with Email and Password
 */
export async function signInUser(email, password) {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current active session
 */
export async function getCurrentSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/**
 * Subscribe to auth state changes (login, logout, token refresh)
 */
export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((event, session) => {
    if (typeof callback === 'function') {
      callback(event, session);
    }
  });
}

// ==========================================
// Data Mapping & Database Sync APIs
// ==========================================

// Helper to convert app Task model to Supabase DB Row
export function toDbRow(task, userId) {
  const row = {
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
  const effectiveUserId = userId || task.user_id || task.userId;
  if (effectiveUserId) {
    row.user_id = effectiveUserId;
  }
  return row;
}

// Helper to convert Supabase DB Row to app Task model
export function fromDbRow(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
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
 * Fetch tasks for current logged-in user from Supabase
 */
export async function fetchTasksFromSupabase(userId) {
  if (!supabase) return null;
  try {
    await resolveActiveTable();
    let query = supabase
      .from(CURRENT_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    // Explicitly filter by user_id if supplied (RLS also automatically enforces this)
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
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
export async function upsertTaskToSupabase(task, userId) {
  if (!supabase) return false;
  try {
    const row = toDbRow(task, userId);
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
 * Batch upload local tasks to Supabase for a specific user
 */
export async function syncLocalTasksToSupabase(localTasks, userId) {
  if (!supabase || !Array.isArray(localTasks) || localTasks.length === 0) return;
  try {
    const rows = localTasks.map(t => toDbRow(t, userId));
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
export function subscribeToTaskChanges(userId, onRemoteChange) {
  if (!supabase) return null;
  try {
    const channel = supabase
      .channel(`todos-realtime-${userId || 'all'}`)
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
