export interface SourceMultilineLine {
  start: number;
  length: number;
  extent: number;
  text: string;
}

export interface SourceMultilineMetrics {
  extent(text: string): number;
  advance(text: string): number;
}

/** MultiLine::formatText paragraph, delimiter, extent and fitting-prefix consumption. */
export function sourceMultilineLayout(text: string, width: number, metrics: SourceMultilineMetrics): SourceMultilineLine[] {
  width = Math.fround(width);
  const characters = Array.from(text), lines: SourceMultilineLine[] = [];
  for (let paragraphStart = 0; paragraphStart < characters.length;) {
    const newline = characters.indexOf('\n', paragraphStart);
    const paragraphEnd = newline < 0 ? characters.length : newline + 1;
    let cursor = paragraphStart;
    while (cursor < paragraphEnd) {
      let count = 0, extent = 0;
      while (cursor + count < paragraphEnd) {
        const tokenStart = cursor + count;
        let tokenEnd = tokenStart;
        while (tokenEnd < paragraphEnd && !'\n\t\r'.includes(characters[tokenEnd])) tokenEnd++;
        if (tokenEnd === tokenStart) tokenEnd++;
        const token = characters.slice(tokenStart, tokenEnd).join(''), tokenExtent = Math.fround(metrics.extent(token));
        if (extent + tokenExtent <= width || width <= 0) {
          extent = Math.fround(extent + tokenExtent); count += tokenEnd - tokenStart;
        } else {
          if (!count) {
            while (count < tokenEnd - tokenStart && Math.fround(metrics.advance(characters.slice(cursor, cursor + count + 1).join(''))) <= width) count++;
            // The original zero-prefix path cannot advance; keep overwide Web glyphs readable in the clip.
            count = Math.max(1, count);
          }
          break;
        }
      }
      lines.push({start: cursor, length: count, extent, text: characters.slice(cursor, cursor + count).join('')});
      cursor += count;
    }
    paragraphStart = paragraphEnd;
  }
  return lines;
}
