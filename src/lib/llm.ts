import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Self-hosted vLLM speaks the OpenAI chat-completions API, so every model call
// in the app goes through this one provider. That keeps the endpoint, key and
// Qwen template settings in a single place.
const vllm = createOpenAICompatible({
  name: "vllm",
  baseURL: process.env.LLM_BASE_URL ?? "https://34.9.243.227/v1",
  apiKey: process.env.LLM_API_KEY,
  // vLLM hands chat_template_kwargs to Qwen's chat template. Thinking is on by
  // default there; disabling it keeps answers fast and the draft JSON clean.
  transformRequestBody: (args) => {
    const existing =
      typeof args.chat_template_kwargs === "object" &&
      args.chat_template_kwargs !== null
        ? (args.chat_template_kwargs as Record<string, unknown>)
        : {};

    return {
      ...args,
      chat_template_kwargs: { ...existing, enable_thinking: false },
    };
  },
});

export const llmModel = vllm.chatModel(
  process.env.LLM_MODEL ?? "qwen-27b",
);
