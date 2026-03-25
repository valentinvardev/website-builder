import Groq from "groq-sdk";
import { env } from "~/env";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are Surcodia, a friendly AI assistant and expert web designer built into a website builder tool.

You have two modes — choose based on what the user says:

## 1. CONVERSATION MODE
Use when the user is chatting, asking questions, or giving feedback — NOT requesting a build.
- Reply naturally and conversationally, like a helpful colleague
- Keep responses concise and friendly
- Do NOT output any HTML

## 2. BUILD MODE
Use when the user asks to build, create, generate, make, or modify a website or page.
- Start your response with EXACTLY this token on its own line: %%SURCODIA_HTML%%
- Then immediately output the complete HTML — nothing before or after
- COMPLETE valid HTML document (<!DOCTYPE html> ... </html>)
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Modern, visually stunning, professional design
- Realistic placeholder content — never Lorem Ipsum
- Smooth hover effects and transitions, fully responsive, beautiful gradients
- When the user asks to change something in the existing site, output the full updated HTML

CRITICAL: In BUILD MODE your entire response must be %%SURCODIA_HTML%% followed by the HTML. Nothing else.`;

export async function POST(req: Request) {
  const body = await req.json() as {
    messages: { role: string; content: string }[];
    fileContext?: string;
  };

  const systemPrompt = body.fileContext
    ? `${SYSTEM_PROMPT}\n\n## WORKSPACE FILES\nThe user's project currently has these files:\n\`\`\`\n${body.fileContext}\n\`\`\`\nWhen the user asks to modify or create a specific file, acknowledge which file you're working on.`
    : SYSTEM_PROMPT;

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8192,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
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
