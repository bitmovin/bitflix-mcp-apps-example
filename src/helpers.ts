import { generateHelpers } from "skybridge/web";
import type { AppType } from "./server.js";

// Fully-typed hooks inferred from the MCP server's tool definitions.
export const { useCallTool, useToolInfo } = generateHelpers<AppType>();
