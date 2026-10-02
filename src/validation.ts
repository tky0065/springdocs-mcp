import { ToolDefinitions } from "./tools/index.js";

type ToolProperty = {
  type: "string" | "number";
  enum?: string[];
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

type ToolSchema = {
  name: string;
  inputSchema: { properties: Record<string, ToolProperty>; required?: string[] };
};

/**
 * Validates the raw `arguments` of a tools/call request against the tool's own inputSchema,
 * so the declared schema is the single source of truth. Returns only the declared parameters
 * (unknown ones are dropped); numbers are clamped to [minimum, maximum] and truncated to integers.
 */
export function validateToolArguments(toolName: string, rawArgs: unknown): Record<string, string | number> {
  const tool = (ToolDefinitions.getToolList() as unknown as ToolSchema[]).find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  if (rawArgs !== undefined && rawArgs !== null && (typeof rawArgs !== "object" || Array.isArray(rawArgs))) {
    throw new Error("Tool arguments must be an object");
  }
  const input = (rawArgs ?? {}) as Record<string, unknown>;
  const required = new Set(tool.inputSchema.required ?? []);
  const validated: Record<string, string | number> = {};

  for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
    const value = input[name];
    if (value === undefined || value === null) {
      if (required.has(name)) {
        throw new Error(`The '${name}' parameter is required`);
      }
      continue;
    }

    if (prop.type === "string") {
      if (typeof value !== "string") {
        throw new Error(`The '${name}' parameter must be a string`);
      }
      if (required.has(name) && value.trim() === "") {
        throw new Error(`The '${name}' parameter must not be empty`);
      }
      if (prop.maxLength !== undefined && value.length > prop.maxLength) {
        throw new Error(`The '${name}' parameter is too long (max ${prop.maxLength} characters)`);
      }
      if (prop.enum && !prop.enum.includes(value)) {
        throw new Error(`The '${name}' parameter must be one of: ${prop.enum.join(", ")}`);
      }
      validated[name] = value;
    } else {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`The '${name}' parameter must be a number`);
      }
      validated[name] = Math.min(prop.maximum ?? Infinity, Math.max(prop.minimum ?? -Infinity, Math.trunc(value)));
    }
  }
  return validated;
}
