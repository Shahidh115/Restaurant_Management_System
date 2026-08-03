import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { api } from '@/lib/api'
import { todayISO, daysAgoISO } from '@/lib/utils'
import { PageHeader, LoadingBlock, Money } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

function useRange() {
  const [from, setFrom] = useState(daysAgoISO(29))
  const [to, setTo] = useState(todayISO())
  return { from, to, setFrom, setTo }
}

function RangePicker({
  from, to, setFrom, setTo,
}: {
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From date" />
      <span className="text-muted-foreground">to</span>
      <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To date" />
    </div>
  )
}

export default function ReportsPage() {
  const range = useRange()
  const { from, to } = range

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['report-summary', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: { revenue: number; discount: number; sales_count: number; items_sold: number; average_bill: number } }>('/reports/summary', { params: { from, to } })
      return res.data.data
    },
  })

  const { data: trends } = useQuery({
    queryKey: ['report-trends', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: { date: string; label: string; count: number; revenue: number }[] }>('/reports/trends', { params: { from, to } })
      return res.data.data
    },
  })

  const { data: foodSales } = useQuery({
    queryKey: ['report-food', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: { menu_item_id: number; name: string; quantity: number; revenue: number }[] }>('/reports/food-sales', { params: { from, to } })
      return res.data.data
    },
  })

  const { data: resourceUsage } = useQuery({
    queryKey: ['report-resource-usage', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: { resource_id: number; name: string; unit: string; opening: number; produced: number; sold: number; restored: number; wasted: number; manual_adjust: number; closing: number; current_balance: number }[] }>('/reports/resource-usage', { params: { from, to } })
      return res.data.data
    },
  })

  const { data: wasteReport } = useQuery({
    queryKey: ['report-waste', from, to],
    queryFn: async () => {
      const res = await api.get<{ data: { total: number; by_type: Record<string, number>; by_resource: { resource_id: number; name: string; unit: string; quantity: number }[] } }>('/reports/waste', { params: { from, to } })
      return res.data.data
    },
  })

  const pieData = wasteReport
    ? Object.entries(wasteReport.by_type).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Performance and stock usage over a date range."
        actions={<RangePicker {...range} />}
      />

      {summaryLoading ? (
        <LoadingBlock label="Loading reports…" />
      ) : summary ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="gap-1 py-4">
            <CardContent className="px-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Revenue</div>
              <div className="text-xl font-bold"><Money value={summary.revenue} /></div>
            </CardContent>
          </Card>
          <Card className="gap-1 py-4">
            <CardContent className="px-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Bills</div>
              <div className="text-xl font-bold">{summary.sales_count}</div>
            </CardContent>
          </Card>
          <Card className="gap-1 py-4">
            <CardContent className="px-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Items sold</div>
              <div className="text-xl font-bold">{summary.items_sold}</div>
            </CardContent>
          </Card>
          <Card className="gap-1 py-4">
            <CardContent className="px-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase">Avg bill</div>
              <div className="text-xl font-bold"><Money value={summary.average_bill} /></div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="food">Food sales</TabsTrigger>
          <TabsTrigger value="resources">Resource usage</TabsTrigger>
          <TabsTrigger value="waste">Deductions & Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-base">Daily revenue</CardTitle>
              <CardDescription>Total sales per day</CardDescription>
            </CardHeader>
            <CardContent className="h-72 px-2">
              {trends && trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [value, 'Revenue']}
                      labelStyle={{ fontSize: 12 }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No sales in range.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-base">Top selling</CardTitle>
                <CardDescription>Most ordered dishes</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                {foodSales && foodSales.length > 0 ? (
                  <div className="space-y-2">
                    {foodSales.slice(0, 10).map((item, i) => (
                      <div key={item.menu_item_id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                        <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.quantity} sold</div>
                        </div>
                        <Money value={item.revenue} className="text-xs" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">No sales in range.</div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-base">Bills per day</CardTitle>
                <CardDescription>Transaction count</CardDescription>
              </CardHeader>
              <CardContent className="h-80 px-2">
                {trends && trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} formatter={(value) => [value, 'Bills']} labelStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" fill="hsl(var(--secondary-foreground) / 0.7)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales in range.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="food" className="mt-4">
          <Card className="gap-0 overflow-hidden py-0">
            {foodSales && foodSales.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {foodSales.map((item) => (
                    <TableRow key={item.menu_item_id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right"><Money value={item.revenue} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">No sales in range.</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="mt-4">
          <Card className="gap-0 overflow-hidden py-0">
            {resourceUsage && resourceUsage.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Produced</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Restored</TableHead>
                    <TableHead className="text-right">Deducted</TableHead>
                    <TableHead className="text-right">Adjust</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                    <TableHead className="text-right">Live</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resourceUsage.map((r) => (
                    <TableRow key={r.resource_id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.opening}</TableCell>
                      <TableCell className="text-right tabular-nums text-success">{r.produced}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{r.sold}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.restored}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.wasted}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.manual_adjust}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.closing}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{r.current_balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">No data in range.</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="waste" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-base">Deductions by reason / type</CardTitle>
                <CardDescription>{wasteReport?.total ?? 0} units total</CardDescription>
              </CardHeader>
              <CardContent className="h-72 px-2">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={90} paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No deductions in range.</div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 overflow-hidden py-0">
              {wasteReport && wasteReport.by_resource.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wasteReport.by_resource.map((r) => (
                      <TableRow key={r.resource_id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right tabular-nums"><Badge variant="warning">{r.quantity} {r.unit}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">No deductions in range.</div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
