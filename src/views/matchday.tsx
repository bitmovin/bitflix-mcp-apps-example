import { useToolInfo } from '../helpers.js';
import { BitflixApp } from './components/BitflixApp.js';

export default function Matchday() {
  const { output } = useToolInfo<'matchday'>();
  return <BitflixApp payload={output} />;
}
