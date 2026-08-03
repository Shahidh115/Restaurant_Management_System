import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ResourceTransaction } from '@/types'
import { todayISO, daysAgoISO, formatDateTime } from '@/lib/utils'
import { usePosData } from '@/hooks/useData'
import { PageHeader, LoadingBlock, EmptyState, TransactionBadge } from '@/components/shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function TransactionsPage() {
  const [from, setFrom] = useState(daysAgoISO(6))
  const [to, setTo] = useState(todayISO())
  const [page, setPage] = useState(1)
  const { data: posData } = usePosData()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['transactions', from, to, page],
    queryFn: async () => {
      const res = await api.get<{ data: { items: ResourceTransaction[]; pagination: { current_page: number; last_page: number; total: number } } }>('/transactions', {
        params: { from, to, page, per_page: 20 },
      })
      return res.data.data
    },
    placeholderData: (prev) => prev,
  })

  return (
    <div>
      <PageHeader
        title="Resource transactions"
        description="Every movement of production resources."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="w-40" aria-label="From date" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="w-40" aria-label="To date" />
          </div>
        }
      />

      {posData && posData.resources.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {posData.resources.map((r) => (
            <Badge key={r.id} variant={r.is_low ? 'warning' : 'secondary'}>
              {r.name}: <span className="ml-1 tabular-nums">{r.current_balance}</span>
            </Badge>
          ))}
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <LoadingBlock label="Loading transactions…" />
        ) : data && data.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(t.created_at)}</TableCell>
                    <TableCell className="font-medium">{t.resource}</TableCell>
                    <TableCell><TransactionBadge type={t.type} /></TableCell>
                    <TableCell className={cn('text-right tabular-nums font-medium', t.quantity > 0 ? 'text-success' : 'text-destructive')}>
                      {t.quantity > 0 ? '+' : ''}{t.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{t.balance_after}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">{t.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.pagination.last_page > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                <span>Page {data.pagination.current_page} of {data.pagination.last_page} · {data.pagination.total} entries</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= data.pagination.last_page || isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No transactions" description="Try a wider date range." />
        )}
      </Card>
    </div>
  )
}
