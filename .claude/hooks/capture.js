#!/usr/bin/env node
/*
 * Capture hook for the 8x assignment.
 * Registered on UserPromptSubmit ("prompt" mode) and Stop ("stop" mode) in
 * .claude/settings.json. Appends one PROMPT entry per user turn and one
 * RESPONSE entry per assistant turn to a per-session file in .agent-logs/.
 *
 * Deliberately dependency-free (no jq/yaml) so it runs anywhere Node does.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function getProjectDir() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

// Stop hook input carries last_assistant_message but not always a "model"
// field, and UserPromptSubmit never does. The transcript's most recent
// assistant line always has message.model, so fall back to that.
function findModelFromTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        continue;
      }
      if (obj.type === 'assistant' && obj.message && obj.message.model) {
        return obj.message.model;
      }
    }
  } catch (e) {
    // ignore, fall through to null
  }
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function gitAuthor() {
  try {
    const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
    if (name) return name;
  } catch (e) {
    // ignore
  }
  return process.env.USERNAME || process.env.USER || 'unknown';
}

function findSessionFile(logsDir, sessionId) {
  if (!fs.existsSync(logsDir)) return null;
  const files = fs.readdirSync(logsDir);
  const match = files.find((f) => f.endsWith(`_${sessionId}.md`));
  return match ? path.join(logsDir, match) : null;
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) return null;
  const end = content.indexOf('\n---', 4);
  if (end === -1) return null;
  const fmBlock = content.slice(4, end);
  const rest = content.slice(end + 4);
  const fields = {};
  const order = [];
  fmBlock.split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fields[key] = value;
    order.push(key);
  });
  return { fields, order, rest };
}

function serializeFrontmatter(fields, order) {
  const lines = order.map((k) => `${k}: ${fields[k]}`);
  return `---\n${lines.join('\n')}\n---`;
}

function updateFrontmatterFields(content, updates) {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;
  Object.assign(parsed.fields, updates);
  const newFm = serializeFrontmatter(parsed.fields, parsed.order);
  return newFm + parsed.rest;
}

function createSessionFile(logsDir, sessionId, timestamp, model, projectName, author) {
  const dateStr = timestamp.slice(0, 10);
  const timeStr = timestamp.slice(11, 19).replace(/:/g, '-');
  const filename = `${dateStr}_${timeStr}_${sessionId}.md`;
  const filePath = path.join(logsDir, filename);
  const fields = {
    session_id: sessionId,
    date: dateStr,
    author: author,
    model: model || 'unknown',
    tool: 'claude-code',
    project: projectName,
    total_exchanges: '0',
    first_prompt_time: timestamp,
    last_prompt_time: timestamp,
  };
  const order = Object.keys(fields);
  const fm = serializeFrontmatter(fields, order);
  const shortId = sessionId.slice(0, 8);
  const body = `\n\n# Session Log - ${dateStr}\n\nSession: \`${shortId}\` | Project: \`${projectName}\` | Author: \`${author}\`\n`;
  fs.writeFileSync(filePath, fm + body, 'utf8');
  return filePath;
}

function countPromptEntries(content) {
  const matches = content.match(/\[LOG_ENTRY type=PROMPT num=\d+/g) || [];
  return matches.length;
}

function lastPromptNum(content) {
  const matches = [...content.matchAll(/\[LOG_ENTRY type=PROMPT num=(\d+)/g)];
  if (matches.length === 0) return 0;
  return parseInt(matches[matches.length - 1][1], 10);
}

function main() {
  const mode = process.argv[2];
  const raw = readStdin();
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch (e) {
    data = {};
  }

  const sessionId = data.session_id || 'unknown-session';
  const transcriptPath = data.transcript_path;
  const projectDir = getProjectDir();
  const logsDir = path.join(projectDir, '.agent-logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const timestamp = nowIso();
  const model = data.model || findModelFromTranscript(transcriptPath) || 'unknown';

  let filePath = findSessionFile(logsDir, sessionId);

  if (mode === 'prompt') {
    const prompt = data.prompt;
    if (typeof prompt !== 'string' || prompt.length === 0) return;
    const projectName = path.basename(projectDir);
    const author = gitAuthor();
    if (!filePath) {
      filePath = createSessionFile(logsDir, sessionId, timestamp, model, projectName, author);
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const num = countPromptEntries(content) + 1;
    const entry = `\n\n---\n\n[LOG_ENTRY type=PROMPT num=${num} session=${sessionId}]\ntimestamp: ${timestamp}\nmodel: ${model}\n\n${prompt}\n`;
    content = content + entry;
    content = updateFrontmatterFields(content, {
      total_exchanges: String(num),
      last_prompt_time: timestamp,
      model: model,
    });
    fs.writeFileSync(filePath, content, 'utf8');
  } else if (mode === 'stop') {
    if (!filePath) return; // no PROMPT entry recorded for this session yet
    const response = data.last_assistant_message;
    if (typeof response !== 'string' || response.length === 0) return;
    let content = fs.readFileSync(filePath, 'utf8');
    const num = lastPromptNum(content);
    if (num === 0) return;
    const already = new RegExp(`\\[LOG_ENTRY type=RESPONSE num=${num} `).test(content);
    if (already) return; // Stop already recorded for this turn
    const entry = `\n\n[LOG_ENTRY type=RESPONSE num=${num} session=${sessionId}]\ntimestamp: ${timestamp}\nmodel: ${model}\n\n${response}\n`;
    content = content + entry;
    content = updateFrontmatterFields(content, { model: model });
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

main();
