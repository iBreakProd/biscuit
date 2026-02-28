import { tavily } from "@tavily/core";
import { WebSearchInputSchema, WebCitation } from "@repo/zod-schemas";

/**
 * web_search tool — Tavily-powered web search.
 * Hard-capped at 3 results per spec to keep LLM context lean.
 * Returns { formattedSnippet, citations } matching the same shape as driveRetrieveTool
 * so executor.ts can handle it uniformly.
 */
export async function webSearchTool(args: {
  query: string;
  topK?: number;
}): Promise<{ formattedSnippet: string; citations: WebCitation[] }> {
  const { query, topK } = WebSearchInputSchema.parse(args);

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[web_search] TAVILY_API_KEY is not set — returning empty results.");
    return { formattedSnippet: "Web search is unavailable (no API key configured).", citations: [] };
  }

  const limit = Math.min(topK ?? 3, 3); // hard cap at 3
  console.log(`[web_search] Querying Tavily: "${query.substring(0, 100)}" (limit=${limit})`);

  const client = tavily({ apiKey });
  const response = await client.search(query, {
    maxResults: limit,
    searchDepth: "basic",
    includeAnswer: false,
  });

  console.log(`[web_search] Tavily returned ${response.results.length} results`);

  if (response.results.length === 0) {
    return { formattedSnippet: "Web search returned no results.", citations: [] };
  }

  const citations: WebCitation[] = response.results.map((result) => ({
    type: "web" as const,
    url: result.url,
    title: result.title ?? "Untitled",
    snippet: result.content ? result.content.substring(0, 300) : undefined,
  }));

  const formattedSnippet = citations
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.url}\n${c.snippet ?? ""}`)
    .join("\n\n---\n\n");

  return { formattedSnippet, citations };
}
