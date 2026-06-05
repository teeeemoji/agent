import OpenAI from "openai"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
})

const model = process.env.OPENAI_MODEL ?? "gpt-4o"

export async function chat(messages: ChatMessage[]): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error("LLM 返回了空响应")
  }

  return content
}
