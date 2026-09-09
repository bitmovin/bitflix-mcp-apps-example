import { useToolInfo } from "../helpers.js";
import { Diagnostics } from "./components/Diagnostics.js";

export default function DiagnosticsView() {
  const { output } = useToolInfo<"run_diagnostics">();
  return <Diagnostics payload={output} />;
}
