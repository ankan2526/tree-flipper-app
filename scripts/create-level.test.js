'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const {
  appendLevelFile,
  atomicReplaceFile,
  parseLevelsSource,
  prepareAppend,
  validateLevel,
  validateLevels,
} = require('./create-level');

const levelsPath = path.resolve(__dirname, '../src/data/levels.js');
const existingSource = fs.readFileSync(levelsPath, 'utf8');
const sampleLevel = {
  id: 'level-test',
  name: 'Test Level',
  tree: {
    id: 'root',
    targetColor: 'red',
    children: [
      { id: 'branch', targetColor: 'blue', children: [] },
    ],
  },
};

test('parses and validates the checked-in level schema', () => {
  const { levels } = parseLevelsSource(existingSource);
  assert.deepEqual(levels.map(({ id }) => id), ['level-1', 'level-2']);
  assert.equal(validateLevels(levels).size, 2);
});

test('rejects duplicate IDs, invalid colors, and malformed tree shapes', () => {
  assert.throws(
    () =>
      validateLevel({
        ...sampleLevel,
        tree: {
          ...sampleLevel.tree,
          children: [
            { id: 'branch', targetColor: 'blue', children: [] },
            { id: 'branch', targetColor: 'red', children: [] },
          ],
        },
      }),
    /duplicate node ID/,
  );
  assert.throws(
    () => validateLevel({ ...sampleLevel, tree: { ...sampleLevel.tree, targetColor: 'green' } }),
    /color must be "red" or "blue"/,
  );
  assert.throws(
    () => validateLevel({ ...sampleLevel, unexpected: true }),
    /must contain exactly/,
  );
  assert.throws(
    () => validateLevels([{ ...sampleLevel }, { ...sampleLevel }]),
    /Duplicate level ID/,
  );
});

test('appends a validated level without changing existing entries', () => {
  const updatedSource = prepareAppend(existingSource, sampleLevel);
  const { levels } = parseLevelsSource(updatedSource);
  validateLevels(levels);
  assert.equal(levels.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(levels[2])), sampleLevel);
  assert.deepEqual(
    JSON.parse(JSON.stringify(levels.slice(0, 2))),
    JSON.parse(JSON.stringify(parseLevelsSource(existingSource).levels)),
  );
});

test('refuses duplicate IDs and malformed source without preparing a write', () => {
  assert.throws(
    () => prepareAppend(existingSource, { ...sampleLevel, id: 'level-1' }),
    /already exists/,
  );
  assert.throws(() => parseLevelsSource('export const GAME_LEVELS = [;'), /Invalid levels\.js/);
});

test('appends atomically to an isolated project-local fixture and preserves failures', () => {
  const fixture = path.join(__dirname, `.level-creator-test-${process.pid}-${randomUUID()}.js`);
  const lockPath = `${fixture}.lock`;
  const initialSource = 'export const GAME_LEVELS = [];\n';
  try {
    fs.writeFileSync(fixture, initialSource, { flag: 'wx' });
    appendLevelFile(fixture, sampleLevel);
    const writtenSource = fs.readFileSync(fixture, 'utf8');
    assert.deepEqual(
      JSON.parse(JSON.stringify(parseLevelsSource(writtenSource).levels)),
      [sampleLevel],
    );
    assert.equal(fs.existsSync(lockPath), false);

    fs.writeFileSync(fixture, 'not a recognized levels module\n');
    const malformedSource = fs.readFileSync(fixture, 'utf8');
    assert.throws(() => appendLevelFile(fixture, sampleLevel), /Invalid levels\.js/);
    assert.equal(fs.readFileSync(fixture, 'utf8'), malformedSource);

    fs.writeFileSync(fixture, initialSource);
    fs.writeFileSync(lockPath, 'another process\n', { flag: 'wx' });
    assert.throws(
      () => atomicReplaceFile(fixture, initialSource, 'replacement'),
      /already exists/,
    );
    assert.equal(fs.readFileSync(fixture, 'utf8'), initialSource);
    assert.equal(fs.readFileSync(lockPath, 'utf8'), 'another process\n');
  } finally {
    fs.rmSync(fixture, { force: true });
    fs.rmSync(lockPath, { force: true });
  }
});
