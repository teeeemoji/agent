import "dotenv/config"
import * as readline from "node:readline"
import { streamChat } from "./llm.js"
import { getSystemPrompt } from "./prompts.js"
import { Conversation } from "./conversation.js"

async function main() {
  const systemPrompt = getSystemPrompt()
  const conversation = new Conversation(systemPrompt)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  })

  process.stdout.write(`Agent 已就绪，输入 /exit 退出，输入 /clear 清空对话\n`)
  process.stdout.write(`System: ${systemPrompt}\n`)
  rl.prompt()

  rl.on("line", async (line) => {
    const input = line.trim()

    if (!input) {
      rl.prompt()
      return
    }

    if (input === "/exit") {
      process.stdout.write("再见！\n")
      rl.close()
      process.exit(0)
    }

    if (input === "/clear") {
      conversation.clear()
      process.stdout.write("对话已清空\n")
      rl.prompt()
      return
    }

    conversation.addUserMessage(input)

    try {
      let fullResponse = ""
      for await (const chunk of streamChat(conversation.getAllMessages())) {
        process.stdout.write(chunk)
        fullResponse += chunk
      }
      process.stdout.write("\n")

      conversation.addAssistantMessage(fullResponse)

      const tokens = conversation.estimateTokens()
      const turns = conversation.getTurnCount()
      process.stdout.write(
        `-- 第 ${turns} 轮对话，预估消耗 ${tokens} tokens --\n`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`错误: ${message}\n`)
    }

    rl.prompt()
  })

  rl.on("close", () => {
    process.stdout.write("\n再见！\n")
  })
}

main()
