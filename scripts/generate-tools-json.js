#!/usr/bin/env node

/**
 * Generate tools.json for Docker MCP Catalog
 *
 * This script extracts tool definitions from the compiled TypeScript code
 * and generates a simplified JSON file for Docker MCP Catalog submission.
 *
 * Usage:
 *   npm run build && node scripts/generate-tools-json.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔧 Generating tools.json for Docker MCP Catalog...\n');

// Read the tools definitions from built code
try {
  // Import the built tools module
  const toolsModule = await import('../build/tools/index.js');
  const ToolDefinitions = toolsModule.ToolDefinitions;

  if (!ToolDefinitions || typeof ToolDefinitions.getToolList !== 'function') {
    throw new Error('ToolDefinitions class or getToolList() method not found');
  }

  const tools = ToolDefinitions.getToolList();

  if (!Array.isArray(tools)) {
    throw new Error('getToolList() did not return an array');
  }

  console.log(`Found ${tools.length} tools to export\n`);

  // Transform tool definitions to Docker MCP Catalog format
  const dockerTools = tools.map(tool => {
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

  // Write to docker/tools.json
  const outputPath = join(projectRoot, 'docker', 'tools.json');
  writeFileSync(
    outputPath,
    JSON.stringify(dockerTools, null, 2),
    'utf-8'
  );

  console.log('✅ Successfully generated docker/tools.json');
  console.log(`📝 Exported ${dockerTools.length} tools:\n`);

  dockerTools.forEach((tool, index) => {
    console.log(`   ${index + 1}. ${tool.name} (${tool.arguments.length} arguments)`);
  });

  console.log('\n📄 Output: docker/tools.json');
  console.log(`📊 File size: ${(Buffer.byteLength(JSON.stringify(dockerTools, null, 2)) / 1024).toFixed(2)} KB\n`);

  // Validate the output
  console.log('🔍 Validating output...');

  // Check for required fields
  const missingFields = dockerTools.filter(tool =>
    !tool.name || !tool.description || !tool.arguments
  );

  if (missingFields.length > 0) {
    console.warn('⚠️  Warning: Some tools are missing required fields:');
    missingFields.forEach(tool => console.warn(`   - ${tool.name || 'unnamed'}`));
  } else {
    console.log('✅ All tools have required fields');
  }

  // Check for tools with no arguments
  const noArgs = dockerTools.filter(tool => tool.arguments.length === 0);
  if (noArgs.length > 0) {
    console.log(`ℹ️  ${noArgs.length} tool(s) have no arguments (this is OK if intentional)`);
  }

  console.log('\n🎉 Generation complete!');
  process.exit(0);

} catch (error) {
  console.error('❌ Error generating tools.json:');
  console.error(error);

  if (error.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('\n💡 Make sure to run "npm run build" first!');
  }

  process.exit(1);
}
