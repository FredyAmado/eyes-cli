#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";

const args = process.argv.slice(2);
if (args[0] === "--version" || args[0] === "-v") {
  console.log("eyes-cli v1.0.0");
  process.exit(0);
}

const [imagePath, ...promptParts] = args;
const prompt = promptParts.join(" ") || "Describe esta imagen con detalle en español. ¿Qué ves?";

if (!imagePath) {
  console.error("Usage: eyes <image-path> [prompt]");
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY not set");
  process.exit(1);
}

const isVision = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].some((ext) =>
  imagePath.toLowerCase().endsWith(ext)
);

const FREE_MODEL = isVision
  ? "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
  : "deepseek/deepseek-v4-flash:free";

const PAID_MODEL = isVision
  ? "google/gemini-3.1-flash-lite-preview"
  : "deepseek/deepseek-v4-flash";

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
  const body = { model, messages: [{ role: "user", content: [] }], max_tokens: 1536 };
  const mime = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
  if (isVision) {
    const base64 = readFileSync(imagePath).toString("base64");
    body.messages[0].content.push(
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
    );
  } else {
    body.messages[0].content = prompt;
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
if (state.useFree) modelsToTry.push(FREE_MODEL);
modelsToTry.push(PAID_MODEL);

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
