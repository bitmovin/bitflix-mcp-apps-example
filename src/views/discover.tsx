import { useToolInfo } from '../helpers.js';
import { DiscoverApp, discoverKey } from './components/discover/DiscoverApp.js';

export default function Discover() {
  const { output, responseMetadata } = useToolInfo<'discover'>();
  return <DiscoverApp key={discoverKey(output)} payload={output} licenseKey={responseMetadata?.licenseKey ?? ''} />;
}
