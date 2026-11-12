import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/public/markdown-content";

describe("MarkdownContent", () => {
  it("renders supported markdown without injecting raw HTML", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        markdown: [
          "# Project",
          "",
          "A **bold** statement with `code`.",
          "",
          "- one",
          "- two",
          "",
          "<script>alert('xss')</script>",
          "",
          "[unsafe](javascript:alert('xss'))",
        ].join("\n"),
      }),
    );

    expect(html).toContain("<h1");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain(">code</code>");
    expect(html).toContain("<li>one</li>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });

  it("allows safe http links", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        markdown: "[Example](https://example.com)",
      }),
    );

    expect(html).toContain('href="https://example.com"');
  });
});
