/** 参考汇率注记（中文 / 英文同一事实数据，仅文案不同）。 */
import { fxEntry } from './pricing';
import type { FxFile } from '../data/schemas';

export const fxNote = (fx: FxFile | null | undefined, cur = 'USD'): string | null => {
  const e = fxEntry(fx, cur);
  return e && e.rateDate ? `1 USD = ${e.rate} CNY（中国外汇交易中心中间价 ${e.rateDate}）` : null;
};

export const enFxNote = (fx: FxFile | null | undefined, cur = 'USD'): string | null => {
  const e = fxEntry(fx, cur);
  return e && e.rate > 0 && e.rateDate ? `1 ${cur} = ${e.rate} CNY, CFETS central parity rate ${e.rateDate}` : null;
};
