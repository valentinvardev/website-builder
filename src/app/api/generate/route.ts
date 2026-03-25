import Anthropic from "@anthropic-ai/sdk";
import { env } from "~/env";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Surcodia, an expert web designer and developer. Your job is to generate complete, beautiful, production-quality HTML websites based on user prompts.

Rules:
- Always output a COMPLETE, valid HTML document (<!DOCTYPE html> ... </html>)
- Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>)
- Make designs modern, visually stunning, and professional
- Use realistic placeholder content — never leave Lorem Ipsum
- Include smooth hover effects and transitions
- Make it fully responsive (mobile-first)
- Use beautiful color palettes with gradients
- Output ONLY the raw HTML — no markdown, no code fences, no explanation
- When the user asks to change something, regenerate the full updated HTML`;

export async function POST(req: Request) {
  const body = await req.json() as { messages: { role: string; content: string }[] };

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    messages: body.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
