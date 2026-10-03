/**
 * Formats search results for the MCP text output. Pure helper (no network).
 * Results are numbered; `note` entries (e.g. empty content index) are appended unnumbered.
 */
export function formatSearchResults(results: any[]): string {
  if (results.length === 0) {
    return "No results found.";
  }

  const notes = results.filter((result) => result.type === "note");
  const items = results.filter((result) => result.type !== "note");

  const numbered = items.map((result, index) => `${index + 1}. **${result.title}**
   Type: ${result.type}
   URL: ${result.url}
   Description: ${result.description || "No description available"}

`);
  const trailing = notes.map((note) => `**${note.title}**
   ${note.description}

`);
  return [...numbered, ...trailing].join("\n");
}
