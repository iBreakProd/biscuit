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
