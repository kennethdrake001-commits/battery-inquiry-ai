"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CustomerIntakeForm from "../components/customers/CustomerIntakeForm";
import CustomerWorkflowCard from "../components/workflow/CustomerWorkflowCard";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";
import {
  emptyCustomerForm,
} from "../lib/options";
import { dateToFollowUpAt, parseFollowUpTime } from "../lib/followUp";
import { generateCustomerWorkflow, mapAnalysisCustomerType, mapAnalysisLeadLevel } from "../lib/customerWorkflow";
import { buildTaskRows } from "../lib/taskWorkflow";

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
      <div className="demo-entry">
        <Link className="primary demo-entry-button" href="/test/workflow">
          Try Demo Without Login
          <span>免登录体验 Demo</span>
        </Link>
        <p className="notice">
          View sample customers and today&apos;s follow-up workflow without logging in.
        </p>
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
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(emptyCustomerForm);
  const [analysis, setAnalysis] = useState(null);
  const [finalReply, setFinalReply] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCustomerId, setSavedCustomerId] = useState(null);
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

  useEffect(() => {
    async function loadCustomers() {
      if (!supabase || !session) {
        setCustomers([]);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("customers")
        .select("*")
        .order("updated_at", { ascending: false });

      if (queryError) {
        setCustomers([]);
        return;
      }

      setCustomers(rows || []);
    }

    loadCustomers();
  }, [supabase, session]);

  const summaryCards = useMemo(() => {
    const tasks = buildTaskRows(customers);

    return [
      {
        title: "Today Follow-up",
        count: tasks.length,
        description: "Tasks generated from current customer workflow"
      },
      {
        title: "Need Quotation",
        count: customers.filter((customer) => (
          customer.stage === "Need Quotation" || customer.current_status === "待报价"
        )).length,
        description: "Customers waiting for quotation preparation"
      },
      {
        title: "Quoted Waiting Reply",
        count: customers.filter((customer) => (
          customer.stage === "Quoted"
          || customer.stage === "Waiting Reply"
          || customer.current_status === "已报价未回复"
        )).length,
        description: "Quoted customers still waiting for response"
      },
      {
        title: "Need Qualification",
        count: customers.filter((customer) => {
          const missingInfo = String(customer.missing_info || "").trim();
          return Boolean(missingInfo)
            || customer.stage === "Need Qualification"
            || customer.current_status === "待补信息";
        }).length,
        description: "Customers missing key info or qualification"
      },
      {
        title: "DDP Shipping Check",
        count: customers.filter((customer) => (
          customer.shipping_term === "DDP"
          && String(customer.quantity || "").trim()
          && String(customer.destination_city || "").trim()
        )).length,
        description: "DDP inquiries ready for shipping cost check"
      },
      {
        title: "High Priority Leads",
        count: customers.filter((customer) => customer.lead_level === "A").length,
        description: "A-level leads requiring close attention"
      }
    ];
  }, [customers]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function generateNextAction() {
    const recommendation = generateCustomerWorkflow(form);
    setForm((current) => ({
      ...current,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate || current.followUpDate,
      leadLevel: recommendation.leadLevel || current.leadLevel
    }));
    setSuccess("已生成规则版下一步动作建议。");
    setError("");
  }

  function updateWorkflowField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function buildCustomerPayload({ sentAt = null, currentAnalysis = null } = {}) {
    return {
      user_id: session.user.id,
      customer_name: form.customerName,
      country: form.country,
      source: form.source,
      original_message: form.originalMessage,
      our_reply: form.ourReply,
      quoted: form.quoted === "yes",
      quote_content: form.quoteContent,
      current_status: currentAnalysis?.stage || form.currentStatus,
      question: form.question,
      customer_type: form.customerType,
      stage: form.stage,
      lead_level: form.leadLevel,
      next_action: form.nextAction || currentAnalysis?.suggestedAction || null,
      missing_info: form.missingInfo || null,
      follow_up_date: form.followUpDate || null,
      quantity: form.quantity || null,
      destination_city: form.destinationCity || null,
      shipping_term: form.shippingTerm || null,
      latest_analysis: currentAnalysis,
      current_next_action: form.nextAction || currentAnalysis?.suggestedAction || null,
      next_follow_up_at: form.followUpDate
        ? dateToFollowUpAt(form.followUpDate)
        : currentAnalysis
          ? parseFollowUpTime(currentAnalysis.followUpTime)
          : null,
      last_contacted_at: sentAt,
      last_quote_at: form.quoted === "yes" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
  }

  async function saveCustomer() {
    if (!supabase) {
      setError("请先配置 Supabase 环境变量。");
      return;
    }
    if (!session) {
      setError("请先登录后再保存客户。");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const customerPayload = buildCustomerPayload({ currentAnalysis: analysis });
      const query = savedCustomerId
        ? supabase.from("customers").update(customerPayload).eq("id", savedCustomerId).select("id").single()
        : supabase.from("customers").insert(customerPayload).select("id").single();

      const { data: customerRow, error: customerError } = await query;
      if (customerError) throw customerError;

      setSavedCustomerId(customerRow.id);
      setSuccess("客户已保存到 Supabase。");
    } catch (saveError) {
      setError(saveError.message || "保存失败，请检查 Supabase 配置。");
    } finally {
      setIsSaving(false);
    }
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
      setForm((current) => ({
        ...current,
        customerType:
          current.customerType === "Unknown"
            ? mapAnalysisCustomerType(payload.analysis.customerType)
            : current.customerType,
        leadLevel: current.leadLevel || mapAnalysisLeadLevel(payload.analysis.customerLevel)
      }));
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
      const customerPayload = buildCustomerPayload({ sentAt, currentAnalysis: analysis });
      const customerQuery = savedCustomerId
        ? supabase.from("customers").update(customerPayload).eq("id", savedCustomerId).select("id").single()
        : supabase.from("customers").insert(customerPayload).select("id").single();

      const { data: customer, error: customerError } = await customerQuery;

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
      setSavedCustomerId(null);
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
          <Link href="/products">产品知识库</Link>
          <Link href="/system-checker">系统搭配校验器</Link>
          <Link href="/tasks">今日任务</Link>
        </nav>
      </header>

      <AuthPanel session={session} onSessionChange={setSession} />

      {session && (
        <section className="panel">
          <div className="section-title">
            <h2>Sales Operation Summary</h2>
            <span>实时汇总当前客户 workflow</span>
          </div>
          <div className="form-grid">
            {summaryCards.map((card) => (
              <article key={card.title} className="notice-panel">
                <strong>{card.title}</strong>
                <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginTop: 8 }}>{card.count}</div>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <CustomerIntakeForm
        title="客户录入页"
        subtitle="OpenAI API Key 只在后端 route 使用"
        form={form}
        onChange={updateForm}
        primaryAction={
          <button className="primary" onClick={analyzeCustomer} disabled={isAnalyzing} type="button">
            {isAnalyzing ? "AI 分析中..." : "AI 生成跟进方案"}
          </button>
        }
        secondaryActions={[
          {
            label: isSaving ? "保存中..." : "保存客户 / Save Customer",
            onClick: saveCustomer,
            disabled: isSaving
          },
          {
            label: isSaving ? "保存中..." : "复制并标记已发送",
            onClick: () => saveInteraction("sent"),
            disabled: isSaving || !analysis
          },
          {
            label: "仅保存草稿",
            onClick: () => saveInteraction("draft"),
            disabled: isSaving || !analysis
          },
          {
            label: "话术不合适",
            onClick: () => saveInteraction("inappropriate"),
            disabled: isSaving || !analysis
          }
        ]}
        footer={
          <>
            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}
          </>
        }
      />

      <CustomerWorkflowCard
        form={form}
        onChange={updateWorkflowField}
        onGenerate={generateNextAction}
      />

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
