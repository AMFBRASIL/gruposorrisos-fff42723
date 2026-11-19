export type QuoteRank = { supplierId: string; unitPrice: number; days: number; freight?: number; rating?: number };

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function quoteTotal(quote: QuoteRank, qty: number) {
  return quote.unitPrice * qty + (quote.freight ?? 0);
}

export function rankQuotes(quotes: QuoteRank[], qty: number, mode: "cost" | "balanced") {
  const min = Math.min(...quotes.map((quote) => quoteTotal(quote, qty)));
  return quotes.map((quote) => {
    const rating = quote.rating ?? 0;
    const total = quoteTotal(quote, qty);
    const score = (total === 0 ? 1 : min / total) * 60 + Math.max(0, 20 - quote.days) + rating * 4;
    return { ...quote, total, rating, score };
  }).sort((left, right) => mode === "cost" ? left.total - right.total || left.days - right.days : right.score - left.score);
}

export function stepApplies(step: { minValue?: number; maxValue?: number; branchId?: string; category?: string }, context: { value: number; branchId: string; categories: string[] }) {
  return context.value >= (step.minValue ?? 0) && context.value <= (step.maxValue ?? Number.POSITIVE_INFINITY) && (!step.branchId || step.branchId === context.branchId) && (!step.category || context.categories.includes(step.category));
}
