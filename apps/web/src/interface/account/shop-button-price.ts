/** Button amounts use the same star-coin display unit as purchase confirmation. */
export function shopButtonPrice({moneyPrice, tokenPrice}: {moneyPrice?: number; tokenPrice?: number}): string | undefined {
  const prices: string[] = [];
  if (tokenPrice !== undefined && tokenPrice > 0) prices.push(`星币${tokenPrice / 10}`);
  if (moneyPrice !== undefined) prices.push(`金币${moneyPrice}`);
  return prices.length ? prices.join(' / ') : undefined;
}
