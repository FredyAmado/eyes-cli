---
name: eyes-cli
description: OpenRouter multi-model CLI for describing images (vision) and text chat. Automatically uses free models first (DeepSeek V4 Flash for text, Nemotron 3 Nano Omni for vision), falls back to cheap paid models when daily free credits run out, and resets to free the next day. Use when the user shares an image, screenshot, or asks about visual content.
allowed-tools: Bash(node *)
---

# eyes-cli

OpenRouter multi-model CLI with automatic fallback.

## Model strategy
- **Free model** (tries first): `deepseek/deepseek-v4-flash:free` (text) / `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` (vision)
- **Paid fallback**: `deepseek/deepseek-v4-flash` (text) / `google/gemini-3.1-flash-lite-preview` (vision)
- Resets to free mode daily

## Usage

```bash
eyes <image-path> [custom-prompt]
```

## Examples

```bash
eyes screenshot.png
eyes diagram.jpg "Explain this architecture diagram"
eyes photo.png "What UI components and colors do you see?"
```
