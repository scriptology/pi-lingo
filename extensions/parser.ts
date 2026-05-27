export function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: "text"; text: string } => c?.type === "text")
    .map((c) => c.text)
    .join("");
}

export function parseTranslationResponse(text: string): { formal: string; natural: string; informal: string } | null {
  // Match header optionally wrapped in * or _ and optionally followed by :
  const formalIdx = text.search(/\b[*_]?Formal[*_]?:?\s*/i);
  const naturalIdx = text.search(/\b[*_]?Natural[*_]?:?\s*/i);
  const informalIdx = text.search(/\b[*_]?Informal[*_]?:?\s*/i);

  if (formalIdx === -1 || naturalIdx === -1 || informalIdx === -1) {
    return null;
  }

  const sections = [
    { name: "formal" as const, idx: formalIdx },
    { name: "natural" as const, idx: naturalIdx },
    { name: "informal" as const, idx: informalIdx },
  ].sort((a, b) => a.idx - b.idx);

  const result: Partial<Record<string, string>> = {};

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const headerMatch = text.slice(sec.idx).match(new RegExp(`^\\b[*_]?${sec.name}[*_]?:?\\s*`, "i"));
    if (!headerMatch) continue;

    const start = sec.idx + headerMatch[0].length;
    const end = i < sections.length - 1 ? sections[i + 1].idx : text.length;
    let content = text.slice(start, end).trim();

    // Strip stray code-block fences and horizontal-rule separators anywhere in the content
    content = content
      .replace(/^```(?:\w*)?\n?/, "")
      .replace(/```\s*$/, "")
      .replace(/\n?---+\s*\n?/g, "\n")
      .trim();

    result[sec.name] = content;
  }

  if (!result.formal || !result.natural || !result.informal) {
    return null;
  }

  return result as { formal: string; natural: string; informal: string };
}

export function formatTranslationOutput(parsed: { formal: string; natural: string; informal: string }): string {
  return `*Formal*

${parsed.formal}

*Natural*

${parsed.natural}

*Informal*

${parsed.informal}`;
}
