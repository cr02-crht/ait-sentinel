"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Send,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdeaChat } from "@/components/idea-chat";

type PriorityType = "low" | "medium" | "high" | "critical";

type FormData = {
  requesterName: string;
  requesterEmail: string;
  priority: PriorityType;
  businessGoal: string;
};

const initialFormData: FormData = {
  requesterName: "",
  requesterEmail: "",
  priority: "medium",
  businessGoal: "",
};

const PRIORITY_COPY: Record<PriorityType, string> = {
  low: "Low",
  medium: "Normal",
  high: "High",
  critical: "Urgent",
};

type SubmittedRequest = {
  title: string;
  requesterName: string;
  requesterEmail: string;
  priority: PriorityType;
};

export default function IntakePage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [showIdeaChat, setShowIdeaChat] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    requestId: string;
    timestamp: string;
    data: SubmittedRequest;
  } | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.requesterName.trim() || !formData.requesterEmail.trim()) {
      setSubmitError("Please provide your name and email address.");
      return;
    }
    if (!formData.businessGoal.trim()) {
      setSubmitError("Please describe what you want automated.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to submit automation request.");
      }

      setSubmittedData({
        requestId: json.requestId,
        timestamp: json.timestamp,
        data: json.data,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyId = () => {
    if (submittedData?.requestId) {
      navigator.clipboard.writeText(submittedData.requestId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleResetForm = () => {
    setFormData(initialFormData);
    setSubmittedData(null);
    setSubmitError(null);
    setShowIdeaChat(false);
  };

  if (submittedData) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
              Request submitted!
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto mb-6 text-sm">
              Your automation request has been logged into the queue for review.
            </p>

            <div className="inline-flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/80 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 mb-8">
              <span className="text-xs uppercase font-medium tracking-wider text-zinc-500">Request ID</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                {submittedData.requestId}
              </span>
              <button
                onClick={handleCopyId}
                type="button"
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-500"
                title="Copy Request ID"
              >
                {copiedId ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-left bg-zinc-50 dark:bg-zinc-950/60 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 mb-8 space-y-4 text-sm">
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <span className="text-zinc-500">Title:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right">{submittedData.data.title}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <span className="text-zinc-500">Requester:</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {submittedData.data.requesterName} ({submittedData.data.requesterEmail})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Priority:</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {PRIORITY_COPY[submittedData.data.priority]}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleResetForm} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Submit Another Request
              </Button>
              <Link href="/catalog">
                <Button className="w-full sm:w-auto">Browse Automation Catalog</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            href="/catalog"
            className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            View Existing Scenarios →
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Request an automation
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Tell us what you need in plain language — no technical detail required.
          </p>
        </div>

        {submitError && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Kept fully outside the form below — it's a standalone brainstorming
            tool, not part of the request itself, and it must never end up
            nested inside <form onSubmit={handleSubmit}> (a submit event from
            an inner form bubbles into the outer one and would submit the
            whole request prematurely). */}
        <div>
          <button
            type="button"
            onClick={() => setShowIdeaChat((prev) => !prev)}
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
          >
            {showIdeaChat ? "Hide AI chat" : "Not sure how to describe this? Chat with AI first."}
          </button>

          {showIdeaChat && (
            <div className="mt-3">
              <IdeaChat
                onUseSummary={(text) => {
                  setFormData((prev) => ({ ...prev, businessGoal: text }));
                  setShowIdeaChat(false);
                }}
              />
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="requesterName"
                  required
                  placeholder="Your Name"
                  value={formData.requesterName}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Your Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="requesterEmail"
                  required
                  placeholder="name@company.com"
                  value={formData.requesterEmail}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                How urgent is this?
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["low", "medium", "high", "critical"] as PriorityType[]).map((level) => {
                  const isSelected = formData.priority === level;
                  const activeColor =
                    level === "critical"
                      ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : level === "high"
                      ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : level === "medium"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-zinc-500 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, priority: level }))}
                      className={`py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        isSelected
                          ? `${activeColor} font-semibold ring-1 ring-offset-0`
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {PRIORITY_COPY[level]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                What do you want automated? <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-zinc-500 mb-2">
                Describe the problem, the trigger, and where the result should go.
              </p>
              <textarea
                name="businessGoal"
                required
                rows={6}
                placeholder={
                  'e.g. "Every morning our team manually checks Stripe for failed payments and posts them in Discord. ' +
                  'We want this to happen automatically so customer support can reach out right away."'
                }
                value={formData.businessGoal}
                onChange={handleInputChange}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleResetForm} disabled={isSubmitting}>
              Clear Form
            </Button>
            <Button type="submit" disabled={isSubmitting} size="lg" className="gap-2 px-6">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Automation Request
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
