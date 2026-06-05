import "dotenv/config"
import { streamChat } from "./llm.js"
import { getSystemPrompt } from "./prompts.js"

async function main() {
  const userInput = process.argv.slice(2).join(" ").trim()

  if (!userInput) {
    process.stderr.write("用法: bun run src/index.ts \"你的问题\"\n")
    process.exit(1)
  }

  const systemPrompt = getSystemPrompt()

  try {
    for await (const chunk of streamChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput },
    ])) {
      process.stdout.write(chunk)
    }
    process.stdout.write("\n")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`错误: ${message}\n`)
    process.exit(1)
  }
}

main()
