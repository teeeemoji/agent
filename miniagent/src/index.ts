import { createInterface } from "node:readline"
import { chat, PromptRole, getApiConfig } from "./llm.js"
import { buildSystemPrompt, listPromptRoles } from "./prompts.js"

const USAGE = `
miniagent - Stage 01: 最小可运行的 LLM CLI 对话

用法:
  npm start [选项]

选项:
  --role <name>    指定 Prompt 角色: ${listPromptRoles().join(" | ")}
  --model <id>     指定模型 ID (覆盖 .env 中的配置)
  --prompt <text>  使用自定义 system prompt
  --help           显示帮助信息

示例:
  npm start
  npm start -- --role coding
  npm start -- --role review --model deepseek-chat
  npm start -- --prompt "你是一个 Python 专家"
`

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE)
    return
  }

  const roleIndex = args.indexOf("--role")
  const modelIndex = args.indexOf("--model")
  const promptIndex = args.indexOf("--prompt")

  const role = roleIndex !== -1 ? (args[roleIndex + 1] as PromptRole) : undefined
  const model = modelIndex !== -1 ? args[modelIndex + 1] : undefined
  const customPrompt = promptIndex !== -1 ? args[promptIndex + 1] : undefined

  const { apiKey, baseUrl, model: defaultModel } = getApiConfig()
  const effectiveModel = model ?? defaultModel
  const systemPrompt = buildSystemPrompt({
    role,
    customPrompt,
  })

  console.log(`🤖 miniagent v0.1.0`)
  console.log(`   模型: ${effectiveModel}`)
  console.log(`   角色: ${role ?? "default"}`)
  console.log(`   端点: ${baseUrl}`)
  console.log(`   输入 /exit 退出, /help 查看帮助\n`)

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  })

  if (!process.stdin.isTTY) {
    const chunks: string[] = []
    for await (const chunk of process.stdin) {
      chunks.push(chunk as string)
    }
    const input = chunks.join("").trim()

    if (!input) {
      process.exit(0)
    }

    try {
      const result = await chat({
        systemPrompt,
        userMessage: input,
        model: effectiveModel,
      })
      console.log(`\n${result.content}\n`)
      if (result.usage) {
        console.log(
          `[Token 消耗: ${result.usage.total_tokens} (提示: ${result.usage.prompt_tokens}, 补全: ${result.usage.completion_tokens})]`,
        )
      }
    } catch (error) {
      console.error(
        `\n❌ 错误: ${error instanceof Error ? error.message : String(error)}\n`,
      )
    }
    process.exit(0)
  }

  rl.prompt()

  for await (const line of rl) {
    const input = line.trim()

    if (!input) {
      rl.prompt()
      continue
    }

    if (input === "/exit" || input === "/quit") {
      console.log("👋 再见!")
      break
    }

    if (input === "/help") {
      console.log(`可用命令:
  /exit, /quit    退出程序
  /help           显示帮助
  /stats          查看 Token 使用情况`)
      rl.prompt()
      continue
    }

    try {
      const result = await chat({
        systemPrompt,
        userMessage: input,
        model: effectiveModel,
      })

      console.log(`\n${result.content}\n`)

      if (result.usage) {
        console.log(
          `[Token 消耗: ${result.usage.total_tokens} (提示: ${result.usage.prompt_tokens}, 补全: ${result.usage.completion_tokens})]`,
        )
      }
    } catch (error) {
      console.error(
        `\n❌ 错误: ${error instanceof Error ? error.message : String(error)}\n`,
      )
    }

    rl.prompt()
  }

  rl.close()
}

main().catch((error) => {
  console.error("致命错误:", error)
  process.exit(1)
})