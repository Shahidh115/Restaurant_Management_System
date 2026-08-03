import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Archive, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { api } from '@/lib/api'
import type { ProductionResource } from '@/types'
import { PageHeader, ConfirmDialog, LoadingBlock, EmptyState, Button } from '@/components/shared'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const UNIT_OPTIONS = ['Portion', 'Piece', 'Kg', 'Gram', 'Litre']

interface ResourceForm {
  id?: number
  name: string
  unit: string
  warning_level: number
}

export default function ResourcesPage() {
  const queryClient = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState<ResourceForm | null>(null)
  const [adjust, setAdjust] = useState<ProductionResource | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ProductionResource | null>(null)

  const { data: resources, isLoading } = useQuery({
    queryKey: ['resources', showArchived],
    queryFn: async () => {
      const res = await api.get<{ data: ProductionResource[] }>('/resources', {
        params: { archived: showArchived },
      })
      return res.data.data
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['resources'] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: ResourceForm) => {
      if (values.id) {
        await api.put(`/resources/${values.id}`, values)
      } else {
        await api.post('/resources', values)
      }
    },
    onSuccess: () => {
      toast.success(form?.id ? 'Resource updated' : 'Resource created')
      setForm(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/resources/${id}/archive`)
    },
    onSuccess: () => {
      toast.success('Resource archived')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const restoreMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/resources/${id}/restore`)
    },
    onSuccess: () => {
      toast.success('Resource restored')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const adjustMutation = useMutation({
    mutationFn: async ({ id, quantity, note }: { id: number; quantity: number; note?: string }) => {
      await api.post(`/resources/${id}/adjust`, { quantity, note })
    },
    onSuccess: () => {
      toast.success('Adjustment recorded')
      setAdjust(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  if (isLoading) return <LoadingBlock label="Loading resources…" />

  return (
    <div>
      <PageHeader
        title="Production Resources"
        description="Raw materials the kitchen prepares daily. Menu items consume these resources."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </Button>
            <Button onClick={() => setForm({ name: '', unit: 'Portion', warning_level: 0 })}>
              <Plus className="size-4" /> New Resource
            </Button>
          </>
        }
      />

      {resources?.length === 0 ? (
        <EmptyState
          title="No resources yet"
          description="Create your first production resource, e.g. Rice Portion."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Warning Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.unit}</TableCell>
                  <TableCell>
                    <span className="font-semibold tabular-nums">{r.current_balance}</span>
                    <span className="text-muted-foreground"> {r.unit}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.warning_level}</TableCell>
                  <TableCell>
                    {r.archived_at ? (
                      <Badge variant="muted">Archived</Badge>
                    ) : r.is_low ? (
                      <Badge variant="warning">Low</Badge>
                    ) : (
                      <Badge variant="success">Ready</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.archived_at && (
                      <Button variant="ghost" size="icon-sm" onClick={() => setAdjust(r)} title="Adjust balance">
                        <SlidersHorizontal className="size-4" />
                      </Button>
                    )}
                    {!r.archived_at && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setForm({ id: r.id, name: r.name, unit: r.unit, warning_level: Number(r.warning_level) })}
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {!r.archived_at ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => setArchiveTarget(r)} title="Archive">
                        <Archive className="size-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => restoreMutation.mutate(r.id)} title="Restore">
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit Resource' : 'New Resource'}</DialogTitle>
            <DialogDescription>
              Configure the production resource and its warning level.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!form) return
              saveMutation.mutate(form)
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                autoFocus
                required
                value={form?.name ?? ''}
                onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                placeholder="e.g. Rice Portion"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={form?.unit ?? 'Portion'} onValueChange={(v) => setForm((f) => (f ? { ...f, unit: v } : f))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Warning Level</Label>
              <Input
                type="number"
                min={0}
                value={form?.warning_level ?? 0}
                onChange={(e) => setForm((f) => (f ? { ...f, warning_level: Number(e.target.value) } : f))}
              />
              <p className="text-xs text-muted-foreground">
                When balance drops to this level the resource is flagged as low.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {form?.id ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjust} onOpenChange={(o) => !o && setAdjust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Balance</DialogTitle>
            <DialogDescription>
              {adjust?.name} currently has {adjust?.current_balance} {adjust?.unit}. Add or subtract to correct the count.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              if (!adjust) return
              adjustMutation.mutate({
                id: adjust.id,
                quantity: Number(fd.get('quantity')),
                note: String(fd.get('note') ?? ''),
              })
            }}
          >
            <div className="space-y-2">
              <Label>Quantity (negative to deduct)</Label>
              <Input name="quantity" type="number" step="any" required placeholder="e.g. -3 or 10" />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input name="note" placeholder="Optional note" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={adjustMutation.isPending}>Save adjustment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive resource?"
        description={`${archiveTarget?.name} will be hidden from new orders. Historical records stay intact.`}
        confirmLabel="Archive"
        destructive
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
        loading={archiveMutation.isPending}
      />
    </div>
  )
}
