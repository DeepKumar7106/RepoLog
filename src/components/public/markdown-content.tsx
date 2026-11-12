import type { ReactNode } from "react";

type MarkdownBlock =
  | { type: "code"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

function isSafeLink(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("http://");
}

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:[^()]|\([^()]*\))*\))/g);

  return tokens.map((token, index) => {
    if (!token) {
      return null;
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]" key={index}>
          {token.slice(1, -1)}
        </code>
      );
    }

    const link = /^\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)$/.exec(token);

    if (link) {
      const [, label, url] = link;

      if (isSafeLink(url)) {
        return (
          <a
            className="font-medium text-slate-900 underline"
            href={url}
            key={index}
            rel="noreferrer"
            target="_blank"
          >
            {label}
          </a>
        );
      }

      return label;
    }

    return token;
  });
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  function flushParagraph(paragraph: string[]) {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph.length = 0;
    }
  }

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === "") {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const paragraph: string[] = [];

    while (index < lines.length) {
      const current = lines[index].trim();

      if (
        current === "" ||
        current.startsWith("```") ||
        /^#{1,6}\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }

      paragraph.push(current);
      index += 1;
    }

    flushParagraph(paragraph);
  }

  return blocks;
}

export function MarkdownContent({ markdown }: Readonly<{ markdown: string }>) {
  if (!markdown.trim()) {
    return null;
  }

  const blocks = parseMarkdown(markdown);

  return (
    <div className="space-y-4 text-sm leading-6 text-slate-700">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const level = Math.min(Math.max(block.level, 1), 3);
          const Tag = `h${level}` as "h1" | "h2" | "h3";

          return (
            <Tag className="font-semibold text-slate-900" key={index}>
              {renderInline(block.text)}
            </Tag>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100"
              key={index}
            >
              <code>{block.text}</code>
            </pre>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";

          return (
            <ListTag
              className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}
              key={index}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        return <p key={index}>{renderInline(block.text)}</p>;
      })}
    </div>
  );
}
