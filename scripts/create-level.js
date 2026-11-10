#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { randomBytes } = require('node:crypto');
const { stdin, stdout } = require('node:process');

const MAX_TREE_DEPTH = 100;
const MAX_TREE_NODES = 1000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function sourceError(message) {
  return new Error(`Invalid levels.js: ${message}`);
}

class LevelsSourceParser {
  constructor(source) {
    this.source = source;
    this.index = 0;
    this.token = null;
    this.next();
  }

  next() {
    const source = this.source;
    while (this.index < source.length) {
      if (/\s/.test(source[this.index])) {
        this.index += 1;
        continue;
      }

      if (source.startsWith('//', this.index)) {
        const newline = source.indexOf('\n', this.index + 2);
        this.index = newline === -1 ? source.length : newline + 1;
        continue;
      }

      if (source.startsWith('/*', this.index)) {
        const end = source.indexOf('*/', this.index + 2);
        if (end === -1) {
          throw sourceError('unterminated block comment.');
        }
        this.index = end + 2;
        continue;
      }

      break;
    }

    const start = this.index;
    if (start >= source.length) {
      this.token = { type: 'eof', start, end: start };
      return;
    }

    const character = source[this.index];
    if ('[]{}:,;='.includes(character)) {
      this.index += 1;
      this.token = { type: character, value: character, start, end: this.index };
      return;
    }

    if (character === "'" || character === '"') {
      this.token = this.readString(character, start);
      return;
    }

    if (/[A-Za-z_$]/.test(character)) {
      this.index += 1;
      while (this.index < source.length && /[\w$]/.test(source[this.index])) {
        this.index += 1;
      }
      this.token = {
        type: 'identifier',
        value: source.slice(start, this.index),
        start,
        end: this.index,
      };
      return;
    }

    throw sourceError(`unexpected character at offset ${start}.`);
  }

  readString(quote, start) {
    this.index += 1;
    let value = '';
    while (this.index < this.source.length) {
      const character = this.source[this.index++];
      if (character === quote) {
        return { type: 'string', value, start, end: this.index };
      }
      if (character === '\n' || character === '\r') {
        throw sourceError(`unescaped newline in string at offset ${start}.`);
      }
      if (character !== '\\') {
        value += character;
        continue;
      }

      if (this.index >= this.source.length) {
        throw sourceError(`unterminated escape in string at offset ${start}.`);
      }
      const escaped = this.source[this.index++];
      const escapes = {
        "'": "'",
        '"': '"',
        '\\': '\\',
        '/': '/',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        v: '\v',
        0: '\0',
      };
      if (Object.hasOwn(escapes, escaped)) {
        value += escapes[escaped];
      } else if (escaped === 'x' || escaped === 'u') {
        const digits = escaped === 'x' ? 2 : 4;
        const hex = this.source.slice(this.index, this.index + digits);
        if (!new RegExp(`^[0-9a-fA-F]{${digits}}$`).test(hex)) {
          throw sourceError(`invalid string escape at offset ${this.index - 2}.`);
        }
        value += String.fromCharCode(parseInt(hex, 16));
        this.index += digits;
      } else if (escaped === '\n') {
        // JavaScript permits a backslash-newline line continuation.
      } else {
        value += escaped;
      }
    }
    throw sourceError(`unterminated string at offset ${start}.`);
  }

  consume(type, value) {
    if (this.token.type !== type || (value !== undefined && this.token.value !== value)) {
      throw sourceError(
        `expected ${value === undefined ? type : JSON.stringify(value)} near offset ${this.token.start}.`,
      );
    }
    const token = this.token;
    this.next();
    return token;
  }

  parseValue() {
    if (this.token.type === 'string') {
      const value = this.token.value;
      this.next();
      return value;
    }
    if (this.token.type === '[') {
      return this.parseArray().values;
    }
    if (this.token.type === '{') {
      return this.parseObject();
    }
    throw sourceError(`only string, object, and array literals are supported near offset ${this.token.start}.`);
  }

  parseArray() {
    const open = this.consume('[');
    const values = [];
    while (this.token.type !== ']') {
      if (this.token.type === 'eof') {
        throw sourceError('unterminated array.');
      }
      values.push(this.parseValue());
      if (this.token.type !== ',') {
        break;
      }
      this.consume(',');
      if (this.token.type === ']') {
        break;
      }
    }
    const close = this.consume(']');
    return { values, openIndex: open.start, closeIndex: close.start };
  }

  parseObject() {
    this.consume('{');
    const object = Object.create(null);
    while (this.token.type !== '}') {
      if (this.token.type === 'eof') {
        throw sourceError('unterminated object.');
      }
      if (this.token.type !== 'identifier' && this.token.type !== 'string') {
        throw sourceError(`expected an object key near offset ${this.token.start}.`);
      }
      const key = this.token.value;
      this.next();
      if (Object.hasOwn(object, key)) {
        throw sourceError(`duplicate object key ${JSON.stringify(key)}.`);
      }
      this.consume(':');
      object[key] = this.parseValue();
      if (this.token.type !== ',') {
        break;
      }
      this.consume(',');
      if (this.token.type === '}') {
        break;
      }
    }
    this.consume('}');
    return object;
  }
}

function parseLevelsSource(source) {
  const parser = new LevelsSourceParser(source);
  parser.consume('identifier', 'export');
  parser.consume('identifier', 'const');
  parser.consume('identifier', 'GAME_LEVELS');
  parser.consume('=');
  const parsedArray = parser.parseArray();
  parser.consume(';');
  parser.consume('eof');
  return {
    levels: parsedArray.values,
    openIndex: parsedArray.openIndex,
    closeIndex: parsedArray.closeIndex,
  };
}

function requireExactKeys(value, expectedKeys, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${context} must contain exactly: ${expected.join(', ')}.`);
  }
}

function validateId(value, context) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new Error(`${context} must be a non-empty ID using letters, numbers, ".", "_" or "-".`);
  }
}

function validateLevel(level, index = 0) {
  const context = `Level ${index + 1}`;
  requireExactKeys(level, ['id', 'name', 'tree'], context);
  validateId(level.id, `${context} ID`);
  if (typeof level.name !== 'string' || !level.name.trim()) {
    throw new Error(`${context} name must be a non-empty string.`);
  }

  const nodeIds = new Set();
  let nodeCount = 0;
  function visitNode(node, depth) {
    const nodeContext = `${context} tree node`;
    requireExactKeys(node, ['id', 'targetColor', 'children'], nodeContext);
    validateId(node.id, `${nodeContext} ID`);
    if (nodeIds.has(node.id)) {
      throw new Error(`${context} contains duplicate node ID "${node.id}".`);
    }
    nodeIds.add(node.id);
    nodeCount += 1;
    if (nodeCount > MAX_TREE_NODES) {
      throw new Error(`${context} exceeds the ${MAX_TREE_NODES}-node limit.`);
    }
    if (depth > MAX_TREE_DEPTH) {
      throw new Error(`${context} exceeds the ${MAX_TREE_DEPTH}-level tree depth limit.`);
    }
    if (node.targetColor !== 'red' && node.targetColor !== 'blue') {
      throw new Error(`${nodeContext} "${node.id}" color must be "red" or "blue".`);
    }
    if (!Array.isArray(node.children)) {
      throw new Error(`${nodeContext} "${node.id}" children must be an array.`);
    }
    node.children.forEach((child) => visitNode(child, depth + 1));
  }
  visitNode(level.tree, 1);
  if (nodeIds.has(level.id)) {
    throw new Error(`${context} ID "${level.id}" collides with a node ID in its tree.`);
  }
}

function validateLevels(levels) {
  if (!Array.isArray(levels)) {
    throw new Error('GAME_LEVELS must be an array.');
  }
  const levelIds = new Set();
  levels.forEach((level, index) => {
    validateLevel(level, index);
    if (levelIds.has(level.id)) {
      throw new Error(`Duplicate level ID "${level.id}" in levels.js.`);
    }
    levelIds.add(level.id);
  });
  return levelIds;
}

function formatLevel(level) {
  return JSON.stringify(level, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function prepareAppend(source, level) {
  const { levels, closeIndex } = parseLevelsSource(source);
  const levelIds = validateLevels(levels);
  validateLevel(level, levels.length);
  if (levelIds.has(level.id)) {
    throw new Error(`Level ID "${level.id}" already exists; choose a different ID.`);
  }

  const beforeClose = source.slice(0, closeIndex).replace(/[ \t\r\n]+$/, '');
  const separator = levels.length > 0 && !beforeClose.endsWith(',') ? ',' : '';
  const updated =
    `${beforeClose}${separator}\n${formatLevel(level)}\n` +
    source.slice(closeIndex);
  const verification = parseLevelsSource(updated);
  validateLevels(verification.levels);
  if (verification.levels.length !== levels.length + 1) {
    throw new Error('Generated source verification failed: level count did not increase by one.');
  }
  return updated;
}

function prepareReplace(source, levels) {
  const parsed = parseLevelsSource(source);
  validateLevels(levels);

  const arrayBody = levels.map(formatLevel).join(',\n');
  const replacement = arrayBody ? `[\n${arrayBody}\n]` : '[]';
  const updated =
    source.slice(0, parsed.openIndex) +
    replacement +
    source.slice(parsed.closeIndex + 1);
  const verification = parseLevelsSource(updated);
  validateLevels(verification.levels);
  if (JSON.stringify(verification.levels) !== JSON.stringify(levels)) {
    throw new Error('Generated source verification failed: levels changed during serialization.');
  }
  return updated;
}

function assertRegularTarget(filePath) {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`Refusing to replace ${filePath}: expected a regular, non-symlink file.`);
  }
  return stat;
}

function atomicReplaceFile(filePath, expectedSource, replacement) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  const lockPath = `${absolutePath}.lock`;
  let lockFd;
  let lockAcquired = false;
  let stagedPath;
  let stagedFd;
  let replacementCommitted = false;
  let primaryError;

  try {
    try {
      lockFd = fs.openSync(lockPath, 'wx', 0o600);
      lockAcquired = true;
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new Error(
          `Cannot update levels.js because ${lockPath} already exists. ` +
            'Another creator may be running; verify it is inactive before removing a stale lock.',
        );
      }
      throw error;
    }

    fs.writeFileSync(lockFd, `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
    fs.fsyncSync(lockFd);
    fs.closeSync(lockFd);
    lockFd = undefined;

    const targetStat = assertRegularTarget(absolutePath);
    const currentSource = fs.readFileSync(absolutePath, 'utf8');
    if (currentSource !== expectedSource) {
      throw new Error('levels.js changed while the level was being created; no changes were written. Retry.');
    }

    stagedPath = path.join(
      directory,
      `.${path.basename(absolutePath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
    );
    stagedFd = fs.openSync(stagedPath, 'wx', targetStat.mode & 0o777);
    fs.writeFileSync(stagedFd, replacement, 'utf8');
    fs.fchmodSync(stagedFd, targetStat.mode & 0o777);
    fs.fsyncSync(stagedFd);
    fs.closeSync(stagedFd);
    stagedFd = undefined;

    assertRegularTarget(absolutePath);
    if (fs.readFileSync(absolutePath, 'utf8') !== expectedSource) {
      throw new Error('levels.js changed during the update; no changes were written. Retry.');
    }
    fs.renameSync(stagedPath, absolutePath);
    stagedPath = undefined;
    replacementCommitted = true;
  } catch (error) {
    primaryError = error;
  } finally {
    if (stagedFd !== undefined) {
      try {
        fs.closeSync(stagedFd);
      } catch {
        // Preserve the original error; staged-file cleanup is attempted below.
      }
    }
    if (stagedPath) {
      try {
        fs.unlinkSync(stagedPath);
      } catch {
        // Preserve the original error.
      }
    }
    if (lockFd !== undefined) {
      try {
        fs.closeSync(lockFd);
      } catch {
        // Preserve the original error.
      }
    }
    if (lockAcquired) {
      try {
        fs.unlinkSync(lockPath);
      } catch (error) {
        if (error.code !== 'ENOENT' && !primaryError) {
          primaryError = replacementCommitted
            ? new Error(`Level was appended, but lock cleanup failed at ${lockPath}: ${error.message}`)
            : error;
        }
      }
    }
  }

  if (primaryError) {
    throw primaryError;
  }
}

function appendLevelFile(filePath, level) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${filePath}: ${error.message}`);
  }
  const updatedSource = prepareAppend(source, level);
  atomicReplaceFile(filePath, source, updatedSource);
}

function nextLevelId(levels) {
  const ids = new Set(levels.map((level) => level.id));
  let number = levels.length + 1;
  while (ids.has(`level-${number}`)) {
    number += 1;
  }
  return `level-${number}`;
}

function createPrompt(rl) {
  let closed = false;
  const lines = [];
  const waiters = [];
  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) {
      waiter.resolve(line);
    } else {
      lines.push(line);
    }
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length) {
      waiters.shift().reject(new Error('Input ended before the level was complete.'));
    }
  });
  return (prompt) => {
    rl.output.write(prompt);
    if (lines.length) {
      return Promise.resolve(lines.shift());
    }
    if (closed) {
      return Promise.reject(new Error('Input ended before the level was complete.'));
    }
    return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  };
}

async function askNonEmpty(ask, label, suggestion) {
  while (true) {
    const answer = (await ask(`${label}${suggestion ? ` [${suggestion}]` : ''}: `)).trim();
    const value = answer || suggestion;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    console.log('Please enter a value.');
  }
}

async function askId(ask, label, suggestion, usedIds) {
  if (usedIds.has(suggestion)) {
    const base = suggestion;
    let suffix = 2;
    while (usedIds.has(`${base}-${suffix}`)) {
      suffix += 1;
    }
    suggestion = `${base}-${suffix}`;
  }
  while (true) {
    const id = await askNonEmpty(ask, label, suggestion);
    if (!ID_PATTERN.test(id)) {
      console.log('Use letters, numbers, ".", "_" or "-" (starting with a letter or number).');
      continue;
    }
    if (usedIds.has(id)) {
      console.log(`ID "${id}" is already in use here; choose a different one.`);
      continue;
    }
    return id;
  }
}

async function askColor(ask, suggestion = 'red') {
  while (true) {
    const answer = (await ask(`Target color (red/blue) [${suggestion}]: `))
      .trim()
      .toLowerCase();
    const color = answer || suggestion;
    if (color === 'red' || color === 'blue') {
      return color;
    }
    console.log('Enter "red" or "blue".');
  }
}

async function askChildCount(ask) {
  while (true) {
    const answer = (await ask('Number of children (0-20): ')).trim();
    if (/^\d+$/.test(answer) && Number(answer) <= 20) {
      return Number(answer);
    }
    console.log('Enter a whole number from 0 to 20.');
  }
}

async function createNode(ask, label, suggestion, usedIds, state, depth = 1) {
  if (depth > MAX_TREE_DEPTH) {
    throw new Error(`Tree exceeds the ${MAX_TREE_DEPTH}-level depth limit.`);
  }
  state.nodeCount += 1;
  if (state.nodeCount > MAX_TREE_NODES) {
    throw new Error(`Tree exceeds the ${MAX_TREE_NODES}-node limit.`);
  }
  const id = await askId(ask, `${label} node ID`, suggestion, usedIds);
  usedIds.add(id);
  const targetColor = await askColor(ask);
  const childCount = await askChildCount(ask);
  const children = [];
  for (let index = 1; index <= childCount; index += 1) {
    const childSuggestion = `${id}-child-${index}`;
    children.push(
      await createNode(
        ask,
        `${label}.${index}`,
        childSuggestion,
        usedIds,
        state,
        depth + 1,
      ),
    );
  }
  return { id, targetColor, children };
}

async function runInteractiveCreator(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${filePath}: ${error.message}`);
  }
  const { levels } = parseLevelsSource(source);
  validateLevels(levels);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ask = createPrompt(rl);
  try {
    console.log('Tree Flipper local level creator');
    console.log(`Target: ${path.relative(process.cwd(), filePath)}`);
    const levelId = await askId(
      ask,
      'Level ID',
      nextLevelId(levels),
      new Set(levels.map((level) => level.id)),
    );
    const name = await askNonEmpty(ask, 'Level name');
    const tree = await createNode(ask, 'root', 'root', new Set(), { nodeCount: 0 });
    const level = { id: levelId, name, tree };
    validateLevel(level, levels.length);

    console.log('\nGenerated level preview:');
    console.log(JSON.stringify(level, null, 2));
    const confirmation = (
      await ask('\nAppend this level to src/data/levels.js? (y/N): ')
    )
      .trim()
      .toLowerCase();
    if (confirmation !== 'y' && confirmation !== 'yes') {
      console.log('Cancelled; levels.js was not changed.');
      return;
    }

    appendLevelFile(filePath, level);
    console.log(`Appended level "${level.id}" (${level.name}) to ${filePath}.`);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  const levelsPath = path.resolve(__dirname, '../src/data/levels.js');
  runInteractiveCreator(levelsPath).catch((error) => {
    console.error(`Level creation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  appendLevelFile,
  atomicReplaceFile,
  parseLevelsSource,
  prepareAppend,
  prepareReplace,
  validateLevel,
  validateLevels,
};
