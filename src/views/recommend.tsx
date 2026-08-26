import { useToolInfo } from "../helpers.js";
import { BitflixApp } from "./components/BitflixApp.js";

export default function Recommend() {
  const { output } = useToolInfo<"get_recommendations">();
  return <BitflixApp payload={output} />;
}
