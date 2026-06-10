"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";
import { emptyCustomerForm, customerTypeOptions, leadLevelOptions, shippingTermOptions, workflowStageOptions, sourceOptions, statusOptions } from "../lib/options";
import { dateToFollowUpAt, parseFollowUpTime } from "../lib/followUp";
import { generateCustomerWorkflow, mapAnalysisCustomerType, mapAnalysisLeadLevel } from "../lib/customerWorkflow";
import { buildTaskRows } from "../lib/taskWorkflow";

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
        <div className="demo-entry">
          <Link className="primary demo-entry-button" href="/test/workflow">
          免登录体验 Demo
          <span>直接查看公开测试页面</span>
          </Link>
          <p className="notice">
          无需登录即可查看示例客户和今日跟进流程。
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
      <SectionTitle title="系统判断结果" subtitle="这里是给运营看的内部判断，可人工调整后再保存。" />

      <div className="notice-panel" style={{ marginBottom: 16 }}>
        <strong>重点结论</strong>
        <p>客户类型：{analysis.customerType || "待判断"}</p>
        <p>当前阶段：{analysis.stage || "待判断"}</p>
        <p>客户等级：{analysis.customerLevel || "待判断"}</p>
        <p>缺失信息：{Array.isArray(analysis.missingInformation) ? analysis.missingInformation.join("、") || "无" : analysis.missingInformation || "无"}</p>
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
        <textarea
          rows={5}
          value={finalReply}
          onChange={(event) => onFinalReplyChange(event.target.value)}
        />
      </Field>

      <details style={{ marginTop: 16 }}>
        <summary>查看完整 AI JSON</summary>
        <pre className="json-box">{JSON.stringify(analysis, null, 2)}</pre>
      </details>
    </section>
  );
}

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [activeSummaryKey, setActiveSummaryKey] = useState("current_pending");
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
        key: "current_pending",
        title: "当前待处理",
        count: tasks.length,
        description: "根据当前客户流程自动生成的任务"
      },
      {
        key: "need_quotation",
        title: "待报价",
        count: customers.filter((customer) => (
          customer.stage === "Need Quotation" || customer.current_status === "待报价"
        )).length,
        description: "需要准备报价的客户"
      },
      {
        key: "quoted_waiting_reply",
        title: "已报价待回复",
        count: customers.filter((customer) => (
          customer.stage === "Quoted"
          || customer.stage === "Waiting Reply"
          || customer.current_status === "已报价未回复"
        )).length,
        description: "报价后还未收到明确回复"
      },
      {
        key: "need_qualification",
        title: "待补信息",
        count: customers.filter((customer) => {
          const missingInfo = String(customer.missing_info || "").trim();
          return Boolean(missingInfo)
            || customer.stage === "Need Qualification"
            || customer.current_status === "待补信息";
        }).length,
        description: "资料不完整，需要继续确认"
      },
      {
        key: "ddp_check",
        title: "DDP 核算",
        count: customers.filter((customer) => (
          customer.shipping_term === "DDP"
          && String(customer.quantity || "").trim()
          && String(customer.destination_city || "").trim()
        )).length,
        description: "可进入 DDP 运费核算的客户"
      },
      {
        key: "high_priority",
        title: "高优先级客户",
        count: customers.filter((customer) => customer.lead_level === "A").length,
        description: "A 级客户需要优先跟进"
      }
    ];
  }, [customers]);

  const selectedSummary = useMemo(
    () => summaryCards.find((card) => card.key === activeSummaryKey) || summaryCards[0] || null,
    [summaryCards, activeSummaryKey]
  );

  const selectedSummaryRows = useMemo(() => {
    const normalizeMissingInfo = (customer) => {
      const raw = customer.missing_info || customer.missingInfo || "";
      if (Array.isArray(raw)) return raw.join("、");
      return `${raw}`.trim();
    };

    const customerStage = (customer) => customer.stage || customer.current_status || "待确认";
    const customerAction = (customer) => customer.current_next_action || customer.next_action || customer.nextAction || "待确认";
    const customerFollowUp = (customer) => customer.follow_up_date || customer.next_follow_up_at || "";

    if (activeSummaryKey === "current_pending") {
      const tasks = buildTaskRows(customers);
      return tasks.map((task) => {
        const matchedCustomer = customers.find((customer) => customer.id === task.id);
        return {
          id: task.id,
          customerName: task.customer_name,
          country: task.country || matchedCustomer?.country || "未知国家",
          source: matchedCustomer?.source || "未知来源",
          stage: task.stage || customerStage(matchedCustomer || {}),
          nextAction: task.current_next_action || customerAction(matchedCustomer || {}),
          missingInfo: matchedCustomer ? normalizeMissingInfo(matchedCustomer) : "",
          followUpDate: task.next_follow_up_at || customerFollowUp(matchedCustomer || {}),
          taskReason: task.task_reason || ""
        };
      });
    }

    return customers
      .filter((customer) => {
        if (activeSummaryKey === "need_quotation") {
          return customer.stage === "Need Quotation" || customer.current_status === "待报价";
        }
        if (activeSummaryKey === "quoted_waiting_reply") {
          return customer.stage === "Quoted" || customer.stage === "Waiting Reply" || customer.current_status === "已报价未回复";
        }
        if (activeSummaryKey === "need_qualification") {
          return Boolean(normalizeMissingInfo(customer)) || customer.stage === "Need Qualification" || customer.current_status === "待补信息";
        }
        if (activeSummaryKey === "ddp_check") {
          return customer.shipping_term === "DDP"
            && String(customer.quantity || "").trim()
            && String(customer.destination_city || "").trim();
        }
        if (activeSummaryKey === "high_priority") {
          return customer.lead_level === "A";
        }
        return false;
      })
      .map((customer) => ({
        id: customer.id,
        customerName: customer.customer_name || customer.customerName || "未命名客户",
        country: customer.country || "未知国家",
        source: customer.source || "未知来源",
        stage: customerStage(customer),
        nextAction: customerAction(customer),
        missingInfo: normalizeMissingInfo(customer),
        followUpDate: customerFollowUp(customer),
        taskReason: ""
      }));
  }, [activeSummaryKey, customers]);

  const selectedSummaryTitle = useMemo(() => {
    const titleMap = {
      current_pending: "当前待处理客户",
      need_quotation: "待报价客户",
      quoted_waiting_reply: "已报价待回复客户",
      need_qualification: "待补信息客户",
      ddp_check: "DDP 核算客户",
      high_priority: "高优先级客户"
    };
    return titleMap[activeSummaryKey] || "客户列表";
  }, [activeSummaryKey]);

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

  function generateNextAction() {
    const recommendation = generateCustomerWorkflow(form);
    setForm((current) => ({
      ...current,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate || current.followUpDate,
      leadLevel: recommendation.leadLevel || current.leadLevel
    }));
    setSuccess("已生成下一步动作建议。");
    setError("");
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
      setSavedCustomerId(customer.id);
      setSuccess(messageMap[action] || "已保存。");
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
          <p className="eyebrow">询盘成交系统</p>
          <h1>储能电池询盘成交 AI 助手</h1>
          <p>把客户原始消息和你的疑问交给系统，先判断，再决定怎么跟进。</p>
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
          <SectionTitle title="今日工作台" subtitle="实时汇总当前客户进展与待处理事项" />
          <div className="form-grid">
            {summaryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                className="notice-panel"
                onClick={() => setActiveSummaryKey(card.key)}
                style={{
                  textAlign: "left",
                  border: activeSummaryKey === card.key ? "2px solid #2563eb" : "1px solid #dbe5f1",
                  background: activeSummaryKey === card.key ? "#eff6ff" : "#fff"
                }}
              >
                <strong>{card.title}</strong>
                <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginTop: 8 }}>{card.count}</div>
                <p>{card.description}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {session && (
        <section className="panel">
          <SectionTitle title={selectedSummaryTitle} subtitle="点击客户可继续进入详情页处理" />
          <div className="detail-grid">
            {selectedSummaryRows.length === 0 && <p className="empty">暂无客户</p>}
            {selectedSummaryRows.map((item) => (
              <article key={`${activeSummaryKey}-${item.id}`} className="detail-item">
                <strong>{item.customerName}</strong>
                <p>国家：{item.country}</p>
                <p>来源：{item.source}</p>
                <p>当前阶段：{item.stage}</p>
                <p>下一步动作：{item.nextAction || "待确认"}</p>
                {item.missingInfo ? <p>缺失信息：{item.missingInfo}</p> : null}
                {item.followUpDate ? <p>跟进日期：{item.followUpDate}</p> : null}
                {item.taskReason ? <p>任务原因：{item.taskReason}</p> : null}
                <div className="actions compact">
                  <Link href={`/customers/${item.id}`}>查看客户</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <SectionTitle title="快速操作" subtitle="先从最常用的动作开始" />
        <div className="actions">
          <button className="primary" type="button" onClick={resetIntake}>新增客户</button>
          <Link href="/tasks">今日任务</Link>
          <Link href="/customers">客户列表</Link>
        </div>
      </section>

      <section className="panel">
        <SectionTitle title="客户录入说明" subtitle="首页现在作为询盘分析入口，先抓核心信息，再让系统给出下一步建议。" />
        <div className="notice-panel">
          <p>1. 先填写客户基础信息和客户原始消息。</p>
          <p>2. 再补充你的疑问和已知关键信息。</p>
          <p>3. 点击“分析询盘并生成下一步”，得到内部判断和推荐英文话术。</p>
          <p>4. 确认无误后再保存客户，或复制话术继续跟进。</p>
          <p>建议分析后保存，但也可以先保存客户，稍后再处理。</p>
        </div>
      </section>

      <section className="panel">
        <SectionTitle title="询盘分析入口" subtitle="系统内部界面全部中文；只有给客户的话术保持英文。" />

        <h3>客户基础信息</h3>
        <div className="form-grid">
          <Field label="客户姓名">
            <input value={form.customerName} onChange={(event) => updateForm("customerName", event.target.value)} />
          </Field>
          <Field label="国家">
            <input value={form.country} onChange={(event) => updateForm("country", event.target.value)} />
          </Field>
          <Field label="客户来源">
            <select value={form.source} onChange={(event) => updateForm("source", event.target.value)}>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="公司 / 联系方式">
            <input
              placeholder="当前版本不单独入库，可先写在客户原始消息里"
              value=""
              readOnly
            />
          </Field>
        </div>

        <h3>客户原始消息</h3>
        <Field label="请尽量粘贴完整原文，这是系统判断的核心输入">
          <textarea rows={8} value={form.originalMessage} onChange={(event) => updateForm("originalMessage", event.target.value)} />
        </Field>

        <h3>我的疑问</h3>
        <Field label="你最想让系统帮你判断什么">
          <textarea rows={5} value={form.question} onChange={(event) => updateForm("question", event.target.value)} />
        </Field>

        <h3>关键信息补充</h3>
        <div className="form-grid">
          <Field label="客户类型">
            <select value={form.customerType} onChange={(event) => updateForm("customerType", event.target.value)}>
              {customerTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="感兴趣产品">
            <input placeholder="例如：5kWh 壁挂电池 / 10kWh 套装" />
          </Field>
          <Field label="数量">
            <input value={form.quantity} onChange={(event) => updateForm("quantity", event.target.value)} />
          </Field>
          <Field label="贸易方式">
            <select value={form.shippingTerm} onChange={(event) => updateForm("shippingTerm", event.target.value)}>
              {shippingTermOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="目的地">
            <input value={form.destinationCity} onChange={(event) => updateForm("destinationCity", event.target.value)} />
          </Field>
          <Field label="使用场景">
            <input placeholder="例如：家庭备电 / 安装商项目 / 分销渠道" />
          </Field>
        </div>

        <div className="actions">
          <button className="primary" onClick={analyzeCustomer} disabled={isAnalyzing} type="button">
            {isAnalyzing ? "分析中..." : "分析询盘并生成下一步"}
          </button>
          <button type="button" onClick={saveCustomer} disabled={isSaving}>
            {isSaving ? "保存中..." : "先保存，稍后分析"}
          </button>
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>历史 / 已处理信息</summary>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <Field label="当前阶段">
              <select value={form.stage} onChange={(event) => updateForm("stage", event.target.value)}>
                {workflowStageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="内部状态（低优先级）">
              <select value={form.currentStatus} onChange={(event) => updateForm("currentStatus", event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="是否已报价">
              <select value={form.quoted} onChange={(event) => updateForm("quoted", event.target.value)}>
                <option value="no">否</option>
                <option value="yes">是</option>
              </select>
            </Field>
            <Field label="客户等级">
              <select value={form.leadLevel} onChange={(event) => updateForm("leadLevel", event.target.value)}>
                {leadLevelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="报价内容">
              <textarea rows={4} value={form.quoteContent} onChange={(event) => updateForm("quoteContent", event.target.value)} />
            </Field>
            <Field label="我方已回复">
              <textarea rows={4} value={form.ourReply} onChange={(event) => updateForm("ourReply", event.target.value)} />
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
          <SectionTitle title="分析结果处理" subtitle="确认无误后，可以先复制英文回复，再保存客户。" />
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
          <SectionTitle title="下一步" subtitle="客户记录已经保存，你可以继续进入后续动作。" />
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
