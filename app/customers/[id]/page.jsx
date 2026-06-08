"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";

const resultOptions = ["客户已回复", "客户未回复", "进入报价", "进入 PI", "成交", "失败", "暂不确定"];
const playbookEligibleResults = ["客户已回复", "进入报价", "进入 PI", "成交"];
const replyTagOptions = ["可直接用", "需要人工改", "不建议用", "成交话术", "唤醒有效"];
const failureReasons = [
  "价格问题",
  "运费问题",
  "清关/证书问题",
  "技术不匹配",
  "客户需求不清",
  "客户低质量",
  "采购时间未到",
  "付款风险",
  "已选择其他供应商",
  "跟进断掉",
  "其他"
];

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatTime(value) {
  if (!value) return "未发送";
  return new Date(value).toLocaleString();
}

const emptyPlaybookForm = {
  scene_name: "",
  customer_type: "",
  stage: "",
  problem: "",
  effective_reply: "",
  result: "",
  reply_tag: "可直接用",
  notes: ""
};

function HistoryItem({ item, onSaveAsPlaybook }) {
  const canSaveAsPlaybook = playbookEligibleResults.includes(item.result_feedback);

  return (
    <article className="history-item">
      <div className="history-head">
        <strong>{new Date(item.created_at).toLocaleString()}</strong>
        <div className="history-actions">
          {canSaveAsPlaybook && <button onClick={() => onSaveAsPlaybook(item)}>保存为有效案例</button>}
          <span>{item.interaction_status || "draft"}</span>
        </div>
      </div>
      <div className="two-col">
        <div>
          <h4>客户原始消息</h4>
          <p>{item.original_message || "无"}</p>
          <h4>我方已回复</h4>
          <p>{item.our_reply || "无"}</p>
          <h4>AI 建议话术</h4>
          <p>{item.ai_suggested_reply || "无"}</p>
          <h4>最终发送话术</h4>
          <p>{item.final_sent_reply || "未发送"}</p>
        </div>
        <div>
          <h4>AI 分析 JSON</h4>
          <pre className="json-box compact-json">{JSON.stringify(item.ai_analysis || {}, null, 2)}</pre>
          <h4>是否修改</h4>
          <p>{item.reply_modified ? "是" : "否"}</p>
          <h4>发送时间</h4>
          <p>{formatTime(item.sent_at)}</p>
          <h4>客户新回复</h4>
          <p>{item.customer_new_reply || "无"}</p>
          <h4>结果反馈 / 失败原因 / 人工备注</h4>
          <p>{[item.result_feedback, item.failure_reason, item.operator_note].filter(Boolean).join(" / ") || "无"}</p>
        </div>
      </div>
    </article>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [customerNewReply, setCustomerNewReply] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [finalReply, setFinalReply] = useState("");
  const [pendingFeedbackInteraction, setPendingFeedbackInteraction] = useState(null);
  const [playbookSourceInteraction, setPlaybookSourceInteraction] = useState(null);
  const [playbookForm, setPlaybookForm] = useState(emptyPlaybookForm);
  const [feedbackResult, setFeedbackResult] = useState("客户已回复");
  const [failureReason, setFailureReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPlaybook, setIsSavingPlaybook] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const customerId = params?.id;

  async function loadData() {
    if (!customerId) {
      setError("客户 ID 缺失，请从客户列表重新进入。");
      setLoading(false);
      return;
    }

    if (!supabase) {
      setError("请先配置 Supabase 环境变量。");
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (!data.session) {
      setLoading(false);
      return;
    }

    const { data: customerRow, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError) {
      setError(customerError.message);
      setLoading(false);
      return;
    }

    const { data: historyRows, error: historyError } = await supabase
      .from("interactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (historyError) {
      setError(historyError.message);
    } else {
      setCustomer(customerRow);
      setInteractions(historyRows || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [supabase, customerId]);

  const lastSentWithoutFeedback = useMemo(() => {
    return interactions.find((item) => item.sent_at && !item.result_feedback);
  }, [interactions]);

  async function updatePendingFeedback() {
    if (!pendingFeedbackInteraction) return;
    if (feedbackResult === "失败" && !failureReason) {
      setError("请选择失败原因。");
      return;
    }

    const { error: updateError } = await supabase
      .from("interactions")
      .update({
        result_feedback: feedbackResult,
        failure_reason: feedbackResult === "失败" ? failureReason : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", pendingFeedbackInteraction.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPendingFeedbackInteraction(null);
    await loadData();
    await continueAnalyze(true);
  }

  async function continueAnalyze(skipFeedbackCheck = false) {
    if (!customer || !session) return;
    if (!skipFeedbackCheck && lastSentWithoutFeedback) {
      setPendingFeedbackInteraction(lastSentWithoutFeedback);
      return;
    }

    setError("");
    setSuccess("");
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          customer,
          customerNewReply,
          operatorNote,
          interactionHistory: interactions
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.analysis) {
        throw new Error(payload?.error || "AI分析失败，请稍后重试");
      }
      setAnalysis(payload.analysis);
      setFinalReply(payload.analysis.englishReply || "");
      setSuccess("已生成下一步方案，可保存草稿或标记已发送。");
    } catch (analyzeError) {
      setError(analyzeError.message || "AI分析失败，请稍后重试");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function openPlaybookForm(item) {
    const itemAnalysis = item.ai_analysis || {};
    setPlaybookSourceInteraction(item);
    setPlaybookForm({
      scene_name: itemAnalysis.customerType && itemAnalysis.stage
        ? `${itemAnalysis.customerType} - ${itemAnalysis.stage}`
        : customer?.customer_name || "有效跟进案例",
      customer_type: itemAnalysis.customerType || customer?.latest_analysis?.customerType || "Unknown",
      stage: itemAnalysis.stage || customer?.current_status || "",
      problem: itemAnalysis.mainBlocker || "",
      effective_reply: item.final_sent_reply || item.ai_suggested_reply || "",
      result: item.result_feedback || "",
      reply_tag: item.result_feedback === "成交" ? "成交话术" : "可直接用",
      notes: item.operator_note || ""
    });
  }

  function updatePlaybookForm(field, value) {
    setPlaybookForm((current) => ({ ...current, [field]: value }));
  }

  async function savePlaybookCase() {
    if (!playbookSourceInteraction || !session) return;
    if (!playbookForm.scene_name || !playbookForm.effective_reply) {
      setError("请填写场景名称和有效话术。");
      return;
    }

    setError("");
    setSuccess("");
    setIsSavingPlaybook(true);

    const { error: insertError } = await supabase.from("playbook_cases").insert({
      scene_name: playbookForm.scene_name,
      customer_type: playbookForm.customer_type,
      stage: playbookForm.stage,
      problem: playbookForm.problem,
      effective_reply: playbookForm.effective_reply,
      result: playbookForm.result,
      reply_tag: playbookForm.reply_tag,
      notes: playbookForm.notes,
      source_customer_id: customer.id,
      source_interaction_id: playbookSourceInteraction.id,
      created_by: session.user.id
    });

    setIsSavingPlaybook(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess("已保存为有效案例。");
    setPlaybookSourceInteraction(null);
    setPlaybookForm(emptyPlaybookForm);
  }

  async function saveNextInteraction(action) {
    if (!analysis || !customer || !session) return;
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const aiSuggestedReply = analysis.englishReply || "";
      const finalSentReply = finalReply || aiSuggestedReply;
      const replyModified = finalSentReply.trim() !== aiSuggestedReply.trim();
      const sentAt = action === "sent" ? new Date().toISOString() : null;

      const { data: analysisRow, error: analysisError } = await supabase
        .from("customer_analyses")
        .insert({
          user_id: session.user.id,
          customer_id: customer.id,
          input_snapshot: { customerNewReply, operatorNote, interactionHistory: interactions },
          analysis,
          ai_suggested_reply: aiSuggestedReply,
          final_english_reply: finalSentReply,
          final_sent_reply: action === "sent" ? finalSentReply : null,
          reply_modified: replyModified
        })
        .select("id")
        .single();

      if (analysisError) throw analysisError;

      const { error: interactionError } = await supabase.from("interactions").insert({
        user_id: session.user.id,
        customer_id: customer.id,
        related_ai_analysis_id: analysisRow.id,
        original_message: customer.original_message,
        our_reply: customer.our_reply,
        ai_analysis: analysis,
        ai_suggested_reply: aiSuggestedReply,
        final_sent_reply: action === "sent" ? finalSentReply : null,
        reply_modified: replyModified,
        interaction_status: action,
        sent_at: sentAt,
        sent_by: action === "sent" ? session.user.id : null,
        customer_new_reply: customerNewReply,
        operator_note: operatorNote
      });

      if (interactionError) throw interactionError;

      await supabase
        .from("customers")
        .update({
          latest_analysis: analysis,
          current_status: analysis.stage || customer.current_status,
          updated_at: new Date().toISOString()
        })
        .eq("id", customer.id);

      if (action === "sent" && aiSuggestedReply) {
        await navigator.clipboard.writeText(aiSuggestedReply);
      }

      setSuccess(action === "sent" ? "已复制并标记已发送。" : "草稿已保存。");
      setAnalysis(null);
      setFinalReply("");
      setCustomerNewReply("");
      setOperatorNote("");
      await loadData();
    } catch (saveError) {
      setError(saveError.message || "保存失败，请检查 Supabase 配置。");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading) return <main className="app"><section className="panel">加载中...</section></main>;

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Customer Detail</p>
          <h1>{customer?.customer_name || "客户详情"}</h1>
          <p>{customer?.country || "未知国家"} · {customer?.source || "Unknown"}</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/playbook">有效案例库</Link>
          <Link href="/products">产品知识库</Link>
          <Link href="/system-checker">系统搭配校验器</Link>
        </nav>
      </header>

      {session ? <div className="auth-card">已登录：{session.user.email}</div> : <div className="auth-card">请先登录。</div>}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="panel">
        <div className="section-title">
          <h2>AI 继续分析下一步</h2>
          <span>会结合该客户历史 interactions</span>
        </div>
        <div className="form-grid">
          <Field label="customer_new_reply 客户新回复">
            <textarea rows={5} value={customerNewReply} onChange={(event) => setCustomerNewReply(event.target.value)} />
          </Field>
          <Field label="operator_note 人工备注">
            <textarea rows={5} value={operatorNote} onChange={(event) => setOperatorNote(event.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => continueAnalyze()} disabled={isAnalyzing || !session}>
            {isAnalyzing ? "AI 分析中..." : "AI 继续分析下一步"}
          </button>
        </div>
      </section>

      {analysis && (
        <section className="panel">
          <div className="section-title">
            <h2>下一步 AI 分析结果</h2>
            <span>可保存草稿或标记已发送</span>
          </div>
          <pre className="json-box">{JSON.stringify(analysis, null, 2)}</pre>
          <Field label="final_sent_reply 运营最终发送话术">
            <textarea rows={5} value={finalReply} onChange={(event) => setFinalReply(event.target.value)} />
          </Field>
          <div className="actions">
            <button onClick={() => saveNextInteraction("sent")} disabled={isSaving}>复制并标记已发送</button>
            <button onClick={() => saveNextInteraction("draft")} disabled={isSaving}>仅保存草稿</button>
          </div>
        </section>
      )}

      <section className="panel history">
        <div className="section-title">
          <h2>Interactions 历史</h2>
          <span>{interactions.length} 条记录</span>
        </div>
        {interactions.map((item) => (
          <HistoryItem key={item.id} item={item} onSaveAsPlaybook={openPlaybookForm} />
        ))}
        {interactions.length === 0 && <p className="empty">暂无历史记录</p>}
      </section>

      {pendingFeedbackInteraction && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>上一次跟进结果是什么？</h2>
            <Field label="结果反馈">
              <select value={feedbackResult} onChange={(event) => setFeedbackResult(event.target.value)}>
                {resultOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </Field>
            {feedbackResult === "失败" && (
              <Field label="failure_reason 失败原因">
                <select value={failureReason} onChange={(event) => setFailureReason(event.target.value)}>
                  <option value="">请选择失败原因</option>
                  {failureReasons.map((reason) => <option key={reason}>{reason}</option>)}
                </select>
              </Field>
            )}
            <div className="actions">
              <button className="primary" onClick={updatePendingFeedback}>保存反馈并继续分析</button>
              <button onClick={() => setPendingFeedbackInteraction(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {playbookSourceInteraction && (
        <div className="modal-backdrop">
          <div className="modal wide-modal">
            <h2>保存为有效案例</h2>
            <div className="form-grid">
              <Field label="场景名称 scene_name">
                <input value={playbookForm.scene_name} onChange={(event) => updatePlaybookForm("scene_name", event.target.value)} />
              </Field>
              <Field label="客户类型 customer_type">
                <input value={playbookForm.customer_type} onChange={(event) => updatePlaybookForm("customer_type", event.target.value)} />
              </Field>
              <Field label="当前阶段 stage">
                <input value={playbookForm.stage} onChange={(event) => updatePlaybookForm("stage", event.target.value)} />
              </Field>
              <Field label="问题/卡点 problem">
                <input value={playbookForm.problem} onChange={(event) => updatePlaybookForm("problem", event.target.value)} />
              </Field>
              <Field label="结果 result">
                <input value={playbookForm.result} onChange={(event) => updatePlaybookForm("result", event.target.value)} />
              </Field>
              <Field label="话术标签 reply_tag">
                <select value={playbookForm.reply_tag} onChange={(event) => updatePlaybookForm("reply_tag", event.target.value)}>
                  {replyTagOptions.map((tag) => <option key={tag}>{tag}</option>)}
                </select>
              </Field>
            </div>
            <Field label="有效话术 effective_reply">
              <textarea rows={5} value={playbookForm.effective_reply} onChange={(event) => updatePlaybookForm("effective_reply", event.target.value)} />
            </Field>
            <Field label="备注 notes">
              <textarea rows={3} value={playbookForm.notes} onChange={(event) => updatePlaybookForm("notes", event.target.value)} />
            </Field>
            <div className="actions">
              <button className="primary" onClick={savePlaybookCase} disabled={isSavingPlaybook}>
                {isSavingPlaybook ? "保存中..." : "保存案例"}
              </button>
              <button onClick={() => setPlaybookSourceInteraction(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
