import * as fs from "node:fs"
import * as path from "node:path"
import type { Tool } from "../tool-registry.js"

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

export const readTool: Tool = {
  name: "read",
  description:
    "读取文件内容，支持指定行范围。返回带行号的文件内容。对于大文件，建议使用 offset 和 limit 参数分批读取。",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "要读取的文件路径（支持相对路径和绝对路径）",
      },
      offset: {
        type: "integer",
        description: "起始行号（从 1 开始），不指定则从第 1 行开始",
      },
      limit: {
        type: "integer",
        description: "读取的行数，不指定则读取到文件末尾",
      },
    },
    required: ["file_path"],
  },
  execute: (args: Record<string, unknown>) => {
    const filePath = String(args.file_path ?? "")
    const offset = args.offset != null ? Number(args.offset) : undefined
    const limit = args.limit != null ? Number(args.limit) : undefined

    if (!filePath) {
      return "错误: 缺少 file_path 参数"
    }

    const resolved = resolvePath(filePath)

    try {
      const stat = fs.statSync(resolved)
      if (!stat.isFile()) {
        return `错误: 路径 "${resolved}" 不是一个文件`
      }
    } catch {
      return `错误: 文件 "${resolved}" 不存在`
    }

    try {
      const content = fs.readFileSync(resolved, "utf-8")
      const lines = content.split("\n")

      const startLine = offset != null && offset >= 1 ? offset : 1
      const endLine = limit != null && limit > 0 ? Math.min(startLine + limit - 1, lines.length) : lines.length

      if (startLine > lines.length) {
        return `文件共 ${lines.length} 行，起始行 ${startLine} 超出范围`
      }

      let result = ""
      for (let i = startLine - 1; i < endLine; i++) {
        const lineNum = i + 1
        const lineNumStr = String(lineNum).padStart(String(lines.length).length, " ")
        result += `${lineNumStr}→${lines[i]}\n`
      }

      const header = `文件: ${resolved} (共 ${lines.length} 行，显示第 ${startLine}-${endLine} 行)\n\n`
      return header + result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `读取文件失败: ${message}`
    }
  },
}
