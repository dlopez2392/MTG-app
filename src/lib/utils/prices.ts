export function formatPrice(price: string | null | undefined, currency: string = "usd"): string {
  if (!price) return "—";
  const num = parseFloat(price);
  if (isNaN(num)) return "—";

  switch (currency) {
    case "eur":
      return `€${num.toFixed(2)}`;
    case "tix":
      return `${num.toFixed(2)} tix`;
    default:
      return `$${num.toFixed(2)}`;
  }
}

export function getPriceValue(price: string | null | undefined): number {
  if (!price) return 0;
  const num = parseFloat(price);
  return isNaN(num) ? 0 : num;
}
