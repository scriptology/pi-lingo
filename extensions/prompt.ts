export function buildTranslationPrompt(text: string, lang: string): string {
  return `Translate the following text into ${lang}. Respond ONLY with the three variants below. Do not add introductions, explanations, notes, or horizontal rules.

*Formal*

<translation here>

*Natural*

<translation here>

*Informal*

<translation here>

Text to translate: """${text}"""`;
}
