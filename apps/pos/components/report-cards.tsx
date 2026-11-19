import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Progress, Text } from '@tallyui/components';
import type { CategoryFigures } from '../lib/reports/category-figures';
import type { ProductFigure } from '../lib/reports/product-figures';
import { cashierLabel } from '../lib/reports/sales-tables';
import type { Period } from '../lib/reports/sales-room';
import type { ReportCashier } from './report-chips';

export type ReportTable = 'orders' | 'payments' | 'where-sold' | 'taxes' | 'products' | 'categories' | 'cashiers';
type Money = (minor: number) => string;

/** v2 reports/cards/card.tsx: a named card whose head carries its figure, and opens its table when it can. */
export function ReportCard({ testID, name, figure, onOpen, children }: {
  testID: string; name: string; figure: string; onOpen?: () => void; children?: ReactNode;
}) {
  const head = <>
    <Text className="min-w-0 flex-1 text-base text-muted-foreground">{name}</Text>
    <Text testID={`${testID}-figure`} className="font-semibold tabular-nums">{figure}</Text>
    {onOpen && <Text className="text-muted-foreground">›</Text>}
  </>;
  // v2 cards/card.tsx:25 `<Card padding="body">`: card/index.tsx:18 is `border-border bg-card rounded-lg border`, p-4.
  return (
    <View testID={testID} className="flex-1 gap-3 rounded-lg border border-border bg-card p-4">
      {onOpen
        ? <Pressable testID={`${testID}-open`} accessibilityRole="button" accessibilityLabel={name} onPress={onOpen}
          className="min-h-11 flex-row items-center justify-between gap-3 active:opacity-70">{head}</Pressable>
        : <View className="flex-row items-center justify-between gap-3">{head}</View>}
      {children}
    </View>
  );
}

/** v2 reports/cards/primitives.tsx StatGrid: three stats to a row. */
export function StatGrid({ items }: { items: { label: string; value: string; testID: string }[] }) {
  return (
    <View className="flex-row flex-wrap gap-y-3">
      {items.map(item => (
        <View key={item.testID} className="w-1/3 gap-1 pr-2">
          <Text className="text-sm text-muted-foreground">{item.label}</Text>
          <Text testID={item.testID} className="tabular-nums">{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export type DonutPart = { key: string; label: string; note?: string; value: number; valueText: string; shareText: string };

/** A share of the total as a percent with at most one decimal: `62.5%`, `100%`. */
const shareText = (value: number, total: number) => `${total ? Math.round((value / total) * 1000) / 10 : 0}%`;
// r 46 with a 20 stroke leaves a 72-point hole for the centre figure and its label.
const CIRCUMFERENCE = 2 * Math.PI * 46;
/** Side by side from this measured width; stacked below it (v2 donut.tsx). */
const DONUT_ROW_MIN_WIDTH = 360;

/** v2 reports/cards/donut.tsx: a ring of up to five parts, the rest folded into Other, with a row per part. */
export function Donut({ testID, parts, centre, total, money }: {
  testID: string; parts: DonutPart[]; centre: { figure: string; label: string }; total: number; money: Money;
}) {
  // v2 donut.tsx:41-45: the ring takes the five chart colours (global.css --color-c1..c5, set per theme).
  const colors = useCSSVariable(['--color-c1', '--color-c2', '--color-c3', '--color-c4', '--color-c5']).map(value => value === undefined ? undefined : String(value));
  const [width, setWidth] = useState(0);
  const other = parts.slice(5).reduce((sum, part) => sum + part.value, 0);
  const rows: DonutPart[] = parts.length > 5
    ? [...parts.slice(0, 5), { key: 'other', label: 'Other', value: other, valueText: money(other), shareText: shareText(other, total) }]
    : parts;
  return (
    <View testID={testID} onLayout={event => setWidth(event.nativeEvent.layout.width)}
      className={width < DONUT_ROW_MIN_WIDTH ? 'gap-3' : 'flex-row items-center gap-3'}>
      <View className="relative items-center justify-center self-center" style={{ width: 120, height: 120 }}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          {/* A transform attribute, not rotation/origin: those emit transform-origin on web. */}
          <G transform="rotate(-90 60 60)">
            {rows.map((part, index) => {
              // A part a refund took to zero or below draws no arc; its row still shows the amount.
              if (part.value <= 0) return null;
              const before = rows.slice(0, index).reduce((sum, row) => sum + Math.max(0, row.value), 0);
              return (
                <Circle key={part.key} testID={`${testID}-arc-${part.key}`} r={46} cx={60} cy={60} strokeWidth={20} fill="none"
                  stroke={colors[Math.min(index, 4)]}
                  strokeDasharray={[Math.max(2, CIRCUMFERENCE * (total ? part.value / total : 0) - 2), CIRCUMFERENCE]}
                  strokeDashoffset={total ? (-CIRCUMFERENCE * before) / total : 0} />
              );
            })}
          </G>
        </Svg>
        {/* Above the SVG: on web the ring otherwise paints over the text's edges. */}
        <View className="absolute inset-0 z-10 items-center justify-center">
          <Text testID={`${testID}-figure`} numberOfLines={1} className="text-sm font-semibold tabular-nums">{centre.figure}</Text>
          <Text numberOfLines={1} className="text-sm text-muted-foreground">{centre.label}</Text>
        </View>
      </View>
      <View className="flex-1 gap-2">
        {rows.map((part, index) => (
          <View key={part.key} testID={`${testID}-row-${part.key}`} className="flex-row items-center gap-2">
            <View className="size-2.5" style={{ backgroundColor: colors[Math.min(index, 4)] }} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1}>{part.label}</Text>
              {part.note && <Text className="text-sm text-muted-foreground">{part.note}</Text>}
            </View>
            <Text testID={`${testID}-row-${part.key}-value`} className="font-semibold tabular-nums">{part.valueText}</Text>
            <Text className="w-16 text-right text-muted-foreground">{part.shareText}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const ordersNote = (count: number) => `${count} ${count === 1 ? 'order' : 'orders'}`;
type CardProps = { period: Period; money: Money; moneyWhole: Money };

/** v2 reports/cards/orders.tsx without the status bar: Tally's local orders carry no WooCommerce status. */
export function OrdersCard({ period, money, onOpen }: Omit<CardProps, 'moneyWhole'> & { onOpen(): void }) {
  const stats = [
    ['average', 'Average order', money(period.averageMinor)],
    ['median', 'Median', money(period.medianMinor)],
    ['largest', 'Largest', period.largestMinor === null ? '—' : money(period.largestMinor)],
    ['items', 'Items Sold', String(period.items)],
    ['items-per-order', 'Items per order', String(period.count ? Math.round((period.items / period.count) * 10) / 10 : 0)],
    ['discounts', 'Discounts', money(period.discountMinor)],
  ];
  return (
    <ReportCard testID="card-orders" name="Orders" figure={String(period.count)} onOpen={onOpen}>
      {period.count === 0
        ? <Text testID="card-orders-empty">No orders in this period</Text>
        : <StatGrid items={stats.map(([id, label, value]) => ({ label, value, testID: `card-orders-${id}` }))} />}
    </ReportCard>
  );
}

/** v2 reports/cards/payments.tsx: the period's takings by method. */
export function PaymentsCard({ period, money, moneyWhole, onOpen }: CardProps & { onOpen(): void }) {
  const ways = period.byMethod.length;
  return (
    <ReportCard testID="card-payments" name="Payments" figure={money(period.totalMinor)} onOpen={onOpen}>
      {ways === 0
        ? <Text testID="card-payments-empty">No payments in this period</Text>
        : <Donut testID="card-payments-donut" total={period.totalMinor} money={money}
          centre={{ figure: moneyWhole(period.totalMinor), label: `${ways} ${ways === 1 ? 'way' : 'ways'}` }}
          parts={period.byMethod.map(row => ({
            key: row.method, label: row.label, value: row.totalMinor, valueText: money(row.totalMinor),
            shareText: shareText(row.totalMinor, period.totalMinor), note: ordersNote(row.count),
          }))} />}
      {period.splitCount > 0 && <Text>{`Split tenders: ${period.splitCount}`}</Text>}
    </ReportCard>
  );
}

/** v2 reports/cards/where-sold.tsx opens the channels table: every Tally order is an in-store POS sale. */
export function WhereSoldCard({ period, money, moneyWhole, onOpen }: CardProps & { onOpen(): void }) {
  return (
    <ReportCard testID="card-where-sold" name="Where sold" figure={money(period.totalMinor)} onOpen={onOpen}>
      {period.count === 0
        ? <Text testID="card-where-sold-empty">No sales in this period</Text>
        : <Donut testID="card-where-sold-donut" total={period.totalMinor} money={money}
          centre={{ figure: moneyWhole(period.totalMinor), label: '1 channel' }}
          parts={[{
            key: 'store', label: 'In store', value: period.totalMinor, valueText: money(period.totalMinor),
            shareText: shareText(period.totalMinor, period.totalMinor), note: ordersNote(period.count),
          }]} />}
    </ReportCard>
  );
}

/** v2 reports/cards/top-products.tsx: the four best sellers with their share of the period and units sold. */
export function TopProductsCard({ period, money, products, onOpen }: {
  period: Period; money: Money; products: readonly ProductFigure[]; onOpen(): void;
}) {
  return (
    <ReportCard testID="card-products" name="Top products" figure={String(period.items)} onOpen={onOpen}>
      {products.length === 0
        ? <Text testID="card-products-empty">No sales in this period</Text>
        : products.slice(0, 4).map((row, index) => {
          const share = period.totalMinor ? row.amountMinor / period.totalMinor : 0;
          return (
            <View key={row.key} testID={`card-products-row-${index}`} className="gap-1">
              <View className="flex-row justify-between gap-2">
                <Text numberOfLines={1} className="min-w-0 flex-1">{row.name || 'Unknown'}</Text>
                <Text className="font-semibold tabular-nums">{money(row.amountMinor)}</Text>
              </View>
              <Progress testID={`card-products-row-${index}-bar`} className="h-2 bg-muted"
                value={share > 0 ? Math.max(0.02, Math.min(1, share)) * 100 : 0} />
              <Text className="text-sm text-muted-foreground">{`${shareText(row.amountMinor, period.totalMinor)} · ${row.quantity} sold`}</Text>
            </View>
          );
        })}
    </ReportCard>
  );
}

/** v2 reports/cards/categories.tsx: the period's gross by category, with units sold and missing local products. */
export function CategoriesCard({ period, money, moneyWhole, categories, onOpen }: CardProps & {
  categories: CategoryFigures; onOpen(): void;
}) {
  const n = categories.parts.filter(row => row.key !== 'unknown' && row.key !== 'uncategorised').length;
  return (
    <ReportCard testID="card-categories" name="Categories" figure={money(period.totalMinor)} onOpen={onOpen}>
      {categories.parts.length === 0
        ? <Text testID="card-categories-empty">No sales in this period</Text>
        : <Donut testID="card-categories-donut" total={period.totalMinor} money={money}
          centre={{ figure: moneyWhole(period.totalMinor), label: `${n} ${n === 1 ? 'category' : 'categories'}` }}
          parts={categories.parts.map(row => ({
            key: row.key, label: row.label, value: row.amountMinor, valueText: money(row.amountMinor),
            shareText: shareText(row.amountMinor, period.totalMinor), note: `${row.quantity} sold`,
          }))} />}
      {categories.unknownLines > 0 && <Text testID="card-categories-unknown" className="text-sm text-muted-foreground">
        {`${categories.unknownLines} of ${categories.totalLines} lines have no local product`}
      </Text>}
    </ReportCard>
  );
}

/** v2 reports/cards/cashiers.tsx: the period's takings by cashier. */
export function CashiersCard({ period, money, moneyWhole, cashiers, onOpen }: CardProps & {
  cashiers: readonly ReportCashier[]; onOpen(): void;
}) {
  const n = period.byCashier.length;
  return (
    <ReportCard testID="card-cashiers" name="Cashiers" figure={String(period.byCashier.length)} onOpen={onOpen}>
      {period.byCashier.length === 0
        ? <Text testID="card-cashiers-empty">No sales in this period</Text>
        : <Donut testID="card-cashiers-donut" total={period.totalMinor} money={money}
          centre={{ figure: moneyWhole(period.totalMinor), label: `${n} ${n === 1 ? 'cashier' : 'cashiers'}` }}
          parts={period.byCashier.map(row => ({
            key: row.cashierRef || 'unknown',
            label: cashierLabel(cashiers, row.cashierRef),
            value: row.totalMinor, valueText: money(row.totalMinor),
            shareText: shareText(row.totalMinor, period.totalMinor), note: ordersNote(row.count),
          }))} />}
    </ReportCard>
  );
}

// v2 cards/taxes.tsx:10: five shared hues, cycled, so a sixth rate takes the first hue again, never its neighbour's.
const TAX_COLORS = ['bg-c1', 'bg-c2', 'bg-c3', 'bg-c4', 'bg-c5'];

/** v2 reports/cards/taxes.tsx: tax collected, each rate's share and Net / Tax / Gross. */
export function TaxesCard({ period, money, onOpen }: Omit<CardProps, 'moneyWhole'> & { onOpen(): void }) {
  return (
    <ReportCard testID="card-taxes" name="Taxes" figure={money(period.taxMinor)} onOpen={onOpen}>
      <View testID="card-taxes-bar" className="h-2 w-full flex-row overflow-hidden rounded-md">
        {period.taxRates.some(row => row.taxMinor > 0)
          ? period.taxRates.map((row, index) => row.taxMinor > 0 &&
            <View key={row.ratePpm} testID={`card-taxes-bar-${row.ratePpm}`} className={TAX_COLORS[index % 5]} style={{ flex: row.taxMinor }} />)
          : <View className="bg-muted" style={{ flex: 1 }} />}
      </View>
      {period.taxRates.length > 0 && <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {period.taxRates.map((row, index) => (
          <View key={row.ratePpm} testID={`card-taxes-rate-${row.ratePpm}`} className="flex-row items-center gap-2">
            <View testID={`card-taxes-rate-${row.ratePpm}-swatch`} className={`size-2.5 ${TAX_COLORS[index % 5]}`} />
            <Text>{row.label}</Text>
            <Text className="font-semibold tabular-nums">{money(row.taxMinor)}</Text>
            <Text className="text-sm text-muted-foreground">{`on ${money(row.netMinor)}`}</Text>
          </View>
        ))}
      </View>}
      <StatGrid items={[
        { label: 'Net', value: money(period.totalMinor - period.taxMinor), testID: 'card-taxes-net' },
        { label: 'Tax', value: money(period.taxMinor), testID: 'card-taxes-tax' },
        { label: 'Gross', value: money(period.totalMinor), testID: 'card-taxes-gross' },
      ]} />
    </ReportCard>
  );
}

// Three cards need about 330 points each for their stat grids plus two gaps; two need 290 (v2 cards/index.tsx).
const THREE_COLUMNS_MIN_WIDTH = 1000;
const TWO_COLUMNS_MIN_WIDTH = 600;

/** v2 reports/cards/index.tsx PeriodSection: Orders, Payments, Where sold, Top products, Categories, Cashiers and Taxes in columns that follow the measured width. */
export function ReportCards({ period, money, moneyWhole, onOpenTable, cashiers = [], products = [],
  categories = { parts: [], unknownLines: 0, totalLines: 0 } }: CardProps & {
  onOpenTable(table: ReportTable): void; cashiers?: readonly ReportCashier[]; products?: readonly ProductFigure[];
  categories?: CategoryFigures;
}) {
  const [width, setWidth] = useState<number | null>(null);
  const columns = width === null ? 1 : width >= THREE_COLUMNS_MIN_WIDTH ? 3 : width >= TWO_COLUMNS_MIN_WIDTH ? 2 : 1;
  const cards = [
    <OrdersCard key="orders" period={period} money={money} onOpen={() => onOpenTable('orders')} />,
    <PaymentsCard key="payments" period={period} money={money} moneyWhole={moneyWhole} onOpen={() => onOpenTable('payments')} />,
    <WhereSoldCard key="where-sold" period={period} money={money} moneyWhole={moneyWhole} onOpen={() => onOpenTable('where-sold')} />,
    <TopProductsCard key="products" period={period} money={money} products={products} onOpen={() => onOpenTable('products')} />,
    <CategoriesCard key="categories" period={period} money={money} moneyWhole={moneyWhole} categories={categories} onOpen={() => onOpenTable('categories')} />,
    <CashiersCard key="cashiers" period={period} money={money} moneyWhole={moneyWhole} cashiers={cashiers} onOpen={() => onOpenTable('cashiers')} />,
    <TaxesCard key="taxes" period={period} money={money} onOpen={() => onOpenTable('taxes')} />,
  ];
  return (
    <View testID="reports-period-section" className="gap-4" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {Array.from({ length: Math.ceil(cards.length / columns) }, (_, row) => (
        <View key={row} testID={`reports-period-row-${row}`} className="flex-row gap-4">
          {Array.from({ length: columns }, (_, cell) => (
            <View key={cell} className="min-w-0 flex-1">{cards[row * columns + cell]}</View>
          ))}
        </View>
      ))}
    </View>
  );
}
