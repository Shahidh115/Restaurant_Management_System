import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ReceiptText, X, Search } from 'lucide-react'
import { api } from '@/lib/api'
import type { Bill, Paginated } from '@/types'
import { todayISO } from '@/lib/utils'
import {
  PageHeader, LoadingBlock, EmptyState, Money, StatusBadge, ConfirmDialog,
} from '@/components/shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import { ReceiptPrint } from '@/components/ReceiptPrint'

export default function SalesPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Bill | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['bills', date, status, q, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, per_page: 15 }
      if (date) params.date = date
      if (status) params.status = status
      if (q.trim()) params.q = q.trim()
      const res = await api.get<{ data: Paginated<Bill> }>('/bills', { params })
      return res.data.data
    },
    placeholderData: (prev) => prev,
    refetchInterval: 5_000,
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post<{ data: Bill }>(`/bills/${id}/cancel`)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Bill cancelled and resources restored')
      setCancelTarget(null)
      queryClient.invalidateQueries({ queryKey: ['bills'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  return (
    <div>
      <PageHeader
        title="Sales"
        description="Browse and manage bills."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setPage(1) }}
                className="w-40"
                aria-label="Bill date"
              />
              {date && (
                <Button variant="ghost" size="icon-sm" onClick={() => { setDate(''); setPage(1) }} title="All dates">
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-44 pl-9"
                placeholder="Invoice #"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="hold">Held</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading ? (
        <LoadingBlock label="Loading sales…" />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((bill) => (
                  <TableRow key={bill.id} className={bill.status === 'cancelled' ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{bill.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(bill.created_at)}</TableCell>
                    <TableCell className="tabular-nums">{bill.item_count}</TableCell>
                    <TableCell><Money value={bill.total} /></TableCell>
                    <TableCell className="capitalize text-muted-foreground">{bill.payment_type}</TableCell>
                    <TableCell><StatusBadge status={bill.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(bill)}>
                        <ReceiptText className="size-4" /> View
                      </Button>
                      {bill.status === 'completed' && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelTarget(bill)}>
                          <X className="size-4" /> Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.pagination.last_page > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {data.pagination.current_page} of {data.pagination.last_page} · {data.pagination.total} bills
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pagination.last_page || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No bills found" description="Try a different date or clear filters." />
      )}

      {/* Bill detail & Printing */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{selected?.invoice_number}</DialogTitle>
            <DialogDescription className="text-center">
              {selected && formatDateTime(selected.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selected && <ReceiptPrint bill={selected} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel this bill?"
        description={`${cancelTarget?.invoice_number ?? ''} will be marked cancelled and all resources restored to stock. This cannot be undone.`}
        confirmLabel="Cancel bill"
        destructive
        loading={cancelMutation.isPending}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
      />
    </div>
  )
}
