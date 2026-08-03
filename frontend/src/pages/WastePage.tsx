import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PackageMinus, AlertTriangle, Utensils, Package } from 'lucide-react'
import { api } from '@/lib/api'
import type { Waste, MenuItem, RecipeItemDto } from '@/types'
import { todayISO, daysAgoISO, formatDateTime } from '@/lib/utils'
import { usePosData } from '@/hooks/useData'
import {
  PageHeader, LoadingBlock, EmptyState, Button,
} from '@/components/shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const WASTE_TYPES = ['STAFF_MEAL', 'BURNT', 'SPOILED', 'DAMAGED', 'MANUAL']

const typeLabel: Record<string, string> = {
  STAFF_MEAL: 'Staff meal',
  BURNT: 'Burnt',
  SPOILED: 'Spoiled',
  DAMAGED: 'Damaged',
  MANUAL: 'Manual',
}

export default function WastePage() {
  const queryClient = useQueryClient()
  const { data: posData, isLoading: posLoading } = usePosData()

  const [from, setFrom] = useState(daysAgoISO(6))
  const [to, setTo] = useState(todayISO())
  const [open, setOpen] = useState(false)

  const [deductMode, setDeductMode] = useState<'menu_item' | 'resource'>('menu_item')
  const [menuItemId, setMenuItemId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [type, setType] = useState('STAFF_MEAL')
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')

  const { data: wastes, isLoading } = useQuery({
    queryKey: ['wastes', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: Waste[] }>('/wastes', { params: { from, to } })
      return res.data.data
    },
  })

  const recordMutation = useMutation({
    mutationFn: async () => {
      const payload = deductMode === 'menu_item'
        ? { menu_item_id: Number(menuItemId), type, quantity: Number(quantity), note: note || null }
        : { production_resource_id: Number(resourceId), type, quantity: Number(quantity), note: note || null }

      const res = await api.post('/wastes', payload)
      return res.data
    },
    onSuccess: () => {
      toast.success('Stock deduction recorded and inventory updated')
      setOpen(false)
      setMenuItemId('')
      setResourceId('')
      setQuantity('1')
      setNote('')
      queryClient.invalidateQueries({ queryKey: ['wastes'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const totalWasted = wastes?.reduce((s, w) => s + w.quantity, 0) ?? 0

  if (posLoading) return <LoadingBlock label="Loading menu items & resources…" />

  const resources = posData?.resources ?? []
  const menuItems: MenuItem[] = posData?.menu_items ?? []
  const selectedMenuItem = menuItems.find((i: MenuItem) => String(i.id) === menuItemId)

  const isValid = deductMode === 'menu_item'
    ? !!menuItemId && Number(quantity) > 0
    : !!resourceId && Number(quantity) > 0

  return (
    <div>
      <PageHeader
        title="Stock Deductions & Usage"
        description="Record non-sale stock deductions including staff meals, spoilage, or damaged items by Menu Item."
        actions={
          <Button onClick={() => setOpen(true)} disabled={menuItems.length === 0 && resources.length === 0}>
            <PackageMinus className="size-4" /> Record deduction
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
        <span className="text-muted-foreground">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
        <Badge variant="warning" className="ml-auto">
          <AlertTriangle className="size-3.5" /> {totalWasted} units deducted
        </Badge>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <LoadingBlock label="Loading deductions…" />
        ) : wastes && wastes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Reason / Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Note / Dish</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wastes.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.resource}</TableCell>
                  <TableCell>
                    <Badge variant={w.type === 'STAFF_MEAL' ? 'default' : 'warning'}>
                      {typeLabel[w.type] ?? w.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">-{w.quantity} {w.unit}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">{w.note ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(w.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No deductions recorded" description="Record staff meals or stock discards to keep inventory accurate." />
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Stock Deduction</DialogTitle>
            <DialogDescription>Deduct staff meals or stock usage by Menu Item or Raw Resource.</DialogDescription>
          </DialogHeader>

          <Tabs value={deductMode} onValueChange={(v) => setDeductMode(v as 'menu_item' | 'resource')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="menu_item" className="flex items-center gap-1.5">
                <Utensils className="size-3.5" /> By Menu Item
              </TabsTrigger>
              <TabsTrigger value="resource" className="flex items-center gap-1.5">
                <Package className="size-3.5" /> By Raw Resource
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              {deductMode === 'menu_item' ? (
                <div className="space-y-2">
                  <Label>Menu Item / Dish</Label>
                  <Select value={menuItemId} onValueChange={setMenuItemId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select dish (e.g. Chicken Fried Rice)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {menuItems.map((item: MenuItem) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name} {item.category ? `(${item.category})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedMenuItem && (
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs">
                      {selectedMenuItem.recipe && selectedMenuItem.recipe.items.length > 0 ? (
                        <div>
                          <span className="font-semibold text-foreground">Recipe Ingredients:</span>{' '}
                          {selectedMenuItem.recipe.items
                            .map((ri: RecipeItemDto) => `${(ri.quantity * (Number(quantity) || 1)).toFixed(1)} ${ri.unit} ${ri.resource}`)
                            .join(', ')}
                        </div>
                      ) : (
                        <span className="text-warning font-medium">⚠️ No recipe configured for this menu item yet.</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Raw Resource</Label>
                  <Select value={resourceId} onValueChange={setResourceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select raw resource" />
                    </SelectTrigger>
                    <SelectContent>
                      {resources.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name} ({r.current_balance} {r.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Reason / Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WASTE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{deductMode === 'menu_item' ? 'Portion Count' : 'Quantity'}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note / Staff Member</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={type === 'STAFF_MEAL' ? 'e.g. Dinner for Chef Rahul' : 'Optional note'}
                  className="h-20"
                />
              </div>
            </div>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button
              disabled={!isValid || recordMutation.isPending}
              onClick={() => recordMutation.mutate()}
            >
              Record Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
