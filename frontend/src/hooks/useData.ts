import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DashboardData, PosData, SettingsData } from '@/types'

export function usePosData() {
  return useQuery({
    queryKey: ['pos-data'],
    queryFn: async () => {
      const res = await api.get<{ data: PosData }>('/pos/data')
      return res.data.data
    },
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<{ data: DashboardData }>('/dashboard')
      return res.data.data
    },
    refetchInterval: 60_000,
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get<{ data: SettingsData }>('/settings')
      return res.data.data
    },
    staleTime: 60_000,
  })
}
