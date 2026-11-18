import { getAdaptor } from 'skybridge/web';
import { hostRoutedOpen } from './hostRoutedOpen.js';

// A host sandbox without pop-up permission drops window.open calls, which the
// player and its UI use to open links. ChatGPT replaces window.open with its
// own route to the host, so it stays in place there.
if (window.openai === undefined) {
  window.open = hostRoutedOpen(href => getAdaptor().openExternal(href), window.open.bind(window));
}
