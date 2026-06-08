"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";
import { emptyCustomerForm, sourceOptions, statusOptions } from "../lib/options";

const resultFields = [
  "customerType",
  "customerLevel",
  "customerScore",
  "stage",
  "mainBlocker",
  "missingInformation",
  "nextGoal",
  "suggestedAction",
  "englishReply",
  "followUpTime",
  "priority",
  "confidence",
  "reasoning",
  "needSupervisorReview",
  "reviewReason",
  "sourceReferences"
];

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AuthPanel({ session, onSessionChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  async function signIn() {
    if (!supabase) {
      setMessage("请先配置 Supabase 环境变量。");
      return;
    }
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
  }

  async function signUp() {
    if (!supabase) {
      setMessage("请先配置 Supabase 环境变量。");
      return;
    }
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("注册成功。如果 Supabase 开启了邮箱确认，请先检查邮箱。");
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    onSessionChange(null);
  }

  if (session) {
    return (
      <div className="auth-card">
        <span>已登录：{session.user.email}</span>
        <button onClick={signOut}>退出登录</button>
      </div>
    );
  }

  return (
    <div className="auth-card auth-form">
      <strong>邮箱登录</strong>
      <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="actions compact">
        <button className="primary" onClick={signIn}>登录</button>
        <button onClick={signUp}>注册</button>
      </div>
      {message && <p className="notice">{message}</p>}
    </div>
  );
}

function AnalysisEditor({ analysis, finalReply, onFinalReplyChange, onChange }) {
  if (!analysis) return null;

  function valueFor(field) {
    const value = analysis[field];
    return Array.isArray(value) ? value.join("\n") : value ?? "";
  }

  function update(field, value) {
    const nextValue = ["missingInformation", "sourceReferences"].includes(field)
      ? value.split("\n").map((item) => item.trim()).filter(Boolean)
      : field === "customerScore"
        ? Number(value)
        : field === "confidence"
          ? Number(value)
          : value;
    onChange({ ...analysis, [field]: nextValue });
  }

  return (
    <section className="panel result-panel">
      <div className="section-title">
        <h2>AI 分析结果</h2>
        <span>可人工修改后保存到 Supabase</span>
      </div>
      <div className="result-grid">
        {resultFields.map((field) => (
          <Field key={field} label={field}>
            {["nextGoal", "suggestedAction", "englishReply", "reasoning", "reviewReason", "missingInformation", "sourceReferences"].includes(field) ? (
              <textarea
                rows={field === "englishReply" ? 5 : 3}
                value={valueFor(field)}
                onChange={(event) => update(field, event.target.value)}
              />
            ) : (
              <input value={valueFor(field)} onChange={(event) => update(field, event.target.value)} />
            )}
          </Field>
        ))}
      </div>
      <Field label="final_sent_reply 运营最终发送话术">
        <textarea
          rows={5}
          value={finalReply}
          onChange={(event) => onFinalReplyChange(event.target.value)}
        />
      </Field>
      <pre className="json-box">{JSON.stringify(analysis, null, 2)}</pre>
    </section>
  );
}

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [form, setForm] = useState(emptyCustomerForm);
  const [analysis, setAnalysis] = useState(null);
  const [finalReply, setFinalReply] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function analyzeCustomer() {
    setError("");
    setSuccess("");
    setIsAnalyzing(true);
    try {
      const authHeaders = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      const response = await fetch("/api/analyze-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(form)
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.analysis) {
        throw new Error(payload?.error || "AI分析失败，请稍后重试");
      }
      setAnalysis(payload.analysis);
      setFinalReply(payload.analysis.englishReply || "");
    } catch (analyzeError) {
      setError(analyzeError.message || "AI分析失败，请稍后重试");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function saveInteraction(action) {
    if (!supabase) {
      setError("请先配置 Supabase 环境变量。");
      return;
    }
    if (!session) {
      setError("请先登录后再保存客户。");
      return;
    }
    if (!analysis) {
      setError("请先生成 AI 分析结果。");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const sentAt = action === "sent" ? new Date().toISOString() : null;
      const aiSuggestedReply = analysis.englishReply || "";
      const finalSentReply = finalReply || aiSuggestedReply;
      const replyModified = finalSentReply.trim() !== aiSuggestedReply.trim();
      const customerPayload = {
        user_id: session.user.id,
        customer_name: form.customerName,
        country: form.country,
        source: form.source,
        original_message: form.originalMessage,
        our_reply: form.ourReply,
        quoted: form.quoted === "yes",
        quote_content: form.quoteContent,
        current_status: analysis.stage || form.currentStatus,
        question: form.question,
        latest_analysis: analysis,
        updated_at: new Date().toISOString()
      };

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert(customerPayload)
        .select("id")
        .single();

      if (customerError) throw customerError;

      const { data: analysisRow, error: analysisError } = await supabase.from("customer_analyses").insert({
        user_id: session.user.id,
        customer_id: customer.id,
        input_snapshot: form,
        analysis,
        ai_suggested_reply: aiSuggestedReply,
        final_english_reply: finalSentReply,
        final_sent_reply: action === "sent" ? finalSentReply : null,
        reply_modified: replyModified
      }).select("id").single();

      if (analysisError) throw analysisError;

      const { error: interactionError } = await supabase.from("interactions").insert({
        user_id: session.user.id,
        customer_id: customer.id,
        related_ai_analysis_id: analysisRow.id,
        original_message: form.originalMessage,
        our_reply: form.ourReply,
        ai_analysis: analysis,
        ai_suggested_reply: aiSuggestedReply,
        final_sent_reply: action === "sent" ? finalSentReply : null,
        reply_modified: replyModified,
        interaction_status: action,
        sent_at: sentAt,
        sent_by: action === "sent" ? session.user.id : null,
        operator_note: action === "inappropriate" ? "话术不合适" : null
      });

      if (interactionError) throw interactionError;

      if (action === "sent" && aiSuggestedReply) {
        await navigator.clipboard.writeText(aiSuggestedReply);
      }

      const messageMap = {
        sent: "已复制 AI 建议话术，并保存最终发送记录。",
        draft: "草稿已保存。",
        inappropriate: "已记录：话术不合适。"
      };
      setSuccess(messageMap[action] || "已保存。");
      setForm(emptyCustomerForm);
      setAnalysis(null);
      setFinalReply("");
    } catch (saveError) {
      setError(saveError.message || "保存失败，请检查 Supabase 配置。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Next.js + Supabase + OpenAI</p>
          <h1>储能电池询盘成交 AI 助手</h1>
          <p>邮箱登录后录入客户，调用后端 AI 分析，并保存到 Supabase。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/playbook">有效案例库</Link>
        </nav>
      </header>

      <AuthPanel session={session} onSessionChange={setSession} />

      <section className="panel">
        <div className="section-title">
          <h2>客户录入页</h2>
          <span>OpenAI API Key 只在后端 route 使用</span>
        </div>
        <div className="form-grid">
          <Field label="customerName 客户姓名">
            <input value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} />
          </Field>
          <Field label="country 国家">
            <input value={form.country} onChange={(event) => updateForm("country", event.target.value)} />
          </Field>
          <Field label="source 客户来源">
            <select value={form.source} onChange={(event) => updateForm("source", event.target.value)}>
              {sourceOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="quoted 是否已报价">
            <select value={form.quoted} onChange={(event) => updateForm("quoted", event.target.value)}>
              <option value="no">no</option>
              <option value="yes">yes</option>
            </select>
          </Field>
          <Field label="currentStatus 当前状态">
            <select value={form.currentStatus} onChange={(event) => updateForm("currentStatus", event.target.value)}>
              {statusOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="quoteContent 报价内容">
            <textarea rows={4} value={form.quoteContent} onChange={(event) => updateForm("quoteContent", event.target.value)} />
          </Field>
          <Field label="originalMessage 客户原始消息">
            <textarea rows={5} value={form.originalMessage} onChange={(event) => updateForm("originalMessage", event.target.value)} />
          </Field>
          <Field label="ourReply 我方已回复内容">
            <textarea rows={5} value={form.ourReply} onChange={(event) => updateForm("ourReply", event.target.value)} />
          </Field>
          <Field label="question 我的困惑">
            <textarea rows={3} value={form.question} onChange={(event) => updateForm("question", event.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <button className="primary" onClick={analyzeCustomer} disabled={isAnalyzing}>
            {isAnalyzing ? "AI 分析中..." : "AI 生成跟进方案"}
          </button>
          <button onClick={() => saveInteraction("sent")} disabled={isSaving || !analysis}>
            {isSaving ? "保存中..." : "复制并标记已发送"}
          </button>
          <button onClick={() => saveInteraction("draft")} disabled={isSaving || !analysis}>
            仅保存草稿
          </button>
          <button onClick={() => saveInteraction("inappropriate")} disabled={isSaving || !analysis}>
            话术不合适
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
      </section>

      <AnalysisEditor
        analysis={analysis}
        finalReply={finalReply}
        onFinalReplyChange={setFinalReply}
        onChange={(nextAnalysis) => {
          setAnalysis(nextAnalysis);
          if (!finalReply) setFinalReply(nextAnalysis.englishReply || "");
        }}
      />
    </main>
  );
}
