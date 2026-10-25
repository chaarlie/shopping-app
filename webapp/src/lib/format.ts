const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
export function money(cents: number): string {
  return formatter.format(cents / 100);
}
export function dateTime(value: string): string {
  return new Date(value).toLocaleString();
}
