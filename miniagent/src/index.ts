import "dotenv/config"
import * as readline from "node:readline"
import * as path from "node:path"
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
import { getProviderResolver } from "./provider/provider-resolver.js"
import { getAuthManager } from "./provider/auth-manager.js"
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

  const resolver = getProviderResolver()
  const resolved = resolver.resolve()
  const providerConfig: ProviderConfig = {
    provider: resolved.provider,
    model: resolved.modelId,
  }

  const authMgr = getAuthManager()
  const authInfo = authMgr.getAuthInfo(resolved.provider)

  if (!authInfo.info.apiKey && authInfo.source === "none") {
    const authProviders = new Set(["ollama", "lmstudio", "vllm"])
    if (!authProviders.has(resolved.provider)) {
      process.stdout.write(
        `警告: Provider "${resolved.provider}" 未配置 API Key。\n`
      )
      process.stdout.write(
        `请设置环境变量或创建 ~/.miniagent/auth.json 文件。\n`
      )
    }
  }

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
  process.stdout.write(
    `Provider: ${resolved.provider}, Model: ${resolved.modelId}, Auth: ${authInfo.source}\n`
  )
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
