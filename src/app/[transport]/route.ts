import { z } from "zod";
import { createClient } from "@deepgram/sdk";
import { createMcpHandler } from "@vercel/mcp-adapter";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// Ensure Deepgram API key is present
if (!process.env.DEEPGRAM_API_KEY) {
  throw new Error("DEEPGRAM_API_KEY environment variable is not set.");
}
// Initialize Deepgram client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Error handling utility
const handleApiError = (error: any, defaultMessage = "API request failed") => {
  console.error("Deepgram API error:", error);
  let errorMessage = defaultMessage;
  if (error?.response) {
    errorMessage = `${defaultMessage}: ${error.response.status} - ${error.response.data?.message || JSON.stringify(error.response.data)}`;
  } else if (error?.request) {
    errorMessage = `${defaultMessage}: No response received`;
  } else if (error?.message) {
    errorMessage = `${defaultMessage}: ${error.message}`;
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `## Error\n\n${errorMessage}`
      }
    ]
  };
};


const handler = createMcpHandler((server) => {
  // REST-based TTS tool
  server.tool(
    "synthesizeSpeech",
    "Synthesize text to speech using Deepgram (REST API)",
    {
      text: z.string({ description: "Text to synthesize" }),
      model: z.string({ description: "Deepgram TTS model (e.g., aura-2-thalia-en)" }).optional(),
    },
    async ({ text, model }) => {
      try {
        const response = await deepgram.speak.request({ text }, { model: model || "aura-2-thalia-en" });
        if (!response.result) {
          return handleApiError({ message: 'No audio result from Deepgram.' }, 'Deepgram TTS error');
        }
        const arrayBuffer = await response.result.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString("base64");
        return {
          content: [
            {
              type: "audio" as const,
              data: base64Audio,
              mimeType: "audio/mpeg"
            }
          ]
        };
      } catch (error) {
        return handleApiError(error, "Failed to synthesize speech");
      }
    }
  );
});

export const GET = handler;
export const POST = handler;
