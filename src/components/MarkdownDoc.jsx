// Tiny markdown renderer for the legal pages. Handles only what the legal
// docs use: # / ## / ### headings, paragraphs, ordered/unordered lists,
// bold via **text**, and inline links. Avoids pulling a full markdown lib
// into the bundle.

function renderInline(text) {
  // **bold**
  const parts = [];
  let last = 0;
  const re = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={m.index} className="text-ink">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownDoc({ source }) {
  if (!source) return null;
  const blocks = source.split(/\n{2,}/);
  return (
    <article className="space-y-4 text-sm text-mute">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={i} className="mt-6 font-display text-lg tracking-wider2 text-ink">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={i} className="mt-8 font-display text-xl tracking-wider2 text-gold">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={i} className="font-display text-3xl tracking-wider2 text-gold sm:text-4xl">
              {trimmed.slice(2)}
            </h1>
          );
        }
        const lines = trimmed.split('\n');
        if (lines.every((l) => /^[-*] /.test(l))) {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^[-*] /, ''))}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((l) => /^\d+\. /.test(l))) {
          return (
            <ol key={i} className="ml-5 list-decimal space-y-1">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\d+\.\s/, ''))}</li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </article>
  );
}
