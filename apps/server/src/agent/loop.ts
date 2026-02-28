import { StepSummary, AgentEvent, Citation } from "@repo/zod-schemas";
import { driveRetrieveTool } from "../tools/driveRetrieve";
import { webSearchTool } from "../tools/web_search";
import { webScrapeTool } from "../tools/web_scrape";
import { callPlannerLLM } from "../llm/openai";

export type AgentEventInput = Omit<AgentEvent, "id"> & { plan?: string[] };

export async function runDynamicAgentLoop(args: {
  taskId: string;
  userId: string;
  inputPrompt: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  appendEvent: (event: AgentEventInput) => Promise<void>;
  citationsAccumulator: Citation[];
  startTime: number;
}): Promise<{ finalAnswerMarkdown: string; stepSummaries: StepSummary[]; timeoutReached: boolean; maxStepsReached: boolean }> {
  const { taskId, userId, inputPrompt, history, appendEvent, citationsAccumulator, startTime } = args;
  const MAX_RUNTIME_MS = 120 * 1000;
  const MAX_STEPS = 7;

  const stepSummaries: StepSummary[] = [];
  let timeoutReached = false;
  let maxStepsReached = false;
  let finalAnswerMarkdown = "";

  const toolDescriptions = `
Available tools:
- drive_retrieve: Performs semantic search over the user's indexed Google Drive documents. Use this when needing info about the user's personal knowledge, documents, or synced files. ALWAYS use this if the user asks about their notes, resume, portfolio, or documents.
- web_search: Searches the web using Tavily for general knowledge, current events, or anything not available in personal Drive documents. Returns a snippet summary.
- web_scrape: Scrapes a specific webpage URL and extracts its main text content. Use this AFTER web_search when you need the full content of a specific page, or if the user explicitly provides a URL in their prompt.
`;

  const systemPrompt = `You are an autonomous ReAct AI agent. Your goal is to answer the user's request by dynamically choosing tools.
Constraints:
1. You have a maximum of ${MAX_STEPS} steps.
2. CRITICAL: You MUST use the 'drive_retrieve' tool AT LEAST ONCE before providing a 'final_answer', especially for ambiguous names (like "Tarak", "John", etc) or terms. ALWAYS verify if the knowledge exists in the user's Drive first!
3. If 'drive_retrieve' results do not yield a complete and confident answer, you MUST use 'web_search' to fill in the gaps for more accurate results. You can also do web search if the drive data feel insufficient.
4. MATURITY CHECK: When using 'web_search', you must evaluate the returned context. If the web search results are completely irrelevant to the underlying intent, discard them and do not hallucinate an answer. Use maturity in your decision to include them in your final answer.
5. Your VERY FIRST action MUST ALWAYS be "plan". DO NOT call tools before planning.

${toolDescriptions}

You MUST output ONLY valid JSON matching EXACTLY one of these three structures. DO NOT wrap it in backticks. DO NOT output ANY conversational text before or after the JSON.

OPTION 1: To plan (MUST act as Step 1):
{
  "action": "plan",
  "plan_steps": ["First step name", "Second step name", "etc..."],
  "thought_for_next_step": "your thought for what the immediate next step is doing"
}

OPTION 2: To call a tool:
{
  "action": "call_tool",
  "tool": "drive_retrieve" | "web_search" | "web_scrape",
  "tool_query": "specific search terms or URL",
  "thought_for_next_step": "your thought for what the immediate next step is doing"
}

OPTION 3: To finish and reply to the user:
{
  "action": "final_answer",
  "final_answer_markdown": "Your detailed final answer to the user in markdown formatting.",
  "thought": "your final reasoning"
}
`;

  // We maintain the trajectory history
  const agentTrajectory: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: inputPrompt },
  ];

  let currentStep = 1;
  let nextStepThought = "Analyzing request and creating a preliminary plan...";

  while (currentStep <= MAX_STEPS) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.warn(`[AgentLoop:${taskId}] task timed out in agent loop`);
      timeoutReached = true;
      break;
    }

    try {
      // 1. Ask LLM what to do next
      await appendEvent({
        taskId,
        type: "reflecting",
        timestamp: Date.now(),
        stepIndex: currentStep,
        title: `Agent is thinking (Step ${currentStep})...`,
        thought: nextStepThought
      });

      const responseJsonStr = await callPlannerLLM({ messages: agentTrajectory });
      let responseJson: any;
      try {
        // Strip markdown codeblocks just in case the LLM ignored json_object directives
        const cleanJsonStr = responseJsonStr.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        responseJson = JSON.parse(cleanJsonStr);
      } catch (e) {
        // If it entirely fails to parse, force it to try again instead of giving up lazily
        console.error(`[AgentLoop:${taskId}] Failed to parse JSON:`, responseJsonStr);
        agentTrajectory.push({ role: "assistant", content: responseJsonStr });
        agentTrajectory.push({ role: "user", content: "Your previous response was not valid JSON. You MUST output EXACTLY valid JSON using OPTION 1 or OPTION 2."});
        currentStep++;
        continue;
      }
      
      // Save the LLM's raw output into the trajectory so it remembers its decisions
      agentTrajectory.push({ role: "assistant", content: JSON.stringify(responseJson) });

      if (responseJson.action === "final_answer") {
        // AI is done
        finalAnswerMarkdown = responseJson.final_answer_markdown || responseJson.final_answer || "Done.";
        
        await appendEvent({
          taskId,
          type: "step_complete",
          timestamp: Date.now(),
          stepIndex: currentStep,
          title: "Synthesizing Final Answer",
          observationSummary: "Agent provided final answer.",
          thought: responseJson.thought || "Finalizing...",
          tools: [],
          progress: { currentStep, totalSteps: MAX_STEPS, completedSteps: currentStep }
        });
        
        break; // Exits the ReAct loop
      } else if (responseJson.action === "plan") {
        nextStepThought = responseJson.thought_for_next_step || "Executing plan...";
        const planSteps = Array.isArray(responseJson.plan_steps) ? responseJson.plan_steps : ["Plan generated"];

        await appendEvent({
          taskId,
          type: "step_complete",
          timestamp: Date.now(),
          stepIndex: currentStep,
          totalSteps: MAX_STEPS,
          title: "Planning Phase Complete",
          observationSummary: `Plan established: ${planSteps.join(", ")}`,
          tools: [],
          plan: planSteps,
          progress: { currentStep, totalSteps: MAX_STEPS, completedSteps: currentStep }
        });

        agentTrajectory.push({ role: "user", content: "Plan acknowledged. Proceed with the next action based on your plan." });

      } else if (responseJson.action === "call_tool") {
        const toolToCall = responseJson.tool;
        const toolQuery = responseJson.tool_query || "";
        nextStepThought = responseJson.thought_for_next_step || `Calling ${toolToCall}`;

        // Emit step execution
        await appendEvent({
          taskId,
          type: "step_executing",
          timestamp: Date.now(),
          stepIndex: currentStep,
          totalSteps: MAX_STEPS,
          title: `Using ${toolToCall}`,
          thought: nextStepThought,
          tools: [toolToCall],
          progress: { currentStep, totalSteps: MAX_STEPS, completedSteps: currentStep - 1 }
        });

        let observationSummary = "";
        let toolsUsed = [toolToCall];

        console.log(`[AgentLoop:${taskId}] Executing Step ${currentStep}: Tool=${toolToCall}, Query="${toolQuery}"`);

        // Execute Tool
        if (toolToCall === "drive_retrieve") {
          try {
            const results = await driveRetrieveTool({ query: toolQuery, userId });
            observationSummary = results.citations.length > 0 ? `drive_retrieve returned: ${results.formattedSnippet}` : "drive_retrieve returned no relevant results.";
            if (results.citations.length > 0) citationsAccumulator.push(...results.citations);
          } catch (err: any) {
            observationSummary = `drive_retrieve failed: ${err.message}`;
          }
        } else if (toolToCall === "web_scrape") {
          try {
             // check if it's a valid URL string
             const urlMatch = toolQuery.match(/https?:\/\/[^\s"']+/);
             if (urlMatch) {
               const url = urlMatch[0].replace(/[.,;)]+$/, "");
               const result = await webScrapeTool({ url });
               // Slice to avoid blowing up context window
               observationSummary = `web_scrape (${result.title}) returned text:\n${result.content.substring(0, 2000)}`;
             } else {
               observationSummary = `web_scrape failed: Invalid URL provided '${toolQuery}'`;
             }
          } catch (err: any) {
             observationSummary = `web_scrape failed: ${err.message}`;
          }
        } else if (toolToCall === "web_search") {
          try {
            const results = await webSearchTool({ query: toolQuery });
            observationSummary = `web_search returned: ${results.formattedSnippet}`;
            if (results.citations.length > 0) citationsAccumulator.push(...results.citations);
          } catch (err: any) {
            observationSummary = `web_search failed: ${err.message}`;
          }
        } else {
          observationSummary = `Unknown tool requested: ${toolToCall}`;
        }

        // Feed observation back to the LLM immediately to complete the ReAct Loop
        const observationMessage = `Tool ${toolToCall} Execution Result:\n${observationSummary}\n\nBased on this result, either call another tool, or use 'final_answer' to respond to the user.`;
        agentTrajectory.push({ role: "user", content: observationMessage });

        // Save Summary for History
        stepSummaries.push({
          index: currentStep,
          title: `Used ${toolToCall}`,
          description: nextStepThought,
          toolsUsed,
          status: "complete",
          observationSummary: observationSummary.substring(0, 300) + "...", // Shorten for DB history logging sizing
        });

        // Emit complete
        await appendEvent({
          taskId,
          type: "step_complete",
          timestamp: Date.now(),
          stepIndex: currentStep,
          totalSteps: MAX_STEPS,
          title: `Used ${toolToCall}`,
          observationSummary: observationSummary.substring(0, 800) + (observationSummary.length > 800 ? "..." : ""),
          tools: toolsUsed,
          progress: { currentStep, totalSteps: MAX_STEPS, completedSteps: currentStep }
        });

      } else {
        // Fallback for bad LLM output
        agentTrajectory.push({ role: "user", content: "Invalid JSON format or missing 'action' field. You MUST supply ONLY a raw JSON object matching the requested schema for 'action': 'plan', 'call_tool', or 'final_answer'." });
      }

    } catch (err: any) {
      console.error(`[AgentLoop:${taskId}] Error in step ${currentStep}:`, err);
      agentTrajectory.push({ role: "user", content: `Runtime Error: ${err.message}. Please retry or gracefully fail with final_answer.` });
    }

    currentStep++;
  }

  if (currentStep > MAX_STEPS && !finalAnswerMarkdown) {
    maxStepsReached = true;
    finalAnswerMarkdown = "I've reached the maximum number of allowed steps without arriving at a conclusive final answer based on the provided tools.";
  }

  return { finalAnswerMarkdown, stepSummaries, timeoutReached, maxStepsReached };
}
