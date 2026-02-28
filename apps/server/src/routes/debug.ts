import { Router, Request, Response, Router as ExpressRouter } from "express";
import { z } from "zod";
import { VectorSearchInputSchema } from "@repo/zod-schemas";
import { vectorSearchTool } from "../tools/vectorSearch";
import { requireAuth } from "../auth/middleware";

const router: ExpressRouter = Router();

router.get("/qdrant/vector-search", requireAuth, async (req: Request, res: Response) => {
  try {
    // Parse the query params. 
    // Express req.query fields are strings, so we must coerce topK.
    const rawQuery = {
      query: req.query.query,
      topK: req.query.topK ? parseInt(req.query.topK as string, 10) : undefined,
    };

    const validatedInput = VectorSearchInputSchema.parse(rawQuery);
    
    const results = await vectorSearchTool(validatedInput);
    
    // Spec wants exactly: { query: string, hits: [...] }
    res.json({
      query: validatedInput.query,
      hits: results.hits,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      res.status(400).json({ error: "Validation Error", details: error.errors });
    } else {
      console.error("Vector search debug error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
});

export default router;
