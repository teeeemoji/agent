import * as fs from "node:fs"
import * as path from "node:path"
import type { Tool } from "../tool-registry.js"

function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  return path.resolve(process.cwd(), filePath)
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export const editTool: Tool = {
  name: "edit",
  description:
    "基于 search/replace 模式修改文件的部分内容。在文件中查找 old_str 并将其替换为 new_str。如果 old_str 在文件中唯一匹配，则执行替换；如果匹配多次或未匹配，则返回错误。",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "要编辑的文件路径（支持相对路径和绝对路径）",
      },
      old_str: {
        type: "string",
        description: "要查找并替换的原始文本内容",
      },
      new_str: {
        type: "string",
        description: "替换后的新文本内容",
      },
    },
    required: ["file_path", "old_str", "new_str"],
  },
  execute: (args: Record<string, unknown>) => {
    const filePath = String(args.file_path ?? "")
    const oldStr = String(args.old_str ?? "")
    const newStr = String(args.new_str ?? "")

    if (!filePath) {
      return "错误: 缺少 file_path 参数"
    }
    if (!oldStr) {
      return "错误: 缺少 old_str 参数"
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
      const normalized = normalizeLineEndings(content)
      const normalizedOld = normalizeLineEndings(oldStr)

      let count = 0
      let pos = -1
      let searchFrom = 0
      while ((pos = normalized.indexOf(normalizedOld, searchFrom)) !== -1) {
        count++
        searchFrom = pos + 1
      }

      if (count === 0) {
        return `错误: 在文件 "${resolved}" 中未找到匹配的 old_str 内容。请确认 old_str 内容与文件中的内容完全一致（包括空格和缩进）。`
      }

      if (count > 1) {
        return `错误: old_str 在文件中出现了 ${count} 次，无法确定要替换哪一处。请提供更具体的上下文以确保唯一匹配。`
      }

      const newContent = normalized.replace(normalizedOld, newStr)
      fs.writeFileSync(resolved, newContent, "utf-8")

      const linesBefore = normalized.split("\n").length
      const linesAfter = newContent.split("\n").length
      return `文件已编辑: ${resolved}
替换了 1 处匹配
文件行数: ${linesBefore} → ${linesAfter}`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `编辑文件失败: ${message}`
    }
  },
}
