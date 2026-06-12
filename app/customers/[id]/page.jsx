"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppNav from "../../../components/layout/AppNav";
import CustomerWorkflowCard from "../../../components/workflow/CustomerWorkflowCard";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import { dateToFollowUpAt, formatDateTime, parseFollowUpTime } from "../../../lib/followUp";
import { formatNextActionForDisplay } from "../../../lib/displayText";
import { generateCustomerWorkflow } from "../../../lib/customerWorkflow";
import {
  getCustomerTypeLabel,
  getCustomerTypeValue,
  getLeadLevel,
  getNextAction,
  getStageLabel,
  getStageValue,
  isPartnerCandidate
} from "../../../lib/customerViews";

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

function formatDateOnly(value) {
  if (!value) return "待安排";
  const text = `${value}`.trim();
  if (!text) return "待安排";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isProspectingCustomer(customer) {
  return customer?.source === "主动开发"
    || customer?.stage === "Prospecting";
}

function formatProspectingStageDisplay(customer, fallbackStage) {
  if (isProspectingCustomer(customer)) {
    return "主动开发中";
  }
  return fallbackStage;
}

function formatProspectingStatusDisplay(customer, fallbackStatus) {
  const status = customer?.current_status || "";
  if ([
    "未联系",
    "已发第一封",
    "第一次跟进",
    "第二次跟进",
    "已回复",
    "有兴趣",
    "不合适",
    "已转正式客户"
  ].includes(status)) {
    return status;
  }
  return fallbackStatus;
}

function formatProspectingActionDisplay(action) {
  if (!action) return "暂无动作";
  const text = `${action}`.trim();
  if (text === "发送首封开发信") return "发送首封开发信";
  if (text === "第一次跟进") return "第一次跟进";
  if (text === "第二次跟进") return "第二次跟进";
  return formatNextActionForDisplay(text);
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

const emptyQuoteForm = {
  quote_version: "",
  product: "",
  quantity: "",
  unit_price: "",
  total_price: "",
  trade_term: "FOB",
  port_or_address: "",
  valid_until: "",
  quote_note: ""
};

const emptyWorkflowForm = {
  customerType: "Unknown",
  stage: "New Inquiry",
  leadLevel: "C",
  quantity: "",
  destinationCity: "",
  shippingTerm: "Unknown",
  nextAction: "",
  missingInfo: "",
  followUpDate: ""
};

const emptyProfileForm = {
  contact_name: "",
  email: "",
  whatsapp: "",
  website: "",
  linkedin: "",
  facebook: "",
  city: "",
  business_scope: "",
  does_installation: "待确认",
  sells_battery: "待确认",
  sells_inverter: "待确认",
  import_experience: "待确认",
  customs_capability: "待补充"
};

const emptyDemandForm = {
  target_capacity: "",
  quantity: "",
  application_scenario: "",
  inverter_brand: "",
  is_oem: "否 / 待确认",
  shipping_term: "待确认",
  destination_city: "",
  destination_country: "",
  recommended_product: "",
  product_note: ""
};

function addDays(dateLike, days) {
  const date = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return fallback;
  }
  date.setDate(date.getDate() + days);
  return date;
}

function toDateText(dateLike) {
  const date = typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)
    ? new Date(`${dateLike}T00:00:00`)
    : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function isArchivedCustomer(customer) {
  return customer?.current_status === "归档"
    || customer?.stage === "Archived"
    || customer?.stage === "归档";
}

function getCurrentBlockerText(customer) {
  const stage = customer?.stage || "";
  const status = customer?.current_status || "";

  if (isArchivedCustomer(customer)) return "客户已归档，无需继续推进";
  if (stage === "Prospecting" || status === "Prospecting" || customer?.source === "主动开发") {
    return "主动开发客户，需要按开发节奏推进";
  }
  if (["新询盘", "New Inquiry"].includes(stage) || ["新询盘", "New Inquiry"].includes(status)) {
    return "需要先判断客户类型和需求";
  }
  if (["待补信息", "Need Qualification"].includes(stage) || ["待补信息", "Need Qualification"].includes(status)) {
    return "缺少关键信息，需要先问清楚";
  }
  if (["待报价", "Need Quotation"].includes(stage) || ["待报价", "Need Quotation"].includes(status)) {
    return "可以准备报价";
  }
  if (["已报价", "Quoted", "Waiting Reply", "已报价未回复", "待客户回复"].includes(stage)
    || ["已报价", "Quoted", "Waiting Reply", "已报价未回复", "待客户回复"].includes(status)) {
    return "等待客户反馈，需要按期跟进";
  }
  return "根据当前进展继续推进客户";
}

function shouldShowQuotedActions(customer) {
  const stage = customer?.stage || "";
  const status = customer?.current_status || "";
  return ["已报价", "Quoted"].includes(stage)
    || ["已报价", "已报价未回复", "Quoted"].includes(status);
}

function shouldShowNewInquiryActions(customer) {
  const stage = customer?.stage || "";
  const status = customer?.current_status || "";
  return ["新询盘", "New Inquiry"].includes(stage)
    || ["新询盘", "New Inquiry"].includes(status);
}

function shouldShowWaitingReplyActions(customer) {
  const stage = customer?.stage || "";
  const status = customer?.current_status || "";
  return ["Waiting Reply", "待客户回复"].includes(stage)
    || ["Waiting Reply", "待客户回复"].includes(status);
}

function buildProfileForm(customer) {
  return {
    contact_name: customer?.contact_name || "",
    email: customer?.email || "",
    whatsapp: customer?.whatsapp || "",
    website: customer?.website || "",
    linkedin: customer?.linkedin || "",
    facebook: customer?.facebook || "",
    city: customer?.city || customer?.destination_city || "",
    business_scope: customer?.business_scope || customer?.main_business || "",
    does_installation: customer?.does_installation || "待确认",
    sells_battery: customer?.sells_battery || "待确认",
    sells_inverter: customer?.sells_inverter || "待确认",
    import_experience: customer?.import_experience || customer?.has_import_experience || "待确认",
    customs_capability: customer?.customs_capability || customer?.customs_clearance_ability || "待补充"
  };
}

function buildDemandForm(customer) {
  return {
    target_capacity: customer?.target_capacity || "",
    quantity: customer?.quantity || "",
    application_scenario: customer?.application_scenario || customer?.application_scene || "",
    inverter_brand: customer?.inverter_brand || "",
    is_oem: customer?.is_oem || "否 / 待确认",
    shipping_term: customer?.shipping_term || "待确认",
    destination_city: customer?.destination_city || "",
    destination_country: customer?.destination_country || customer?.country || "",
    recommended_product: customer?.recommended_product || "",
    product_note: customer?.product_note || ""
  };
}

function HistoryItem({ item, onSaveAsPlaybook }) {
  const canSaveAsPlaybook = playbookEligibleResults.includes(item.result_feedback);

  return (
    <article className="history-item">
      <div className="history-head">
        <strong>{new Date(item.created_at).toLocaleString()}</strong>
        <div className="history-actions">
          {canSaveAsPlaybook && <button onClick={() => onSaveAsPlaybook(item)}>保存为有效案例</button>}
          <span>{item.interaction_status || "草稿"}</span>
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

function QuoteItem({ item, onNoteChange, onSaveNote, isSaving }) {
  return (
    <article className="history-item">
      <div className="history-head">
        <strong>{item.quote_version || "未命名版本"}</strong>
        <span>{formatDateTime(item.created_at)}</span>
      </div>
      <div className="two-col">
        <div>
          <h4>产品</h4>
          <p>{item.product || "无"}</p>
          <h4>数量</h4>
          <p>{item.quantity || "无"}</p>
          <h4>单价 / 总价</h4>
          <p>{item.unit_price || "-"} / {item.total_price || "-"}</p>
          <h4>贸易条款 / 港口或地址</h4>
          <p>{item.trade_term || "-"} / {item.port_or_address || "-"}</p>
        </div>
        <div>
          <h4>有效期</h4>
          <p>{item.valid_until || "无"}</p>
          <h4>备注</h4>
          <textarea rows={4} value={item.quote_note || ""} onChange={(event) => onNoteChange(item.id, event.target.value)} />
          <div className="actions compact">
            <button onClick={() => onSaveNote(item)} disabled={isSaving}>保存报价备注</button>
          </div>
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
  const [quotes, setQuotes] = useState([]);
  const [quoteForm, setQuoteForm] = useState(emptyQuoteForm);
  const [workflowForm, setWorkflowForm] = useState(emptyWorkflowForm);
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
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [scheduleFollowUpDate, setScheduleFollowUpDate] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingDemand, setIsEditingDemand] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [demandForm, setDemandForm] = useState(emptyDemandForm);
  const quoteSectionRef = useRef(null);

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
      setWorkflowForm({
        customerType: customerRow.customer_type || "Unknown",
        stage: customerRow.stage || "New Inquiry",
        leadLevel: customerRow.lead_level || "C",
        quantity: customerRow.quantity || "",
        destinationCity: customerRow.destination_city || "",
        shippingTerm: customerRow.shipping_term || "Unknown",
        nextAction: customerRow.next_action || customerRow.current_next_action || "",
        missingInfo: customerRow.missing_info || "",
        followUpDate: customerRow.follow_up_date || ""
      });
      setProfileForm(buildProfileForm(customerRow));
      setDemandForm(buildDemandForm(customerRow));
      setInteractions(historyRows || []);
    }

    const { data: quoteRows, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (quoteError) {
      setError(quoteError.message);
    } else {
      setQuotes(quoteRows || []);
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

      const { error: customerUpdateError } = await supabase
        .from("customers")
        .update({
          latest_analysis: analysis,
          current_status: analysis.stage || customer.current_status,
          customer_type: workflowForm.customerType || customer.customer_type || null,
          stage: workflowForm.stage || customer.stage || null,
          lead_level: workflowForm.leadLevel || customer.lead_level || null,
          next_action: workflowForm.nextAction || analysis.suggestedAction || null,
          missing_info: workflowForm.missingInfo || null,
          follow_up_date: workflowForm.followUpDate || null,
          quantity: workflowForm.quantity || customer.quantity || null,
          destination_city: workflowForm.destinationCity || customer.destination_city || null,
          shipping_term: workflowForm.shippingTerm || customer.shipping_term || null,
          current_next_action: workflowForm.nextAction || analysis.suggestedAction || null,
          next_follow_up_at: workflowForm.followUpDate ? dateToFollowUpAt(workflowForm.followUpDate) : parseFollowUpTime(analysis.followUpTime),
          last_contacted_at: sentAt || customer.last_contacted_at,
          last_customer_reply_at: customerNewReply ? new Date().toISOString() : customer.last_customer_reply_at,
          updated_at: new Date().toISOString()
        })
        .eq("id", customer.id);
      if (customerUpdateError) throw customerUpdateError;

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

  function updateQuoteForm(field, value) {
    setQuoteForm((current) => ({ ...current, [field]: value }));
  }

  function updateWorkflowForm(field, value) {
    setWorkflowForm((current) => ({ ...current, [field]: value }));
  }

  function updateProfileForm(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function updateDemandForm(field, value) {
    setDemandForm((current) => ({ ...current, [field]: value }));
  }

  function generateWorkflowRecommendation() {
    if (!customer) return;
    const recommendation = generateCustomerWorkflow({
      ...workflowForm,
      country: customer.country,
      originalMessage: customer.original_message,
      question: customer.question,
      quoteContent: customer.quote_content
    });

    setWorkflowForm((current) => ({
      ...current,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate || current.followUpDate,
      leadLevel: recommendation.leadLevel || current.leadLevel
    }));
    setSuccess("已生成推荐下一步动作。");
    setError("");
  }

  async function saveWorkflow() {
    if (!customer) return;
    if (!session?.user) {
      setError("请先登录后再保存流程更新。");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const nextFollowUpAt = workflowForm.followUpDate ? dateToFollowUpAt(workflowForm.followUpDate) : customer.next_follow_up_at;
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        customer_type: workflowForm.customerType,
        stage: workflowForm.stage,
        lead_level: workflowForm.leadLevel,
        next_action: workflowForm.nextAction || null,
        missing_info: workflowForm.missingInfo || null,
        follow_up_date: workflowForm.followUpDate || null,
        quantity: workflowForm.quantity || null,
        destination_city: workflowForm.destinationCity || null,
        shipping_term: workflowForm.shippingTerm || null,
        current_next_action: workflowForm.nextAction || null,
        next_follow_up_at: nextFollowUpAt,
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id);

    setIsSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("客户流程已保存。");
    await loadData();
  }

  async function updateCustomerWithExistingFields(payload) {
    let remainingPayload = { ...payload };
    const strippedFields = [];

    while (true) {
      const { error: updateError } = await supabase
        .from("customers")
        .update(remainingPayload)
        .eq("id", customer.id);

      if (!updateError) {
        return { error: null, strippedFields };
      }

      const match = updateError.message?.match(/Could not find the '([^']+)' column/);
      if (match?.[1] && Object.prototype.hasOwnProperty.call(remainingPayload, match[1])) {
        strippedFields.push(match[1]);
        delete remainingPayload[match[1]];
        continue;
      }

      return { error: updateError, strippedFields };
    }
  }

  async function saveProfile() {
    if (!customer || !session?.user) {
      setError("请先登录后再保存客户资料。");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const payload = {
      contact_name: profileForm.contact_name || null,
      email: profileForm.email || null,
      whatsapp: profileForm.whatsapp || null,
      website: profileForm.website || null,
      linkedin: profileForm.linkedin || null,
      facebook: profileForm.facebook || null,
      city: profileForm.city || null,
      business_scope: profileForm.business_scope || null,
      does_installation: profileForm.does_installation || null,
      sells_battery: profileForm.sells_battery || null,
      sells_inverter: profileForm.sells_inverter || null,
      import_experience: profileForm.import_experience || null,
      customs_capability: profileForm.customs_capability || null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await updateCustomerWithExistingFields(payload);
    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setIsEditingProfile(false);
    setSuccess("客户资料已保存");
    await loadData();
  }

  function cancelProfileEdit() {
    setProfileForm(buildProfileForm(customer));
    setIsEditingProfile(false);
    setError("");
  }

  async function saveDemand() {
    if (!customer || !session?.user) {
      setError("请先登录后再保存客户需求。");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const payload = {
      target_capacity: demandForm.target_capacity || null,
      quantity: demandForm.quantity || null,
      application_scenario: demandForm.application_scenario || null,
      inverter_brand: demandForm.inverter_brand || null,
      is_oem: demandForm.is_oem || null,
      shipping_term: demandForm.shipping_term === "待确认" ? null : demandForm.shipping_term,
      destination_city: demandForm.destination_city || null,
      destination_country: demandForm.destination_country || null,
      recommended_product: demandForm.recommended_product || null,
      product_note: demandForm.product_note || null,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await updateCustomerWithExistingFields(payload);
    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setWorkflowForm((current) => ({
      ...current,
      quantity: demandForm.quantity || "",
      destinationCity: demandForm.destination_city || "",
      shippingTerm: demandForm.shipping_term === "待确认" ? "Unknown" : demandForm.shipping_term
    }));
    setIsEditingDemand(false);
    setSuccess("客户需求已保存");
    await loadData();
  }

  function cancelDemandEdit() {
    setDemandForm(buildDemandForm(customer));
    setIsEditingDemand(false);
    setError("");
  }

  async function saveProgressAction({
    customerPayload,
    interactionStatus,
    interactionNote,
    successMessage
  }) {
    if (!customer || !session?.user) {
      setError("请先登录后再推进客户。");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    const now = new Date().toISOString();
    const { error: customerUpdateError } = await supabase
      .from("customers")
      .update({
        ...customerPayload,
        updated_at: now
      })
      .eq("id", customer.id);

    if (customerUpdateError) {
      setIsSaving(false);
      setError(customerUpdateError.message);
      return;
    }

    const interactionPayload = {
      user_id: session.user.id,
      customer_id: customer.id,
      original_message: customer.original_message,
      our_reply: customer.our_reply,
      interaction_status: interactionStatus,
      operator_note: interactionNote,
      created_at: now,
      updated_at: now
    };

    const { error: interactionError } = await supabase
      .from("interactions")
      .insert(interactionPayload);

    setIsSaving(false);

    if (interactionError) {
      setError(`客户状态已更新，但跟进记录写入失败：${interactionError.message}`);
      await loadData();
      return;
    }

    setSuccess(successMessage);
    setScheduleFollowUpDate("");
    await loadData();
  }

  async function markFollowedUp() {
    const nextDate = addDays(new Date(), 3);
    const followUpDateText = toDateText(nextDate);

    await saveProgressAction({
      customerPayload: {
        last_contacted_at: new Date().toISOString(),
        current_status: "待客户回复",
        stage: "Waiting Reply",
        current_next_action: "等待客户回复，必要时再次跟进",
        next_action: customer?.next_action || customer?.current_next_action || null,
        next_follow_up_at: nextDate.toISOString(),
        follow_up_date: followUpDateText
      },
      interactionStatus: "follow_up",
      interactionNote: "已完成一次跟进",
      successMessage: "已标记为已跟进，3 天后再次提醒。"
    });
  }

  async function scheduleNextFollowUp() {
    if (!scheduleFollowUpDate) {
      setError("请选择下次跟进日期。");
      setSuccess("");
      return;
    }

    await saveProgressAction({
      customerPayload: {
        next_follow_up_at: dateToFollowUpAt(scheduleFollowUpDate),
        follow_up_date: scheduleFollowUpDate,
        current_next_action: "按计划继续跟进"
      },
      interactionStatus: "follow_up_schedule",
      interactionNote: `已安排下次跟进：${scheduleFollowUpDate}`,
      successMessage: "已安排下次跟进。"
    });
  }

  async function markCustomerReplied() {
    await saveProgressAction({
      customerPayload: {
        last_customer_reply_at: new Date().toISOString(),
        current_status: "已回复",
        stage: "Customer Replied",
        current_next_action: "根据客户回复判断是否需要报价、补信息或推进合作"
      },
      interactionStatus: "customer_reply",
      interactionNote: "客户已回复，等待进一步判断",
      successMessage: "已标记客户已回复。"
    });
  }

  async function saveQuote() {
    if (!session?.user || !customer) {
      setError("请先登录后再保存报价。");
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setIsSavingQuote(true);

    const now = new Date().toISOString();
    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 2);
    const followUpDateText = followUpDate.toISOString().slice(0, 10);
    const nextFollowUpAt = dateToFollowUpAt(followUpDateText);
    const { error: quoteError } = await supabase.from("quotes").insert({
      customer_id: customer.id,
      quote_version: quoteForm.quote_version,
      product: quoteForm.product,
      quantity: quoteForm.quantity,
      unit_price: quoteForm.unit_price,
      total_price: quoteForm.total_price,
      trade_term: quoteForm.trade_term,
      port_or_address: quoteForm.port_or_address,
      valid_until: quoteForm.valid_until || null,
      quote_note: quoteForm.quote_note,
      created_by: session.user.id
    });

    let customerUpdateError = null;
    if (!quoteError) {
      const { error } = await supabase
        .from("customers")
        .update({
          last_quote_at: now,
          stage: "Quoted",
          current_status: customer.current_status === "待报价" || customer.current_status === "新询盘" ? "已报价未回复" : customer.current_status,
          follow_up_date: followUpDateText,
          next_follow_up_at: nextFollowUpAt,
          current_next_action: "Follow up quotation after 2 days",
          updated_at: now
        })
        .eq("id", customer.id);
      customerUpdateError = error;
    }

    setIsSavingQuote(false);
    if (quoteError) {
      setError(quoteError.message);
      return;
    }

    if (customerUpdateError) {
      setError("报价已保存，但客户流程更新失败。");
      await loadData();
      return;
    }

    setQuoteForm(emptyQuoteForm);
    setSuccess("报价版本已保存。");
    await loadData();
  }

  function updateQuoteNote(id, value) {
    setQuotes((current) => current.map((item) => (item.id === id ? { ...item, quote_note: value } : item)));
  }

  async function saveQuoteNote(item) {
    setIsSavingQuote(true);
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ quote_note: item.quote_note })
      .eq("id", item.id);
    setIsSavingQuote(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("报价备注已更新。");
    await loadData();
  }

  if (loading) return <main className="app"><section className="panel">加载中...</section></main>;

  const currentStage = getStageLabel(getStageValue(customer || {}));
  const displayStage = formatProspectingStageDisplay(customer || {}, currentStage);
  const displayStatus = formatProspectingStatusDisplay(customer || {}, currentStage);
  const currentType = getCustomerTypeLabel(getCustomerTypeValue(customer || {}));
  const currentLeadLevel = getLeadLevel(customer || {});
  const currentAction = workflowForm.nextAction || getNextAction(customer || {});
  const localizedCurrentAction = formatProspectingActionDisplay(currentAction);
  const persistedNextAction = customer?.current_next_action || customer?.next_action || workflowForm.nextAction;
  const localizedPersistedAction = formatProspectingActionDisplay(persistedNextAction);
  const blockerText = getCurrentBlockerText(customer || {});
  const followUpDateDisplay = formatDateOnly(customer?.next_follow_up_at || customer?.follow_up_date || workflowForm.followUpDate);
  const archivedCustomer = isArchivedCustomer(customer || {});
  const showQuotedActions = shouldShowQuotedActions(customer || {});
  const showNewInquiryActions = shouldShowNewInquiryActions(customer || {});
  const showWaitingReplyActions = shouldShowWaitingReplyActions(customer || {});

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">客户详情</p>
          <h1>{customer?.customer_name || "客户详情"}</h1>
          <p>{customer?.country || "未知国家"} · {customer?.source || "未知来源"}</p>
        </div>
        <AppNav />
      </header>

      {session ? <div className="auth-card">已登录：{session.user.email}</div> : <div className="auth-card">请先登录。</div>}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="panel">
        <div className="section-title">
          <h2>当前推进</h2>
          <span>先看当前该做什么，再进入下面各标签处理</span>
        </div>
        <div className="detail-grid">
          <div className="detail-item"><strong>当前阶段</strong><p>{displayStage || displayStatus || "待判断"}</p></div>
          <div className="detail-item"><strong>当前卡点</strong><p>{blockerText}</p></div>
          <div className="detail-item"><strong>下一步动作</strong><p>{localizedPersistedAction}</p></div>
          <div className="detail-item"><strong>下次跟进日期</strong><p>{followUpDateDisplay}</p></div>
        </div>
        {archivedCustomer ? (
          <div className="notice-panel" style={{ marginTop: 16 }}>
            <strong>客户已归档</strong>
            <p>客户已归档，如需继续推进，请先恢复客户。</p>
          </div>
        ) : (
          <>
            <div className="actions" style={{ marginTop: 16, flexWrap: "wrap" }}>
              {(showQuotedActions || showNewInquiryActions || (!showWaitingReplyActions && !archivedCustomer)) && (
                <button onClick={markFollowedUp} disabled={isSaving}>标记已跟进</button>
              )}
              {(showQuotedActions || showWaitingReplyActions || (!showNewInquiryActions && !archivedCustomer)) && (
                <button onClick={markCustomerReplied} disabled={isSaving}>标记客户已回复</button>
              )}
              {!archivedCustomer && (
                <>
                  <input
                    type="date"
                    value={scheduleFollowUpDate}
                    onChange={(event) => setScheduleFollowUpDate(event.target.value)}
                    style={{ maxWidth: 220 }}
                  />
                  <button onClick={scheduleNextFollowUp} disabled={isSaving}>安排下次跟进</button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="tabs">
          <button
            className={activeTab === "overview" ? "primary" : ""}
            style={activeTab === "overview"
              ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
              : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
            onClick={() => setActiveTab("overview")}
          >
            概览
          </button>
          <button
            className={activeTab === "profile" ? "primary" : ""}
            style={activeTab === "profile"
              ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
              : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
            onClick={() => setActiveTab("profile")}
          >
            客户资料
          </button>
          <button
            className={activeTab === "demand" ? "primary" : ""}
            style={activeTab === "demand"
              ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
              : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
            onClick={() => setActiveTab("demand")}
          >
            需求与产品
          </button>
          <button
            className={activeTab === "records" ? "primary" : ""}
            style={activeTab === "records"
              ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
              : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
            onClick={() => setActiveTab("records")}
          >
            跟进记录
          </button>
        </div>
      </section>

      {activeTab === "overview" && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>概览</h2>
              <span>只看当前阶段判断和下一步</span>
            </div>
            {isProspectingCustomer(customer || {}) && (
              <div className="notice-panel" style={{ marginBottom: 16 }}>
                <strong>主动开发提醒</strong>
                <p>这是主动开发客户，请在主动开发页推进开发信、跟进和转正式客户。</p>
              </div>
            )}
            <div className="detail-grid">
              <div className="detail-item"><strong>客户名</strong><p>{customer?.customer_name || "待补充"}</p></div>
              <div className="detail-item"><strong>国家</strong><p>{customer?.country || "待补充"}</p></div>
              <div className="detail-item"><strong>客户类型</strong><p>{currentType}</p></div>
              <div className="detail-item"><strong>来源</strong><p>{customer?.source || "待补充"}</p></div>
              <div className="detail-item"><strong>客户评分 / 等级</strong><p>{customer?.latest_analysis?.customerScore || "-"} / {currentLeadLevel}</p></div>
              <div className="detail-item"><strong>当前阶段</strong><p>{displayStage}</p></div>
              <div className="detail-item"><strong>当前状态</strong><p>{displayStatus}</p></div>
              <div className="detail-item"><strong>下一步建议</strong><p>{localizedCurrentAction}</p></div>
              <div className="detail-item"><strong>下次跟进日期</strong><p>{formatDateOnly(workflowForm.followUpDate || customer?.next_follow_up_at)}</p></div>
              <div className="detail-item"><strong>合作商候选标记</strong><p>{isProspectingCustomer(customer || {}) ? "待判断" : (isPartnerCandidate(customer || {}) ? "是" : "否")}</p></div>
            </div>
          </section>

          <CustomerWorkflowCard
            form={workflowForm}
            onChange={updateWorkflowForm}
            onGenerate={generateWorkflowRecommendation}
            actions={<button onClick={saveWorkflow} disabled={isSaving}>保存客户流程</button>}
          />
        </>
      )}

      {activeTab === "profile" && (
        <section className="panel">
          <div className="section-title">
            <h2>客户资料</h2>
            <span>基础信息统一放这里，避免列表页过载</span>
            <div className="actions compact">
              {isEditingProfile ? (
                <>
                  <button className="primary" onClick={saveProfile} disabled={isSaving}>保存资料</button>
                  <button onClick={cancelProfileEdit} disabled={isSaving}>取消</button>
                </>
              ) : (
                <button onClick={() => setIsEditingProfile(true)}>编辑资料</button>
              )}
            </div>
          </div>
          {isEditingProfile ? (
            <div className="form-grid">
              <Field label="联系人"><input value={profileForm.contact_name} onChange={(event) => updateProfileForm("contact_name", event.target.value)} /></Field>
              <Field label="邮箱"><input value={profileForm.email} onChange={(event) => updateProfileForm("email", event.target.value)} /></Field>
              <Field label="WhatsApp"><input value={profileForm.whatsapp} onChange={(event) => updateProfileForm("whatsapp", event.target.value)} /></Field>
              <Field label="官网"><input value={profileForm.website} onChange={(event) => updateProfileForm("website", event.target.value)} /></Field>
              <Field label="LinkedIn"><input value={profileForm.linkedin} onChange={(event) => updateProfileForm("linkedin", event.target.value)} /></Field>
              <Field label="Facebook"><input value={profileForm.facebook} onChange={(event) => updateProfileForm("facebook", event.target.value)} /></Field>
              <Field label="城市"><input value={profileForm.city} onChange={(event) => updateProfileForm("city", event.target.value)} /></Field>
              <Field label="主营业务"><textarea rows={3} value={profileForm.business_scope} onChange={(event) => updateProfileForm("business_scope", event.target.value)} /></Field>
              <Field label="是否做安装">
                <select value={profileForm.does_installation} onChange={(event) => updateProfileForm("does_installation", event.target.value)}>
                  {["待确认", "是", "否"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="是否卖电池">
                <select value={profileForm.sells_battery} onChange={(event) => updateProfileForm("sells_battery", event.target.value)}>
                  {["待确认", "是", "否"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="是否卖逆变器">
                <select value={profileForm.sells_inverter} onChange={(event) => updateProfileForm("sells_inverter", event.target.value)}>
                  {["待确认", "是", "否"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="是否有进口经验">
                <select value={profileForm.import_experience} onChange={(event) => updateProfileForm("import_experience", event.target.value)}>
                  {["待确认", "是", "否"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="清关能力">
                <select value={profileForm.customs_capability} onChange={(event) => updateProfileForm("customs_capability", event.target.value)}>
                  {["待补充", "有清关能力", "需要我们协助", "不确定"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-item"><strong>联系人</strong><p>{profileForm.contact_name || "待补充"}</p></div>
              <div className="detail-item"><strong>邮箱</strong><p>{profileForm.email || "待补充"}</p></div>
              <div className="detail-item"><strong>WhatsApp</strong><p>{profileForm.whatsapp || "待补充"}</p></div>
              <div className="detail-item"><strong>官网</strong><p>{profileForm.website || "待补充"}</p></div>
              <div className="detail-item"><strong>LinkedIn</strong><p>{profileForm.linkedin || "待补充"}</p></div>
              <div className="detail-item"><strong>Facebook</strong><p>{profileForm.facebook || "待补充"}</p></div>
              <div className="detail-item"><strong>城市</strong><p>{profileForm.city || "待补充"}</p></div>
              <div className="detail-item"><strong>主营业务</strong><p>{profileForm.business_scope || "待补充"}</p></div>
              <div className="detail-item"><strong>是否做安装</strong><p>{profileForm.does_installation || "待确认"}</p></div>
              <div className="detail-item"><strong>是否卖电池</strong><p>{profileForm.sells_battery || "待确认"}</p></div>
              <div className="detail-item"><strong>是否卖逆变器</strong><p>{profileForm.sells_inverter || "待确认"}</p></div>
              <div className="detail-item"><strong>是否有进口经验</strong><p>{profileForm.import_experience || "待确认"}</p></div>
              <div className="detail-item"><strong>清关能力</strong><p>{profileForm.customs_capability || "待补充"}</p></div>
            </div>
          )}
        </section>
      )}

      {activeTab === "demand" && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>需求与产品</h2>
              <span>把需求、推荐产品和报价入口放在一起看</span>
              <div className="actions compact">
                {isEditingDemand ? (
                  <>
                    <button className="primary" onClick={saveDemand} disabled={isSaving}>保存需求</button>
                    <button onClick={cancelDemandEdit} disabled={isSaving}>取消</button>
                  </>
                ) : (
                  <button onClick={() => setIsEditingDemand(true)}>编辑需求</button>
                )}
              </div>
            </div>
            {isEditingDemand ? (
              <div className="form-grid">
                <Field label="目标容量"><input value={demandForm.target_capacity} onChange={(event) => updateDemandForm("target_capacity", event.target.value)} /></Field>
                <Field label="数量"><input value={demandForm.quantity} onChange={(event) => updateDemandForm("quantity", event.target.value)} /></Field>
                <Field label="应用场景"><input value={demandForm.application_scenario} onChange={(event) => updateDemandForm("application_scenario", event.target.value)} /></Field>
                <Field label="逆变器品牌"><input value={demandForm.inverter_brand} onChange={(event) => updateDemandForm("inverter_brand", event.target.value)} /></Field>
                <Field label="是否 OEM">
                  <select value={demandForm.is_oem} onChange={(event) => updateDemandForm("is_oem", event.target.value)}>
                    {["否 / 待确认", "是", "否"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="贸易条款">
                  <select value={demandForm.shipping_term} onChange={(event) => updateDemandForm("shipping_term", event.target.value)}>
                    {["FOB", "CIF", "DDP", "EXW", "待确认"].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="目的地城市"><input value={demandForm.destination_city} onChange={(event) => updateDemandForm("destination_city", event.target.value)} /></Field>
                <Field label="目的国家"><input value={demandForm.destination_country} onChange={(event) => updateDemandForm("destination_country", event.target.value)} /></Field>
                <Field label="推荐产品"><input value={demandForm.recommended_product} onChange={(event) => updateDemandForm("recommended_product", event.target.value)} /></Field>
                <Field label="产品备注或推荐原因"><textarea rows={4} value={demandForm.product_note} onChange={(event) => updateDemandForm("product_note", event.target.value)} /></Field>
              </div>
            ) : (
              <div className="detail-grid">
                <div className="detail-item"><strong>目标容量</strong><p>{demandForm.target_capacity || customer?.latest_analysis?.capacitySuggestion || "待确认"}</p></div>
                <div className="detail-item"><strong>数量</strong><p>{demandForm.quantity || "待确认"}</p></div>
                <div className="detail-item"><strong>应用场景</strong><p>{demandForm.application_scenario || customer?.question || "待确认"}</p></div>
                <div className="detail-item"><strong>逆变器品牌</strong><p>{demandForm.inverter_brand || "待确认"}</p></div>
                <div className="detail-item"><strong>是否 OEM</strong><p>{demandForm.is_oem || "否 / 待确认"}</p></div>
                <div className="detail-item"><strong>贸易条款</strong><p>{demandForm.shipping_term || "待确认"}</p></div>
                <div className="detail-item"><strong>目的地城市</strong><p>{demandForm.destination_city || "待补充"}</p></div>
                <div className="detail-item"><strong>目的国家</strong><p>{demandForm.destination_country || "待补充"}</p></div>
                <div className="detail-item"><strong>推荐产品</strong><p>{demandForm.recommended_product || customer?.quote_content || "待补充"}</p></div>
                <div className="detail-item"><strong>产品备注或推荐原因</strong><p>{demandForm.product_note || "待补充"}</p></div>
              </div>
            )}
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                className="primary"
                onClick={() => quoteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                新增报价
              </button>
              <button onClick={() => quoteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                查看报价记录
              </button>
            </div>
          </section>

          <section className="panel" ref={quoteSectionRef}>
            <div className="section-title">
              <h2>报价记录</h2>
              <span>{quotes.length} 个报价版本</span>
            </div>
            <div className="form-grid">
              <Field label="报价版本">
                <input value={quoteForm.quote_version} onChange={(event) => updateQuoteForm("quote_version", event.target.value)} />
              </Field>
              <Field label="产品">
                <input value={quoteForm.product} onChange={(event) => updateQuoteForm("product", event.target.value)} />
              </Field>
              <Field label="数量">
                <input value={quoteForm.quantity} onChange={(event) => updateQuoteForm("quantity", event.target.value)} />
              </Field>
              <Field label="单价">
                <input value={quoteForm.unit_price} onChange={(event) => updateQuoteForm("unit_price", event.target.value)} />
              </Field>
              <Field label="总价">
                <input value={quoteForm.total_price} onChange={(event) => updateQuoteForm("total_price", event.target.value)} />
              </Field>
              <Field label="贸易条款">
                <select value={quoteForm.trade_term} onChange={(event) => updateQuoteForm("trade_term", event.target.value)}>
                  {["FOB", "CIF", "DDP", "EXW", "Other"].map((term) => <option key={term}>{term}</option>)}
                </select>
              </Field>
              <Field label="港口或地址">
                <input value={quoteForm.port_or_address} onChange={(event) => updateQuoteForm("port_or_address", event.target.value)} />
              </Field>
              <Field label="报价有效期">
                <input type="date" value={quoteForm.valid_until} onChange={(event) => updateQuoteForm("valid_until", event.target.value)} />
              </Field>
              <Field label="报价备注">
                <textarea rows={3} value={quoteForm.quote_note} onChange={(event) => updateQuoteForm("quote_note", event.target.value)} />
              </Field>
            </div>
            <div className="actions">
              <button className="primary" onClick={saveQuote} disabled={isSavingQuote}>新增报价</button>
              <Link href="/quotes">进入报价页</Link>
            </div>
            <div className="history">
              {quotes.map((item) => (
                <QuoteItem key={item.id} item={item} onNoteChange={updateQuoteNote} onSaveNote={saveQuoteNote} isSaving={isSavingQuote} />
              ))}
              {quotes.length === 0 && <p className="empty">暂无报价记录</p>}
            </div>
          </section>
        </>
      )}

      {activeTab === "records" && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>继续跟进</h2>
              <span>跟进动作和新回复在这里推进</span>
            </div>
            <div className="form-grid">
              <Field label="客户新回复">
                <textarea rows={5} value={customerNewReply} onChange={(event) => setCustomerNewReply(event.target.value)} />
              </Field>
              <Field label="人工备注">
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
              <Field label="运营最终发送话术">
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
              <h2>跟进记录时间线</h2>
              <span>{interactions.length} 条记录</span>
            </div>
            <div className="timeline">
              {interactions.map((item) => (
                <article className="timeline-item" key={item.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="history-head">
                      <strong>{new Date(item.created_at).toLocaleString()}</strong>
                      <div className="actions compact">
                        {playbookEligibleResults.includes(item.result_feedback) && (
                          <button onClick={() => openPlaybookForm(item)}>保存为有效案例</button>
                        )}
                        <span>{item.interaction_status || "草稿"}</span>
                      </div>
                    </div>
                    <p><strong>客户原始消息：</strong>{item.original_message || "无"}</p>
                    <p><strong>最终发送话术：</strong>{item.final_sent_reply || "未发送"}</p>
                    <p><strong>客户新回复：</strong>{item.customer_new_reply || "无"}</p>
                    <p><strong>结果反馈：</strong>{[item.result_feedback, item.failure_reason, item.operator_note].filter(Boolean).join(" / ") || "无"}</p>
                    <details>
                      <summary>查看完整记录</summary>
                      <HistoryItem item={item} onSaveAsPlaybook={openPlaybookForm} />
                    </details>
                  </div>
                </article>
              ))}
            </div>
            {interactions.length === 0 && <p className="empty">暂无历史记录</p>}
          </section>
        </>
      )}

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
              <Field label="失败原因">
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
              <Field label="场景名称">
                <input value={playbookForm.scene_name} onChange={(event) => updatePlaybookForm("scene_name", event.target.value)} />
              </Field>
              <Field label="客户类型">
                <input value={playbookForm.customer_type} onChange={(event) => updatePlaybookForm("customer_type", event.target.value)} />
              </Field>
              <Field label="当前阶段">
                <input value={playbookForm.stage} onChange={(event) => updatePlaybookForm("stage", event.target.value)} />
              </Field>
              <Field label="问题/卡点">
                <input value={playbookForm.problem} onChange={(event) => updatePlaybookForm("problem", event.target.value)} />
              </Field>
              <Field label="结果">
                <input value={playbookForm.result} onChange={(event) => updatePlaybookForm("result", event.target.value)} />
              </Field>
              <Field label="话术标签">
                <select value={playbookForm.reply_tag} onChange={(event) => updatePlaybookForm("reply_tag", event.target.value)}>
                  {replyTagOptions.map((tag) => <option key={tag}>{tag}</option>)}
                </select>
              </Field>
            </div>
            <Field label="有效话术">
              <textarea rows={5} value={playbookForm.effective_reply} onChange={(event) => updatePlaybookForm("effective_reply", event.target.value)} />
            </Field>
            <Field label="备注">
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
