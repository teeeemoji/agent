import "dotenv/config"
import * as readline from "node:readline"
import * as path from "node:path"
import * as fs from "node:fs"
import { getSystemPrompt } from "./prompts.js"
import { Conversation } from "./conversation.js"
import { createDefaultRegistry } from "./tool-registry.js"
import { runAgent, buildSystemPrompt } from "./agent-loop.js"
import { PermissionManager } from "./permission/permission-manager.js"
import { readTool } from "./tools/read.js"
import { writeTool } from "./tools/write.js"
import { editTool } from "./tools/edit.js"
import { grepTool } from "./tools/grep.js"
import { globTool } from "./tools/glob.js"
import { listTool } from "./tools/list.js"
import { bashTool } from "./tools/bash.js"
import { createProvider } from "./provider/provider-factory.js"
import type { ProviderConfig } from "./provider/provider-factory.js"

async function main() {
  const basePrompt = getSystemPrompt()
  const registry = createDefaultRegistry()
  registry.register(readTool)
  registry.register(writeTool)
  registry.register(editTool)
  registry.register(grepTool)
  registry.register(globTool)
  registry.register(listTool)
  registry.register(bashTool)
  const systemPrompt = buildSystemPrompt(basePrompt)
  const conversation = new Conversation(systemPrompt)

  const configDir = path.join(process.cwd(), ".miniagent")
  const configPath = path.join(configDir, "permissions.json")
  PermissionManager.createDefaultConfigFile(configDir)
  const permissionManager = PermissionManager.fromFile(configPath)

  const providerConfigPath = path.join(configDir, "config.json")
  if (!fs.existsSync(providerConfigPath)) {
    const defaultConfig: ProviderConfig = {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
    }
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(
      providerConfigPath,
      JSON.stringify(defaultConfig, null, 2) + "\n",
      "utf-8"
    )
  }
  const providerConfig = JSON.parse(
    fs.readFileSync(providerConfigPath, "utf-8")
  ) as ProviderConfig
  const provider = createProvider(providerConfig)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  })

  const askConfirm = (question: string): Promise<boolean> => {
    return new Promise((resolve) => {
      rl.question(`${question} (y/n) `, (answer) => {
        resolve(answer.trim().toLowerCase().startsWith("y"))
      })
    })
  }

  process.stdout.write(`Agent 已就绪，输入 /exit 退出，输入 /clear 清空对话\n`)
  process.stdout.write(`System: ${systemPrompt}\n`)
  process.stdout.write(`Provider: ${providerConfig.provider}, Model: ${providerConfig.model ?? process.env.OPENAI_MODEL ?? "gpt-4o"}\n`)
  process.stdout.write(`权限配置: ${configPath}\n`)
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

    try {
      const result = await runAgent(
        conversation,
        input,
        registry,
        permissionManager,
        provider,
        { maxTurns: 10, askConfirm }
      )

      const turns = conversation.getTurnCount()
      const tokens = conversation.estimateTokens()
      process.stdout.write(
        `-- 第 ${turns} 轮对话，Agent 使用了 ${result.turnsUsed} 个 turn，预估消耗 ${tokens} tokens --\n`
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
