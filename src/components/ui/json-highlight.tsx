"use client";

type TokenType =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punctuation"
  | "whitespace";

type Token = { type: TokenType; value: string };

function tokenize(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < json.length) {
    if (/\s/.test(json[i])) {
      let ws = "";
      while (i < json.length && /\s/.test(json[i])) ws += json[i++];
      tokens.push({ type: "whitespace", value: ws });
      continue;
    }

    if (json[i] === '"') {
      let str = '"';
      i++;
      while (i < json.length) {
        if (json[i] === "\\") {
          str += json[i] + json[i + 1];
          i += 2;
        } else if (json[i] === '"') {
          str += '"';
          i++;
          break;
        } else {
          str += json[i++];
        }
      }
      let j = i;
      while (j < json.length && /\s/.test(json[j])) j++;
      tokens.push({ type: json[j] === ":" ? "key" : "string", value: str });
      continue;
    }

    if (json.slice(i, i + 4) === "true") {
      tokens.push({ type: "boolean", value: "true" });
      i += 4;
      continue;
    }
    if (json.slice(i, i + 5) === "false") {
      tokens.push({ type: "boolean", value: "false" });
      i += 5;
      continue;
    }
    if (json.slice(i, i + 4) === "null") {
      tokens.push({ type: "null", value: "null" });
      i += 4;
      continue;
    }

    if (/[-\d]/.test(json[i])) {
      let num = "";
      while (i < json.length && /[-\d.eE+]/.test(json[i])) num += json[i++];
      tokens.push({ type: "number", value: num });
      continue;
    }

    tokens.push({ type: "punctuation", value: json[i++] });
  }

  return tokens;
}

const COLOR: Record<TokenType, string> = {
  key: "text-[#0451a5] dark:text-[#9cdcfe]",
  string: "text-[#a31515] dark:text-[#ce9178]",
  number: "text-[#098658] dark:text-[#b5cea8]",
  boolean: "text-[#0000ff] dark:text-[#569cd6]",
  null: "text-[#0000ff] dark:text-[#569cd6]",
  punctuation: "text-[#393a34] dark:text-[#d4d4d4]",
  whitespace: "",
};

export function JsonHighlight({
  value,
  raw,
  maxHeight = "9rem",
}: {
  value?: unknown;
  raw?: string;
  maxHeight?: string;
}) {
  const json = raw ?? JSON.stringify(value, null, 2);
  const tokens = tokenize(json);

  return (
    <pre
      className="overflow-auto rounded-md border bg-[#fffffe] p-3 font-mono text-xs leading-relaxed dark:bg-[#1e1e1e]"
      style={{ maxHeight }}
    >
      {tokens.map((tok, idx) =>
        tok.type === "whitespace" ? (
          tok.value
        ) : (
          <span key={idx} className={COLOR[tok.type]}>
            {tok.value}
          </span>
        ),
      )}
    </pre>
  );
}
