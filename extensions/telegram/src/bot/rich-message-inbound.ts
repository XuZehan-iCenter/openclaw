// Telegram inbound rich message converter: Bot API 10.1 RichMessage → agent-readable markdown.
//
// When a forwarded rich message arrives, the Telegram update contains a `rich_message` field
// (type: RichMessage) but no `text` or `caption`. This module converts the structured blocks
// into markdown so the agent can read the content.

/** Minimal type shapes for Telegram Bot API 10.1 rich message structures. */

type RichTextNode = string | RichTextNode[] | RichTextTypedNode;

interface RichTextTypedNode {
  type: string;
  text?: RichTextNode;
  // RichTextUrl
  url?: string;
  // RichTextEmailAddress
  email_address?: string;
  // RichTextPhoneNumber
  phone_number?: string;
  // RichTextBankCardNumber
  bank_card_number?: string;
  // RichTextMention
  username?: string;
  // RichTextHashtag / RichTextCashtag / RichTextBotCommand
  hashtag?: string;
  cashtag?: string;
  bot_command?: string;
  // RichTextAnchor / RichTextAnchorLink / RichTextReference / RichTextReferenceLink
  name?: string;
  anchor_name?: string;
  reference_name?: string;
  // RichTextCustomEmoji
  custom_emoji_id?: string;
  alternative_text?: string;
  // RichTextMathematicalExpression
  expression?: string;
  // RichTextDateTime
  unix_time?: number;
  date_time_format?: string;
  // RichTextTextMention
  user?: { id?: number; first_name?: string; last_name?: string; username?: string };
  // RichTextSubscript / RichTextSuperscript - same as text wrapper
}

interface RichBlockNode {
  type: string;
  text?: RichTextNode;
  // RichBlockSectionHeading
  size?: number;
  // RichBlockPreformatted
  language?: string;
  // RichBlockList
  items?: RichBlockListItem[];
  // RichBlockTable
  cells?: RichBlockTableCell[][];
  caption?: RichTextNode;
  // RichBlockDetails
  summary?: RichTextNode;
  blocks?: RichBlockNode[];
  is_open?: boolean;
  // RichBlockBlockQuotation / RichBlockPullQuotation
  // (uses blocks/text)
  // RichBlockFooter
  // (uses text)
  // RichBlockCollage / RichBlockSlideshow / RichBlockMap / RichBlockAnimation etc.
  // Media blocks - best-effort text extraction
  // RichBlockThinking
}

interface RichBlockListItem {
  label?: string;
  blocks?: RichBlockNode[];
  has_checkbox?: boolean;
  is_checked?: boolean;
}

interface RichBlockTableCell {
  text?: RichTextNode;
  is_header?: boolean;
  colspan?: number;
}

interface RichMessageData {
  blocks?: RichBlockNode[];
  is_rtl?: boolean;
}

/**
 * Converts a RichText node (recursive union type) to a plain string.
 * RichText can be: a string, an array of RichText, or a typed object with `type`.
 */
function richTextToPlain(node: RichTextNode | undefined | null): string {
  if (node == null) {
    return "";
  }
  if (typeof node === "string") {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(richTextToPlain).join("");
  }
  // Typed node
  const typed = node as RichTextTypedNode;
  switch (typed.type) {
    case "bold":
      return `**${richTextToPlain(typed.text)}**`;
    case "italic":
      return `*${richTextToPlain(typed.text)}*`;
    case "underline":
      return `<u>${richTextToPlain(typed.text)}</u>`;
    case "strikethrough":
      return `~~${richTextToPlain(typed.text)}~~`;
    case "spoiler":
      return `||${richTextToPlain(typed.text)}||`;
    case "code":
      return `\`${richTextToPlain(typed.text)}\``;
    case "pre":
      return `\`\`\`\n${richTextToPlain(typed.text)}\n\`\`\``;
    case "url":
      return richTextToPlain(typed.text) || typed.url || "";
    case "email_address":
      return richTextToPlain(typed.text) || typed.email_address || "";
    case "phone_number":
      return richTextToPlain(typed.text) || typed.phone_number || "";
    case "bank_card_number":
      return richTextToPlain(typed.text) || typed.bank_card_number || "";
    case "mention":
      return richTextToPlain(typed.text) || (typed.username ? `@${typed.username}` : "");
    case "text_mention": {
      const user = typed.user;
      const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
      return richTextToPlain(typed.text) || name || (user?.username ? `@${user.username}` : "");
    }
    case "hashtag":
      return richTextToPlain(typed.text) || typed.hashtag || "";
    case "cashtag":
      return richTextToPlain(typed.text) || typed.cashtag || "";
    case "bot_command":
      return richTextToPlain(typed.text) || typed.bot_command || "";
    case "anchor":
      return typed.name || "";
    case "anchor_link":
      return richTextToPlain(typed.text) || "";
    case "reference":
      return richTextToPlain(typed.text) || typed.name || "";
    case "reference_link":
      return richTextToPlain(typed.text) || "";
    case "custom_emoji":
      return typed.alternative_text || "";
    case "mathematical_expression":
      return typed.expression ? `$${typed.expression}$` : "";
    case "date_time":
      return richTextToPlain(typed.text) || "";
    case "subscript":
      return richTextToPlain(typed.text);
    case "superscript":
      return richTextToPlain(typed.text);
    case "marked":
      return `==${richTextToPlain(typed.text)}==`;
    default:
      // Unknown rich text type - extract text if present
      return richTextToPlain(typed.text);
  }
}

/** Convert a single RichBlock to markdown text. */
function richBlockToMarkdown(block: RichBlockNode, indent = ""): string {
  switch (block.type) {
    case "paragraph":
      return `${indent}${richTextToPlain(block.text)}\n`;

    case "heading": {
      const level = Math.min(Math.max(block.size ?? 1, 1), 6);
      const prefix = "#".repeat(level);
      return `${indent}${prefix} ${richTextToPlain(block.text)}\n`;
    }

    case "pre": {
      const lang = block.language ?? "";
      return `${indent}\`\`\`${lang}\n${richTextToPlain(block.text)}\n\`\`\`\n`;
    }

    case "footer":
      return `${indent}${richTextToPlain(block.text)}\n`;

    case "divider":
      return `${indent}---\n`;

    case "mathematical_expression":
      return block.text ? `${indent}$${richTextToPlain(block.text)}$\n` : "";

    case "anchor":
      return ""; // Anchors are invisible markers

    case "list": {
      const items = block.items ?? [];
      const lines: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const label = item.label ?? `${i + 1}`;
        const checkbox = item.has_checkbox ? (item.is_checked ? "[x] " : "[ ] ") : "";
        const itemContent = (item.blocks ?? [])
          .map((b) => richBlockToMarkdown(b, `${indent}  `))
          .join("")
          .trim();
        lines.push(`${indent}${label}. ${checkbox}${itemContent}`);
      }
      return lines.join("\n") + "\n";
    }

    case "block_quotation": {
      const content = block.text
        ? richTextToPlain(block.text)
        : (block.blocks ?? []).map((b) => richBlockToMarkdown(b)).join("");
      const quoted = content
        .split("\n")
        .map((line) => `${indent}> ${line}`)
        .join("\n");
      return `${quoted}\n`;
    }

    case "pull_quotation": {
      const content = block.text ? richTextToPlain(block.text) : "";
      return `${indent}> *${content}*\n`;
    }

    case "table": {
      const rows = block.cells ?? [];
      if (rows.length === 0) return "";
      const lines: string[] = [];
      // Convert each row to pipe-separated cells
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const cellTexts = row.map((cell) => {
          const text = richTextToPlain(cell.text).replace(/\|/g, "\\|").replace(/\n/g, " ");
          return cell.text ? text : "";
        });
        lines.push(`${indent}| ${cellTexts.join(" | ")} |`);
        // Add separator after first row (header)
        if (r === 0) {
          lines.push(`${indent}| ${cellTexts.map(() => "---").join(" | ")} |`);
        }
      }
      if (block.caption) {
        lines.push(`${indent}*${richTextToPlain(block.caption)}*`);
      }
      return lines.join("\n") + "\n";
    }

    case "details": {
      const summary = richTextToPlain(block.summary);
      const content = (block.blocks ?? [])
        .map((b) => richBlockToMarkdown(b, `${indent}  `))
        .join("");
      return `${indent}<details>\n${indent}  <summary>${summary}</summary>\n${content}${indent}</details>\n`;
    }

    case "collage":
    case "slideshow":
    case "map":
    case "animation":
    case "audio":
    case "photo":
    case "video":
    case "voice_note": {
      // Media blocks - extract caption if available
      const caption = block.text ? richTextToPlain(block.text) : "";
      return caption ? `${indent}[${block.type}] ${caption}\n` : `${indent}[${block.type}]\n`;
    }

    case "thinking": {
      const content = block.text ? richTextToPlain(block.text) : "";
      return content ? `${indent}[thinking: ${content}]\n` : "";
    }

    default: {
      // Unknown block type - best-effort text extraction
      const text = block.text ? richTextToPlain(block.text) : "";
      const childBlocks = block.blocks ?? [];
      const children = childBlocks.map((b) => richBlockToMarkdown(b, indent)).join("");
      return text ? `${indent}${text}\n` : children;
    }
  }
}

/**
 * Converts a Telegram RichMessage (Bot API 10.1) to agent-readable markdown text.
 * Returns undefined if the rich_message field is absent or empty.
 */
export function convertTelegramRichMessageToMarkdown(
  richMessage: RichMessageData | undefined | null,
): string | undefined {
  if (!richMessage?.blocks?.length) {
    return undefined;
  }
  const parts = richMessage.blocks.map((block) => richBlockToMarkdown(block));
  const markdown = parts.join("\n").trim();
  return markdown || undefined;
}
