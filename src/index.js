#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from "fs";
import { homedir } from "os";

const args = process.argv.slice(2);

if (args[0] === "--version" || args[0] === "-v") {
  console.log("eyes-cli v2.0.0");
  process.exit(0);
}

if (args[0] === "--models" || args[0] === "-m") {
  console.log("Text free:    deepseek/deepseek-v4-flash:free");
  console.log("Text paid:    deepseek/deepseek-v4-flash");
  console.log("Vision free:  nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");
  console.log("Vision paid:  google/gemini-3.1-flash-lite-preview");
  process.exit(0);
}

const input = args[0];
const isVision = isImage(input);

let textPrompt, imagePath;
if (isVision) {
  imagePath = input;
  textPrompt = args.slice(1).join(" ") || "Describe esta imagen con detalle en español. ¿Qué ves?";
} else {
  textPrompt = args.join(" ");
  imagePath = null;
}

if (!textPrompt && !imagePath) {
  console.error("Usage:");
  console.error("  eyes <prompt>                                  # text chat");
  console.error("  eyes <image-path> [prompt]                     # image description");
  console.error("  eyes --models                                   # list models");
  console.error("  eyes --version                                  # show version");
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY not set");
  process.exit(1);
}

const FREE_TEXT = "deepseek/deepseek-v4-flash:free";
const PAID_TEXT = "deepseek/deepseek-v4-flash";
const FREE_VISION = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const PAID_VISION = "google/gemini-3.1-flash-lite-preview";

const FREE = isVision ? FREE_VISION : FREE_TEXT;
const PAID = isVision ? PAID_VISION : PAID_TEXT;

const stateDir = homedir() + "/.eyes-cli";
if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
const stateFile = stateDir + "/state.json";
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf-8")) : { date: "", useFree: true };

const today = new Date().toISOString().slice(0, 10);
if (state.date !== today) {
  state.date = today;
  state.useFree = true;
  writeFileSync(stateFile, JSON.stringify(state));
}

async function tryModel(model) {
  const body = { model, messages: [{ role: "user", content: "" }], max_tokens: 2048 };

  if (isVision) {
    const mime = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    const base64 = readFileSync(imagePath).toString("base64");
    body.messages[0].content = [
      { type: "text", text: textPrompt },
      { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
    ];
  } else {
    body.messages[0].content = textPrompt;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    const msg = data.error.message || "";
    const isRateLimit = msg.includes("Rate limit") || msg.includes("Insufficient") || msg.includes("429");
    return { ok: false, rateLimited: isRateLimit, raw: data };
  }
  return { ok: true, text: data.choices?.[0]?.message?.content || "" };
}

const modelsToTry = [];
if (state.useFree) modelsToTry.push(FREE);
modelsToTry.push(PAID);

for (const model of modelsToTry) {
  const result = await tryModel(model);
  if (result.ok) {
    console.log(result.text);
    process.exit(0);
  }
  if (result.rateLimited) {
    state.useFree = false;
    writeFileSync(stateFile, JSON.stringify(state));
    continue;
  }
  console.error("API Error:", JSON.stringify(result.raw.error || result.raw));
  process.exit(1);
}

console.error("All models failed");
process.exit(1);

function isImage(p) {
  if (!p || p.startsWith("-")) return false;
  try { return statSync(p).isFile() && /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(p); }
  catch { return false; }
}
