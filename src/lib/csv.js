// Minimal CSV serializer. Quotes cells that contain a comma, newline, or
// double-quote, and escapes internal double-quotes per RFC 4180.

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV(rows, columns) {
  const headers = columns.map((c) => c.label ?? c.key);
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const raw = typeof c.get === 'function' ? c.get(row) : row[c.key];
        return escapeCell(raw);
      })
      .join(','),
  );
  return [headers.map(escapeCell).join(','), ...body].join('\n');
}

export function downloadCSV(filename, rows, columns) {
  const csv = toCSV(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
