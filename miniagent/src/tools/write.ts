import * as fs from "node:fs"
import * as path from "node:path"
import type { Tool } from "../tool-registry.js"

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

export const writeTool: Tool = {
  name: "write",
  description:
    "创建新文件或覆盖已有文件。将完整内容写入指定路径的文件中。注意：此操作会覆盖已有文件的全部内容。",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "要写入的文件路径（支持相对路径和绝对路径）",
      },
      content: {
        type: "string",
        description: "要写入文件的完整内容",
      },
    },
    required: ["file_path", "content"],
  },
  execute: (args: Record<string, unknown>) => {
    const filePath = String(args.file_path ?? "")
    const content = String(args.content ?? "")

    if (!filePath) {
      return "错误: 缺少 file_path 参数"
    }
    if (content === "" && args.content !== "") {
      return "错误: 缺少 content 参数"
    }

    const resolved = resolvePath(filePath)
    const isNew = !fs.existsSync(resolved)

    try {
      const dir = path.dirname(resolved)
      ensureDir(dir)
      fs.writeFileSync(resolved, content, "utf-8")

      if (isNew) {
        return `文件已创建: ${resolved} (${content.length} 字符)`
      }
      return `文件已覆盖: ${resolved} (${content.length} 字符)`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `写入文件失败: ${message}`
    }
  },
}
