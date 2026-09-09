/**
 * Renders an inline SVG string as decoration, hidden from assistive
 * technology. Anything that needs a name must carry its own label.
 */
export function Icon({ html }: { html: string }) {
  return <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}
