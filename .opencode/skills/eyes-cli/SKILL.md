---
name: eyes-cli
description: OpenRouter multi-model CLI. Text chat (DeepSeek V4 Flash) and image vision (Nemotron 3 Nano Omni). Auto free → paid fallback when daily credits exhausted. Daily reset to free.
allowed-tools: Bash(eyes *)
---

# eyes-cli

Multi-model CLI with automatic free → paid fallback.

## Text
```bash
eyes "your question or task"
```

## Vision
```bash
eyes screenshot.png "optional prompt"
```

## Model strategy
- Free first, paid fallback on rate limit, reset daily
