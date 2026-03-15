
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

const NOVA_PRO_MODEL = process.env.NOVA_PRO_MODEL_ID || "us.amazon.nova-pro-v1:0";
const NOVA_LITE_MODEL = process.env.NOVA_LITE_MODEL_ID || "us.amazon.nova-lite-v1:0";
const NOVA_PREMIER_MODEL = process.env.NOVA_PREMIER_MODEL_ID || "us.amazon.nova-premier-v1:0";

function getClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

interface NovaMessage {
  role: "user" | "assistant";
  content: Array<{
    type: "text" | "image";
    text?: string;
    source?: {
      mediaType: string;
      data: string;
    };
  }>;
}

interface NovaResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

// Build message payload for Nova
function buildPayload(messages: NovaMessage[], systemPrompt?: string) {
  return {
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content.map((c) => {
        if (c.type === "image" && c.source) {
          return {
            image: {
              format: c.source.mediaType.split("/")[1] || "png",
              source: { bytes: Buffer.from(c.source.data, "base64") },
            },
          };
        }
        return { text: c.text || "" };
      }),
    })),
    inferenceConfig: {
      max_new_tokens: 8000,
      temperature: 0.7,
      top_p: 0.95,
    },
    ...(systemPrompt
      ? { system: [{ text: systemPrompt }] }
      : {}),
  };
}

// Invoke Nova Pro (for full app generation)
export async function invokeNovaPro(
  userContent: string,
  systemPrompt: string,
  imageBase64?: string
): Promise<NovaResponse> {
  const client = getClient();

  const contentItems: NovaMessage["content"] = [{ type: "text", text: userContent }];
  if (imageBase64) {
    contentItems.unshift({
      type: "image",
      source: { mediaType: "image/png", data: imageBase64 },
    });
  }

  const messages: NovaMessage[] = [{ role: "user", content: contentItems }];
  const payload = buildPayload(messages, systemPrompt);

  const command = new InvokeModelCommand({
    modelId: NOVA_PRO_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const parsed = JSON.parse(Buffer.from(response.body).toString("utf-8"));

  return {
    text: parsed.output?.message?.content?.[0]?.text || "",
    tokensIn: parsed.usage?.inputTokens || 0,
    tokensOut: parsed.usage?.outputTokens || 0,
    model: NOVA_PRO_MODEL,
  };
}

// Invoke Nova Lite (for fast architecture/docs generation)
export async function invokeNovaLite(
  userContent: string,
  systemPrompt: string
): Promise<NovaResponse> {
  const client = getClient();

  const messages: NovaMessage[] = [
    { role: "user", content: [{ type: "text", text: userContent }] },
  ];
  const payload = buildPayload(messages, systemPrompt);

  const command = new InvokeModelCommand({
    modelId: NOVA_LITE_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const parsed = JSON.parse(Buffer.from(response.body).toString("utf-8"));

  return {
    text: parsed.output?.message?.content?.[0]?.text || "",
    tokensIn: parsed.usage?.inputTokens || 0,
    tokensOut: parsed.usage?.outputTokens || 0,
    model: NOVA_LITE_MODEL,
  };
}

// Streaming invoke for Nova Pro (returns async generator)
export async function* invokeNovaProStream(
  userContent: string,
  systemPrompt: string,
  imageBase64?: string
): AsyncGenerator<string> {
  const client = getClient();

  const contentItems: NovaMessage["content"] = [{ type: "text", text: userContent }];
  if (imageBase64) {
    contentItems.unshift({
      type: "image",
      source: { mediaType: "image/png", data: imageBase64 },
    });
  }

  const messages: NovaMessage[] = [{ role: "user", content: contentItems }];
  const payload = buildPayload(messages, systemPrompt);

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: NOVA_PRO_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);

  if (!response.body) return;

  for await (const event of response.body) {
    if (event.chunk?.bytes) {
      const chunk = JSON.parse(
        Buffer.from(event.chunk.bytes).toString("utf-8")
      );
      const text = chunk.contentBlockDelta?.delta?.text;
      if (text) yield text;
    }
  }
}

// Streaming invoke for Nova Lite
export async function* invokeNovaLiteStream(
  userContent: string,
  systemPrompt: string
): AsyncGenerator<string> {
  const client = getClient();

  const messages: NovaMessage[] = [
    { role: "user", content: [{ type: "text", text: userContent }] },
  ];
  const payload = buildPayload(messages, systemPrompt);

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: NOVA_LITE_MODEL,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);

  if (!response.body) return;

  for await (const event of response.body) {
    if (event.chunk?.bytes) {
      const chunk = JSON.parse(
        Buffer.from(event.chunk.bytes).toString("utf-8")
      );
      const text = chunk.contentBlockDelta?.delta?.text;
      if (text) yield text;
    }
  }
}

export const MODEL_IDS = {
  pro: NOVA_PRO_MODEL,
  lite: NOVA_LITE_MODEL,
  premier: NOVA_PREMIER_MODEL,
};
