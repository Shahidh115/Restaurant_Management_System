import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, ImageUp } from 'lucide-react'
import { api } from '@/lib/api'
import type { SettingsData } from '@/types'
import { useSettings } from '@/hooks/useData'
import { PageHeader, LoadingBlock, Button } from '@/components/shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<SettingsData | null>(null)

  const updateMutation = useMutation({
    mutationFn: async (payload: SettingsData) => {
      const res = await api.put<{ data: SettingsData }>('/settings', payload)
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await api.post<{ data: { logo_path: string; logo_url: string } }>('/settings/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
    onSuccess: () => {
      toast.success('Logo uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['pos-data'] })
    },
    onError: (e: { message: string }) => toast.error(e.message),
  })

  if (isLoading) return <LoadingBlock label="Loading settings…" />

  const value = form ?? settings ?? {}

  const set = (patch: Partial<SettingsData>) => setForm((f) => ({ ...(f ?? settings ?? {}), ...patch }))

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Restaurant identity, receipt, and billing configuration."
        actions={
          <Button
            onClick={() => updateMutation.mutate(value)}
            disabled={updateMutation.isPending}
          >
            <Save className="size-4" /> Save settings
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Shown on receipts and the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Restaurant name</Label>
              <Input value={value.restaurant_name ?? ''} onChange={(e) => set({ restaurant_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={value.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={value.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex flex-wrap items-center gap-3">
                {value.logo_path && (
                  <img
                    src={value.logo_path.startsWith('http') ? value.logo_path : `/storage/${value.logo_path.replace(/^\/+/, '').replace(/^storage\//, '')}`}
                    alt="Restaurant Logo"
                    className="h-20 w-auto max-w-[200px] rounded border bg-muted/30 p-1.5 object-contain"
                  />
                )}
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-accent">
                  <ImageUp className="size-4" /> {value.logo_path ? 'Change logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) logoMutation.mutate(file)
                    }}
                  />
                </label>
                {logoMutation.isPending && (
                  <span className="text-xs text-muted-foreground animate-pulse">Uploading…</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>Currency and tax applied to every bill.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Currency symbol</Label>
                <Input value={value.currency ?? ''} onChange={(e) => set({ currency: e.target.value })} placeholder="Rs." />
              </div>
              <div className="space-y-2">
                <Label>Tax rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={value.tax_rate ?? 0}
                  onChange={(e) => set({ tax_rate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Invoice prefix</Label>
              <Input value={value.invoice_prefix ?? ''} onChange={(e) => set({ invoice_prefix: e.target.value })} placeholder="INV" />
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5 lg:col-span-2">
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
            <CardDescription>Header and footer printed on receipts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Receipt header</Label>
              <Textarea value={value.receipt_header ?? ''} onChange={(e) => set({ receipt_header: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Receipt footer</Label>
              <Textarea value={value.receipt_footer ?? ''} onChange={(e) => set({ receipt_footer: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Printer config</Label>
              <Textarea value={value.printer_config ?? ''} onChange={(e) => set({ printer_config: e.target.value })} rows={3} placeholder="Optional JSON or notes for the receipt printer." />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
