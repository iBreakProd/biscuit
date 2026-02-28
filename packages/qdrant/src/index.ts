import { QdrantClient } from "@qdrant/js-client-rest";

let qdrantClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (qdrantClient) {
    return qdrantClient;
  }

  qdrantClient = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

  return qdrantClient;
}

export async function healthCheckQdrant(): Promise<boolean> {
  try {
    const client = getQdrantClient();
    const result = await client.getCollections();
    return !!result.collections;
  } catch (error) {
    console.error("Qdrant Health Check Failed:", error);
    return false;
  }
}

export async function ensureDriveVectorsCollection() {
  const client = getQdrantClient();
  const collectionName = "drive_vectors";

  let collectionExists = false;
  try {
    const res = await client.getCollection(collectionName);
    if (res) collectionExists = true;
  } catch (err: any) {
    if (err.status !== 404) throw err;
  }

  if (!collectionExists) {
    await client.createCollection(collectionName, {
      vectors: {
        size: 1536,
        distance: "Cosine",
      },
    });
    console.log("[qdrant] Created drive_vectors collection (1536 dims, Cosine)");
  }

  // Always ensure the user_id payload index exists so Qdrant strict mode
  // allows filtering. createPayloadIndex is idempotent — safe every startup.
  try {
    await client.createPayloadIndex(collectionName, {
      field_name: "user_id",
      field_schema: "keyword",
      wait: true,
    });
    console.log("[qdrant] user_id payload index ensured.");
  } catch (err: any) {
    // "already exists" errors are fine
    if (!err?.message?.toLowerCase().includes("already exists")) {
      console.warn("[qdrant] createPayloadIndex warning:", err?.message);
    }
  }
}

export async function upsertPoints(points: any[]) {
  const client = getQdrantClient();
  await client.upsert("drive_vectors", {
    wait: true,
    points,
  });
}

export async function searchDriveVectors(embedding: number[], userId?: string, topK: number = 5) {
  const client = getQdrantClient();

  const filter: any = userId ? {
    must: [
      {
        key: "user_id",
        match: {
          value: userId,
        },
      },
    ],
  } : undefined;

  try {
    return await client.search("drive_vectors", {
      vector: embedding,
      limit: topK,
      filter,
      with_payload: true,
    });
  } catch (err: any) {
    // Log the full Qdrant error body so we can diagnose Bad Request causes
    console.error("[qdrant:search] FAILED. Status:", err?.status);
    console.error("[qdrant:search] Message:", err?.message);
    console.error("[qdrant:search] Error data:", JSON.stringify(err?.data ?? err?.error ?? err, null, 2));
    throw err;
  }
}
