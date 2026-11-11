'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parseLevelsSource } = require('./create-level');
const { createLevelManagerServer } = require('./level-manager');

const sampleLevel = {
  id: 'level-test',
  name: 'Test Level',
  tree: {
    id: 'root',
    targetColor: 'red',
    children: [{ id: 'branch', targetColor: 'blue', children: [] }],
  },
};

test('local UI API creates, edits, and deletes levels safely', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tree-flipper-manager-'));
  const levelsPath = path.join(directory, 'levels.js');
  fs.writeFileSync(levelsPath, 'export const GAME_LEVELS = [];\n');
  const { server, token } = createLevelManagerServer({ levelsPath, port: 0 });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const uiResponse = await fetch(baseUrl);
  assert.equal(uiResponse.status, 200);
  const ui = await uiResponse.text();
  assert.match(ui, new RegExp(token));
  assert.match(ui, /id="tree-visual"/);
  assert.match(ui, /id="add-child"/);
  assert.match(ui, /id="color-blue"/);

  const getLevels = () =>
    fetch(`${baseUrl}/api/levels`, {
      headers: { 'X-Level-Manager-Token': token },
    });
  assert.equal((await fetch(`${baseUrl}/api/levels`)).status, 403);

  let response = await getLevels();
  let result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.levels, []);
  assert.deepEqual(
    result.chapters.map(({ id }) => id),
    ['chapter-1', 'chapter-2'],
  );
  const originalRevision = result.revision;

  response = await fetch(`${baseUrl}/api/levels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({
      level: { ...sampleLevel, chapterId: 'chapter-2' },
      revision: originalRevision,
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(fs.readFileSync(levelsPath, 'utf8'), 'export const GAME_LEVELS = [];\n');

  response = await fetch(`${baseUrl}/api/levels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({ level: sampleLevel, revision: originalRevision }),
  });
  result = await response.json();
  assert.equal(response.status, 200);
  const chapterOneLevel = { ...sampleLevel, chapterId: 'chapter-1' };
  assert.deepEqual(JSON.parse(JSON.stringify(result.levels)), [chapterOneLevel]);

  response = await fetch(`${baseUrl}/api/levels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({
      level: { ...sampleLevel, id: 'level-chapter-two', chapterId: 'chapter-2', moveLimit: 3 },
      revision: result.revision,
    }),
  });
  result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.levels[1].chapterId, 'chapter-2');
  assert.equal(result.levels[1].moveLimit, 3);

  response = await fetch(`${baseUrl}/api/levels/level-chapter-two`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({ revision: result.revision }),
  });
  result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(result.levels)), [chapterOneLevel]);

  const editedLevel = { ...sampleLevel, name: 'Edited Test Level' };
  response = await fetch(`${baseUrl}/api/levels/level-test`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({ level: editedLevel, revision: result.revision }),
  });
  result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.levels[0].name, editedLevel.name);

  const beforeConflict = fs.readFileSync(levelsPath, 'utf8');
  response = await fetch(`${baseUrl}/api/levels/level-test`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({ level: sampleLevel, revision: originalRevision }),
  });
  assert.equal(response.status, 409);
  assert.equal(fs.readFileSync(levelsPath, 'utf8'), beforeConflict);

  response = await fetch(`${baseUrl}/api/levels/level-test`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Level-Manager-Token': token,
    },
    body: JSON.stringify({ revision: result.revision }),
  });
  result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.levels, []);
  assert.deepEqual(parseLevelsSource(fs.readFileSync(levelsPath, 'utf8')).levels, []);
});
