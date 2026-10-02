/**
 * Transform MCP tool definitions to the Docker MCP Catalog format.
 * Pure function, shared by generate-tools-json.js and the sync test.
 */
export function buildDockerTools(tools) {
  return tools.map(tool => {
    const simplified = {
      name: tool.name,
      description: tool.description,
      arguments: []
    };

    // Extract argument definitions
    if (tool.inputSchema && tool.inputSchema.properties) {
      simplified.arguments = Object.entries(tool.inputSchema.properties).map(([name, prop]) => {
        const arg = {
          name,
          type: prop.type,
          required: tool.inputSchema.required?.includes(name) || false,
          description: prop.description || ''
        };

        // Add enum values if present
        if (prop.enum) {
          arg.enum = prop.enum;
        }

        // Add max length for strings
        if (prop.maxLength !== undefined) {
          arg.maxLength = prop.maxLength;
        }

        // Add default value if present
        if (prop.default !== undefined) {
          arg.default = prop.default;
        }

        // Add min/max for numbers
        if (prop.type === 'number') {
          if (prop.minimum !== undefined) arg.minimum = prop.minimum;
          if (prop.maximum !== undefined) arg.maximum = prop.maximum;
        }

        return arg;
      });
    }

    return simplified;
  });
}
