import * as React from 'react'
import { Loader2, Inbox } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Inbox className="size-6 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      {description && (
        <div className="max-w-sm text-sm text-muted-foreground">{description}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            className={cn(destructive && 'bg-destructive text-white hover:bg-destructive/90')}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'muted' }> = {
    completed: { label: 'Completed', variant: 'success' },
    hold: { label: 'Held', variant: 'warning' },
    cancelled: { label: 'Cancelled', variant: 'muted' },
  }
  const item = map[status] ?? { label: status, variant: 'muted' as const }
  return <Badge variant={item.variant}>{item.label}</Badge>
}

export function TransactionBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'muted' | 'destructive' }> = {
    OPENING: { label: 'Opening', variant: 'default' },
    PRODUCTION: { label: 'Production', variant: 'success' },
    SALE: { label: 'Sale', variant: 'destructive' },
    SALE_RESTORE: { label: 'Restore', variant: 'success' },
    WASTE: { label: 'Deduction / Usage', variant: 'warning' },
    MANUAL_ADJUSTMENT: { label: 'Manual', variant: 'muted' },
  }
  const item = map[type] ?? { label: type, variant: 'muted' as const }
  return <Badge variant={item.variant}>{item.label}</Badge>
}

export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('tabular-nums font-medium', className)}>
      {new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'LKR',
        currencyDisplay: 'code',
      })
        .format(value)
        .replace('LKR', 'Rs.')}
    </span>
  )
}

export { Button }
