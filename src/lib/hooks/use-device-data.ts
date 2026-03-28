import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useDeviceStore } from '@/lib/stores/device-store'

interface UseDeviceDataOptions {
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
  enabled?: boolean;
  dateColumn?: string;
  dateRange?: { from?: Date; to?: Date };
  searchQuery?: string;
  searchColumns?: string[];
  notNullColumn?: string;
}

export function useDeviceData<T>(tableName: string, options: UseDeviceDataOptions = {}) {
  const { 
    pageSize = 20, 
    orderBy = 'created_at', 
    orderDirection = 'desc', 
    filters = {}, 
    enabled = true 
  } = options
  
  const [page, setPage] = useState(0)
  const selectedDeviceId = useDeviceStore((state) => state.selectedDeviceId)

  const queryKey = [tableName, selectedDeviceId, page, pageSize, orderBy, orderDirection, filters]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!selectedDeviceId) return { data: [], count: 0 }
      
      const supabase = createClient()

      let query = supabase
        .from(tableName as any)
        .select('*', { count: 'exact' })
        .eq('device_id', selectedDeviceId)

      // Apply extra filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })

      if (options.dateColumn && options.dateRange) {
        if (options.dateRange.from) {
          query = query.gte(options.dateColumn, options.dateRange.from.toISOString())
        }
        if (options.dateRange.to) {
          query = query.lte(options.dateColumn, options.dateRange.to.toISOString())
        }
      }

      if (options.searchQuery && options.searchColumns && options.searchColumns.length > 0) {
        const orQuery = options.searchColumns.map(col => `${col}.ilike.%${options.searchQuery}%`).join(',')
        query = query.or(orQuery)
      }

      if (options.notNullColumn) {
        query = query.not(options.notNullColumn, 'is', null)
      }

      // Pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      
      const { data, count, error } = await query
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(from, to)

      if (error) throw new Error(error.message)
      
      return { 
        data: data as T[], 
        count: count || 0 
      }
    },
    enabled: Boolean(selectedDeviceId) && enabled,
    staleTime: 1000 * 60, // 1 minute
  })

  return {
    data: data?.data || [],
    count: data?.count || 0,
    page,
    setPage,
    isLoading,
    error,
    refetch
  }
}
