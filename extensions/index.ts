import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig, createState, type LingoState } from "./config.js";
import { isValidBCP47, normalizeBCP47 } from "./bcp47.js";
import { buildTranslationPrompt } from "./prompt.js";
import { extractTextContent, formatTranslationOutput, parseTranslationResponse } from "./parser.js";

export default function lingoExtension(pi: ExtensionAPI) {
  const config = createState(loadConfig());
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
        "Target language (BCP 47, e.g. en, en-GB, es, zh-Hans):",
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
      saveConfig({ targetLanguage: config.targetLanguage });
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

      saveConfig({ targetLanguage: config.targetLanguage });
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
