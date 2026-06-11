import type { ChatMessage, ProviderTransform } from "./types.js"

export const stripEmptyContent: ProviderTransform = {
  name: "stripEmptyContent",
  transform(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => {
      if (msg.content === null || msg.content === "") {
        const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0
        if (hasToolCalls || msg.role === "tool") {
          return msg
        }
        return { ...msg, content: "(empty)" }
      }
      return msg
    })
  },
}

export const normalizeToolCallIds: ProviderTransform = {
  name: "normalizeToolCallIds",
  transform(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((msg) => {
      if (msg.tool_call_id) {
        const normalized = msg.tool_call_id.replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 9)
          .padEnd(9, "0")
        if (normalized !== msg.tool_call_id) {
          return { ...msg, tool_call_id: normalized }
        }
      }

      if (msg.tool_calls) {
        const normalizedTCs = msg.tool_calls.map((tc) => {
          const nid = tc.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 9).padEnd(9, "0")
          if (nid !== tc.id) {
            return { ...tc, id: nid }
          }
          return tc
        })
        if (normalizedTCs.some((tc, i) => tc.id !== msg.tool_calls![i].id)) {
          return { ...msg, tool_calls: normalizedTCs }
        }
      }

      return msg
    })
  },
}

export function applyTransforms(
  messages: ChatMessage[],
  transforms: ProviderTransform[]
): ChatMessage[] {
  let result = messages
  for (const t of transforms) {
    result = t.transform(result)
  }
  return result
}

export const anthropicTransforms: ProviderTransform[] = [
  stripEmptyContent,
]

export const mistralTransforms: ProviderTransform[] = [
  stripEmptyContent,
  normalizeToolCallIds,
]

export const identityTransforms: ProviderTransform[] = []

export function getTransformsForProvider(provider: string): ProviderTransform[] {
  switch (provider) {
    case "anthropic":
      return anthropicTransforms
    case "mistral":
      return mistralTransforms
    default:
      return identityTransforms
  }
}
