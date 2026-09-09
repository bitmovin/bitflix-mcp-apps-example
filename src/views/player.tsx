import { useToolInfo } from '../helpers.js';
import { BitflixApp } from './components/BitflixApp.js';

export default function Player() {
  const { output } = useToolInfo<'play_title'>();
  return <BitflixApp payload={output} />;
}
