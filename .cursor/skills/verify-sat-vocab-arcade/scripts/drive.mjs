#!/usr/bin/env node
/**
 * Drive SAT Word Blitz through the Chrome session started by launch.sh.
 * Connects over CDP, runs one command, prints JSON, disconnects.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_RUN_DIR = path.join(SKILL_DIR, ".verify-run");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

const runDir = process.env.SAT_VOCAB_RUN_DIR || DEFAULT_RUN_DIR;
const fileEnv = loadEnvFile(path.join(runDir, "env"));
const PORT = process.env.SAT_VOCAB_PORT || fileEnv.SAT_VOCAB_PORT || "8000";
const CDP = process.env.SAT_VOCAB_CDP || fileEnv.SAT_VOCAB_CDP || "9222";
const URL = process.env.SAT_VOCAB_URL || fileEnv.SAT_VOCAB_URL || `http://127.0.0.1:${PORT}/`;
const CDP_URL = process.env.SAT_VOCAB_CDP_URL || fileEnv.SAT_VOCAB_CDP_URL || `http://127.0.0.1:${CDP}`;
const EVIDENCE = process.env.SAT_VOCAB_EVIDENCE || path.join(runDir, "shots");
const STORAGE_KEY = "satWordBlitz.v1";

function parseArgs(raw) {
  const out = { command: undefined, rest: [], shot: null };
  const args = raw.slice();
  while (args.length) {
    const tok = args.shift();
    if (tok === "--shot") {
      out.shot = args.shift() || null;
      continue;
    }
    if (!out.command) {
      out.command = tok;
      continue;
    }
    out.rest.push(tok);
  }
  return out;
}

const parsed = parseArgs(process.argv.slice(2));
const command = parsed.command;
const rest = parsed.rest;
const shotName = parsed.shot;

function usage() {
  return [
    "Usage: drive.mjs [--shot <name>] <command> [args]",
    "  --shot <name>      PNG in the same CDP session (needed to catch a 280ms hit grade)",
    "  ready              wait for the home screen",
    "  state              dump screen, HUD, choices, localStorage",
    "  shot <name>        PNG under $SAT_VOCAB_EVIDENCE/shots or .verify-run/shots",
    "  html               print current HTML",
    "  click-play         click #playBtn (PLAY)",
    "  click-again        click #againBtn (PLAY AGAIN)",
    "  click-home         click #homeBtn (HOME)",
    "  click-mute         click #muteBtn",
    "  key <k>            press 1-4, a-d, Enter, or Space",
    "  key-correct        press the 1-4 key for the right definition",
    "  key-wrong          press a 1-4 key for a wrong definition",
    "  answer-correct     click the correct .choice",
    "  answer-wrong       click a wrong .choice",
    "  wait-countdown     wait until #countdown is visible",
    "  wait-playing       wait until a real word and 4 choices are showing",
    "  wait-results       wait until #results is active (up to 75s)",
    "  wait <ms>          sleep",
    "  storage            print localStorage satWordBlitz.v1",
    "  clear-storage      remove satWordBlitz.v1 and reload home stats",
    "  goto               navigate to the arcade URL",
  ].join("\n");
}

function fail(message, extra) {
  const payload = { ok: false, error: message, ...(extra || {}) };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(1);
}

async function saveShot(page, name) {
  const dir = path.join(EVIDENCE, "shots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name.endsWith(".png") ? name : `${name}.png`);
  await page.screenshot({ path: file, type: "png" });
  return file;
}

async function connect() {
  try {
    return await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: { width: 390, height: 844 },
    });
  } catch (err) {
    fail(`cannot connect to ${CDP_URL} — run launch.sh first`, { detail: String(err) });
  }
}

async function getPage(browser) {
  const pages = await browser.pages();
  const match = pages.find((p) => {
    try {
      return p.url().includes(`:${PORT}`);
    } catch {
      return false;
    }
  });
  if (match) return match;
  const page = pages[0] || await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  return page;
}

async function readStorage(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { parseError: raw };
    }
  }, STORAGE_KEY);
}

async function snapshot(page) {
  return page.evaluate((storageKey) => {
    const hidden = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      return el.hasAttribute("hidden") || el.hidden === true;
    };
    const text = (id) => {
      const el = document.getElementById(id);
      return el ? String(el.textContent || "").trim() : null;
    };
    const cls = (id) => {
      const el = document.getElementById(id);
      return el ? el.className : null;
    };
    const choices = [...document.querySelectorAll("#choices .choice")].map((btn, i) => ({
      idx: i,
      key: (btn.querySelector(".key") || {}).textContent || String(i + 1),
      text: (btn.querySelector("span:last-child") || btn).textContent.trim(),
      className: btn.className,
      disabled: btn.disabled,
    }));
    const screen = hidden("home") === false && document.getElementById("home")?.classList.contains("is-active")
      ? "home"
      : hidden("play") === false && document.getElementById("play")?.classList.contains("is-active")
        ? "play"
        : hidden("results") === false && document.getElementById("results")?.classList.contains("is-active")
          ? "results"
          : "unknown";
    let storage = null;
    try {
      const raw = localStorage.getItem(storageKey);
      storage = raw ? JSON.parse(raw) : null;
    } catch {
      storage = { parseError: true };
    }
    return {
      url: location.href,
      screen,
      homeHidden: hidden("home"),
      playHidden: hidden("play"),
      resultsHidden: hidden("results"),
      countdownHidden: hidden("countdown"),
      questionHidden: hidden("questionWrap"),
      countdown: text("countdownNum"),
      word: text("wordEl"),
      playStatus: text("playStatus"),
      feedback: text("feedback"),
      feedbackClass: cls("feedback"),
      score: text("scoreEl"),
      time: text("timeEl"),
      combo: text("comboEl"),
      comboClass: cls("comboEl"),
      choices,
      finalScore: text("finalScore"),
      highNote: text("highNote"),
      highNoteHidden: hidden("highNote"),
      comboNote: text("comboNote"),
      comboNoteHidden: hidden("comboNote"),
      hitCount: text("hitCount"),
      missCount: text("missCount"),
      runCombo: text("runCombo"),
      missedHidden: hidden("missedWrap"),
      missed: [...document.querySelectorAll("#missedList li")].map((li) => li.innerText.trim()),
      homeBest: text("homeBest"),
      homeCombo: text("homeCombo"),
      homeGames: text("homeGames"),
      mute: {
        pressed: document.getElementById("muteBtn")?.getAttribute("aria-pressed"),
        label: document.getElementById("muteBtn")?.getAttribute("aria-label"),
        text: text("muteBtn"),
      },
      playDisabled: document.getElementById("playBtn")?.disabled ?? null,
      storage,
    };
  }, STORAGE_KEY);
}

async function waitForWordBank(page) {
  await page.waitForFunction(() => Array.isArray(window.SAT_WORDS) && window.SAT_WORDS.length > 0, {
    timeout: 8000,
  });
}

async function correctIndex(page) {
  await waitForWordBank(page);
  return page.evaluate(() => {
    const word = (document.getElementById("wordEl")?.textContent || "").trim();
    const item = (window.SAT_WORDS || []).find((w) => w.w === word);
    if (!item) return { word, idx: -1, def: null };
    const buttons = [...document.querySelectorAll("#choices .choice")];
    const idx = buttons.findIndex((btn) => {
      const body = btn.querySelector("span:last-child");
      return body && body.textContent === item.d;
    });
    return { word, idx, def: item.d, key: idx >= 0 ? String(idx + 1) : null };
  });
}

async function waitCountdown(page) {
  await page.waitForFunction(() => {
    const c = document.getElementById("countdown");
    return c && !c.hidden && !c.hasAttribute("hidden");
  }, { timeout: 5000 });
}

async function waitPlaying(page) {
  await page.waitForFunction(() => {
    const play = document.getElementById("play");
    const q = document.getElementById("questionWrap");
    const word = document.getElementById("wordEl");
    const choices = document.querySelectorAll("#choices .choice");
    return play && !play.hidden && play.classList.contains("is-active")
      && q && !q.hidden
      && word && word.textContent.trim() !== "—"
      && choices.length === 4;
  }, { timeout: 8000 });
}

async function waitResults(page) {
  await page.waitForFunction(() => {
    const results = document.getElementById("results");
    return results && !results.hidden && results.classList.contains("is-active");
  }, { timeout: 75000 });
}

async function pressKey(page, raw) {
  const k = String(raw || "").toLowerCase();
  const map = {
    enter: "Enter",
    space: " ",
    " ": " ",
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    a: "a",
    b: "b",
    c: "c",
    d: "d",
  };
  if (!(k in map)) fail(`unsupported key ${raw}`);
  await page.keyboard.press(map[k]);
  return map[k];
}

async function run(page) {
  switch (command) {
    case "ready": {
      await page.waitForSelector("#playBtn", { visible: true, timeout: 8000 });
      await page.waitForFunction(() => {
        const home = document.getElementById("home");
        return home && !home.hidden && home.classList.contains("is-active");
      }, { timeout: 8000 });
      const state = await snapshot(page);
      return { ok: true, command, state };
    }
    case "state":
      return { ok: true, command, state: await snapshot(page) };
    case "shot": {
      const name = rest[0];
      if (!name) fail("shot requires a name");
      const file = await saveShot(page, name);
      return { ok: true, command, file };
    }
    case "html":
      return { ok: true, command, html: await page.content() };
    case "click-play":
      await page.waitForSelector("#playBtn", { visible: true });
      await page.click("#playBtn");
      return { ok: true, command, clicked: "#playBtn" };
    case "click-again":
      await page.waitForSelector("#againBtn", { visible: true });
      await page.click("#againBtn");
      return { ok: true, command, clicked: "#againBtn" };
    case "click-home":
      await page.waitForSelector("#homeBtn", { visible: true });
      await page.click("#homeBtn");
      return { ok: true, command, clicked: "#homeBtn" };
    case "click-mute":
      await page.waitForSelector("#muteBtn", { visible: true });
      await page.click("#muteBtn");
      return { ok: true, command, mute: (await snapshot(page)).mute };
    case "key": {
      const pressed = await pressKey(page, rest[0]);
      return { ok: true, command, key: pressed };
    }
    case "key-correct": {
      const found = await correctIndex(page);
      if (found.idx < 0) fail("could not map word to a choice", found);
      await pressKey(page, found.key);
      await new Promise((r) => setTimeout(r, 120));
      return { ok: true, command, ...found, state: await snapshot(page) };
    }
    case "key-wrong": {
      const found = await correctIndex(page);
      if (found.idx < 0) fail("could not map word to a choice", found);
      const wrong = found.idx === 0 ? 1 : 0;
      const key = String(wrong + 1);
      await pressKey(page, key);
      await new Promise((r) => setTimeout(r, 120));
      return { ok: true, command, word: found.word, key, correctKey: found.key, state: await snapshot(page) };
    }
    case "answer-correct": {
      const found = await correctIndex(page);
      if (found.idx < 0) fail("could not map word to a choice", found);
      const buttons = await page.$$("#choices .choice");
      await buttons[found.idx].click();
      await new Promise((r) => setTimeout(r, 120));
      return { ok: true, command, ...found, state: await snapshot(page) };
    }
    case "answer-wrong": {
      const found = await correctIndex(page);
      if (found.idx < 0) fail("could not map word to a choice", found);
      const wrong = found.idx === 0 ? 1 : 0;
      const buttons = await page.$$("#choices .choice");
      await buttons[wrong].click();
      await new Promise((r) => setTimeout(r, 120));
      return { ok: true, command, word: found.word, idx: wrong, correctIdx: found.idx, state: await snapshot(page) };
    }
    case "wait-countdown":
      await waitCountdown(page);
      return { ok: true, command, state: await snapshot(page) };
    case "wait-playing":
      await waitPlaying(page);
      return { ok: true, command, state: await snapshot(page) };
    case "wait-results":
      await waitResults(page);
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true, command, state: await snapshot(page) };
    case "wait": {
      const ms = Number(rest[0]);
      if (!Number.isFinite(ms) || ms < 0) fail("wait requires milliseconds");
      await new Promise((r) => setTimeout(r, ms));
      return { ok: true, command, ms };
    }
    case "storage":
      return { ok: true, command, storage: await readStorage(page) };
    case "clear-storage": {
      await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#playBtn", { visible: true });
      return { ok: true, command, storage: await readStorage(page), state: await snapshot(page) };
    }
    case "goto":
      await page.goto(URL, { waitUntil: "domcontentloaded" });
      return { ok: true, command, url: page.url(), state: await snapshot(page) };
    case undefined:
    case "help":
    case "--help":
      console.log(usage());
      return { ok: true, command: "help" };
    default: {
      const _exhaustive = command;
      fail(`unknown command ${String(_exhaustive)}`, { usage: usage() });
    }
  }
}

async function main() {
  if (!command || command === "help" || command === "--help") {
    console.log(usage());
    return;
  }
  const browser = await connect();
  try {
    const page = await getPage(browser);
    const result = await run(page);
    if (shotName && result && command !== "shot") {
      result.file = await saveShot(page, shotName);
    }
    if (result && result.html) {
      console.log(result.html);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } finally {
    browser.disconnect();
  }
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});
