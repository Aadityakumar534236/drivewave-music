import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  mood: z.string().trim().min(2).max(300),
  titles: z.array(z.string().max(200)).min(1).max(500),
});

export const recommendQueue = createServerFn({ method: "POST" })
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }): Promise<{ indices: number[]; note: string } | { error: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const list = data.titles.map((t, i) => `${i}: ${t}`).join("\n");
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        maxRetries: 0,
        output: Output.object({
          schema: z.object({
            indices: z.array(z.number().int()).describe("Track numbers in play order, 3-15 items"),
            note: z.string().describe("One short friendly sentence about the queue"),
          }),
        }),
        system:
          "You are a DJ. Pick a listening queue only from the numbered track titles given, judging by title alone. All artists are 'ME'.",
        messages: [{ role: "user", content: `Mood or activity: ${data.mood}\n\nTracks:\n${list}` }],
        providerOptions: {
          openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] },
        },
      });
      const out = await result.output;
      const seen = new Set<number>();
      const indices = out.indices.filter((n) => n >= 0 && n < data.titles.length && !seen.has(n) && seen.add(n));
      if (!indices.length) return { error: "No matching songs found. Try another description." };
      return { indices, note: out.note };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("recommendQueue failed", status, e);
      if (status === 429) return { error: "Too many requests right now. Please try again in a moment." };
      if (status === 402 || status === 403) return { error: "AI recommendations are temporarily unavailable." };
      return { error: "Couldn't build a queue. Please try again." };
    }
  });
