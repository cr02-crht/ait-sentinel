"use client";

import { useState } from "react";
import { Bot, User, Send, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// The assistant naturally writes in markdown (headings, bold, bullets), but
// these bubbles are plain text — this renders just enough of that markdown
// subset to avoid literal "###"/"**" characters showing up in the chat.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const heading = trimmed.match(/^#{1,6}\s+(.*)/);
        if (heading) {
          return (
            <div key={i} className="font-semibold">
              {renderInline(heading[1])}
            </div>
          );
        }

        const bullet = trimmed.match(/^[*-]\s+(.*)/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-muted-foreground">•</span>
              <span>{renderInline(bullet[1])}</span>
            </div>
          );
        }

        return <div key={i}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

export function IdeaChat({ onUseSummary }: { onUseSummary: (businessGoal: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAssistantReply = messages.some((m) => m.role === "assistant" && m.content.trim());

  const handleSend = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || isSending) return;

    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error("The assistant didn't respond. Please try again.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantText };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong talking to the assistant.");
    } finally {
      setIsSending(false);
    }
  };

  const handleUseSummary = async () => {
    setIsSummarizing(true);
    setError(null);
    try {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "Requester" : "Assistant"}: ${m.content}`)
        .join("\n\n");

      const res = await fetch("/api/intake/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: transcript }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to summarize the conversation.");
      }

      const summary: string | undefined = data.draft?.businessGoal?.trim();
      onUseSummary(summary || transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't summarize this conversation — try again.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100 dark:border-purple-900/40 text-sm font-medium text-purple-700 dark:text-purple-300">
        <Sparkles className="w-4 h-4" />
        Talk it through with AI
      </div>

      <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Tell me roughly what you want to automate — I&apos;ll ask a couple of quick questions to help you
            describe it clearly. When you&apos;re done, use the button below to carry it into your request.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 shrink-0 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                  : "bg-muted text-foreground"
              }`}
            >
              {m.content ? (
                m.role === "assistant" ? <FormattedMessage text={m.content} /> : m.content
              ) : m.role === "assistant" && isSending ? (
                "…"
              ) : (
                ""
              )}
            </div>
            {m.role === "user" && (
              <div className="w-6 h-6 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/30">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* A <div>, not a <form> — this panel can end up inside a parent
          <form> (or not), and a nested form's submit event bubbles into the
          parent's onSubmit, which previously caused the whole intake form to
          submit whenever someone hit Send in here. */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="e.g. Something to alert us about failed payments"
          disabled={isSending}
          className="flex-1 px-3 py-2 rounded-lg border border-input bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60"
        />
        <Button type="button" size="sm" onClick={() => handleSend()} disabled={isSending || !input.trim()} className="gap-1.5 shrink-0">
          {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {hasAssistantReply && (
        <div className="flex justify-end px-4 pb-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleUseSummary}
            disabled={isSummarizing || isSending}
            className="gap-2 bg-linear-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
          >
            {isSummarizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Summarizing...
              </>
            ) : (
              "Use this as my description"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
