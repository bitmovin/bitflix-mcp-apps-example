import { useToolInfo } from "../helpers.js";
import { BitflixApp } from "./components/BitflixApp.js";

export default function Live() {
  const { output } = useToolInfo<"whats_live">();
  return <BitflixApp payload={output} />;
}
