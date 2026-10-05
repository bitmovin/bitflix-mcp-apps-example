import { useToolInfo } from '../helpers.js';
import { TrailerReel } from './components/discover/TrailerReel.js';

export default function Reel() {
  const { output, responseMetadata } = useToolInfo<'trailer_reel'>();
  return <TrailerReel payload={output} licenseKey={responseMetadata?.licenseKey ?? ''} />;
}
