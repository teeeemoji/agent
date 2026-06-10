import * as child_process from "node:child_process"
import * as path from "node:path"
import * as fs from "node:fs"
import type { Tool } from "../tool-registry.js"

const MAX_OUTPUT_LENGTH = 10000
const DEFAULT_TIMEOUT = 30

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

function truncateOutput(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  const half = Math.floor(maxLength / 2)
  return text.slice(0, half) + "\n... (输出被截断) ...\n" + text.slice(-half)
}

function executeCommand(
  command: string,
  cwd: string,
  timeoutSec: number
): Promise<{ stdout: string; stderr: string; exitCode: number; killed: boolean }> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const child = child_process.exec(
      command,
      {
        cwd,
        timeout: timeoutSec * 1000,
        maxBuffer: 10 * 1024 * 1024,
        signal: controller.signal,
        shell: process.env.COMSPEC || "cmd.exe",
        env: { ...process.env },
      },
      (error, stdout, stderr) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            resolve({
              stdout: stdout || "",
              stderr: "错误: 命令输出超过最大缓冲区限制\n" + (stderr || ""),
              exitCode: 1,
              killed: false,
            })
            return
          }
          resolve({
            stdout: stdout || "",
            stderr: stderr || error.message,
            exitCode: (error as NodeJS.ErrnoException).code === "ETIMEDOUT" ? 124 : error.killed ? 137 : 1,
            killed: error.killed || false,
          })
          return
        }
        resolve({
          stdout: stdout,
          stderr: stderr,
          exitCode: 0,
          killed: false,
        })
      }
    )

    const killTimer = setTimeout(() => {
      controller.abort()
      try {
        child.kill("SIGTERM")
      } catch {
        // 子进程可能已经退出
      }
    }, (timeoutSec + 10) * 1000)

    child.on("close", () => {
      clearTimeout(killTimer)
    })
  })
}

export const bashTool: Tool = {
  name: "bash",
  description:
    "在子进程中执行 shell 命令。返回命令的 stdout、stderr 和退出码。适用于运行测试、构建、安装依赖、执行脚本等操作。输出长度限制为 10000 字符。",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的 shell 命令",
      },
      cwd: {
        type: "string",
        description: "命令执行的工作目录（支持相对路径和绝对路径），默认为当前工作目录",
      },
      timeout: {
        type: "integer",
        description: `命令超时时间（秒），默认 ${DEFAULT_TIMEOUT} 秒`,
      },
    },
    required: ["command"],
  },
  execute: async (args: Record<string, unknown>) => {
    const command = String(args.command ?? "")

    if (!command) {
      return "错误: 缺少 command 参数"
    }

    let cwd = process.cwd()
    if (args.cwd) {
      const resolved = resolvePath(String(args.cwd))
      try {
        const stat = fs.statSync(resolved)
        if (!stat.isDirectory()) {
          return `错误: 工作目录 "${resolved}" 不是一个目录`
        }
        cwd = resolved
      } catch {
        return `错误: 工作目录 "${resolved}" 不存在`
      }
    }

    const timeout = args.timeout != null ? Math.max(1, Number(args.timeout)) : DEFAULT_TIMEOUT

    try {
      const result = await executeCommand(command, cwd, timeout)

      const stdoutTruncated = truncateOutput(result.stdout, MAX_OUTPUT_LENGTH)
      const stderrTruncated = truncateOutput(result.stderr, MAX_OUTPUT_LENGTH)

      let output = ""
      output += `命令: ${command}\n`
      output += `工作目录: ${cwd}\n`
      output += `退出码: ${result.exitCode}\n`
      output += `\n--- stdout ---\n`
      output += stdoutTruncated || "(无输出)"
      if (result.stderr) {
        output += `\n\n--- stderr ---\n`
        output += stderrTruncated
      }
      if (result.killed) {
        output += `\n\n⚠ 命令因超时被终止`
      }

      return output
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `命令执行失败: ${message}`
    }
  },
}
