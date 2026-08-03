import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search, Plus, Minus, Trash2, ReceiptText, PauseCircle,
  Hash, X,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { MenuItem, Bill } from '@/types'
import { usePosData } from '@/hooks/useData'
import { useCartStore, cartTotal, type CartLine } from '@/stores/useCartStore'
import { LoadingBlock, Button, Money } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ReceiptPrint } from '@/components/ReceiptPrint'

type SalePayload = {
  items: { menu_item_id: number; quantity: number }[]
  discount: number
  payment_type: string
}

function CategoryTabs({
  categories,
  value,
  onChange,
}: {
  categories: { id: number; name: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
        <TabsTrigger value="all">All</TabsTrigger>
        {categories.map((c) => (
          <TabsTrigger key={c.id} value={String(c.id)}>{c.name}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function ItemGrid({
  items,
  onAdd,
}: {
  items: MenuItem[]
  onAdd: (item: MenuItem, qty?: number) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const isLow = item.max_preparable <= 5
        const isOut = item.max_preparable <= 0

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onAdd(item)}
            disabled={isOut}
            className={cn(
              'group flex flex-col rounded-xl border p-3 text-left transition-all relative overflow-hidden',
              isOut
                ? 'cursor-not-allowed border-2 border-red-500/80 bg-red-500/10 text-red-500 opacity-70'
                : isLow
                  ? 'border-2 border-red-500 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.25)] hover:bg-red-500/10'
                  : 'bg-card hover:border-primary/60 hover:bg-accent'
            )}
          >
            {isLow && (
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg shadow-sm">
                {isOut ? 'SOLD OUT' : 'LOW STOCK'}
              </div>
            )}
            {item.is_favourite && <Badge variant="warning" className="mb-1 w-fit">★</Badge>}
            <div className="flex size-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="size-full rounded-lg object-cover" />
              ) : (
                <ReceiptText className="size-6" />
              )}
            </div>
            <div className="mt-2 truncate text-sm font-medium">{item.name}</div>
            <div className="mt-1 flex items-center justify-between">
              <Money value={item.price} className="text-xs" />
              <span className={cn('text-[11px] font-semibold', isLow ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                {item.max_preparable > 0 ? `×${item.max_preparable}` : 'Sold out'}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default function PosPage() {
  const queryClient = useQueryClient()
  const { data: posData, isLoading } = usePosData()

  const cart = useCartStore()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [barcode, setBarcode] = useState('')
  const [paymentType, setPaymentType] = useState(cart.paymentType)
  const [discount, setDiscount] = useState(cart.discount.toString())
  const [receipt, setReceipt] = useState<Bill | null>(null)
  const [holding, setHolding] = useState<string | null>(null)

  const invalidatePos = () => {
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const subtotal = cartTotal(cart.lines)
  const discountNum = Number(discount) || 0
  const taxRate = posData?.settings.tax_rate ?? 0
  const taxable = Math.max(0, subtotal - discountNum)
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100
  const total = Math.round((taxable + taxAmount) * 100) / 100

  useEffect(() => {
    cart.setPaymentType(paymentType)
  }, [paymentType]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cart.setDiscount(discountNum)
  }, [discountNum]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredItems = useMemo(() => {
    if (!posData) return []
    let items = posData.menu_items
    if (category !== 'all') items = items.filter((i) => i.category_id === Number(category))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      items = items.filter((i) => i.name.toLowerCase().includes(q))
    }
    return items
  }, [posData, category, search])

  const saleMutation = useMutation({
    mutationFn: async (payload: SalePayload) => {
      const res = await api.post<{ data: Bill }>('/pos/sale', payload)
      return res.data.data
    },
    onSuccess: (bill) => {
      toast.success('Sale completed')
      setReceipt(bill)
      cart.clear()
      setDiscount('')
      invalidatePos()
    },
    onError: (e: { message: string; data?: unknown }) => {
      const maxQty = (e.data as { max_quantity?: number } | undefined)?.max_quantity
      toast.error(maxQty ? `${e.message} (max ${maxQty})` : e.message)
    },
  })

  const holdMutation = useMutation({
    mutationFn: async (payload: SalePayload) => {
      const res = await api.post<{ data: { id: number; hold_code: string } }>('/pos/hold', payload)
      return res.data.data
    },
    onSuccess: (res) => {
      toast.success(`Order held · ${res.hold_code}`)
      cart.clear()
      setDiscount('')
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const { data: holds } = useQuery({
    queryKey: ['pos-holds'],
    queryFn: async () => {
      const res = await api.get<{ data: Bill[] }>('/pos/holds')
      return res.data.data
    },
    refetchInterval: 30_000,
  })

  const completeHoldMutation = useMutation({
    mutationFn: async ({ code, payload }: { code: string; payload: SalePayload }) => {
      const res = await api.post<{ data: Bill }>(`/pos/holds/${code}/complete`, payload)
      return res.data.data
    },
    onSuccess: (bill) => {
      toast.success('Held order completed')
      setReceipt(bill)
      cart.clear()
      setDiscount('')
      setHolding(null)
      queryClient.invalidateQueries({ queryKey: ['pos-holds'] })
      invalidatePos()
    },
    onError: (e: { message: string; data?: unknown }) => {
      const maxQty = (e.data as { max_quantity?: number } | undefined)?.max_quantity
      toast.error(maxQty ? `${e.message} (max ${maxQty})` : e.message)
    },
  })

  const discardHoldMutation = useMutation({
    mutationFn: async (code: string) => {
      await api.delete(`/pos/holds/${code}`)
    },
    onSuccess: () => {
      toast.success('Held order discarded')
      queryClient.invalidateQueries({ queryKey: ['pos-holds'] })
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  if (isLoading) return <LoadingBlock label="Loading POS…" />

  const activeHold = holds?.find((h) => h.hold_code === holding)
  const cartLines: CartLine[] = cart.lines

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
      {/* Menu panel */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Hash className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-44 pl-9"
              placeholder="Item # / barcode"
              value={barcode}
              onChange={(e) => {
                setBarcode(e.target.value)
                const id = Number(e.target.value)
                const item = posData?.menu_items.find((i) => i.id === id)
                if (item) {
                  cart.addItem(item)
                  setBarcode('')
                }
              }}
            />
          </div>
        </div>

        <div className="mb-3">
          <CategoryTabs
            categories={posData?.categories ?? []}
            value={category}
            onChange={setCategory}
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No menu items in this view.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <ItemGrid items={filteredItems} onAdd={(item, qty) => cart.addItem(item, qty)} />
          </ScrollArea>
        )}

        {holds && holds.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <span className="text-xs font-medium text-muted-foreground">Held orders:</span>
            {holds.map((h) => (
              <Badge
                key={h.hold_code}
                variant="secondary"
                className="cursor-pointer py-1.5 text-sm"
                onClick={() => {
                  setHolding(h.hold_code!)
                  cart.replaceWith(
                    h.items.map((i) => ({
                      menu_item_id: i.menu_item_id,
                      name: i.name,
                      price: i.unit_price,
                      quantity: i.quantity,
                    }))
                  )
                  setPaymentType(h.payment_type)
                }}
              >
                <PauseCircle className="size-3.5" /> {h.hold_code}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Cart panel */}
      <section className="xl:sticky xl:top-20 self-start">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Order</CardTitle>
              <Badge variant="outline">{cartLines.reduce((s, l) => s + l.quantity, 0)} items</Badge>
            </div>
          </CardHeader>

          {activeHold && (
            <div className="flex items-center justify-between gap-2 px-4">
              <Badge variant="warning">Resuming hold {activeHold.hold_code}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  discardHoldMutation.mutate(activeHold.hold_code!)
                  setHolding(null)
                  cart.clear()
                  setDiscount('')
                }}
              >
                <Trash2 className="size-3.5" /> Discard
              </Button>
            </div>
          )}

          <CardContent className="space-y-3 px-4">
            {cartLines.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Cart is empty.
                <br />Tap an item to add it.
              </div>
            ) : (
              <div className="space-y-2">
                {cartLines.map((line) => (
                  <div key={line.menu_item_id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{line.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <Money value={line.price} /> each
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="icon-sm" onClick={() => cart.setQuantity(line.menu_item_id, line.quantity - 1)}>
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                      <Button variant="outline" size="icon-sm" onClick={() => cart.setQuantity(line.menu_item_id, line.quantity + 1)}>
                        <Plus className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => cart.removeItem(line.menu_item_id)} className="text-destructive">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{cartLines.length ? <Money value={subtotal} /> : '—'}</span>
              </div>
              {discountNum > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span className="tabular-nums">-<Money value={discountNum} /></span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({taxRate}%)</span>
                  <span className="tabular-nums"><Money value={taxAmount} /></span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="tabular-nums"><Money value={total} /></span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Discount</div>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Payment</div>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                disabled={cartLines.length === 0 || holdMutation.isPending}
                onClick={() =>
                  holdMutation.mutate({
                    items: cartLines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
                    discount: discountNum,
                    payment_type: paymentType,
                  })
                }
              >
                <PauseCircle className="size-4" /> Hold
              </Button>
              <Button
                disabled={cartLines.length === 0 || saleMutation.isPending || completeHoldMutation.isPending}
                onClick={() => {
                  const payload = {
                    items: cartLines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
                    discount: discountNum,
                    payment_type: paymentType,
                  }
                  if (activeHold) completeHoldMutation.mutate({ code: activeHold.hold_code!, payload })
                  else saleMutation.mutate(payload)
                }}
                size="lg"
              >
                <ReceiptText className="size-4" /> {activeHold ? 'Complete Hold' : 'Charge'}
              </Button>
            </div>

            {cartLines.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full text-destructive" onClick={cart.clear}>
                <X className="size-4" /> Clear cart
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{posData?.settings.restaurant_name ?? 'Receipt'}</DialogTitle>
            <DialogDescription className="text-center">
              {receipt?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          {receipt && <ReceiptPrint bill={receipt} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
