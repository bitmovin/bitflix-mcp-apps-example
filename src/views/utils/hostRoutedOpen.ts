type OpenArgs = Parameters<typeof window.open>;

/**
 * Builds a `window.open` replacement that hands web links to the host.
 *
 * - A URL that starts with `http://` or `https://` goes to `openInHost`, and the call returns `null`.
 * - Every other call goes to `nativeOpen` with its arguments unchanged, and returns its result.
 *
 * @param openInHost Opens a web link, given as a string.
 * @param nativeOpen Opens every call that carries no web link.
 */
export function hostRoutedOpen<Opened>(
  openInHost: (href: string) => void,
  nativeOpen: (...args: OpenArgs) => Opened,
): (...args: OpenArgs) => Opened | null {
  return (url, target, features) => {
    const href = String(url);
    if (!/^https?:\/\//i.test(href)) {
      return nativeOpen(url, target, features);
    }
    openInHost(href);
    return null;
  };
}
