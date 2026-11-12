import { supabase } from './supabase';

export type SyncTable = 'products' | 'orders' | 'delivery_slips' | 'debt_payments';

export async function fetchCollection<T>(table: SyncTable): Promise<T[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(table)
      .select('data')
      .order('updated_at', { ascending: false });
    if (error || !data) return null;
    return data.map((row) => row.data as T);
  } catch {
    return null;
  }
}

export async function upsertRecord<T>(table: SyncTable, id: string, data: T): Promise<void> {
  if (!supabase || !id) return;
  try {
    await supabase.from(table).upsert(
      { id, data, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  } catch {
    // Non-blocking sync; local state remains authoritative for offline fallback
  }
}

export async function upsertMany<T>(
  table: SyncTable,
  items: Array<{ id: string; data: T }>,
): Promise<void> {
  if (!supabase || items.length === 0) return;
  try {
    const now = new Date().toISOString();
    await supabase.from(table).upsert(
      items.map((item) => ({ id: item.id, data: item.data, updated_at: now })),
      { onConflict: 'id' },
    );
  } catch {
    // Non-blocking sync
  }
}

export async function deleteRecord(table: SyncTable, id: string): Promise<void> {
  if (!supabase || !id) return;
  try {
    await supabase.from(table).delete().eq('id', id);
  } catch {
    // Non-blocking sync
  }
}

export async function clearTable(table: SyncTable): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from(table).delete().neq('id', '');
  } catch {
    // Non-blocking sync
  }
}

export function subscribeTableChanges(
  table: SyncTable,
  onChange: () => void,
): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`sync-${table}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => onChange(),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
