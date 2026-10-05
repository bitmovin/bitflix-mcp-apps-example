// The pure helpers the views rely on: preview windowing and reel order.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBeforePreview, isPastPreview, nextIndex, previewRemaining } from '../../src/discover/model.js';

describe('preview window', () => {
  const w = { startSec: 30, durationSec: 60 };

  it('counts down to the end of the window, never below zero or above its length', () => {
    assert.equal(previewRemaining(w, 30), 60);
    assert.equal(previewRemaining(w, 75), 15);
    assert.equal(previewRemaining(w, 200), 0);
    assert.equal(previewRemaining(w, 0), 60, 'a seek back before the window must not show 1:30 left');
  });

  it('treats a seek back before the window as outside it, allowing a second of slack', () => {
    assert.equal(isBeforePreview(w, 0), true);
    assert.equal(isBeforePreview(w, 28.9), true);
    assert.equal(isBeforePreview(w, 29.5), false);
    assert.equal(isBeforePreview(w, 60), false);
  });

  it('ends exactly at start + duration, including after a seek past it', () => {
    assert.equal(isPastPreview(w, 89.9), false);
    assert.equal(isPastPreview(w, 90), true);
    assert.equal(isPastPreview(w, 400), true);
  });
});

describe('nextIndex', () => {
  it('wraps forwards and backwards, and handles an empty list', () => {
    assert.equal(nextIndex(0, 3), 1);
    assert.equal(nextIndex(2, 3), 0);
    assert.equal(nextIndex(0, 3, -1), 2);
    assert.equal(nextIndex(5, 3, 0), 2);
    assert.equal(nextIndex(0, 0), 0);
  });
});
