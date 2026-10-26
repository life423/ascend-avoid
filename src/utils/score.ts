const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 3 });

/** Keep arena labels short at uncapped totals; exact values remain in the DOM title/accessibility text. */
export function formatGems(value: number): string {
  return Math.abs(value) >= 10000 ? compact.format(value) : String(Math.round(value));
}
