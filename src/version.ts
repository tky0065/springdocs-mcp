import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const VERSION: string = pkg.version;
export const USER_AGENT = `Spring-Docs-MCP/${VERSION}`;
