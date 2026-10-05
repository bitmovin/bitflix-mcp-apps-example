import { useToolInfo } from '../helpers.js';
import { DiscoverApp, discoverKey } from './components/discover/DiscoverApp.js';

export default function FilmPreview() {
  const { output, responseMetadata } = useToolInfo<'preview_film'>();
  return <DiscoverApp key={discoverKey(output)} payload={output} licenseKey={responseMetadata?.licenseKey ?? ''} />;
}
