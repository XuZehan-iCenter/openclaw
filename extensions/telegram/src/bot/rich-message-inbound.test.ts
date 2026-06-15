// Tests for Telegram inbound rich message → markdown conversion.
import { describe, expect, it } from "vitest";
import { convertTelegramRichMessageToMarkdown } from "./rich-message-inbound.js";

describe("convertTelegramRichMessageToMarkdown", () => {
  it("returns undefined for null/undefined input", () => {
    expect(convertTelegramRichMessageToMarkdown(undefined)).toBeUndefined();
    expect(convertTelegramRichMessageToMarkdown(null)).toBeUndefined();
    expect(convertTelegramRichMessageToMarkdown({ blocks: [] })).toBeUndefined();
    expect(convertTelegramRichMessageToMarkdown({})).toBeUndefined();
  });

  it("converts a simple paragraph", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [{ type: "paragraph", text: "Hello world" }],
    });
    expect(result).toBe("Hello world");
  });

  it("converts headings with correct level", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        { type: "heading", text: "Title", size: 1 },
        { type: "heading", text: "Subtitle", size: 3 },
      ],
    });
    expect(result).toContain("# Title");
    expect(result).toContain("### Subtitle");
  });

  it("converts preformatted blocks with language", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        { type: "pre", text: "const x = 1;", language: "javascript" },
      ],
    });
    expect(result).toContain("```javascript");
    expect(result).toContain("const x = 1;");
    expect(result).toContain("```");
  });

  it("converts tables to markdown pipe format", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "table",
          cells: [
            [
              { text: "Name", is_header: true },
              { text: "Value", is_header: true },
            ],
            [{ text: "A" }, { text: "1" }],
            [{ text: "B" }, { text: "2" }],
          ],
        },
      ],
    });
    expect(result).toContain("| Name | Value |");
    expect(result).toContain("| --- | --- |");
    expect(result).toContain("| A | 1 |");
    expect(result).toContain("| B | 2 |");
  });

  it("converts lists with numbered labels", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "list",
          items: [
            { label: "•", blocks: [{ type: "paragraph", text: "First item" }] },
            { label: "•", blocks: [{ type: "paragraph", text: "Second item" }] },
          ],
        },
      ],
    });
    expect(result).toContain("•. First item");
    expect(result).toContain("•. Second item");
  });

  it("converts checklists", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "list",
          items: [
            {
              label: "•",
              blocks: [{ type: "paragraph", text: "Done task" }],
              has_checkbox: true,
              is_checked: true,
            },
            {
              label: "•",
              blocks: [{ type: "paragraph", text: "Pending task" }],
              has_checkbox: true,
              is_checked: false,
            },
          ],
        },
      ],
    });
    expect(result).toContain("[x] Done task");
    expect(result).toContain("[ ] Pending task");
  });

  it("converts inline rich text formatting", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "paragraph",
          text: [
            "Normal ",
            { type: "bold", text: "bold" },
            " ",
            { type: "italic", text: "italic" },
            " ",
            { type: "code", text: "code" },
          ],
        },
      ],
    });
    expect(result).toContain("**bold**");
    expect(result).toContain("*italic*");
    expect(result).toContain("`code`");
  });

  it("converts block quotation", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "block_quotation",
          text: "This is a quote",
        },
      ],
    });
    expect(result).toContain("> This is a quote");
  });

  it("converts details/expandable blocks", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "details",
          summary: "Click to expand",
          blocks: [{ type: "paragraph", text: "Hidden content" }],
        },
      ],
    });
    expect(result).toContain("<details>");
    expect(result).toContain("<summary>Click to expand</summary>");
    expect(result).toContain("Hidden content");
    expect(result).toContain("</details>");
  });

  it("converts dividers", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [{ type: "divider" }],
    });
    expect(result).toContain("---");
  });

  it("handles multiple blocks separated by blank lines", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        { type: "paragraph", text: "First paragraph" },
        { type: "paragraph", text: "Second paragraph" },
      ],
    });
    expect(result).toContain("First paragraph");
    expect(result).toContain("Second paragraph");
  });

  it("converts URLs as rich text", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "paragraph",
          text: [
            { type: "url", text: "Click here", url: "https://example.com" },
          ],
        },
      ],
    });
    expect(result).toContain("Click here");
  });

  it("converts mathematical expressions", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "mathematical_expression",
          text: "E = mc^2",
        },
      ],
    });
    expect(result).toContain("$E = mc^2$");
  });

  it("handles empty text in blocks gracefully", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        { type: "paragraph", text: "" },
        { type: "divider" },
      ],
    });
    expect(result).toContain("---");
  });

  it("converts spoiler text", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "paragraph",
          text: [{ type: "spoiler", text: "hidden" }],
        },
      ],
    });
    expect(result).toContain("||hidden||");
  });

  it("converts strikethrough text", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        {
          type: "paragraph",
          text: [{ type: "strikethrough", text: "deleted" }],
        },
      ],
    });
    expect(result).toContain("~~deleted~~");
  });

  it("converts a realistic forwarded rich message", () => {
    const result = convertTelegramRichMessageToMarkdown({
      blocks: [
        { type: "heading", text: "System Status Report", size: 1 },
        { type: "paragraph", text: "Current system metrics:" },
        {
          type: "table",
          cells: [
            [
              { text: "Metric", is_header: true },
              { text: "Value", is_header: true },
              { text: "Status", is_header: true },
            ],
            [{ text: "CPU" }, { text: "45%" }, { text: "OK" }],
            [{ text: "Memory" }, { text: "8.2 GB" }, { text: "Warning" }],
            [{ text: "Disk" }, { text: "120 GB" }, { text: "OK" }],
          ],
        },
        { type: "divider" },
        {
          type: "details",
          summary: "Raw logs",
          blocks: [
            {
              type: "pre",
              text: "[2026-06-15] All services healthy",
              language: "log",
            },
          ],
        },
      ],
    });
    expect(result).toContain("# System Status Report");
    expect(result).toContain("Current system metrics:");
    expect(result).toContain("| Metric | Value | Status |");
    expect(result).toContain("| CPU | 45% | OK |");
    expect(result).toContain("| Memory | 8.2 GB | Warning |");
    expect(result).toContain("---");
    expect(result).toContain("<details>");
    expect(result).toContain("```log");
    expect(result).toContain("[2026-06-15] All services healthy");
  });
});
