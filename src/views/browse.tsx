import { useToolInfo } from "../helpers.js";
import { BitflixApp } from "./components/BitflixApp.js";

export default function Browse() {
  const { output } = useToolInfo<"browse_catalog">();
  return <BitflixApp payload={output} />;
}
