import { Link } from 'react-router-dom'
import { Banknote, Receipt, Utensils, Percent, AlertTriangle, PackageX, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { useDashboard, usePosData } from '@/hooks/useData'
import { LoadingBlock, Money, StatusBadge } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon: React.ElementType
  tone?: 'default' | 'success' | 'warning' | 'muted'
}) {
  const tones = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    muted: 'bg-muted text-muted-foreground',
  }
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-medium text-muted-foreground uppercase">{label}</div>
          <div className="truncate text-xl font-bold">{value}</div>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const { data: posData } = usePosData()

  if (isLoading) return <LoadingBlock label="Loading dashboard…" />

  if (!data) return null

  const summary = data.summary

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue today"
          value={<Money value={summary.revenue} />}
          sub={data.date}
          icon={Banknote}
          tone="success"
        />
        <StatCard
          label="Sales"
          value={String(summary.sales_count)}
          sub={`${summary.items_sold} items sold`}
          icon={Receipt}
        />
        <StatCard
          label="Average bill"
          value={<Money value={summary.average_bill} />}
          icon={Percent}
        />
        <StatCard
          label="Discounts"
          value={<Money value={summary.discount} />}
          icon={TrendingUp}
          tone="muted"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="gap-3 py-4 xl:col-span-2">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Sales by hour</CardTitle>
            <CardDescription>Bills completed today</CardDescription>
          </CardHeader>
          <CardContent className="h-64 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.hourly_sales} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  formatter={(value) => [value, 'Sales']}
                  labelStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Low resources</CardTitle>
            <CardDescription>Below warning level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            {data.low_resources.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">All resources healthy.</div>
            ) : (
              data.low_resources.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-4 text-warning" />
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">Warning at {r.warning_level} {r.unit}</div>
                    </div>
                  </div>
                  <Badge variant="warning">{r.current_balance}</Badge>
                </div>
              ))
            )}
            {posData && posData.resources.length > 0 && (
              <Link to="/production">
                <Button variant="outline" size="sm" className="w-full">
                  <PackageX className="size-4" /> Manage production
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Top selling today</CardTitle>
            <CardDescription>Most ordered dishes</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {data.top_selling.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No sales yet today.</div>
            ) : (
              <div className="space-y-2">
                {data.top_selling.map((item, i) => (
                  <div key={item.menu_item_id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.quantity} sold</div>
                    </div>
                    <Money value={item.revenue} className="text-xs" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-base">Production capacity</CardTitle>
            <CardDescription>Maximum portions with current stock</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {data.production_capacity.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No recipes configured.</div>
            ) : (
              <div className="space-y-2">
                {data.production_capacity.slice(0, 8).map((item) => (
                  <div key={item.menu_item_id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Utensils className="size-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.max_preparable === 0 && item.limiting_resource && (
                        <Badge variant="warning">Needs {item.limiting_resource}</Badge>
                      )}
                      <Badge variant={item.max_preparable === 0 ? 'muted' : 'success'}>
                        ×{item.max_preparable}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-3 py-4">
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <div>
            <CardTitle className="text-base">Recent bills</CardTitle>
            <CardDescription>Latest transactions</CardDescription>
          </div>
          <Link to="/sales">
            <Button variant="outline" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent className="px-4">
          {data.recent_bills.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No bills yet.</div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_bills.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium">{bill.invoice_number}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(bill.created_at)}</TableCell>
                      <TableCell className="tabular-nums">{bill.item_count}</TableCell>
                      <TableCell><Money value={bill.total} /></TableCell>
                      <TableCell><StatusBadge status={bill.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
