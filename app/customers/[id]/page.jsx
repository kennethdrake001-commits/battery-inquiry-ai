"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppNav from "../../../components/layout/AppNav";
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
import {
  getChannelStatusLabel,
  getLeadProgressStageLabel,
  getLeadProgressStageValue,
  getLeadSourceLabel,
  getLeadSourceValue,
  isLeadProgressCustomer
} from "../../../lib/leadProgress";

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

function formatCustomerActionDisplay(action) {
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
  customer_name: "",
  country: "",
  customer_type: "Unknown",
  source: "",
  lead_level: "C",
  notes: "",
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
  missing_info: "",
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
  const leadStage = getLeadProgressStageValue(customer);

  if (isArchivedCustomer(customer)) return "客户已归档，无需继续推进";
  if (leadStage === "new_lead") return "这是新线索，需要先判断客户价值和触达方式";
  if (leadStage === "contacted") return "客户已触达，等待通过、回复或下一轮跟进";
  if (leadStage === "engaged") return "客户已有互动，建议继续破冰并确认业务方向";
  if (leadStage === "has_need") return "客户已有明确需求，建议补充规格并准备报价";
  if (leadStage === "material_sent") return "资料已发送，需要确认是否收到以及是否需要报价";
  if (leadStage === "quoted") return "报价已发出，建议按计划跟进反馈";
  if (leadStage === "follow_up") return "客户正在跟进中，需要持续推进下一步";
  if (leadStage === "won") return "客户已进入成交阶段，继续按成交流程推进";
  if (leadStage === "lost" || leadStage === "invalid") return "当前线索已结束，不需要继续推进";
  if (stage === "Prospecting" || status === "Prospecting" || customer?.source === "主动开发") {
    return "这是获客推进客户，需要按多渠道节奏持续推进";
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
  const leadStage = getLeadProgressStageValue(customer);
  return leadStage === "quoted"
    || ["已报价", "Quoted"].includes(stage)
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
    customer_name: customer?.customer_name || "",
    country: customer?.country || "",
    customer_type: customer?.customer_type || "Unknown",
    source: customer?.lead_source || customer?.source || "",
    lead_level: customer?.lead_level || "C",
    notes: customer?.notes || customer?.internal_note || customer?.customer_note || customer?.question || "",
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
    missing_info: customer?.missing_info || "",
    recommended_product: customer?.recommended_product || "",
    product_note: customer?.product_note || ""
  };
}

function getProspectActionStage(customer) {
  const stage = getLeadProgressStageValue(customer || {});
  if (stage === "engaged") return "responded";
  return stage;
}

function getProgressSummaryStage(customer) {
  if (!customer) return "待判断";
  if (isArchivedCustomer(customer)) return "已归档";
  if (customer.source === "主动开发" || customer.stage === "Prospecting" || customer.current_status === "Prospecting") {
    const leadStage = getProspectActionStage(customer);
    const map = {
      new_lead: "新线索",
      contacted: "已触达",
      responded: "有回应",
      has_need: "有需求",
      material_sent: "已发资料",
      quoted: "已报价",
      follow_up: "跟进中",
      won: "已转正式客户",
      lost: "丢单",
      invalid: "无效"
    };
    return map[leadStage] || "主动开发中";
  }
  return getStageLabel(getStageValue(customer));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasMeaningfulValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function calculateCustomerScore(customer) {
  const sourceText = normalizeText(customer?.source || customer?.lead_source || customer?.customer_source);
  const typeText = normalizeText(customer?.customer_type || customer?.customerType);
  const stageText = normalizeText(customer?.stage || customer?.current_status || customer?.status);
  const needText = normalizeText([
    customer?.product_need,
    customer?.productNeed,
    customer?.target_capacity,
    customer?.application_scenario,
    customer?.application_scene,
    customer?.recommended_product,
    customer?.question,
    customer?.original_message
  ].filter(Boolean).join(" "));
  const quantityText = normalizeText(customer?.quantity);
  const tradeTermText = normalizeText(customer?.shipping_term || customer?.trade_term);
  const contactFields = [
    customer?.email,
    customer?.whatsapp,
    customer?.phone,
    customer?.website,
    customer?.company,
    customer?.company_name,
    customer?.linkedin,
    customer?.facebook
  ];
  const contactCount = contactFields.filter(hasMeaningfulValue).length;

  let sourceScore = 0;
  if (includesAny(sourceText, ["alibaba", "阿里"])) sourceScore = 15;
  else if (includesAny(sourceText, ["website", "官网"])) sourceScore = 15;
  else if (includesAny(sourceText, ["whatsapp"])) sourceScore = 12;
  else if ((includesAny(sourceText, ["linkedin", "facebook", "fb"]) && includesAny(stageText, ["已回复", "有回应", "responded", "engaged"]))) sourceScore = 10;
  else if (includesAny(sourceText, ["主动开发", "google maps", "linkedin", "facebook", "fb"])) sourceScore = 5;

  let identityScore = 0;
  if (includesAny(typeText, ["distributor", "经销商", "installer", "安装商", "epc", "wholesaler", "批发商"])) identityScore = 20;
  else if (includesAny(typeText, ["公司客户", "brand", "oem", "品牌商"])) identityScore = 12;
  else if (includesAny(typeText, ["终端用户", "个人", "end user"])) identityScore = 5;

  const demandSignals = [
    hasMeaningfulValue(customer?.target_capacity),
    hasMeaningfulValue(customer?.quantity),
    hasMeaningfulValue(customer?.application_scenario || customer?.application_scene),
    hasMeaningfulValue(customer?.recommended_product),
    includesAny(needText, ["kwh", "ah", "容量", "型号", "quantity", "pcs", "应用", "backup", "solar", "inverter"])
  ].filter(Boolean).length;
  let demandScore = 0;
  if (demandSignals >= 3) demandScore = 20;
  else if (demandSignals >= 1) demandScore = 12;
  else if (includesAny(needText, ["price", "报价", "多少钱"])) demandScore = 6;

  let orderScore = 0;
  if (includesAny(`${quantityText} ${needText}`, ["project", "项目", "container", "wholesale", "distributor", "采购", "批量"])) orderScore = 15;
  else if (hasMeaningfulValue(customer?.quantity)) orderScore = 10;
  else if (includesAny(`${quantityText} ${needText}`, ["sample", "样品", "单台"])) orderScore = 5;

  let contactScore = 0;
  if (contactCount >= 3) contactScore = 10;
  else if (contactCount >= 1) contactScore = 5;

  let progressScore = 0;
  if (includesAny(stageText, ["已回复", "有回应", "responded", "engaged", "customer replied"])) progressScore = 20;
  else if (includesAny(stageText, ["已报价", "quoted", "已发送报价", "待客户回复", "waiting reply"])) progressScore = 15;
  else if (includesAny(stageText, ["已发资料", "material_sent", "sent info"])) progressScore = 10;
  else if (includesAny(stageText, ["新询盘", "new inquiry", "new"])) progressScore = 8;
  else if (includesAny(stageText, ["prospecting", "新线索", "待判断"])) progressScore = 5;
  else if (includesAny(stageText, ["无效", "归档", "archived", "invalid"])) progressScore = 0;

  const total = Math.max(0, Math.min(100, sourceScore + identityScore + demandScore + orderScore + contactScore + progressScore));
  return {
    total,
    breakdown: {
      sourceScore,
      identityScore,
      demandScore,
      orderScore,
      contactScore,
      progressScore
    }
  };
}

function getCustomerGrade(score) {
  if (score >= 80) return "A级客户";
  if (score >= 60) return "B级客户";
  if (score >= 40) return "C级客户";
  return "D级客户";
}

function getCustomerPriorityLabel(score) {
  if (score >= 80) return "重点客户，优先跟进";
  if (score >= 60) return "正常推进，继续补充需求并推动报价";
  if (score >= 40) return "先补信息再判断";
  return "低优先级或暂缓";
}

function getCustomerScoreReasons(customer) {
  const sourceText = customer?.source || customer?.lead_source || customer?.customer_source || "未知来源";
  const typeText = customer?.customer_type || customer?.customerType || "待判断";
  const missingParts = [];

  if (!hasMeaningfulValue(customer?.country)) missingParts.push("国家");
  if (!hasMeaningfulValue(customer?.email) && !hasMeaningfulValue(customer?.whatsapp) && !hasMeaningfulValue(customer?.website)) {
    missingParts.push("联系方式");
  }
  if (!hasMeaningfulValue(customer?.target_capacity) && !hasMeaningfulValue(customer?.recommended_product)) {
    missingParts.push("产品需求");
  }
  if (!hasMeaningfulValue(customer?.quantity)) missingParts.push("数量");
  if (!hasMeaningfulValue(customer?.shipping_term || customer?.trade_term)) missingParts.push("贸易方式");
  if (!hasMeaningfulValue(customer?.application_scenario || customer?.application_scene)) missingParts.push("应用场景");

  const needSummary = missingParts.length > 0
    ? `不完整，需确认${missingParts.slice(0, 4).join("、")}`
    : "较完整，可以继续推进报价或跟进";

  const contactSummary = !hasMeaningfulValue(customer?.email) && !hasMeaningfulValue(customer?.whatsapp) && !hasMeaningfulValue(customer?.website)
    ? "不完整，建议补充 WhatsApp / 公司信息"
    : "已有基础联系方式，可继续推进";

  return [
    `来源渠道：${sourceText}，${includesAny(normalizeText(sourceText), ["alibaba", "阿里", "website", "官网"]) ? "询盘来源较明确" : "建议结合回复情况判断价值"}`,
    `客户身份：${typeText}，${includesAny(normalizeText(typeText), ["distributor", "经销商", "installer", "安装商", "epc", "wholesaler", "批发商"]) ? "渠道价值较高" : "需继续确认客户类型"}`,
    `需求信息：${needSummary}`,
    `联系信息：${contactSummary}`
  ];
}

function getCompletenessItems(customer) {
  const items = [
    ["国家", customer?.country],
    ["联系方式", customer?.email || customer?.whatsapp || customer?.website],
    ["产品需求", customer?.recommended_product || customer?.target_capacity || customer?.question],
    ["数量", customer?.quantity],
    ["贸易方式", customer?.shipping_term || customer?.trade_term],
    ["应用场景", customer?.application_scenario || customer?.application_scene]
  ];

  const missing = items.filter(([, value]) => !hasMeaningfulValue(value)).map(([label]) => label);
  return missing.length > 0 ? missing : ["暂无明显缺失信息"];
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
      customer_name: profileForm.customer_name || null,
      country: profileForm.country || null,
      customer_type: profileForm.customer_type || null,
      source: profileForm.source || null,
      lead_level: profileForm.lead_level || null,
      notes: profileForm.notes || null,
      internal_note: profileForm.notes || null,
      customer_note: profileForm.notes || null,
      question: profileForm.notes || null,
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
      missing_info: demandForm.missing_info || null,
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
    const { error: customerUpdateError } = await updateCustomerWithExistingFields({
      ...customerPayload,
      updated_at: now
    });

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

  async function markLinkedInInviteSent() {
    const nextDate = addDays(new Date(), 3);
    const followUpDateText = toDateText(nextDate);

    await saveProgressAction({
      customerPayload: {
        linkedin_status: "connection_sent",
        stage: "contacted",
        current_status: "已触达",
        current_next_action: "3天后查看是否通过",
        next_action: "3天后查看是否通过",
        next_follow_up_at: nextDate.toISOString(),
        follow_up_date: followUpDateText
      },
      interactionStatus: "linkedin_invite_sent",
      interactionNote: "已发送 LinkedIn 邀请",
      successMessage: "已记录 LinkedIn 邀请，3 天后查看是否通过。"
    });
  }

  async function markLinkedInConnected() {
    const todayText = toDateText(new Date());

    await saveProgressAction({
      customerPayload: {
        linkedin_status: "connected",
        stage: "engaged",
        current_status: "有互动",
        current_next_action: "发送 LinkedIn 破冰私信",
        next_action: "发送 LinkedIn 破冰私信",
        next_follow_up_at: dateToFollowUpAt(todayText),
        follow_up_date: todayText
      },
      interactionStatus: "linkedin_connected",
      interactionNote: "LinkedIn 已通过",
      successMessage: "已标记 LinkedIn 通过，可立即发送破冰私信。"
    });
  }

  async function markFacebookMessageSent() {
    const nextDate = addDays(new Date(), 3);
    const followUpDateText = toDateText(nextDate);

    await saveProgressAction({
      customerPayload: {
        facebook_status: "message_sent",
        stage: "contacted",
        current_status: "已触达",
        current_next_action: "3天后跟进 FB 私信",
        next_action: "3天后跟进 FB 私信",
        next_follow_up_at: nextDate.toISOString(),
        follow_up_date: followUpDateText
      },
      interactionStatus: "facebook_message_sent",
      interactionNote: "已发送 FB 私信",
      successMessage: "已记录 FB 私信，3 天后继续跟进。"
    });
  }

  async function markMaterialSent() {
    const nextDate = addDays(new Date(), 2);
    const followUpDateText = toDateText(nextDate);

    await saveProgressAction({
      customerPayload: {
        email_status: "material_sent",
        stage: "material_sent",
        current_status: "已发资料",
        current_next_action: "询问是否收到资料，是否需要报价",
        next_action: "询问是否收到资料，是否需要报价",
        next_follow_up_at: nextDate.toISOString(),
        follow_up_date: followUpDateText
      },
      interactionStatus: "material_sent",
      interactionNote: "已发送产品资料",
      successMessage: "已标记为已发资料，2 天后提醒继续跟进。"
    });
  }

  async function markQuoteSent() {
    const nextDate = addDays(new Date(), 3);
    const followUpDateText = toDateText(nextDate);

    await saveProgressAction({
      customerPayload: {
        email_status: "quotation_sent",
        stage: "quoted",
        current_status: "已报价",
        current_next_action: "跟进报价反馈",
        next_action: "跟进报价反馈",
        last_quote_at: new Date().toISOString(),
        next_follow_up_at: nextDate.toISOString(),
        follow_up_date: followUpDateText
      },
      interactionStatus: "quotation_sent",
      interactionNote: "已发送报价",
      successMessage: "已标记为已发送报价，3 天后提醒跟进。"
    });
  }

  async function markHasNeed() {
    const todayText = toDateText(new Date());

    await saveProgressAction({
      customerPayload: {
        stage: "has_need",
        current_status: "有需求",
        current_next_action: "准备报价或确认详细需求",
        next_action: "准备报价或确认详细需求",
        next_follow_up_at: dateToFollowUpAt(todayText),
        follow_up_date: todayText
      },
      interactionStatus: "has_need",
      interactionNote: "已标记客户有需求",
      successMessage: "已标记客户有需求，可继续准备报价。"
    });
  }

  async function markLeadContacted() {
    const nextDate = addDays(new Date(), 3);
    const followUpDateText = toDateText(nextDate);

    await saveProgressAction({
      customerPayload: {
        stage: "contacted",
        current_status: "已触达",
        current_next_action: "3天后检查是否回复",
        next_action: "3天后检查是否回复",
        next_follow_up_at: nextDate.toISOString(),
        follow_up_date: followUpDateText
      },
      interactionStatus: "lead_contacted",
      interactionNote: "已标记线索已触达",
      successMessage: "已标记已触达，3 天后提醒继续跟进。"
    });
  }

  async function markLeadResponded() {
    const todayText = toDateText(new Date());

    await saveProgressAction({
      customerPayload: {
        stage: "engaged",
        current_status: "有回应",
        current_next_action: "确认客户需求并发送资料",
        next_action: "确认客户需求并发送资料",
        next_follow_up_at: dateToFollowUpAt(todayText),
        follow_up_date: todayText
      },
      interactionStatus: "lead_responded",
      interactionNote: "已标记客户有回应",
      successMessage: "已标记客户有回应，可继续确认需求。"
    });
  }

  async function markInvalidLead() {
    await saveProgressAction({
      customerPayload: {
        stage: "invalid",
        current_status: "无效",
        current_next_action: null,
        next_action: null,
        next_follow_up_at: null,
        follow_up_date: null
      },
      interactionStatus: "invalid_lead",
      interactionNote: "已标记为无效线索",
      successMessage: "已标记为无效客户。"
    });
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

  async function markWon() {
    await saveProgressAction({
      customerPayload: {
        stage: "Closed Won",
        current_status: "成交",
        current_next_action: "客户已成交，进入成交后维护",
        next_action: "客户已成交，进入成交后维护",
        next_follow_up_at: null,
        follow_up_date: null
      },
      interactionStatus: "won",
      interactionNote: "已标记客户成交",
      successMessage: "已标记客户成交。"
    });
  }

  async function markLost() {
    await saveProgressAction({
      customerPayload: {
        stage: "Closed Lost",
        current_status: "丢单",
        current_next_action: null,
        next_action: null,
        next_follow_up_at: null,
        follow_up_date: null
      },
      interactionStatus: "lost",
      interactionNote: "已标记客户丢单",
      successMessage: "已标记客户丢单。"
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

  const leadProgressCustomer = isLeadProgressCustomer(customer || {});
  const leadProgressStage = getProspectActionStage(customer || {});
  const currentStage = getStageLabel(getStageValue(customer || {}));
  const displayStage = leadProgressCustomer ? getProgressSummaryStage(customer || {}) : currentStage;
  const displayStatus = customer?.current_status || displayStage || currentStage;
  const currentType = getCustomerTypeLabel(getCustomerTypeValue(customer || {}));
  const currentLeadLevel = getLeadLevel(customer || {});
  const currentAction = workflowForm.nextAction || getNextAction(customer || {});
  const localizedCurrentAction = formatCustomerActionDisplay(currentAction);
  const persistedNextAction = customer?.current_next_action || customer?.next_action || workflowForm.nextAction;
  const localizedPersistedAction = formatCustomerActionDisplay(persistedNextAction);
  const blockerText = getCurrentBlockerText(customer || {});
  const followUpDateDisplay = formatDateOnly(customer?.next_follow_up_at || customer?.follow_up_date || workflowForm.followUpDate);
  const archivedCustomer = isArchivedCustomer(customer || {});
  const leadSourceLabel = getLeadSourceLabel(getLeadSourceValue(customer || {}));
  const latestInteraction = interactions[0] || null;
  const latestInteractionSummary = latestInteraction
    ? [latestInteraction.result_feedback || latestInteraction.interaction_status, latestInteraction.operator_note].filter(Boolean).join(" / ")
    : "暂无跟进记录";
  const partnerCandidateLabel = leadProgressCustomer ? "待判断" : (isPartnerCandidate(customer || {}) ? "是" : "否");
  const needQuoteLabel = quotes.length > 0 || ["已报价", "Quoted", "已报价未回复", "待报价"].includes(customer?.current_status) || ["Quoted", "Need Quotation"].includes(customer?.stage)
    ? "是"
    : "待判断";
  const customerScore = calculateCustomerScore(customer || {});
  const customerGrade = getCustomerGrade(customerScore.total);
  const customerPriorityLabel = getCustomerPriorityLabel(customerScore.total);
  const customerScoreReasons = getCustomerScoreReasons(customer || {});
  const completenessItems = getCompletenessItems(customer || {});
  const showLeadNewButtons = !archivedCustomer && leadProgressCustomer && leadProgressStage === "new_lead";
  const showLeadContactedButtons = !archivedCustomer && leadProgressCustomer && leadProgressStage === "contacted";
  const showLeadRespondedButtons = !archivedCustomer && leadProgressCustomer && leadProgressStage === "responded";
  const showSalesProgressButtons = !archivedCustomer && (
    (leadProgressCustomer && ["has_need", "material_sent", "quoted", "follow_up", "won"].includes(leadProgressStage))
    || (!leadProgressCustomer && ["Need Qualification", "Need Quotation", "Quoted", "Waiting Reply", "Negotiation", "Trial Order", "Closed Won"].includes(customer?.stage))
    || (!leadProgressCustomer && ["有需求", "待报价", "已报价", "已发资料", "跟进中", "待客户回复", "已转正式客户"].includes(customer?.current_status))
  );

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">客户详情</p>
          <h1 style={{ marginBottom: 8 }}>{customer?.customer_name || "客户详情"}</h1>
          <p>{customer?.country || "未知国家"} · {leadSourceLabel || customer?.source || "未知来源"} · {currentType || "待判断"} · 客户等级 {currentLeadLevel || "C"}</p>
        </div>
        <AppNav />
      </header>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 0.35fr) minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
          marginBottom: 20
        }}
      >
        <article className="panel" style={{ borderRadius: 20, padding: 20 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <h2>客户档案</h2>
            <span>先确认这个客户是谁</span>
          </div>
          <div style={{ borderRadius: 18, background: "#eff6ff", border: "1px solid #dbeafe", padding: 18, marginBottom: 16 }}>
            <div style={{ color: "#475569", fontSize: 13, marginBottom: 6 }}>客户评分</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
              <strong style={{ fontSize: 28, lineHeight: 1, color: "#0f172a" }}>{customerScore.total}</strong>
              <span style={{ color: "#475569", fontSize: 14 }}>/ 100</span>
            </div>
            <div style={{ fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>{customerGrade}</div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 10 }}>{customerPriorityLabel}</div>
            <div style={{ color: "#334155", fontSize: 13, lineHeight: 1.7 }}>
              <strong style={{ display: "block", marginBottom: 4 }}>评分依据：</strong>
              {customerScoreReasons.map((reason) => (
                <div key={reason}>• {reason}</div>
              ))}
            </div>
          </div>
          <div className="detail-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>客户名</strong>
              <p>{customer?.customer_name || "待补充"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>来源渠道</strong>
              <p>{leadSourceLabel || customer?.source || "待补充"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>国家</strong>
              <p>{customer?.country || "未知国家"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>客户类型</strong>
              <p>{currentType}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>客户等级</strong>
              <p>{currentLeadLevel || "C"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>合作商候选</strong>
              <p>{partnerCandidateLabel}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>联系人</strong>
              <p>{profileForm.contact_name || "待补充"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>联系方式</strong>
              <p>{profileForm.email || profileForm.whatsapp || "待补充"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14, gridColumn: "1 / -1" }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>公司名 / 官网</strong>
              <p>{profileForm.website || customer?.company_name || "待补充"}</p>
            </div>
          </div>
        </article>

        <article className="panel" style={{ borderRadius: 20, padding: 20 }}>
          <div className="section-title" style={{ marginBottom: 16 }}>
            <h2>当前推进</h2>
            <span>先看当前该做什么，再进入下方标签处理</span>
          </div>
          <div className="detail-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="detail-item" style={{ background: "#f8fbff", borderRadius: 18, padding: 18, border: "1px solid #dbeafe" }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>当前阶段</strong>
              <p style={{ fontSize: 18, fontWeight: 600 }}><span className="soft-badge">{displayStage || displayStatus || "待判断"}</span></p>
            </div>
            <div className="detail-item" style={{ background: "#f8fbff", borderRadius: 18, padding: 18, border: "1px solid #dbeafe" }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>下一步动作</strong>
              <p style={{ fontSize: 16, fontWeight: 600 }}>{localizedPersistedAction}</p>
            </div>
            <div className="detail-item" style={{ background: "#f8fbff", borderRadius: 18, padding: 18, border: "1px solid #dbeafe" }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>下次跟进</strong>
              <p style={{ fontSize: 16, fontWeight: 600 }}>{followUpDateDisplay}</p>
            </div>
          </div>

          <div className="detail-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>客户类型</strong>
              <p>{currentType}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#f8fafc", padding: 14 }}>
              <strong style={{ color: "#64748b", fontSize: 13 }}>国家</strong>
              <p>{customer?.country || "待补充"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 16, background: "#fff7ed", padding: 14, gridColumn: "1 / -1", border: "1px solid #fed7aa" }}>
              <strong style={{ color: "#9a3412", fontSize: 13 }}>当前卡点</strong>
              <p>{blockerText}</p>
            </div>
          </div>

          {archivedCustomer ? (
            <div className="notice-panel" style={{ marginTop: 16 }}>
              <strong>客户已归档</strong>
              <p>客户已归档，如需继续推进，请先恢复客户。</p>
            </div>
          ) : (
            <div className="actions" style={{ marginTop: 16, flexWrap: "wrap", gap: 10 }}>
              <button onClick={generateWorkflowRecommendation} disabled={isSaving}>生成下一步建议</button>
              <button className="primary" onClick={saveWorkflow} disabled={isSaving}>保存客户流程</button>
              <input
                type="date"
                value={scheduleFollowUpDate}
                onChange={(event) => setScheduleFollowUpDate(event.target.value)}
                style={{ maxWidth: 220 }}
              />
              <button onClick={scheduleNextFollowUp} disabled={isSaving}>设置下次跟进</button>
              {showLeadNewButtons && <button onClick={markLeadContacted} disabled={isSaving}>标记已触达</button>}
              {showLeadContactedButtons && <button onClick={markLeadResponded} disabled={isSaving}>标记有回应</button>}
              {showLeadRespondedButtons && <button onClick={markHasNeed} disabled={isSaving}>标记有需求</button>}
              {showSalesProgressButtons && (
                <>
                  <button onClick={markMaterialSent} disabled={isSaving}>已发送产品资料</button>
                  <button onClick={markQuoteSent} disabled={isSaving}>已发送报价</button>
                </>
              )}
              <button onClick={markInvalidLead} disabled={isSaving}>标记无效</button>
            </div>
          )}
        </article>
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
            推进概览
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
        <section className="panel">
          <div className="section-title">
            <h2>推进概览</h2>
            <span>这里保留客户摘要、需求摘要和最近一次跟进记录，不再重复顶部推进字段。</span>
          </div>
          {leadProgressCustomer && (
            <div className="notice-panel" style={{ marginBottom: 16 }}>
              <strong>获客推进提醒</strong>
              <p>这是获客推进客户，请按来源渠道、互动状态和下次跟进时间持续推进。</p>
            </div>
          )}
          <div className="detail-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            <div className="detail-item" style={{ borderRadius: 18, background: "#f8fafc", padding: 18 }}>
              <strong>客户完整度 / 缺失信息</strong>
              <p><strong>当前缺失信息：</strong></p>
              <div style={{ color: "#334155", lineHeight: 1.8, marginTop: 6 }}>
                {completenessItems.map((item) => (
                  <div key={item}>• {item}</div>
                ))}
              </div>
            </div>
            <div className="detail-item" style={{ borderRadius: 18, background: "#f8fafc", padding: 18 }}>
              <strong>当前需求摘要</strong>
              <p><strong>产品需求：</strong>{demandForm.recommended_product || demandForm.target_capacity || customer?.quote_content || "待确认"}</p>
              <p><strong>数量 / 贸易方式：</strong>{demandForm.quantity || "待确认"} / {demandForm.shipping_term || "待确认"}</p>
              <p><strong>缺失信息：</strong>{workflowForm.missingInfo || demandForm.missing_info || customer?.missing_info || "暂无"}</p>
            </div>
            <div className="detail-item" style={{ borderRadius: 18, background: "#f8fafc", padding: 18 }}>
              <strong>最近一次跟进</strong>
              <p><strong>最近跟进记录：</strong>{latestInteractionSummary}</p>
              <p><strong>最近客户回复时间：</strong>{formatDateTime(customer?.last_customer_reply_at)}</p>
              <p><strong>最近报价时间：</strong>{formatDateTime(customer?.last_quote_at)}</p>
            </div>
          </div>
        </section>
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
              <Field label="客户姓名"><input value={profileForm.customer_name} onChange={(event) => updateProfileForm("customer_name", event.target.value)} /></Field>
              <Field label="国家"><input value={profileForm.country} onChange={(event) => updateProfileForm("country", event.target.value)} /></Field>
              <Field label="客户类型"><input value={profileForm.customer_type} onChange={(event) => updateProfileForm("customer_type", event.target.value)} /></Field>
              <Field label="来源渠道"><input value={profileForm.source} onChange={(event) => updateProfileForm("source", event.target.value)} /></Field>
              <Field label="客户等级">
                <select value={profileForm.lead_level} onChange={(event) => updateProfileForm("lead_level", event.target.value)}>
                  {["A", "B", "C"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
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
              <Field label="备注">
                <textarea rows={4} value={profileForm.notes} onChange={(event) => updateProfileForm("notes", event.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="detail-grid">
              <div className="detail-item"><strong>客户姓名</strong><p>{profileForm.customer_name || "待补充"}</p></div>
              <div className="detail-item"><strong>国家</strong><p>{profileForm.country || "待补充"}</p></div>
              <div className="detail-item"><strong>客户类型</strong><p>{getCustomerTypeLabel(profileForm.customer_type)}</p></div>
              <div className="detail-item"><strong>来源渠道</strong><p>{getLeadSourceLabel(profileForm.source) || profileForm.source || "待补充"}</p></div>
              <div className="detail-item"><strong>客户等级</strong><p>{profileForm.lead_level || "C"}</p></div>
              <div className="detail-item"><strong>合作商候选标记</strong><p>{partnerCandidateLabel}</p></div>
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
              <div className="detail-item"><strong>备注</strong><p>{profileForm.notes || "待补充"}</p></div>
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
                <Field label="认证 / 清关问题与缺失信息">
                  <textarea rows={4} value={demandForm.missing_info} onChange={(event) => updateDemandForm("missing_info", event.target.value)} />
                </Field>
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
                <div className="detail-item"><strong>认证 / 清关问题</strong><p>{demandForm.missing_info || customer?.missing_info || "待补充"}</p></div>
                <div className="detail-item"><strong>缺失信息</strong><p>{workflowForm.missingInfo || demandForm.missing_info || customer?.missing_info || "暂无"}</p></div>
                <div className="detail-item"><strong>推荐产品</strong><p>{demandForm.recommended_product || customer?.quote_content || "待补充"}</p></div>
                <div className="detail-item"><strong>产品备注或推荐原因</strong><p>{demandForm.product_note || "待补充"}</p></div>
                <div className="detail-item"><strong>是否需要报价</strong><p>{needQuoteLabel}</p></div>
              </div>
            )}
            <div className="actions" style={{ marginTop: 16 }}>
              <button
                className="primary"
                onClick={() => quoteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                进入报价
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
            <div className="detail-grid" style={{ marginBottom: 16 }}>
              <div className="detail-item"><strong>创建时间</strong><p>{formatDateTime(customer?.created_at)}</p></div>
              <div className="detail-item"><strong>最近联系时间</strong><p>{formatDateTime(customer?.last_contacted_at)}</p></div>
              <div className="detail-item"><strong>最近报价时间</strong><p>{formatDateTime(customer?.last_quote_at)}</p></div>
              <div className="detail-item"><strong>最近客户回复时间</strong><p>{formatDateTime(customer?.last_customer_reply_at)}</p></div>
              <div className="detail-item"><strong>当前下一步动作</strong><p>{localizedPersistedAction}</p></div>
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
