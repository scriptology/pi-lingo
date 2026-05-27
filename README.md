<p align="center">
  <img src="pi-lingo-logo.png" alt="pi-lingo" width="117">
</p>

Translation extension for [Pi coding agent](https://github.com/earendil-works/pi). Toggle translation mode and get three variants — Formal, Natural, and Informal — for any text you type.

## Install

```bash
pi install npm:pi-lingo
```

Or add to your project's `.pi/settings.json`:

```json
{
  "packages": ["npm:pi-lingo"]
}
```

## What You Get

### Commands

| Command | Description |
|---------|-------------|
| `/lingo` | Toggle translation mode on/off |
| `/lingo on` | Enable translation mode |
| `/lingo off` | Disable translation mode |
| `/lingo settings` | Open language settings |
| `/lingo-settings` | Configure target language (BCP 47) |

### Features

- **Toggle mode** — Turn translation on/off mid-session without restarting Pi
- **Three variants** — Every translation returns Formal, Natural, and Informal versions
- **BCP 47 language tags** — Supports `en`, `en-GB`, `es`, `zh-Hans`, `pt-BR`, and any valid IETF language tag
- **Persistent config** — Target language and mode state survive across sessions
- **Status indicator** — Shows `lingo:en` (or your language) in the footer when active

## Usage

Enable translation mode:

```
/lingo on
```

Type any text and Pi translates it automatically:

```
> Hola, ¿cómo estás?

*Formal*

Hello, how are you?

*Natural*

Hi, how's it going?

*Informal*

Hey, what's up?
```

Disable when you want normal Pi behavior:

```
/lingo off
```

### Configure Language

```
/lingo-settings
```

Enter any valid BCP 47 tag, for example:
- `en` — English (generic)
- `en-GB` — British English
- `es` — Spanish
- `de` — German
- `zh-Hans` — Simplified Chinese
- `fr-CA` — Canadian French

Invalid tags are rejected with an error message.

## Requirements

- [Pi coding agent](https://github.com/earendil-works/pi) v0.37+
- An LLM provider configured in Pi

## How It Works

When translation mode is active, the extension intercepts your input via Pi's `input` event and transforms it into a structured translation prompt. The LLM responds with three variants, which the extension reformats into clean markdown with italic headers.

The extension does **not** add tools to the LLM context — everything happens transparently through prompt transformation, so there is no extra token overhead when the mode is off.

## License

MIT
