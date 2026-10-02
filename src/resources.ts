import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { SpringBootDocsServiceOptimized } from "./services/springboot-docs-optimized.js";
import { springProjectsConfig } from "./services/spring-projects-config.js";

// MCP resources: the Spring documentation the server already fetches, served as complete markdown documents.
// Real API only: reads go through the same services, cache and URL checks as the tools.

const MIME_TYPE = "text/markdown";
const PROJECT_PATTERN = /^spring:\/\/project\/([a-z0-9][a-z0-9-]*)$/;
const GUIDE_PATTERN = /^spring:\/\/guide\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;
const ACCEPTED_FORMS = "spring://project/<name> (e.g. spring://project/spring-boot) or spring://guide/<id> (e.g. spring://guide/rest-service)";

export type ParsedResource = { kind: "project" | "guide"; id: string };

/** Strict parsing of the raw string: no URL normalization, so nothing but the two accepted forms gets through. */
export function parseResourceUri(uri: string): ParsedResource {
  const project = PROJECT_PATTERN.exec(uri);
  if (project) return { kind: "project", id: project[1] };

  const guide = GUIDE_PATTERN.exec(uri);
  if (guide && !guide[1].includes("..")) return { kind: "guide", id: guide[1] };

  throw new McpError(ErrorCode.InvalidParams, `Invalid resource URI. Expected ${ACCEPTED_FORMS}`);
}

export class ResourcesService {
  constructor(private docs: SpringBootDocsServiceOptimized) {}

  listResources() {
    return springProjectsConfig.getAllProjects().map((project) => ({
      uri: `spring://project/spring-${project.id}`,
      name: project.displayName,
      description: `${project.displayName} project page on spring.io`,
      mimeType: MIME_TYPE,
    }));
  }

  listTemplates() {
    return [
      {
        uriTemplate: "spring://project/{name}",
        name: "Spring project",
        description: "Any project page of spring.io/projects, by slug (e.g. spring-boot)",
        mimeType: MIME_TYPE,
      },
      {
        uriTemplate: "spring://guide/{id}",
        name: "Spring guide",
        description: "A getting-started guide of spring.io/guides, by id (e.g. rest-service)",
        mimeType: MIME_TYPE,
      },
    ];
  }

  async readResource(uri: string) {
    const { kind, id } = parseResourceUri(uri);
    try {
      let text: string;
      if (kind === "project") {
        const { markdown, url } = await this.docs.getProjectMarkdown(id);
        text = `# ${id}\n\n${markdown}\n\nSource: ${url}`;
      } else {
        text = await this.docs.getGuide(id, "full");
      }
      return { contents: [{ uri, mimeType: MIME_TYPE, text }] };
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : "Unable to read the resource");
    }
  }
}
