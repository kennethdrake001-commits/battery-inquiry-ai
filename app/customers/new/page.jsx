"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../../../components/layout/AppNav";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import {
  emptyCustomerForm,
  customerTypeOptions,
  leadLevelOptions,
  shippingTermOptions,
  workflowStageOptions,
  sourceOptions,
  statusOptions
} from "../../../lib/options";
import { dateToFollowUpAt, parseFollowUpTime } from "../../../lib/followUp";
import { mapAnalysisCustomerType, mapAnalysisLeadLevel } from "../../../lib/customerWorkflow";

const resultFieldMeta = [
  { key: "customerType", label: "客户类型" },
  { key: "stage", label: "当前阶段" },
  { key: "customerLevel", label: "客户等级" },
  { key: "missingInformation", label: "缺失信息", textarea: true },
  { key: "suggestedAction", label: "下一步动作", textarea: true },
  { key: "followUpTime", label: "建议跟进时间" },
  { key: "englishReply", label: "推荐英文话术", textarea: true, rows: 5 },
  { key: "mainBlocker", label: "主要卡点" },
  { key: "reasoning", label: "判断依据", textarea: true },
  { key: "sourceReferences", label: "参考来源", textarea: true }
];

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
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
      <input placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
      <input
        placeholder="密码"
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
      <SectionTitle title="系统判断结果" subtitle="系统内部判断全部放在这里，确认后再决定是否保存。" />

      <div className="notice-panel" style={{ marginBottom: 16 }}>
        <strong>重点结论</strong>
        <p>客户类型：{analysis.customerType || "待判断"}</p>
        <p>当前阶段：{analysis.stage || "待判断"}</p>
        <p>客户等级：{analysis.customerLevel || "待判断"}</p>
        <p>
          缺失信息：
          {Array.isArray(analysis.missingInformation)
            ? analysis.missingInformation.join("、") || "无"
            : analysis.missingInformation || "无"}
        </p>
        <p>下一步动作：{analysis.suggestedAction || "待补充"}</p>
        <p>跟进日期：{analysis.followUpTime || "待确认"}</p>
      </div>

      <div className="result-grid">
        {resultFieldMeta.map((field) => (
          <Field key={field.key} label={field.label}>
            {field.textarea ? (
              <textarea
                rows={field.rows || 3}
                value={valueFor(field.key)}
                onChange={(event) => update(field.key, event.target.value)}
              />
            ) : (
              <input value={valueFor(field.key)} onChange={(event) => update(field.key, event.target.value)} />
            )}
          </Field>
        ))}
      </div>

      <Field label="最终发送英文话术">
        <textarea rows={5} value={finalReply} onChange={(event) => onFinalReplyChange(event.target.value)} />
      </Field>

      <details style={{ marginTop: 16 }}>
        <summary>查看完整 AI JSON</summary>
        <pre className="json-box">{JSON.stringify(analysis, null, 2)}</pre>
      </details>
    </section>
  );
}

export default function NewCustomerPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
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

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetIntake() {
    setForm(emptyCustomerForm);
    setAnalysis(null);
    setFinalReply("");
    setSavedCustomerId(null);
    setError("");
    setSuccess("");
  }

  function buildCustomerPayload({ currentAnalysis = null } = {}) {
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
      next_action: form.nextAction || currentAnalysis?.suggestedAction || "待分析",
      missing_info: form.missingInfo || null,
      follow_up_date: form.followUpDate || null,
      quantity: form.quantity || null,
      destination_city: form.destinationCity || null,
      shipping_term: form.shippingTerm || null,
      latest_analysis: currentAnalysis,
      current_next_action: form.nextAction || currentAnalysis?.suggestedAction || "待分析",
      next_follow_up_at: form.followUpDate
        ? dateToFollowUpAt(form.followUpDate)
        : currentAnalysis
          ? parseFollowUpTime(currentAnalysis.followUpTime)
          : null,
      ...(form.quoted === "yes" ? { last_quote_at: new Date().toISOString() } : {}),
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
      const { data: customerRow, error: customerError } = await supabase
        .from("customers")
        .insert(customerPayload)
        .select("id")
        .single();

      if (customerError) throw customerError;

      setSavedCustomerId(customerRow.id);
      setSuccess(analysis ? "客户已保存到系统。" : "客户已先保存，后续可再补分析。");
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
        stage: payload.analysis.stage || current.stage,
        leadLevel: mapAnalysisLeadLevel(payload.analysis.customerLevel) || current.leadLevel,
        nextAction: payload.analysis.suggestedAction || current.nextAction,
        missingInfo: Array.isArray(payload.analysis.missingInformation)
          ? payload.analysis.missingInformation.join("\n")
          : current.missingInfo,
        followUpDate: /^\d{4}-\d{2}-\d{2}$/.test(payload.analysis.followUpTime || "")
          ? payload.analysis.followUpTime
          : current.followUpDate
      }));
    } catch (analyzeError) {
      setError(analyzeError.message || "AI分析失败，请稍后重试");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">客户</p>
          <h1>新询盘分析</h1>
          <p>把客户原话粘贴进来，系统会判断客户类型、缺失信息、下一步动作，并生成英文回复。</p>
        </div>
        <AppNav />
      </header>

      <AuthPanel session={session} onSessionChange={setSession} />

      <section className="panel">
        <SectionTitle title="客户基础信息" subtitle="先录核心信息，不把所有历史字段都堆在第一屏。" />

        <div className="notice-panel" style={{ marginBottom: 16 }}>
          <p>建议分析后保存，但也可以先保存客户，稍后再处理。</p>
        </div>

        <div className="form-grid">
          <Field label="客户姓名">
            <input
              placeholder="例如：Ahmed / Mary / 公司联系人"
              value={form.customerName}
              onChange={(event) => updateForm("customerName", event.target.value)}
            />
          </Field>
          <Field label="国家">
            <input
              placeholder="例如：Nigeria / Kenya / UAE"
              value={form.country}
              onChange={(event) => updateForm("country", event.target.value)}
            />
          </Field>
          <Field label="客户来源">
            <select value={form.source} onChange={(event) => updateForm("source", event.target.value)}>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </Field>
          <Field label="客户等级（可后续调整）">
            <select value={form.leadLevel} onChange={(event) => updateForm("leadLevel", event.target.value)}>
              {leadLevelOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="客户原始消息">
          <textarea
            rows={10}
            placeholder="把客户在阿里、WhatsApp、邮件里的原话粘贴到这里。"
            value={form.originalMessage}
            onChange={(event) => updateForm("originalMessage", event.target.value)}
          />
        </Field>

        <Field label="我的疑问">
          <textarea
            rows={5}
            placeholder="例如：客户要 DDP 但没有城市和数量，我应该怎么问？"
            value={form.question}
            onChange={(event) => updateForm("question", event.target.value)}
          />
        </Field>

        <details style={{ marginTop: 16 }}>
          <summary>关键信息补充</summary>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <Field label="客户类型">
              <select value={form.customerType} onChange={(event) => updateForm("customerType", event.target.value)}>
                {customerTypeOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="当前阶段">
              <select value={form.stage} onChange={(event) => updateForm("stage", event.target.value)}>
                {workflowStageOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="数量">
              <input value={form.quantity} onChange={(event) => updateForm("quantity", event.target.value)} />
            </Field>
            <Field label="贸易方式">
              <select value={form.shippingTerm} onChange={(event) => updateForm("shippingTerm", event.target.value)}>
                {shippingTermOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="目的地">
              <input value={form.destinationCity} onChange={(event) => updateForm("destinationCity", event.target.value)} />
            </Field>
            <Field label="缺失信息">
              <textarea rows={3} value={form.missingInfo} onChange={(event) => updateForm("missingInfo", event.target.value)} />
            </Field>
            <Field label="下一步动作">
              <textarea rows={3} value={form.nextAction} onChange={(event) => updateForm("nextAction", event.target.value)} />
            </Field>
            <Field label="跟进日期">
              <input type="date" value={form.followUpDate} onChange={(event) => updateForm("followUpDate", event.target.value)} />
            </Field>
          </div>
        </details>

        <details style={{ marginTop: 16 }}>
          <summary>历史 / 已处理信息</summary>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <Field label="内部状态（低优先级）">
              <select value={form.currentStatus} onChange={(event) => updateForm("currentStatus", event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="是否已报价">
              <select value={form.quoted} onChange={(event) => updateForm("quoted", event.target.value)}>
                <option value="no">否</option>
                <option value="yes">是</option>
              </select>
            </Field>
            <Field label="报价内容">
              <textarea rows={4} value={form.quoteContent} onChange={(event) => updateForm("quoteContent", event.target.value)} />
            </Field>
            <Field label="我方已回复">
              <textarea rows={4} value={form.ourReply} onChange={(event) => updateForm("ourReply", event.target.value)} />
            </Field>
          </div>
        </details>

        <div className="actions">
          <button className="primary" onClick={analyzeCustomer} disabled={isAnalyzing} type="button">
            {isAnalyzing ? "分析中..." : "分析客户并生成下一步"}
          </button>
          <button type="button" onClick={saveCustomer} disabled={isSaving}>
            {isSaving ? "保存中..." : "先保存，稍后分析"}
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

      {analysis && (
        <section className="panel">
          <SectionTitle title="分析结果处理" subtitle="确认内部判断后，再复制英文回复并保存客户。" />
          <div className="actions">
            <button onClick={() => navigator.clipboard.writeText(finalReply || analysis.englishReply || "")} type="button">
              复制英文回复
            </button>
            <button className="primary" onClick={saveCustomer} disabled={isSaving} type="button">
              {isSaving ? "保存中..." : "保存客户"}
            </button>
          </div>
        </section>
      )}

      {success && savedCustomerId && (
        <section className="panel">
          <SectionTitle title="保存完成" subtitle="客户已经进入系统，下一步可以继续处理或返回任务。" />
          <div className="success">客户已保存</div>
          <div className="actions">
            <Link href={`/customers/${savedCustomerId}`}>查看客户详情</Link>
            <Link href="/tasks">进入今日任务</Link>
            <button type="button" onClick={resetIntake}>继续录入下一个客户</button>
          </div>
        </section>
      )}
    </main>
  );
}
