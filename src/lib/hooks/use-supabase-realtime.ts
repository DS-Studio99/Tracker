import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RealtimeOptions {
  column: string;
  value: string;
}

export function useSupabaseRealtime(
  tableName: string,
  filter?: RealtimeOptions,
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  useEffect(() => {
    const supabase = createClient()
    
    let filterString: string | undefined = undefined
    if (filter?.column && filter?.value) {
      filterString = `${filter.column}=eq.${filter.value}`
    }

    const channel = supabase
      .channel(`public_${tableName}_${filterString || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: filterString,
        },
        (payload) => {
          if (onInsert) onInsert(payload)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: tableName,
          filter: filterString,
        },
        (payload) => {
          if (onUpdate) onUpdate(payload)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: tableName,
          filter: filterString,
        },
        (payload) => {
          if (onDelete) onDelete(payload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableName, filter?.column, filter?.value, onInsert, onUpdate, onDelete])
}
