#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {
  atomicReplaceFile,
  parseLevelsSource,
  prepareReplace,
  validateLevel,
  validateLevels,
} = require('./create-level');

const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_PORT = 4173;
const HTML_PATH = path.join(__dirname, 'level-manager.html');
const DEFAULT_CHAPTERS_PATH = path.resolve(__dirname, '../src/data/chapters.json');

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readSource(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new RequestError(500, 'The levels file must be a regular, non-symlink file.');
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }
    throw new RequestError(500, `Cannot read levels.js: ${error.message}`);
  }
}

function getLevels(source) {
  try {
    const { levels } = parseLevelsSource(source);
    validateLevels(levels);
    return levels;
  } catch (error) {
    throw new RequestError(500, `Cannot use levels.js: ${error.message}`);
  }
}

function validateInputLevel(level, index) {
  try {
    validateLevel(level, index);
  } catch (error) {
    throw new RequestError(400, error.message);
  }
}

function readChapters(filePath) {
  let chapters;
  try {
    chapters = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new RequestError(500, `Cannot read chapters: ${error.message}`);
  }
  if (!Array.isArray(chapters) || chapters.length === 0) {
    throw new RequestError(500, 'Chapter data must be a non-empty array.');
  }
  const ids = new Set();
  for (const chapter of chapters) {
    if (
      !chapter ||
      typeof chapter.id !== 'string' ||
      !chapter.id ||
      typeof chapter.title !== 'string' ||
      !chapter.title.trim() ||
      !['none', 'per-level'].includes(chapter.moveLimitMode)
    ) {
      throw new RequestError(500, 'Chapter data contains an invalid entry.');
    }
    if (ids.has(chapter.id)) {
      throw new RequestError(500, `Duplicate chapter ID "${chapter.id}".`);
    }
    ids.add(chapter.id);
  }
  return chapters;
}

function validateChapterAssignment(level, index, chapters) {
  validateInputLevel(level, index);
  const chapterId = level.chapterId ?? chapters[0].id;
  const chapter = chapters.find((item) => item.id === chapterId);
  if (!chapter) {
    throw new RequestError(400, `Chapter "${chapterId}" does not exist.`);
  }
  if (chapter.moveLimitMode === 'per-level') {
    if (!Number.isInteger(level.moveLimit) || level.moveLimit < 1) {
      throw new RequestError(400, 'This chapter requires a positive whole-number move limit.');
    }
  } else if (level.moveLimit !== undefined) {
    throw new RequestError(400, 'This chapter does not use a move limit.');
  }
  return { ...level, chapterId };
}

function getRevision(source) {
  return crypto.createHash('sha256').update(source).digest('hex');
}

function requireRevision(body, source) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new RequestError(400, 'Request body must be an object.');
  }
  if (typeof body.revision !== 'string') {
    throw new RequestError(400, 'Request body is missing its file revision.');
  }
  if (body.revision !== getRevision(source)) {
    throw new RequestError(409, 'The levels file changed. Reload the list before saving.');
  }
}

function persistLevels(filePath, source, levels) {
  const replacement = prepareReplace(source, levels);
  atomicReplaceFile(filePath, source, replacement);
  return replacement;
}

function createLevel(filePath, body, chapters) {
  const source = readSource(filePath);
  requireRevision(body, source);
  const levels = getLevels(source);
  const level = validateChapterAssignment(body.level, levels.length, chapters);
  if (levels.some(({ id }) => id === level.id)) {
    throw new RequestError(409, `A level with ID "${body.level.id}" already exists.`);
  }
  levels.push(level);
  const updatedSource = persistLevels(filePath, source, levels);
  return { levels, revision: getRevision(updatedSource) };
}

function updateLevel(filePath, originalId, body, chapters) {
  const source = readSource(filePath);
  requireRevision(body, source);
  const levels = getLevels(source);
  const index = levels.findIndex(({ id }) => id === originalId);
  if (index === -1) {
    throw new RequestError(404, `Level "${originalId}" was not found.`);
  }
  const level = validateChapterAssignment(body.level, index, chapters);
  if (levels.some(({ id }, otherIndex) => otherIndex !== index && id === level.id)) {
    throw new RequestError(409, `A level with ID "${body.level.id}" already exists.`);
  }
  levels[index] = level;
  const updatedSource = persistLevels(filePath, source, levels);
  return { levels, revision: getRevision(updatedSource) };
}

function deleteLevel(filePath, id, body) {
  const source = readSource(filePath);
  requireRevision(body, source);
  const levels = getLevels(source);
  const index = levels.findIndex(({ id: levelId }) => levelId === id);
  if (index === -1) {
    throw new RequestError(404, `Level "${id}" was not found.`);
  }
  levels.splice(index, 1);
  const updatedSource = persistLevels(filePath, source, levels);
  return { levels, revision: getRevision(updatedSource) };
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new RequestError(413, 'Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        if (!request.headers['content-type']?.startsWith('application/json')) {
          throw new RequestError(415, 'Content-Type must be application/json.');
        }
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(error instanceof RequestError ? error : new RequestError(400, 'Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

function safeTokenEqual(candidate, expected) {
  if (typeof candidate !== 'string') {
    return false;
  }
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    crypto.timingSafeEqual(candidateBytes, expectedBytes)
  );
}

function createLevelManagerServer({
  levelsPath = path.resolve(__dirname, '../src/data/levels.js'),
  chaptersPath = DEFAULT_CHAPTERS_PATH,
  port = DEFAULT_PORT,
} = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const html = fs.readFileSync(HTML_PATH, 'utf8').replaceAll('__LEVEL_MANAGER_TOKEN__', token);

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(html),
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(html);
      return;
    }

    if (!url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }
    if (!safeTokenEqual(request.headers['x-level-manager-token'], token)) {
      sendJson(response, 403, { error: 'This local tool session is not authorized.' });
      return;
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/levels') {
        const source = readSource(levelsPath);
        const chapters = readChapters(chaptersPath);
        const defaultChapterId = chapters[0].id;
        const levels = getLevels(source).map((level, index) => {
          try {
            return validateChapterAssignment(
              { ...level, chapterId: level.chapterId ?? defaultChapterId },
              index,
              chapters,
            );
          } catch (error) {
            throw new RequestError(500, `Cannot use levels.js: ${error.message}`);
          }
        });
        sendJson(response, 200, {
          chapters,
          levels,
          revision: getRevision(source),
        });
        return;
      }

      const createRoute = request.method === 'POST' && url.pathname === '/api/levels';
      const match = url.pathname.match(/^\/api\/levels\/([^/]+)$/);
      if (url.pathname === '/api/levels' && !createRoute) {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }
      if (!createRoute && !match) {
        sendJson(response, 404, { error: 'Not found.' });
        return;
      }
      if (match && request.method !== 'PUT' && request.method !== 'DELETE') {
        sendJson(response, 405, { error: 'Method not allowed.' });
        return;
      }

      const body = await readJsonBody(request);
      const chapters = readChapters(chaptersPath);
      let result;
      if (createRoute) {
        result = createLevel(levelsPath, body, chapters);
      } else {
        let id;
        try {
          id = decodeURIComponent(match[1]);
        } catch {
          throw new RequestError(400, 'Invalid level ID in request path.');
        }
        if (request.method === 'PUT') {
          result = updateLevel(levelsPath, id, body, chapters);
        } else if (request.method === 'DELETE') {
          result = deleteLevel(levelsPath, id, body);
        }
      }
      sendJson(response, 200, result);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      sendJson(response, status, { error: error.message || 'The request could not be completed.' });
    }
  });

  return { server, token, port };
}

if (require.main === module) {
  const portArgument = process.env.LEVEL_MANAGER_PORT || String(DEFAULT_PORT);
  const port = Number(portArgument);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error('LEVEL_MANAGER_PORT must be a port number from 1024 to 65535.');
    process.exitCode = 1;
  } else {
    const { server } = createLevelManagerServer({ port });
    server.on('error', (error) => {
      console.error(`Could not start the level manager: ${error.message}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Tree Flipper Level Manager: http://127.0.0.1:${port}`);
      console.log('Only this computer can connect. Press Ctrl+C to stop.');
    });
    process.once('SIGINT', () => server.close(() => process.exit(0)));
  }
}

module.exports = { createLevelManagerServer };
