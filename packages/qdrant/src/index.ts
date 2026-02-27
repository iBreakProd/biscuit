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

  try {
    const res = await client.getCollection(collectionName);
    if (res) return;
  } catch (err: any) {
    // 404 means it doesn't exist, which is fine, we'll create it.
    if (err.status !== 404) {
      throw err;
    }
  }

  await client.createCollection(collectionName, {
    vectors: {
      size: 1536, // text-embedding-3-small dimension
      distance: "Cosine",
    },
  });
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
  
  const filter = userId ? {
    must: [
      {
        key: "user_id",
        match: {
          value: userId,
        },
      },
    ],
  } : undefined;

  return await client.search("drive_vectors", {
    vector: embedding,
    limit: topK,
    filter,
    with_payload: true,
  });
}
