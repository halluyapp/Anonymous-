/** Split text into measured lines without dropping characters or paragraph breaks. */
export function wrapText(value, maxWidth, measure) {
  const lines = [];
  for (const paragraph of value.replace(/\r\n/g, '\n').split('\n')) {
    let line = '';
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
