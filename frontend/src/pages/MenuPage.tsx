import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Pencil, Archive, RotateCcw, ImagePlus, Star, ListChecks, UtensilsCrossed,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Category, MenuItem } from '@/types'
import {
  PageHeader, ConfirmDialog, LoadingBlock, EmptyState, Button, Money,
} from '@/components/shared'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RecipeBuilder from '@/components/RecipeBuilder'

interface ItemForm {
  id?: number
  name: string
  price: number
  category_id?: number
  description?: string
  sort_order?: number
}

interface CategoryForm {
  id?: number
  name: string
  description?: string
  sort_order?: number
}

export default function MenuPage() {
  const queryClient = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const [tab, setTab] = useState('items')
  const [itemForm, setItemForm] = useState<ItemForm | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null)
  const [recipeTarget, setRecipeTarget] = useState<MenuItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<{ kind: 'item' | 'category'; id: number; name: string } | null>(null)

  const { data: items, isLoading } = useQuery({
    queryKey: ['menu-items', showArchived],
    queryFn: async () => {
      const res = await api.get<{ data: MenuItem[] }>('/menu-items', { params: { archived: showArchived } })
      return res.data.data
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', showArchived],
    queryFn: async () => {
      const res = await api.get<{ data: Category[] }>('/categories', { params: { archived: showArchived } })
      return res.data.data
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['menu-items'] })
    queryClient.invalidateQueries({ queryKey: ['categories'] })
    queryClient.invalidateQueries({ queryKey: ['pos-data'] })
  }

  const saveItemMutation = useMutation({
    mutationFn: async (values: ItemForm) => {
      if (values.id) {
        const res = await api.put<{ data: MenuItem }>(`/menu-items/${values.id}`, values)
        return res.data.data
      } else {
        const res = await api.post<{ data: MenuItem }>('/menu-items', values)
        return res.data.data
      }
    },
    onSuccess: (savedItem, variables) => {
      const isNew = !variables.id
      toast.success(isNew ? 'Menu item created! Set up its recipe ingredients below.' : 'Menu item updated')
      setItemForm(null)
      invalidate()
      if (isNew && savedItem) {
        setRecipeTarget(savedItem)
      }
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      await api.put(`/menu-items/${id}`, { is_active })
    },
    onSuccess: () => {
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const toggleFavMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/menu-items/${id}/favourite`)
    },
    onSuccess: () => invalidate(),
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const archiveMutation = useMutation({
    mutationFn: async (target: { kind: 'item' | 'category'; id: number }) => {
      await api.post(`/${target.kind === 'item' ? 'menu-items' : 'categories'}/${target.id}/archive`)
    },
    onSuccess: () => {
      toast.success('Archived')
      setArchiveTarget(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const restoreMutation = useMutation({
    mutationFn: async ({ kind, id }: { kind: 'item' | 'category'; id: number }) => {
      await api.post(`/${kind === 'item' ? 'menu-items' : 'categories'}/${id}/restore`)
    },
    onSuccess: () => {
      toast.success('Restored')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const saveCategoryMutation = useMutation({
    mutationFn: async (values: CategoryForm) => {
      if (values.id) await api.put(`/categories/${values.id}`, values)
      else await api.post('/categories', values)
    },
    onSuccess: () => {
      toast.success('Category saved')
      setCategoryForm(null)
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const uploadImageMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const fd = new FormData()
      fd.append('image', file)
      await api.post(`/menu-items/${id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      toast.success('Image uploaded')
      invalidate()
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  if (isLoading) return <LoadingBlock label="Loading menu…" />

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Categories, menu items, and recipes."
        actions={
          <Button variant="outline" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="items">
            <UtensilsCrossed className="size-4" /> Menu Items
          </TabsTrigger>
          <TabsTrigger value="categories">
            <ListChecks className="size-4" /> Categories
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button
              onClick={() =>
                setItemForm({
                  name: '',
                  price: 0,
                  category_id: categories?.find((c) => !c.archived_at)?.id,
                  description: '',
                  sort_order: 0,
                })
              }
            >
              <Plus className="size-4" /> New Menu Item
            </Button>
          </div>

          {items?.length === 0 ? (
            <EmptyState title="No menu items" description="Create your first dish." />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Recipe</TableHead>
                    <TableHead>Max</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-muted">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="size-full object-cover" />
                            ) : (
                              <UtensilsCrossed className="size-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 font-medium">
                            {item.name}
                            {item.is_favourite && <Star className="size-3.5 fill-warning text-warning" />}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell><Money value={item.price} /></TableCell>
                      <TableCell>
                        {item.has_recipe ? (
                          <Badge variant="success">v{item.recipe_version}</Badge>
                        ) : (
                          <Badge variant="warning">No recipe</Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{item.max_preparable}</TableCell>
                      <TableCell>
                        <Switch
                          checked={item.is_active}
                          onCheckedChange={(v) => toggleActiveMutation.mutate({ id: item.id, is_active: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => setRecipeTarget(item)} title="Recipe">
                          <ListChecks className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => toggleFavMutation.mutate(item.id)} title="Favourite">
                          <Star className={item.is_favourite ? 'size-4 fill-warning text-warning' : 'size-4'} />
                        </Button>
                        {!item.archived_at && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setItemForm({
                                id: item.id,
                                name: item.name,
                                price: Number(item.price),
                                category_id: item.category_id,
                                description: item.description ?? '',
                                sort_order: item.sort_order,
                              })
                            }
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {!item.archived_at ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setArchiveTarget({ kind: 'item', id: item.id, name: item.name })}
                            title="Archive"
                          >
                            <Archive className="size-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon-sm" onClick={() => restoreMutation.mutate({ kind: 'item', id: item.id })} title="Restore">
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
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setCategoryForm({ name: '', description: '', sort_order: categories?.length ?? 0 })}>
              <Plus className="size-4" /> New Category
            </Button>
          </div>

          {categories?.length === 0 ? (
            <EmptyState title="No categories" description="Create categories like Rice, Kottu, Parata." />
          ) : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories?.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.menu_items_count}</TableCell>
                      <TableCell className="text-muted-foreground">{c.sort_order}</TableCell>
                      <TableCell>
                        {c.archived_at ? <Badge variant="muted">Archived</Badge> : <Badge variant="success">Active</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {!c.archived_at && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setCategoryForm({ id: c.id, name: c.name, description: c.description ?? '', sort_order: c.sort_order })}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {!c.archived_at ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setArchiveTarget({ kind: 'category', id: c.id, name: c.name })}
                            title="Archive"
                          >
                            <Archive className="size-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon-sm" onClick={() => restoreMutation.mutate({ kind: 'category', id: c.id })} title="Restore">
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
        </TabsContent>
      </Tabs>

      {/* Menu item form */}
      <Dialog open={!!itemForm} onOpenChange={(o) => !o && setItemForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemForm?.id ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
            <DialogDescription>Configure the dish, price, and image.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (itemForm) saveItemMutation.mutate(itemForm)
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                autoFocus
                required
                value={itemForm?.name ?? ''}
                onChange={(e) => setItemForm((f) => (f ? { ...f, name: e.target.value } : f))}
                placeholder="e.g. Chicken Fried Rice"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={String(itemForm?.category_id ?? '')}
                  onValueChange={(v) => setItemForm((f) => (f ? { ...f, category_id: Number(v) } : f))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemForm?.price ?? 0}
                  onChange={(e) => setItemForm((f) => (f ? { ...f, price: Number(e.target.value) } : f))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={itemForm?.description ?? ''}
                onChange={(e) => setItemForm((f) => (f ? { ...f, description: e.target.value } : f))}
                placeholder="Optional"
              />
            </div>
            {!itemForm?.id && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5 mb-0.5">
                  <ListChecks className="size-3.5 text-primary" /> Recipe Builder
                </div>
                After creating this dish, the Recipe Builder will automatically open so you can set up consumed production resources.
              </div>
            )}
            {itemForm?.id && (
              <div className="space-y-2">
                <Label>Image</Label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent">
                  <ImagePlus className="size-4" />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file && itemForm.id) uploadImageMutation.mutate({ id: itemForm.id, file })
                    }}
                  />
                </label>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={saveItemMutation.isPending}>
                {itemForm?.id ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category form */}
      <Dialog open={!!categoryForm} onOpenChange={(o) => !o && setCategoryForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryForm?.id ? 'Edit Category' : 'New Category'}</DialogTitle>
            <DialogDescription>Group menu items for the POS screen.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (categoryForm) saveCategoryMutation.mutate(categoryForm)
            }}
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                autoFocus
                required
                value={categoryForm?.name ?? ''}
                onChange={(e) => setCategoryForm((f) => (f ? { ...f, name: e.target.value } : f))}
                placeholder="e.g. Rice"
              />
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                min={0}
                value={categoryForm?.sort_order ?? 0}
                onChange={(e) => setCategoryForm((f) => (f ? { ...f, sort_order: Number(e.target.value) } : f))}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveCategoryMutation.isPending}>
                {categoryForm?.id ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {recipeTarget && (
        <RecipeBuilder
          menuItemId={recipeTarget.id}
          menuItemName={recipeTarget.name}
          open={!!recipeTarget}
          onOpenChange={(o) => !o && setRecipeTarget(null)}
        />
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={archiveTarget?.kind === 'item' ? 'Archive menu item?' : 'Archive category?'}
        description={`${archiveTarget?.name} will be hidden from the POS. Historical records stay intact.`}
        confirmLabel="Archive"
        destructive
        loading={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate({ kind: archiveTarget.kind, id: archiveTarget.id })}
      />
    </div>
  )
}
