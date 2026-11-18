// The window.open replacement that hands web links to the host. It is built
// from two functions, so the cases run without a DOM.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hostRoutedOpen } from '../../src/views/utils/hostRoutedOpen.js';

/** What the stand-in for the native open returns. */
const OPENED = 'opened';

function routedOpen() {
  const hostLinks: string[] = [];
  const nativeCalls: unknown[][] = [];
  const open = hostRoutedOpen(
    href => hostLinks.push(href),
    (...args) => {
      nativeCalls.push(args);
      return OPENED;
    },
  );
  return { open, hostLinks, nativeCalls };
}

describe('hostRoutedOpen', () => {
  it('hands an https URL to the host and opens no window', () => {
    const { open, hostLinks, nativeCalls } = routedOpen();

    const opened = open('https://bitmovin.com/ads?id=1', '_blank');

    assert.deepEqual(hostLinks, ['https://bitmovin.com/ads?id=1']);
    assert.deepEqual(nativeCalls, []);
    assert.equal(opened, null);
  });

  it('hands an http URL to the host', () => {
    const { open, hostLinks, nativeCalls } = routedOpen();

    open('http://bitmovin.com/');

    assert.deepEqual(hostLinks, ['http://bitmovin.com/']);
    assert.deepEqual(nativeCalls, []);
  });

  it('hands a URL object to the host as its href', () => {
    const { open, hostLinks } = routedOpen();

    open(new URL('https://bitmovin.com/ads'));

    assert.deepEqual(hostLinks, ['https://bitmovin.com/ads']);
  });

  it('opens a URL of another scheme natively, with every argument', () => {
    const { open, hostLinks, nativeCalls } = routedOpen();

    const opened = open('about:blank', '_blank', 'popup');

    assert.deepEqual(hostLinks, []);
    assert.deepEqual(nativeCalls, [['about:blank', '_blank', 'popup']]);
    assert.equal(opened, OPENED);
  });

  it('opens a relative URL natively', () => {
    const { open, hostLinks, nativeCalls } = routedOpen();

    open('/watch', '_blank');

    assert.deepEqual(hostLinks, []);
    assert.deepEqual(nativeCalls, [['/watch', '_blank', undefined]]);
  });

  it('opens natively when no URL is given', () => {
    const { open, hostLinks, nativeCalls } = routedOpen();

    open();

    assert.deepEqual(hostLinks, []);
    assert.deepEqual(nativeCalls, [[undefined, undefined, undefined]]);
  });
});
