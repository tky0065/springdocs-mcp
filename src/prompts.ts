import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

// MCP prompts: ready-made instructions that chain the existing tools.
// A prompt executes nothing itself; the client injects the message and the model calls the tools.

interface PromptArgument { name: string; description: string; required: boolean }
interface PromptDefinition { name: string; description: string; arguments: PromptArgument[] }

const VERSION_PATTERN = /^\d+\.\d+(\.\d+)?$/;
const LIMITS = { error_message: 2000, stack_trace: 10000, version: 20 };

const PROMPTS: PromptDefinition[] = [
  {
    name: "migrate-boot-version",
    description: "Plan a Spring Boot upgrade: migration guide, breaking changes and a checklist",
    arguments: [
      { name: "to_version", description: "Target Spring Boot version (e.g. 3.0, 3.4 or 4.0)", required: true },
      { name: "from_version", description: "Current Spring Boot version (e.g. 2.7)", required: false },
    ],
  },
  {
    name: "explain-error",
    description: "Explain a Spring error: root cause, likely fixes and the matching reference sections",
    arguments: [
      { name: "error_message", description: "Error message or issue description", required: true },
      { name: "stack_trace", description: "Stack trace (optional, for a more specific diagnosis)", required: false },
    ],
  },
];

export function listPrompts(): PromptDefinition[] {
  return PROMPTS.map((p) => ({ ...p, arguments: p.arguments.map((a) => ({ ...a })) }));
}

function invalid(message: string): never {
  throw new McpError(ErrorCode.InvalidParams, message);
}

function requiredText(args: Record<string, string>, name: string, max: number): string {
  const value = args[name];
  if (typeof value !== "string" || value.trim() === "") invalid(`The '${name}' argument is required`);
  if (value.length > max) invalid(`The '${name}' argument must not exceed ${max} characters`);
  return value;
}

function optionalText(args: Record<string, string>, name: string, max: number): string | undefined {
  const value = args[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") invalid(`The '${name}' argument must be a string`);
  if (value.length > max) invalid(`The '${name}' argument must not exceed ${max} characters`);
  return value;
}

function version(value: string, name: string): string {
  const trimmed = value.trim();
  if (!VERSION_PATTERN.test(trimmed) || trimmed.length > LIMITS.version) {
    invalid(`The '${name}' argument must be a version like 3.0 or 3.4.2`);
  }
  return trimmed;
}

/** Wraps user text in a tilde fence longer than any run of tildes it contains. */
function fenced(text: string): string {
  const longest = Math.max(0, ...(text.match(/~+/g) ?? []).map((run) => run.length));
  const fence = "~".repeat(Math.max(4, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}

function userMessage(description: string, text: string) {
  return { description, messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function getPrompt(name: string, rawArgs: Record<string, string> | undefined) {
  const args = rawArgs ?? {};

  if (name === "migrate-boot-version") {
    const to = version(requiredText(args, "to_version", LIMITS.version), "to_version");
    const fromRaw = optionalText(args, "from_version", LIMITS.version);
    const from = fromRaw === undefined ? undefined : version(fromRaw, "from_version");
    const release = to.split(".").length === 2 ? `${to}.0` : to;
    const jakarta = Number(to.split(".")[0]) >= 3;
    const steps = [
      `Help me upgrade a Spring Boot application${from ? ` from ${from}` : ""} to ${to}. Use the Spring documentation tools, in this order:`,
      "",
      `1. Call \`get_migration_guide\` with version "${to}" and read the migration steps.`,
      `2. Call \`get_release_notes\` with project "boot", version "${release}" and focus "breaking-changes".`,
      "3. Call `get_spring_reference` for the configuration sections affected by the changes you found.",
      ...(jakarta ? ["4. Check the javax -> jakarta namespace migration: call `get_migration_guide` with section \"jakarta\"."] : []),
      "",
      "Finish with an ordered upgrade checklist: dependency and property changes first, then code changes, then verification steps. Cite which tool each point comes from.",
    ];
    return userMessage(`Spring Boot upgrade plan to ${to}`, steps.join("\n"));
  }

  if (name === "explain-error") {
    const message = requiredText(args, "error_message", LIMITS.error_message);
    const trace = optionalText(args, "stack_trace", LIMITS.stack_trace);
    const steps = [
      "Explain this Spring error and tell me how to fix it. Use the Spring documentation tools, in this order:",
      "",
      "1. Call `diagnose_spring_issues` with the error message below" + (trace ? " and the stack trace" : "") + ".",
      "2. Call `get_spring_reference` for the reference sections the diagnosis points to.",
      "",
      "Then explain the root cause in plain language and give the most likely fixes, most probable first.",
      "",
      "Error message:",
      fenced(message),
      ...(trace ? ["", "Stack trace:", fenced(trace)] : []),
    ];
    return userMessage("Spring error explanation", steps.join("\n"));
  }

  invalid(`Unknown prompt: ${name}`);
}
