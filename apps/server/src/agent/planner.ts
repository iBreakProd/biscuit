import { callPlannerLLM } from "../llm/openai";

export type PlannedStep = {
  index: number;
  title: string;
  description?: string;
};

export async function planTask(args: {
  userMessage: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  availableTools: string[];
}): Promise<{ steps: PlannedStep[] }> {
  const { userMessage, history, availableTools } = args;

const toolDescriptions = `
Available tools:
- vector_search: Performs semantic search over a small set of seeded documentation about this system (vector search, Redis Streams, Drive ingestion, etc.) and returns relevant text snippets. Use this tool when you need information about the system architecture, ingestion processes, or streaming capabilities.
- drive_retrieve: Performs semantic search over the user's indexed Google Drive documents. Use this tool when you need information about the user's personal knowledge, documents, or synced files.
- web_search: Searches the web using Tavily for general knowledge, external facts, current events, stock prices, or anything not available in personal Drive documents. Returns up to 3 summarized results. ONLY use this if the answer is NOT in the user's Drive documents.
- web_scrape: Scrapes a specific webpage URL and extracts its main text content (truncated to 10,000 chars). Use this AFTER web_search when you need the full content of a specific page and the search snippet is not enough.

PRIORITY RULE: ALWAYS prefer drive_retrieve first if the question relates to the user's documents or personal knowledge. Only use web_search or web_scrape for general web knowledge, external facts, or current events that are not in the user's Drive.
`;

  const systemPrompt = `You are a helpful AI agent. Your goal is to plan a sequence of steps to answer the user's request.
Constraints:
- You have a maximum of 7 steps. Keep your plan concise.
- You have a maximum of 60 seconds (1 minute) execution budget.
- If the user asks about their own documents, files, Google Drive, or personal knowledge, you MUST use the drive_retrieve tool.
- If the user asks about general knowledge, current events, or anything external, use web_search (and optionally web_scrape).
- The available tools you can use in the future are: [${availableTools.join(", ")}].
${toolDescriptions}
- You MUST output ONLY valid JSON matching this structure:
{
  "steps": [
    { "index": 1, "title": "Understanding the request", "description": "Analyzing..." }
  ]
}
`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  try {
    const isMock = !process.env.OPENAI_API_KEY;
    const responseJson = isMock 
      ? JSON.stringify({ steps: [{ index: 1, title: "Mock Planned Step", description: "Bypassed OpenAI call because no API key was provided" }]})
      : await callPlannerLLM({ messages });

    const parsed = JSON.parse(responseJson);
    
    if (Array.isArray(parsed.steps)) {
      // Normalize bounds of max 7 steps and correct sequence indexing
      const boundedSteps = parsed.steps.slice(0, 7).map((step: any, idx: number) => ({
        index: idx + 1,
        title: step.title || `Step ${idx + 1}`,
        description: step.description,
      }));
      return { steps: boundedSteps };
    }
    
    return { steps: [] };
  } catch (error) {
    console.error("Failed to parse planner JSON:", error);
    return { steps: [] };
  }
}
