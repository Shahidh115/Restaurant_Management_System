import { Printer } from 'lucide-react'
import type { Bill } from '@/types'
import { useSettings } from '@/hooks/useData'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatMoney, formatDateTime, cn } from '@/lib/utils'

interface ReceiptPrintProps {
  bill: Bill
  onClose?: () => void
}

export function ReceiptPrint({ bill }: ReceiptPrintProps) {
  const { data: settings } = useSettings()

  const handlePrint = () => {
    window.print()
  }

  const restaurantName = settings?.restaurant_name?.trim() ?? ''
  const address = settings?.address?.trim()
  const phone = settings?.phone?.trim()
  const receiptHeader = settings?.receipt_header?.trim()
  const receiptFooter = settings?.receipt_footer?.trim()
  const currency = settings?.currency ?? 'Rs.'

  const logoUrl = settings?.logo_path ? (
    settings.logo_path.startsWith('http')
      ? settings.logo_path
      : `/storage/${settings.logo_path.replace(/^\/+/, '').replace(/^storage\//, '')}`
  ) : null

  const hasName = Boolean(restaurantName)
  const hasLogo = Boolean(logoUrl)

  return (
    <div>
      {/* Screen Preview Card */}
      <div className="space-y-4 text-sm">
        <div className="text-center space-y-1">
          {hasLogo && (
            <div className={cn('flex justify-center', hasName ? 'mb-1.5' : 'mb-3')}>
              <img
                src={logoUrl!}
                alt={restaurantName || 'Logo'}
                className="w-1/2 h-auto max-h-24 object-contain mx-auto transition-all"
              />
            </div>
          )}
          {hasName && (
            <h3 className="text-lg font-bold tracking-tight text-foreground">{restaurantName}</h3>
          )}
          {address && (
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-snug">{address}</p>
          )}
          {phone && (
            <p className="text-xs text-muted-foreground font-medium">Tel: {phone}</p>
          )}
          {receiptHeader && (
            <p className="text-xs text-muted-foreground/90 whitespace-pre-line pt-0.5 italic">{receiptHeader}</p>
          )}

          <div className="pt-2 text-xs font-semibold text-primary">
            Invoice: {bill.invoice_number}
          </div>
          {bill.customer_phone && (
            <div className="text-xs text-muted-foreground">
              Customer Mobile: <span className="font-semibold text-foreground">{bill.customer_phone}</span>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Date: {bill.bill_date ? `${bill.bill_date} (${formatDateTime(bill.created_at)})` : formatDateTime(bill.created_at)}
          </div>
        </div>

        <Separator />

        {/* Line items */}
        <div className="space-y-2">
          {bill.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start text-xs">
              <div className="min-w-0 flex-1 pr-2">
                <span className="font-medium">{item.name}</span>
                <div className="text-muted-foreground">
                  {item.quantity} × {formatMoney(item.unit_price, currency)}
                </div>
              </div>
              <span className="font-semibold tabular-nums">
                {formatMoney(item.line_total, currency)}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Calculations */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatMoney(bill.subtotal, currency)}</span>
          </div>

          {bill.discount > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span className="tabular-nums">-{formatMoney(bill.discount, currency)}</span>
            </div>
          )}

          {bill.tax_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({bill.tax_rate}%)</span>
              <span className="tabular-nums">{formatMoney(bill.tax_amount, currency)}</span>
            </div>
          )}

          <Separator className="my-1" />

          <div className="flex justify-between text-base font-bold pt-1">
            <span>Total</span>
            <span className="tabular-nums text-foreground">{formatMoney(bill.total, currency)}</span>
          </div>

          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>Payment Method</span>
            <span className="font-semibold capitalize text-foreground">{bill.payment_type}</span>
          </div>
        </div>

        {receiptFooter && (
          <>
            <Separator />
            <p className="text-center text-xs text-muted-foreground whitespace-pre-line">
              {receiptFooter}
            </p>
          </>
        )}

        {/* Print Button */}
        <div className="pt-2 flex justify-end gap-2">
          <Button onClick={handlePrint} className="w-full flex items-center gap-2">
            <Printer className="size-4" /> Print Bill
          </Button>
        </div>
      </div>

      {/* Hidden Thermal Printer DOM Layer for Browser window.print() */}
      <div id="printable-receipt" className="hidden print:block text-black font-mono text-xs leading-tight">
        <div className="text-center mb-2">
          {hasLogo && (
            <div className={`flex justify-center ${hasName ? 'mb-1' : 'mb-2'}`}>
              <img
                src={logoUrl!}
                alt={restaurantName || 'Logo'}
                className="w-1/2 h-auto object-contain mx-auto"
              />
            </div>
          )}
          {hasName && <div className="font-bold text-base uppercase">{restaurantName}</div>}
          {address && <div className="text-xs whitespace-pre-line">{address}</div>}
          {phone && <div className="text-xs font-bold">TEL: {phone}</div>}
          {receiptHeader && <div className="text-xs whitespace-pre-line my-1 italic">{receiptHeader}</div>}
          <div className="my-1">================================</div>
          <div>INVOICE #: {bill.invoice_number}</div>
          {bill.customer_phone && <div>CUST MOBILE: {bill.customer_phone}</div>}
          <div>DATE: {bill.bill_date ? `${bill.bill_date} (${formatDateTime(bill.created_at)})` : formatDateTime(bill.created_at)}</div>
          <div>================================</div>
        </div>

        <div className="mb-2">
          <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
            <span>ITEM</span>
            <span>QTY x PRICE</span>
            <span>TOTAL</span>
          </div>
          {bill.items.map((item) => (
            <div key={item.id} className="mb-1">
              <div className="font-bold">{item.name}</div>
              <div className="flex justify-between pl-2">
                <span>{item.quantity} x {formatMoney(item.unit_price, currency)}</span>
                <span>{formatMoney(item.line_total, currency)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-black pt-1 mb-2">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>{formatMoney(bill.subtotal, currency)}</span>
          </div>
          {bill.discount > 0 && (
            <div className="flex justify-between">
              <span>DISCOUNT:</span>
              <span>-{formatMoney(bill.discount, currency)}</span>
            </div>
          )}
          {bill.tax_amount > 0 && (
            <div className="flex justify-between">
              <span>TAX ({bill.tax_rate}%):</span>
              <span>{formatMoney(bill.tax_amount, currency)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm my-1 border-t border-b border-black py-1">
            <span>TOTAL:</span>
            <span>{formatMoney(bill.total, currency)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>PAYMENT:</span>
            <span className="uppercase">{bill.payment_type}</span>
          </div>
        </div>

        {receiptFooter && (
          <div className="text-center mt-3 pt-1 border-t border-dashed border-black text-xs whitespace-pre-line">
            {receiptFooter}
          </div>
        )}
      </div>
    </div>
  )
}
