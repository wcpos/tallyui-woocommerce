import { woocommerceDiscountCodes } from '@tallyui/pos';
import type { PosOrder, SaleDiscountCodes } from '@tallyui/pos';
import type { RxCollection } from 'rxdb';

// The sale screen passes this to useSale as discountCodes.
export function saleDiscountCodes(deps: {
  coupons: RxCollection; products: RxCollection; orders: RxCollection<PosOrder>;
}): SaleDiscountCodes<any> {
  return woocommerceDiscountCodes.createDiscountCodes(woocommerceDiscountCodes.createSaleCouponSource(deps));
}
