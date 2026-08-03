import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, History, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { ProductionResource, RecipeDto } from '@/types'
import { Button, ConfirmDialog, LoadingBlock, EmptyState } from '@/components/shared'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface RecipeLine {
  resource_id: string
  quantity: string
}

interface Props {
  menuItemId: number
  menuItemName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function RecipeBuilder({ menuItemId, menuItemName, open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const [lines, setLines] = useState<RecipeLine[]>([{ resource_id: '', quantity: '1' }])
  const [recipeName, setRecipeName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RecipeDto | null>(null)

  const { data: resources } = useQuery({
    queryKey: ['resources'],
    queryFn: async () => {
      const res = await api.get<{ data: ProductionResource[] }>('/resources')
      return res.data.data
    },
  })

  const { data: versions, isLoading } = useQuery({
    queryKey: ['recipes', menuItemId],
    queryFn: async () => {
      const res = await api.get<{ data: RecipeDto[] }>(`/menu-items/${menuItemId}/recipes`)
      return res.data.data
    },
    enabled: open,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['recipes', menuItemId] })
    queryClient.invalidateQueries({ queryKey: ['menu-items'] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = lines
        .filter((l) => l.resource_id)
        .map((l) => ({ production_resource_id: Number(l.resource_id), quantity: Number(l.quantity) }))
      await api.post(`/menu-items/${menuItemId}/recipes`, { name: recipeName, items })
    },
    onSuccess: () => {
      toast.success('Recipe version created and activated')
      setLines([{ resource_id: '', quantity: '1' }])
      setRecipeName('')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const activateMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      await api.post(`/recipes/${recipeId}/activate`)
    },
    onSuccess: () => {
      toast.success('Recipe version activated')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (recipeId: number) => {
      await api.delete(`/recipes/${recipeId}`)
    },
    onSuccess: () => {
      toast.success('Recipe version deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  useEffect(() => {
    if (open) invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const allLinesValid =
    lines.length > 0 &&
    lines.every((l) => l.resource_id && Number(l.quantity) > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recipe Builder — {menuItemName}</DialogTitle>
          <DialogDescription>
            Define the production resources consumed by this dish. New versions never change historical sales.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="new">
          <TabsList className="w-full">
            <TabsTrigger value="new" className="flex-1">
              <Plus className="size-4" /> New Version
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="size-4" /> Versions ({versions?.length ?? 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Version name (optional)</Label>
              <Input
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="e.g. New 2026 recipe"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Resource consumption</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((l) => [...l, { resource_id: '', quantity: '1' }])}
                >
                  <Plus className="size-4" /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={line.resource_id}
                      onValueChange={(v) =>
                        setLines((l) => l.map((x, i) => (i === idx ? { ...x, resource_id: v } : x)))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select resource" />
                      </SelectTrigger>
                      <SelectContent>
                        {resources?.map((r) => (
                          <SelectItem key={r.id} value={String(r.id)}>
                            {r.name} ({r.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      className="w-24"
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((l) => l.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={lines.length === 1}
                      onClick={() => setLines((l) => l.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                disabled={!allLinesValid || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating…' : 'Save new version'}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {isLoading ? (
              <LoadingBlock />
            ) : versions?.length === 0 ? (
              <EmptyState title="No recipe versions" description="Create the first version to enable sales of this item." />
            ) : (
              <div className="space-y-3">
                {versions?.map((v) => (
                  <div key={v.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{v.version}</span>
                        {v.is_current && <Badge variant="success">Current</Badge>}
                      </div>
                      {v.name && <div className="text-sm text-muted-foreground">{v.name}</div>}
                      <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                        {v.items.map((ri) => (
                          <li key={ri.recipe_item_id}>
                            {ri.resource} × {ri.quantity} {ri.unit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {!v.is_current && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateMutation.mutate(v.id)}
                        >
                          <CheckCircle2 className="size-4" /> Activate
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(v)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete recipe version?"
        description="This only works while the version is not referenced by any historical sale."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </Dialog>
  )
}
