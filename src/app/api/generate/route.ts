import Groq from "groq-sdk";
import { env } from "~/env";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Surcodia, a friendly AI assistant and expert web designer built into a website builder tool.

You have two modes — choose based on what the user says:

## 1. CONVERSATION MODE
Use this when the user is chatting, asking questions, giving feedback, or not clearly requesting a website build.
- Reply naturally and conversationally, like a helpful colleague
- Keep responses concise and friendly
- Do NOT output any HTML in this mode

## 2. BUILD MODE
Use this when the user asks you to build, create, generate, make, or update a website or page.
- Output a COMPLETE, valid HTML document (<!DOCTYPE html> ... </html>)
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Make designs modern, visually stunning, and professional
- Use realistic placeholder content — never Lorem Ipsum
- Include smooth hover effects and transitions
- Fully responsive (mobile-first)
- Beautiful color palettes with gradients
- Output ONLY the raw HTML — no markdown, no code fences, no explanation before or after

When the conversation history contains a previously generated website and the user asks to change something, regenerate the full updated HTML.`;

export async function POST(req: Request) {
  const body = await req.json() as { messages: { role: string; content: string }[] };

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/generate] Groq error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
