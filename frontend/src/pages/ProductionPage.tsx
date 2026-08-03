import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, History, AlertTriangle, Factory } from 'lucide-react'
import { api } from '@/lib/api'
import { todayISO } from '@/lib/utils'
import { usePosData } from '@/hooks/useData'
import {
  PageHeader, LoadingBlock, ConfirmDialog, EmptyState, Button,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface OpeningRow {
  resource_id: number
  resource: string
  unit: string
  opening_quantity: number | null
  current_balance: number
  date: string
}

interface HistoryEntry {
  id: string | number
  resource_id: number
  resource: string
  unit: string
  quantity: number
  type: string
  note: string | null
  created_at: string
}

function formatTimeOnly(iso?: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.includes(' ') ? iso.replace(' ', 'T') : iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

const QUICK_ADD = [10, 20, 30, 50]

export default function ProductionPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayISO())
  const [openings, setOpenings] = useState<Record<number, string>>({})
  const [customAdd, setCustomAdd] = useState<{ resourceId: number; name: string; unit: string } | null>(null)
  const [customQty, setCustomQty] = useState('')
  const [confirmReset, setConfirmReset] = useState<number | null>(null)

  const { data: posData, isLoading: posLoading, isError: posError } = usePosData()
  const resources = posData?.resources ?? []

  const { data: openingData, isLoading: openingLoading, isError: openingError } = useQuery({
    queryKey: ['production-opening', date],
    queryFn: async () => {
      const res = await api.get<{ data: OpeningRow[] }>('/production/opening', { params: { date } })
      return res.data.data
    },
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['production-history', date],
    queryFn: async () => {
      const res = await api.get<{ data: HistoryEntry[] }>('/production/history', { params: { date } })
      return res.data.data
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['production-opening', date] })
    queryClient.invalidateQueries({ queryKey: ['production-history', date] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['resources'] })
  }

  const setOpeningMutation = useMutation({
    mutationFn: async (payload: { production_resource_id: number; quantity: number; date?: string }) => {
      await api.post('/production/opening', payload)
    },
    onSuccess: () => {
      toast.success('Opening quantity saved')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const quickAddMutation = useMutation({
    mutationFn: async ({ resourceId, quantity }: { resourceId: number; quantity: number }) => {
      await api.post(`/production/resources/${resourceId}/quick-add`, { quantity })
    },
    onSuccess: () => {
      toast.success('Production added')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const addMutation = useMutation({
    mutationFn: async ({ resourceId, quantity }: { resourceId: number; quantity: number }) => {
      await api.post('/production/add', { production_resource_id: resourceId, quantity, note: 'Manual entry' })
    },
    onSuccess: () => {
      toast.success('Production added')
      setCustomAdd(null)
      setCustomQty('')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const resetOpeningMutation = useMutation({
    mutationFn: async (resourceId: number) => {
      await api.post('/production/opening', { production_resource_id: resourceId, quantity: 0, date })
    },
    onSuccess: () => {
      toast.success('Opening quantity reset')
      setConfirmReset(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const merged = useMemo(() => {
    if (!resources.length) return []
    const openingMap = new Map(openingData?.map((r) => [r.resource_id, r]) ?? [])
    return resources.map((r) => {
      const opening = openingMap.get(r.id)
      return {
        ...r,
        opening_quantity: opening?.opening_quantity ?? 0,
        current_balance: opening?.current_balance ?? r.current_balance,
      }
    })
  }, [resources, openingData])

  const isLoading = posLoading || openingLoading
  const isError = posError || openingError

  if (isLoading) return <LoadingBlock label="Loading production…" />

  if (isError) {
    return (
      <div className="py-12">
        <PageHeader title="Daily Production" description="Set opening stock and record production batches." />
        <EmptyState
          title="Unable to load production data"
          description="Make sure the Laravel backend server is running (php artisan serve)."
          action={<Button onClick={() => invalidate()}>Retry</Button>}
        />
      </div>
    )
  }

  const historyList = Array.isArray(historyData) ? historyData : []

  const summary = historyList.reduce(
    (acc, e) => {
      acc.total += e.quantity
      if (e.type === 'PRODUCTION') acc.produced += e.quantity
      return acc
    },
    { total: 0, produced: 0 }
  )

  return (
    <div>
      <PageHeader
        title="Daily Production"
        description="Set opening stock and record production batches."
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
            aria-label="Production date"
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="size-4 text-primary" /> Daily Production & Stock Management
          </CardTitle>
          <CardDescription>
            Set opening stock or add new production batches for {date}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {merged.length === 0 ? (
            <EmptyState title="No resources" description="Add production resources first under Resources page." />
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource & Current Balance</TableHead>
                    <TableHead className="w-56">Opening Stock</TableHead>
                    <TableHead className="text-right">Add Production (Top Up)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merged.map((r) => {
                    const qtyVal = openings[r.id] ?? String(r.opening_quantity ?? 0)
                    const numVal = Number(openings[r.id] ?? r.opening_quantity ?? 0)
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{r.name}</span>
                            {r.is_low && <Badge variant="warning">Low stock</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Current Stock: <span className="font-bold text-foreground">{r.current_balance}</span> {r.unit}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={0}
                              className="w-24 text-right"
                              value={qtyVal}
                              onChange={(e) => setOpenings((o) => ({ ...o, [r.id]: e.target.value }))}
                              aria-label={`Opening quantity for ${r.name}`}
                            />
                            <Button
                              size="sm"
                              variant={numVal === 0 ? 'outline' : 'default'}
                              onClick={() =>
                                setOpeningMutation.mutate({
                                  production_resource_id: r.id,
                                  quantity: numVal || 0,
                                  date,
                                })
                              }
                              disabled={setOpeningMutation.isPending}
                            >
                              Set
                            </Button>
                            {numVal !== 0 && (
                              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(r.id)} title="Reset opening to 0">
                                <AlertTriangle className="size-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {QUICK_ADD.map((q) => (
                              <Button
                                key={q}
                                size="sm"
                                variant="outline"
                                onClick={() => quickAddMutation.mutate({ resourceId: r.id, quantity: q })}
                                disabled={quickAddMutation.isPending}
                              >
                                +{q}
                              </Button>
                            ))}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setCustomAdd({ resourceId: r.id, name: r.name, unit: r.unit })}
                            >
                              <Plus className="size-3.5 mr-1" /> Custom
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4" /> Activity on {date}
          </CardTitle>
          <CardDescription>
            {summary.total} total units recorded · {summary.produced} produced
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <LoadingBlock label="Loading history…" />
          ) : historyList.length > 0 ? (
            <div className="space-y-2">
              {historyList.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.resource}</span>
                    <Badge variant={e.type === 'OPENING' ? 'default' : 'success'}>
                      {e.type === 'OPENING' ? 'Opening' : 'Production'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-success font-semibold">+{e.quantity} {e.unit}</span>
                    <span className="hidden text-xs sm:inline">{formatTimeOnly(e.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No production activity" description="Record opening quantities or add production for this day." />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!customAdd} onOpenChange={(o) => !o && setCustomAdd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Production</DialogTitle>
            <DialogDescription>
              {customAdd?.name} · {customAdd?.unit}s
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={0}
              autoFocus
              value={customQty}
              onChange={(e) => setCustomQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customAdd) {
                  addMutation.mutate({ resourceId: customAdd.resourceId, quantity: Number(customQty) })
                }
              }}
              placeholder="e.g. 25"
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!customQty || Number(customQty) <= 0 || addMutation.isPending}
              onClick={() => customAdd && addMutation.mutate({ resourceId: customAdd.resourceId, quantity: Number(customQty) })}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmReset}
        onOpenChange={(o) => !o && setConfirmReset(null)}
        title="Reset opening quantity?"
        description="This sets the opening production for this resource to 0. The live balance is not changed."
        confirmLabel="Reset"
        destructive
        loading={resetOpeningMutation.isPending}
        onConfirm={() => confirmReset && resetOpeningMutation.mutate(confirmReset)}
      />
    </div>
  )
}
