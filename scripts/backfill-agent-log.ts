/**
 * One-off recovery tool for a session whose live UserPromptSubmit/Stop hooks
 * never fired. This repo's very first session started before
 * .claude/settings.json existed, and (confirmed directly in CAPTURE-TEST.md,
 * via temporary debug logging that never fired for it) this harness doesn't
 * hot-reload newly-added project hooks into an already-running session the
 * way the interactive CLI docs describe. Two brand-new sessions picked the
 * hook up immediately — this one specifically never will.
 *
 * This script does NOT summarize or edit anything. It mechanically extracts
 * real human prompts (transcript entries with origin.kind === "human") and
 * each turn's final assistant text (the message with stop_reason ===
 * "end_turn", text blocks only — no thinking, no tool_use) straight from the
 * session's own transcript JSONL, in a single linear pass that assigns each
 * end_turn message to whichever human prompt most recently opened (assistant
 * entries carry no promptId of their own — only parentUuid chains — so
 * chronological order is the grouping key), and writes them in the identical
 * format capture.js produces. Re-running it is safe: it only appends turns
 * beyond whatever's already in the log file.
 *
 * Usage: npx tsx scripts/backfill-agent-log.ts <path-to-transcript.jsonl>
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

interface TranscriptEntry {
  type?: string;
  sessionId?: string;
  timestamp?: string;
  origin?: { kind?: string };
  message?: {
    role?: string;
    content?: unknown;
    stop_reason?: string;
    model?: string;
  };
}

interface TurnRecord {
  promptText: string;
  promptTimestamp: string;
  responseText: string | null;
  responseTimestamp: string | null;
  model: string | null;
}

function gitAuthor(): string {
  try {
    const name = execSync("git config user.name", { encoding: "utf8" }).trim();
    if (name) return name;
  } catch {
    // ignore
  }
  return process.env.USERNAME || process.env.USER || "unknown";
}

function main() {
  const transcriptPath = process.argv[2];
  if (!transcriptPath) {
    console.error("Usage: npx tsx scripts/backfill-agent-log.ts <transcript.jsonl>");
    process.exit(1);
  }

  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  const turns: TurnRecord[] = [];
  let current: TurnRecord | null = null;
  let sessionId = "";

  for (const line of lines) {
    let entry: TranscriptEntry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    sessionId = entry.sessionId || sessionId;

    if (
      entry.type === "user" &&
      entry.origin?.kind === "human" &&
      typeof entry.message?.content === "string"
    ) {
      current = {
        promptText: entry.message.content,
        promptTimestamp: entry.timestamp!,
        responseText: null,
        responseTimestamp: null,
        model: null,
      };
      turns.push(current);
      continue;
    }

    if (entry.type === "assistant" && entry.message?.stop_reason === "end_turn" && current) {
      const content = entry.message.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter((b): b is { type: "text"; text: string } => {
          return typeof b === "object" && b !== null && "type" in b && b.type === "text";
        })
        .map((b) => b.text)
        .join("\n\n")
        .trim();
      if (text) {
        current.responseText = text;
        current.responseTimestamp = entry.timestamp!;
        current.model = entry.message.model || current.model;
      }
    }
  }

  const completeTurns = turns.filter((t) => t.responseText !== null);

  console.log(
    `Found ${turns.length} human turns in transcript, ${completeTurns.length} have a completed final response.`
  );
  if (completeTurns.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  const logsDir = path.join(process.cwd(), ".agent-logs");
  fs.mkdirSync(logsDir, { recursive: true });

  const existingFile = fs.readdirSync(logsDir).find((f) => f.endsWith(`_${sessionId}.md`));
  let filePath: string;
  let content: string;
  const author = gitAuthor();
  const projectName = path.basename(process.cwd());

  if (existingFile) {
    filePath = path.join(logsDir, existingFile);
    content = fs.readFileSync(filePath, "utf8");
  } else {
    const first = completeTurns[0];
    const dateStr = first.promptTimestamp.slice(0, 10);
    const timeStr = first.promptTimestamp.slice(11, 19).replace(/:/g, "-");
    filePath = path.join(logsDir, `${dateStr}_${timeStr}_${sessionId}.md`);
    const fm =
      `---\n` +
      `session_id: ${sessionId}\n` +
      `date: ${dateStr}\n` +
      `author: ${author}\n` +
      `model: ${first.model || "unknown"}\n` +
      `tool: claude-code\n` +
      `project: ${projectName}\n` +
      `total_exchanges: 0\n` +
      `first_prompt_time: ${first.promptTimestamp}\n` +
      `last_prompt_time: ${first.promptTimestamp}\n` +
      `---`;
    content = `${fm}\n\n# Session Log - ${dateStr}\n\nSession: \`${sessionId.slice(0, 8)}\` | Project: \`${projectName}\` | Author: \`${author}\`\n`;
  }

  const alreadyLogged = (content.match(/\[LOG_ENTRY type=PROMPT num=\d+/g) || []).length;
  const newTurns = completeTurns.slice(alreadyLogged);

  if (newTurns.length === 0) {
    console.log("Log file already has every completed turn from this transcript. Nothing new to append.");
    return;
  }

  let num = alreadyLogged;
  let lastModel = "unknown";
  for (const turn of newTurns) {
    num++;
    lastModel = turn.model || lastModel;
    content += `\n\n---\n\n[LOG_ENTRY type=PROMPT num=${num} session=${sessionId}]\ntimestamp: ${turn.promptTimestamp}\nmodel: ${turn.model}\n\n${turn.promptText}\n`;
    content += `\n\n[LOG_ENTRY type=RESPONSE num=${num} session=${sessionId}]\ntimestamp: ${turn.responseTimestamp}\nmodel: ${turn.model}\n\n${turn.responseText}\n`;
  }

  content = content.replace(/total_exchanges: \d+/, `total_exchanges: ${num}`);
  content = content.replace(
    /last_prompt_time: [^\n]+/,
    `last_prompt_time: ${newTurns[newTurns.length - 1].promptTimestamp}`
  );
  content = content.replace(/^model: .+$/m, `model: ${lastModel}`);

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Wrote ${newTurns.length} new turn(s) to ${filePath}`);
}

main();
