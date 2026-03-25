import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

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

  const history = body.messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const lastMessage = body.messages[body.messages.length - 1]!;

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const chat = model.startChat({ history });

  try {
    const result = await chat.sendMessageStream(lastMessage.content);

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          controller.enqueue(encoder.encode(chunk.text()));
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[/api/generate] Gemini error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
