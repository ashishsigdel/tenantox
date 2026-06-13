import { Fragment } from "react";

/** Renders inline **bold**, *italic*, and `code` within a line. */
function inline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-sm">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/**
 * Lightweight markdown: headings (#, ##, ###), bullet lists (-, *), and
 * paragraphs with inline bold/italic/code. Avoids a markdown dependency.
 */
export function Markdown({ source }: { source: string }) {
  const lines = (source ?? "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-1 pl-5 text-sm">
        {list.map((item, i) => (
          <li key={`${key}-${i}`}>{inline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `md-${i}`;
    if (/^###\s+/.test(line)) {
      flushList(`${key}-l`);
      blocks.push(
        <h3 key={key} className="text-base font-medium">
          {inline(line.replace(/^###\s+/, ""), key)}
        </h3>,
      );
    } else if (/^##\s+/.test(line)) {
      flushList(`${key}-l`);
      blocks.push(
        <h2 key={key} className="text-lg font-semibold">
          {inline(line.replace(/^##\s+/, ""), key)}
        </h2>,
      );
    } else if (/^#\s+/.test(line)) {
      flushList(`${key}-l`);
      blocks.push(
        <h1 key={key} className="text-xl font-semibold">
          {inline(line.replace(/^#\s+/, ""), key)}
        </h1>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
    } else if (line.trim() === "") {
      flushList(`${key}-l`);
    } else {
      flushList(`${key}-l`);
      blocks.push(
        <p key={key} className="text-sm text-muted-foreground">
          {inline(line, key)}
        </p>,
      );
    }
  });
  flushList("md-tail");

  return <div className="space-y-2">{blocks}</div>;
}
