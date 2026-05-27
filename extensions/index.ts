import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface LingoConfig {
  targetLanguage: string;
  isActive: boolean;
}

const CONFIG_FILE = "lingo.json";

function getConfigPath(): string {
  return join(getAgentDir(), CONFIG_FILE);
}

function loadConfig(): LingoConfig {
  const path = getConfigPath();
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, "utf-8")) as Partial<LingoConfig>;
      return {
        targetLanguage: typeof data.targetLanguage === "string" && data.targetLanguage
          ? data.targetLanguage
          : "en",
        isActive: !!data.isActive,
      };
    } catch {
      // ignore parse errors, fallback to defaults
    }
  }
  return { targetLanguage: "en", isActive: false };
}

function saveConfig(cfg: LingoConfig): void {
  const dir = getAgentDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

function isValidBCP47(tag: string): boolean {
  try {
    const locale = new Intl.Locale(tag);
    return !!locale.language && locale.language.length >= 2;
  } catch {
    return false;
  }
}

function normalizeBCP47(tag: string): string {
  try {
    return new Intl.Locale(tag).toString();
  } catch {
    return tag.trim().toLowerCase();
  }
}

function buildTranslationPrompt(text: string, lang: string): string {
  return `Translate the following text into ${lang}. Respond ONLY with the three variants below. Do not add introductions, explanations, or notes.

*Formal*

<translation here>

---

*Natural*

<translation here>

---

*Informal*

<translation here>

Text to translate: """${text}"""`;
}

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is { type: "text"; text: string } => c?.type === "text")
    .map((c) => c.text)
    .join("");
}

function parseTranslationResponse(text: string): { formal: string; natural: string; informal: string } | null {
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

    // Strip stray code-block fences and horizontal-rule separators
    content = content
      .replace(/^```(?:\w*)?\n?/, "")
      .replace(/```\s*$/, "")
      .replace(/^(---+\s*)+/, "")
      .replace(/(\s*---+)+\s*$/, "")
      .trim();

    result[sec.name] = content;
  }

  if (!result.formal || !result.natural || !result.informal) {
    return null;
  }

  return result as { formal: string; natural: string; informal: string };
}

function formatTranslationOutput(parsed: { formal: string; natural: string; informal: string }): string {
  return `*Formal*

${parsed.formal}

---

*Natural*

${parsed.natural}

---

*Informal*

${parsed.informal}`;
}

export default function lingoExtension(pi: ExtensionAPI) {
  const config = loadConfig();
  let activeTranslationTurn = false;

  function updateStatus(ctx: ExtensionContext) {
    if (config.isActive) {
      ctx.ui.setStatus("lingo", ctx.ui.theme.fg("accent", `lingo:${config.targetLanguage}`));
    } else {
      ctx.ui.setStatus("lingo", undefined);
    }
  }

  // /lingo-settings — configure target language
  pi.registerCommand("lingo-settings", {
    description: "Configure pi-lingo target language (BCP 47)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("lingo-settings requires interactive mode", "error");
        return;
      }

      const input = await ctx.ui.input(
        "Target language (BCP 47, e.g. en, en-GB, ru, zh-Hans):",
        config.targetLanguage
      );

      if (input === undefined) {
        ctx.ui.notify("Settings cancelled", "warning");
        return;
      }

      const trimmed = input.trim();
      if (!trimmed) {
        ctx.ui.notify("Language cannot be empty", "error");
        return;
      }

      if (!isValidBCP47(trimmed)) {
        ctx.ui.notify(`Invalid BCP 47 language tag: "${trimmed}"`, "error");
        return;
      }

      config.targetLanguage = normalizeBCP47(trimmed);
      saveConfig(config);
      ctx.ui.notify(`Target language set to: ${config.targetLanguage}`, "info");
      updateStatus(ctx);
    },
  });

  // /lingo [on|off|settings] — toggle or set translation mode
  pi.registerCommand("lingo", {
    description: "Toggle translation mode (on/off) or open settings",
    handler: async (args, ctx) => {
      const arg = args?.trim().toLowerCase() ?? "";

      if (arg === "settings" || arg === "config") {
        // Trigger settings command via follow-up so the current command handler can return
        pi.sendUserMessage("/lingo-settings", { deliverAs: "followUp" });
        return;
      }

      if (arg === "on") {
        config.isActive = true;
      } else if (arg === "off") {
        config.isActive = false;
      } else {
        config.isActive = !config.isActive;
      }

      saveConfig(config);
      updateStatus(ctx);
      ctx.ui.notify(
        config.isActive
          ? `Translation mode ON → ${config.targetLanguage}`
          : "Translation mode OFF",
        "info"
      );
    },
  });

  // Input transformation: when active, turn any user message into a translation request
  pi.on("input", async (event, _ctx) => {
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const text = event.text;

    // Skip commands, bash, and empty input
    if (text.startsWith("/") || text.startsWith("!") || !text.trim()) {
      return { action: "continue" };
    }

    if (!config.isActive) {
      return { action: "continue" };
    }

    activeTranslationTurn = true;
    const prompt = buildTranslationPrompt(text, config.targetLanguage);
    return { action: "transform", text: prompt };
  });

  // Reformat assistant translation responses for consistent markdown output
  pi.on("message_end", async (event, _ctx) => {
    if (!activeTranslationTurn) return;
    if (event.message.role !== "assistant") return;

    activeTranslationTurn = false;

    const rawText = extractTextContent(event.message.content);
    const parsed = parseTranslationResponse(rawText);
    if (!parsed) return;

    const formatted = formatTranslationOutput(parsed);
    return {
      message: {
        ...event.message,
        content: [{ type: "text", text: formatted }],
      },
    };
  });

  // Safety: clear flag at turn end in case message_end didn't fire
  pi.on("turn_end", async () => {
    activeTranslationTurn = false;
  });

  // Restore status on session start
  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);
  });
}
