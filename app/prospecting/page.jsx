"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/layout/AppNav";
import { formatNextActionForDisplay } from "../../lib/displayText";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import {
  getLeadProgressStageLabel,
  getLeadProgressStageValue,
  getLeadSourceLabel,
  getLeadSourceValue
} from "../../lib/leadProgress";
import {
  getCustomerName,
  getCustomerTypeLabel,
  getCustomerTypeValue,
  getSourceLabel
} from "../../lib/customerViews";

const prospectingStages = ["新线索", "已触达", "有互动", "有需求", "已发资料", "已报价", "跟进中", "成交", "丢单", "无效"];
const simplifiedStageFilters = [
  { label: "全部", value: "" },
  { label: "新线索", value: "新线索" },
  { label: "已触达", value: "已触达" },
  { label: "有回应", value: "有互动" },
  { label: "有需求", value: "有需求" },
  { label: "已转正式客户", value: "成交" },
  { label: "无效", value: "无效" }
];
const channelFilters = ["全部来源", "Google Maps", "LinkedIn", "FB", "Alibaba", "Website"];

const importHeaders = ["公司名", "国家", "客户类型", "官网", "邮箱", "LinkedIn", "联系人", "WhatsApp", "来源渠道", "备注"];
const reviewRanges = ["今天", "昨天", "本周", "上周", "本月", "上月", "自定义"];
const prospectingSources = ["Google Maps", "LinkedIn", "FB", "Website", "Referral", "主动开发"];
const invalidReasonOptions = [
  "不是太阳能相关客户",
  "终端个人客户",
  "没有有效联系方式",
  "国家暂不适合清关",
  "公司信息不完整",
  "规模太小",
  "不匹配当前产品",
  "重复线索",
  "其他"
];
const manualLeadInitialState = {
  companyName: "",
  country: "",
  customerType: "Unknown",
  sourceChannel: "Google Maps",
  website: "",
  linkedin: "",
  facebook: "",
  email: "",
  whatsapp: "",
  note: "",
  nextAction: "筛选客户价值"
};

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到工作台登录邮箱账号。</div>;
}

function FieldLike({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatDate(value) {
  if (!value) return "未设置";
  try {
    return new Date(value).toLocaleDateString("zh-CN");
  } catch {
    return "未设置";
  }
}

function getProspectingStage(customer) {
  return getLeadProgressStageLabel(customer);
}

function isProspectingCustomer(customer) {
  const source = getLeadSourceValue(customer);
  const rawSource = `${customer?.source || ""}`.trim();
  return prospectingSources.includes(source)
    || prospectingSources.includes(rawSource)
    || customer?.stage === "Prospecting"
    || customer?.current_status === "Prospecting"
    || Boolean(customer?.linkedin_status)
    || Boolean(customer?.facebook_status)
    || Boolean(customer?.whatsapp_status);
}

function getProspectingNextAction(customer) {
  const stageValue = getLeadProgressStageValue(customer);
  if (customer.current_next_action || customer.next_action) {
    return formatNextActionForDisplay(customer.current_next_action || customer.next_action);
  }

  switch (stageValue) {
    case "new_lead":
      return "发送首封开发信，确认客户是否在做储能或太阳能相关业务";
    case "contacted":
      return "等待对方响应，或按渠道节奏继续补一次触达";
    case "engaged":
      return "继续互动，确认客户是否有明确采购方向";
    case "has_need":
      return "确认容量、数量、逆变器和目标市场，准备进入报价";
    case "material_sent":
      return "询问是否收到资料，是否需要进一步报价";
    case "quoted":
      return "跟进报价反馈，确认价格、运费和规格问题";
    case "follow_up":
      return "继续按计划跟进，推动进入有需求或报价阶段";
    case "won":
      return "客户已进入成交阶段，转到正式客户流程继续推进";
    case "lost":
    case "invalid":
      return "该线索已结束，默认不再继续推进";
    default:
      return "需要人工判断下一步动作";
  }
}

function getProspectingScript(customer) {
  const stage = getProspectingStage(customer);
  const name = getCustomerName(customer);
  const type = getCustomerTypeValue(customer);

  if (stage === "新线索") {
    return {
      title: "首封开发信",
      text: `Hi ${name}, we are a supplier of lithium battery energy storage solutions for solar projects and backup power. I noticed your company may be active in this market, so I wanted to ask whether you are currently sourcing home storage batteries, commercial battery systems, or related solar products. If yes, I can share our main models and offer details for your review.`
    };
  }

  if (stage === "已触达" || stage === "跟进中") {
    return {
      title: "跟进开发信",
      text: `Hi ${name}, just following up on my previous message. We supply LiFePO4 battery systems for solar installers and distributors, with support for common inverter brands and project applications. Please let me know if you are currently looking for any battery products, and I can send the most relevant models and pricing information.`
    };
  }

  if (["有互动", "有需求", "已发资料", "已报价"].includes(stage)) {
    if (type === "Solar Distributor") {
      return {
        title: "经销商推进话术",
        text: `Hi ${name}, thanks for your interest. I can send you our main battery models, distributor supply information, and recommended capacities for your market. Please let me know which capacity range and order quantity you are mainly evaluating, and I will prepare the most relevant offer for you.`
      };
    }

    if (type === "Solar Installer") {
      return {
        title: "安装商推进话术",
        text: `Hi ${name}, thanks for your interest. I can send you the battery datasheet, installation photos, and inverter compatibility information for review. Please share the inverter brand and model you are using, and I will prepare the matching information for you.`
      };
    }

    return {
      title: "回复后需求确认",
      text: `Hi ${name}, thanks for your reply. To recommend the right solution, may I know what battery capacity, quantity, and main application you are looking for? If you already have a target inverter brand or project type, I can check the most suitable option for you.`
    };
  }

  return {
    title: "通用开发话术",
    text: `Hi ${name}, I’m following up to see whether your company is currently evaluating lithium battery storage products. If you share your target application, quantity, and market focus, I can prepare the most relevant product information for you.`
  };
}

function getTaskReason(customer) {
  const stage = getProspectingStage(customer);
  if (stage === "新线索") return "需要先筛选并触达这条线索";
  if (stage === "已触达") return "已触达客户，等待响应或安排下一次沟通";
  if (stage === "有互动") return "客户已有互动，需要进一步判断是否有明确需求";
  if (stage === "有需求") return "客户有明确需求，应尽快确认规格和数量";
  if (stage === "已发资料") return "资料已发送，需跟进是否收到及是否要报价";
  if (stage === "已报价") return "报价已发送，需要按期跟进";
  if (stage === "跟进中") return "线索正在跟进推进";
  if (stage === "成交") return "线索已进入成交阶段";
  if (stage === "丢单" || stage === "无效") return "该线索已结束";
  return "根据当前获客阶段继续推进";
}

function getInvalidLeadAction() {
  return "已标记无效，不再推进";
}

function getLeadValueLabel(customer) {
  const rawValue = `${customer?.lead_value || customer?.leadLevel || ""}`.trim();
  if (["高", "中", "低", "待判断"].includes(rawValue)) return rawValue;

  const leadLevel = `${customer?.lead_level || customer?.leadLevel || ""}`.trim().toUpperCase();
  if (leadLevel === "A") return "高";
  if (leadLevel === "B") return "中";
  if (leadLevel === "C") return "低";
  return "待判断";
}

function getInvalidReason(customer) {
  const directValue = customer?.invalid_reason
    || customer?.failure_reason
    || customer?.loss_reason
    || customer?.invalidReason;

  if (directValue) return `${directValue}`.trim();

  const textSources = [customer?.question, customer?.operator_note, customer?.our_reply, customer?.original_message]
    .filter(Boolean)
    .map((item) => `${item}`);

  for (const source of textSources) {
    const matched = source.match(/无效原因[:：]\s*([^\n]+)/);
    if (matched?.[1]) return matched[1].trim();
  }

  return "未填写原因";
}

function getQuestionMetaValue(text, label) {
  if (!text || !label) return "";
  const source = `${text}`;
  const matched = source.match(new RegExp(`${label}[:：]\\s*([^\\n]+)`));
  return matched?.[1]?.trim() || "";
}

function upsertQuestionMeta(text, label, value) {
  const source = `${text || ""}`.trim();
  const cleaned = source
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith(`${label}：`) && !line.startsWith(`${label}:`))
    .join("\n")
    .trim();

  if (!value) return cleaned;
  return [cleaned, `${label}：${value}`].filter(Boolean).join("\n");
}

function getLastActionRecord(customer) {
  const content = getQuestionMetaValue(customer?.question, "最后动作");
  if (!content) {
    return {
      content: "暂无动作记录",
      date: ""
    };
  }

  return {
    content,
    date: customer?.updated_at ? formatDate(customer.updated_at) : ""
  };
}

function normalizeComparableValue(value) {
  return `${value || ""}`
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[\s/._-]+/g, "");
}

function isSimilarCompanyName(a, b) {
  const normalizedA = normalizeComparableValue(a);
  const normalizedB = normalizeComparableValue(b);
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (normalizedA.length >= 6 && normalizedB.length >= 6) {
    return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
  }
  return false;
}

function getStoredContactValue(customer, label) {
  const directMap = {
    官网: customer?.website,
    邮箱: customer?.email,
    WhatsApp: customer?.whatsapp,
    LinkedIn: customer?.linkedin,
    FB: customer?.facebook
  };

  if (directMap[label]) return `${directMap[label]}`.trim();
  return getQuestionMetaValue(customer?.original_message, label) || "";
}

function findPotentialDuplicateCustomers(form, customers) {
  const companyName = form.companyName.trim();
  const website = form.website.trim();
  const email = form.email.trim();
  const whatsapp = form.whatsapp.trim();
  const linkedin = form.linkedin.trim();
  const facebook = form.facebook.trim();

  return customers.filter((customer) => {
    const matchedByName = companyName && isSimilarCompanyName(companyName, getCustomerName(customer));
    const matchedByWebsite = website && normalizeComparableValue(website) === normalizeComparableValue(getStoredContactValue(customer, "官网"));
    const matchedByEmail = email && normalizeComparableValue(email) === normalizeComparableValue(getStoredContactValue(customer, "邮箱"));
    const matchedByWhatsapp = whatsapp && normalizeComparableValue(whatsapp) === normalizeComparableValue(getStoredContactValue(customer, "WhatsApp"));
    const matchedByLinkedin = linkedin && normalizeComparableValue(linkedin) === normalizeComparableValue(getStoredContactValue(customer, "LinkedIn"));
    const matchedByFacebook = facebook && normalizeComparableValue(facebook) === normalizeComparableValue(getStoredContactValue(customer, "FB"));

    return matchedByName || matchedByWebsite || matchedByEmail || matchedByWhatsapp || matchedByLinkedin || matchedByFacebook;
  });
}

function getFollowUpDate(customer) {
  return customer.next_follow_up_at || customer.follow_up_date || customer.updated_at || customer.created_at || "";
}

function getContactSummary(customer) {
  const parts = [customer.email, customer.website].filter(Boolean);
  return parts.length ? parts.join(" / ") : "待补充";
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function formatPercent(numerator, denominator) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function isDateInToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return startOfDay(date).getTime() === startOfDay(now).getTime();
}

function getRangeBounds(rangeKey, customStart, customEnd) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  if (rangeKey === "今天") {
    return { start: todayStart, end: todayEnd };
  }

  if (rangeKey === "昨天") {
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
  }

  if (rangeKey === "本周") {
    const start = new Date(todayStart);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { start: startOfDay(start), end: todayEnd };
  }

  if (rangeKey === "上周") {
    const start = new Date(todayStart);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day - 6);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: startOfDay(start), end: endOfDay(end) };
  }

  if (rangeKey === "本月") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: startOfDay(start), end: todayEnd };
  }

  if (rangeKey === "上月") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: startOfDay(start), end: endOfDay(end) };
  }

  if (rangeKey === "自定义") {
    if (!customStart || !customEnd) return { start: null, end: null };
    return {
      start: startOfDay(customStart),
      end: endOfDay(customEnd)
    };
  }

  return { start: null, end: null };
}

const pageSize = 10;

export default function ProspectingPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef(null);
  const targetPoolRef = useRef(null);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("全部来源");
  const [page, setPage] = useState(1);
  const [reviewRange, setReviewRange] = useState("本月");
  const [showImportRules, setShowImportRules] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState(manualLeadInitialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function init() {
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

      await loadCustomers();
      setLoading(false);
    }

    init();
  }, [supabase]);

  async function loadCustomers() {
    const { data: rows, error: queryError } = await supabase
      .from("customers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setCustomers(rows || []);
  }

  const prospectingCustomers = useMemo(() => {
    return customers.filter((customer) => isProspectingCustomer(customer));
  }, [customers]);

  const todayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return prospectingCustomers
      .filter((customer) => {
        const stage = getProspectingStage(customer);
        if (["无效", "成交", "丢单"].includes(stage)) return false;
        if (["新线索", "有互动", "有需求"].includes(stage)) return true;
        const followUpAt = getFollowUpDate(customer);
        return followUpAt ? new Date(followUpAt).getTime() <= today.getTime() : false;
      })
      .map((customer) => ({
        ...customer,
        prospectingStage: getProspectingStage(customer),
        prospectingAction: getProspectingNextAction(customer),
        taskReason: getTaskReason(customer)
      }));
  }, [prospectingCustomers]);

  const targetPool = useMemo(() => {
    return prospectingCustomers.map((customer) => ({
      ...customer,
      prospectingStage: getProspectingStage(customer),
      prospectingAction: getProspectingStage(customer) === "无效" ? getInvalidLeadAction() : getProspectingNextAction(customer),
      leadSourceLabel: getLeadSourceLabel(getLeadSourceValue(customer)) || getSourceLabel(customer.source),
      leadValueLabel: getLeadValueLabel(customer),
      invalidReasonLabel: getInvalidReason(customer),
      lastActionRecord: getLastActionRecord(customer)
    }));
  }, [prospectingCustomers]);

  const filteredTargetPool = useMemo(() => {
    return targetPool.filter((customer) => {
      const stageMatched = !selectedStage || customer.prospectingStage === selectedStage;
      const sourceLabel = customer.leadSourceLabel || "";
      const rawSource = `${customer.source || ""}`.trim();
      const channelMatched = selectedChannel === "全部来源"
        || sourceLabel === selectedChannel
        || rawSource === selectedChannel
        || (selectedChannel === "Alibaba" && (sourceLabel.includes("Alibaba") || rawSource.includes("Alibaba") || rawSource.includes("阿里")))
        || (selectedChannel === "Website" && (sourceLabel.includes("官网") || rawSource.includes("Website")));
      return stageMatched && channelMatched;
    });
  }, [selectedStage, selectedChannel, targetPool]);

  const totalPages = Math.max(1, Math.ceil(filteredTargetPool.length / pageSize));
  const pagedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTargetPool.slice(start, start + pageSize);
  }, [filteredTargetPool, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedStage, selectedChannel]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function focusTargetPool() {
    targetPoolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleQuickFilter(stage = "", channel = "全部来源") {
    setSelectedStage(stage);
    setSelectedChannel(channel);
    setTimeout(() => focusTargetPool(), 40);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function openCreateLeadModal() {
    setError("");
    setNotice("");
    setManualLeadForm(manualLeadInitialState);
    setShowCreateLeadModal(true);
  }

  function closeCreateLeadModal() {
    if (savingLead) return;
    setShowCreateLeadModal(false);
    setManualLeadForm(manualLeadInitialState);
  }

  function updateManualLeadField(field, value) {
    setManualLeadForm((current) => ({ ...current, [field]: value }));
  }

  function downloadTemplate() {
    const csv = [
      importHeaders.join(","),
      "ABC Solar,Kenya,Solar Distributor,https://example.com,sales@example.com,https://linkedin.com/company/example,John,+254700000000,主动开发,重点跟进东非市场"
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "目标客户导入模板.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice("导入模板已下载。");
  }

  function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === "\"") {
        if (inQuotes && nextChar === "\"") {
          current += "\"";
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  async function handleCsvUpload(event) {
    setError("");
    setNotice("");

    const file = event.target.files?.[0];
    if (!file) return;

    if (!session?.user?.id) {
      setError("请先登录后再导入客户。");
      event.target.value = "";
      return;
    }

    try {
      const content = await file.text();
      const lines = content
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setError("导入失败：请使用模板字段上传 CSV");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((item) => item.trim());
      if (
        headers.length < importHeaders.length
        || importHeaders.some((header, index) => headers[index] !== header)
      ) {
        setError("导入失败：请使用模板字段上传 CSV");
        return;
      }

      const now = new Date().toISOString();
      const rows = lines.slice(1);
      const inserts = rows
        .map((line) => {
          const cols = parseCsvLine(line);
          const companyName = cols[0]?.trim();
          if (!companyName) return null;

          const country = cols[1]?.trim() || "";
          const customerType = cols[2]?.trim() || "Unknown";
          const website = cols[3]?.trim() || "";
          const email = cols[4]?.trim() || "";
          const linkedin = cols[5]?.trim() || "";
          const contactName = cols[6]?.trim() || "";
          const whatsapp = cols[7]?.trim() || "";
          const sourceChannel = cols[8]?.trim() || "Google Maps";
          const note = cols[9]?.trim() || "";

          const contactLines = [
            website ? `官网：${website}` : "",
            email ? `邮箱：${email}` : "",
            linkedin ? `LinkedIn：${linkedin}` : "",
            contactName ? `联系人：${contactName}` : "",
            whatsapp ? `WhatsApp：${whatsapp}` : "",
            sourceChannel ? `来源渠道：${sourceChannel}` : "",
            note ? `备注：${note}` : ""
          ].filter(Boolean);

          return {
            user_id: session.user.id,
            customer_name: companyName,
            country,
            source: sourceChannel,
            customer_type: customerType,
            stage: "new_lead",
            current_status: "未联系",
            lead_level: "C",
            next_action: "发送首封开发信",
            current_next_action: "筛选客户价值",
            original_message: contactLines.join("\n"),
            question: note || "获客推进导入客户",
            updated_at: now
          };
        })
        .filter(Boolean);

      if (inserts.length === 0) {
        setError("导入失败：没有可导入的客户，请确认公司名不为空。");
        return;
      }

      const { error: insertError } = await supabase.from("customers").insert(inserts);
      if (insertError) {
        setError(`导入失败：${insertError.message}`);
        return;
      }

      await loadCustomers();
      setNotice(`成功导入 ${inserts.length} 个目标客户`);
    } catch {
      setError("导入失败：请使用模板字段上传 CSV");
    } finally {
      event.target.value = "";
    }
  }

  async function handleCreateLeadSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!session?.user?.id) {
      setError("请先登录后再新增目标客户。");
      return;
    }

    const companyName = manualLeadForm.companyName.trim();
    if (!companyName) {
      setError("请先填写公司名。");
      return;
    }

    const duplicateCustomers = findPotentialDuplicateCustomers(manualLeadForm, customers);
    if (duplicateCustomers.length > 0) {
      const duplicateSummary = duplicateCustomers
        .slice(0, 3)
        .map((customer) => `- ${getCustomerName(customer)}｜${customer.country || "待补充"}｜${getLeadSourceLabel(getLeadSourceValue(customer)) || getSourceLabel(customer.source) || "待补充"}｜${getProspectingStage(customer)}`)
        .join("\n");

      const confirmed = window.confirm(
        `可能已存在相同目标客户，是否继续保存？\n\n疑似重复客户：\n${duplicateSummary}`
      );

      if (!confirmed) return;
    }

    const contactLines = [
      manualLeadForm.website ? `官网：${manualLeadForm.website.trim()}` : "",
      manualLeadForm.linkedin ? `LinkedIn：${manualLeadForm.linkedin.trim()}` : "",
      manualLeadForm.facebook ? `FB：${manualLeadForm.facebook.trim()}` : "",
      manualLeadForm.email ? `邮箱：${manualLeadForm.email.trim()}` : "",
      manualLeadForm.whatsapp ? `WhatsApp：${manualLeadForm.whatsapp.trim()}` : "",
      `来源渠道：${manualLeadForm.sourceChannel}`,
      manualLeadForm.note ? `备注：${manualLeadForm.note.trim()}` : ""
    ].filter(Boolean);

    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10);
    const now = today.toISOString();

    const payload = {
      user_id: session.user.id,
      customer_name: companyName,
      country: manualLeadForm.country.trim(),
      source: manualLeadForm.sourceChannel,
      customer_type: manualLeadForm.customerType,
      stage: "new_lead",
      current_status: "未联系",
      lead_level: "C",
      next_action: manualLeadForm.nextAction.trim() || "筛选客户价值",
      current_next_action: manualLeadForm.nextAction.trim() || "筛选客户价值",
      next_follow_up_at: now,
      follow_up_date: todayDate,
      original_message: contactLines.join("\n") || "主动开发新增目标客户",
      question: manualLeadForm.note.trim() || "主动开发新增目标客户",
      updated_at: now
    };

    setSavingLead(true);
    const { error: insertError } = await supabase.from("customers").insert(payload);
    setSavingLead(false);

    if (insertError) {
      setError(`新增目标客户失败：${insertError.message}`);
      return;
    }

    await loadCustomers();
    setSelectedStage("新线索");
    setSelectedChannel("全部渠道");
    setPage(1);
    setShowCreateLeadModal(false);
    setManualLeadForm(manualLeadInitialState);
    setNotice("目标客户已新增，已进入“新线索”。");
    setTimeout(() => focusTargetPool(), 40);
  }

  async function convertToFormalCustomer(customer) {
    setError("");
    setNotice("");

    const confirmed = window.confirm(
      "确认转为正式客户？\n\n建议只有当客户出现以下情况时再转为正式客户：\n- 明确询价\n- 索要产品资料\n- 询问认证、清关、报价或样品\n- 有真实项目需求\n- 已经开始有效沟通"
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        current_status: "已转正式客户",
        stage: "Need Qualification",
        current_next_action: customer.current_next_action || "补齐需求并推进正式报价",
        updated_at: now
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(`转为正式客户失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    setNotice("已转为正式客户。");
  }

  async function archiveProspectingCustomer(customer) {
    setError("");
    setNotice("");

    const confirmed = window.confirm("确定将这个主动开发客户归档吗？归档后默认不再继续推进。");
    if (!confirmed) return;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        current_status: "无效",
        stage: "invalid",
        current_next_action: "",
        next_action: "",
        next_follow_up_at: null,
        updated_at: now
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(`归档失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    if (selectedId === customer.id) {
      setSelectedId("");
    }
    setNotice("客户已归档。");
  }

  async function restoreProspectingCustomer(customer) {
    setError("");
    setNotice("");

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        current_status: "未联系",
        stage: "new_lead",
        current_next_action: "发送首封开发信",
        next_action: "发送首封开发信",
        next_follow_up_at: null,
        follow_up_date: null,
        updated_at: now
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(`恢复失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    setNotice("客户已恢复为新线索。");
  }

  async function markFirstEmailSent(customer) {
    setError("");
    setNotice("");

    if (!session?.user?.id) {
      setError("请先登录后再操作。");
      return;
    }

    const followUpAt = new Date();
    followUpAt.setDate(followUpAt.getDate() + 3);
    const now = new Date().toISOString();
    const nextQuestion = upsertQuestionMeta(customer.question, "最后动作", "已完成首次触达");

    const { error: updateError } = await supabase
      .from("customers")
      .update({
        current_status: "已触达",
        stage: "contacted",
        email_status: "not_sent",
        next_action: "3天后检查是否回复",
        current_next_action: "3天后检查是否回复",
        next_follow_up_at: followUpAt.toISOString(),
        follow_up_date: followUpAt.toISOString().slice(0, 10),
        question: nextQuestion,
        updated_at: now
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(`更新失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    setNotice("已标记为已发首封，3 天后跟进");
  }

  async function updateProspectingCustomer(customer, updates, successMessage) {
    setError("");
    setNotice("");

    if (!session?.user?.id) {
      setError("请先登录后再操作。");
      return;
    }

    const now = new Date().toISOString();
    const payload = { ...updates, updated_at: now };
    const { error: updateError } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customer.id);

    if (updateError) {
      setError(`更新失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    setNotice(successMessage);
  }

  async function markEngaged(customer) {
    const today = new Date();
    await updateProspectingCustomer(
      customer,
      {
        current_status: "有互动",
        stage: "engaged",
        current_next_action: "确认客户需求并发送资料",
        next_action: "确认客户需求并发送资料",
        next_follow_up_at: today.toISOString(),
        follow_up_date: today.toISOString().slice(0, 10),
        question: upsertQuestionMeta(customer.question, "最后动作", "客户已有互动")
      },
      "已标记为有互动。"
    );
  }

  async function markFollowUp(customer) {
    const followUpAt = new Date();
    followUpAt.setDate(followUpAt.getDate() + 7);
    await updateProspectingCustomer(
      customer,
      {
        current_status: "跟进中",
        stage: "follow_up",
        current_next_action: "7天后进行轻跟进",
        next_action: "7天后进行轻跟进",
        next_follow_up_at: followUpAt.toISOString(),
        follow_up_date: followUpAt.toISOString().slice(0, 10),
        question: upsertQuestionMeta(customer.question, "最后动作", "已跟进未回复客户")
      },
      "已安排未回复客户跟进。"
    );
  }

  async function markHasNeed(customer) {
    const today = new Date();
    await updateProspectingCustomer(
      customer,
      {
        current_status: "有需求",
        stage: "has_need",
        current_next_action: "准备报价或确认详细需求",
        next_action: "准备报价或确认详细需求",
        next_follow_up_at: today.toISOString(),
        follow_up_date: today.toISOString().slice(0, 10),
        question: upsertQuestionMeta(customer.question, "最后动作", "已确认客户有需求")
      },
      "已标记为有需求。"
    );
  }

  async function markMaterialSent(customer) {
    const followUpAt = new Date();
    followUpAt.setDate(followUpAt.getDate() + 2);
    await updateProspectingCustomer(
      customer,
      {
        current_status: "已发资料",
        stage: "material_sent",
        email_status: "material_sent",
        current_next_action: "2天后跟进是否收到资料",
        next_action: "2天后跟进是否收到资料",
        next_follow_up_at: followUpAt.toISOString(),
        follow_up_date: followUpAt.toISOString().slice(0, 10),
        question: upsertQuestionMeta(customer.question, "最后动作", "已发送产品资料")
      },
      "已标记为已发资料。"
    );
  }

  async function markQuoted(customer) {
    const followUpAt = new Date();
    followUpAt.setDate(followUpAt.getDate() + 3);
    await updateProspectingCustomer(
      customer,
      {
        current_status: "已报价",
        stage: "quoted",
        email_status: "quotation_sent",
        current_next_action: "3天后跟进报价反馈",
        next_action: "3天后跟进报价反馈",
        next_follow_up_at: followUpAt.toISOString(),
        follow_up_date: followUpAt.toISOString().slice(0, 10),
        question: upsertQuestionMeta(customer.question, "最后动作", "已发送报价")
      },
      "已标记为已报价。"
    );
  }

  async function markInvalid(customer) {
    const reason = window.prompt(`请选择或填写无效原因：\n${invalidReasonOptions.join(" / ")}`, customer.invalidReasonLabel === "未填写原因" ? "" : customer.invalidReasonLabel);
    if (reason === null) return;
    const trimmedReason = reason.trim() || "其他";
    const nextQuestion = upsertQuestionMeta(
      upsertQuestionMeta(customer.question, "无效原因", trimmedReason),
      "最后动作",
      "已标记为无效"
    );

    await updateProspectingCustomer(
      customer,
      {
        current_status: "无效",
        stage: "invalid",
        current_next_action: "",
        next_action: "",
        next_follow_up_at: null,
        follow_up_date: null,
        question: nextQuestion
      },
      "已标记为无效客户。"
    );
  }

  const dailyActionItems = useMemo(() => {
    return [
      {
        key: "add-company",
        title: "新增目标公司",
        target: 20,
        completed: prospectingCustomers.filter((customer) => isDateInToday(customer.created_at)).length,
        actionLabel: "查看新线索",
        onClick: () => handleQuickFilter("新线索")
      },
      {
        key: "qualify-leads",
        title: "筛选新线索",
        target: 10,
        completed: prospectingCustomers.filter((customer) => isDateInToday(customer.updated_at) && getProspectingStage(customer) !== "新线索").length,
        actionLabel: "筛选新线索",
        onClick: () => handleQuickFilter("新线索")
      },
      {
        key: "outreach",
        title: "触达目标客户",
        target: 20,
        completed: prospectingCustomers.filter((customer) => ["已触达", "有互动", "有需求", "已发资料", "已报价", "跟进中"].includes(getProspectingStage(customer)) && isDateInToday(customer.updated_at)).length,
        actionLabel: "查看已触达客户",
        onClick: () => handleQuickFilter("已触达")
      },
      {
        key: "follow-up",
        title: "跟进未回复客户",
        target: 5,
        completed: prospectingCustomers.filter((customer) => getProspectingStage(customer) === "跟进中" && isDateInToday(customer.updated_at)).length,
        actionLabel: "查看待跟进客户",
        onClick: () => handleQuickFilter("跟进中")
      }
    ];
  }, [prospectingCustomers]);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">获客推进</p>
          <h1>获客推进系统</h1>
          <p>管理 Google Maps、LinkedIn、FB 等来源线索，筛选后再通过社媒、邮件或 WhatsApp 触达。</p>
        </div>
        <AppNav />
      </header>

      <AuthNotice session={session} />
      {loading && <section className="panel">加载中...</section>}
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      {!loading && session && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={handleCsvUpload}
          />

          <section className="panel">
            <div className="section-title">
              <h2>今日获客动作</h2>
              <span>先做今天该推进的触达动作</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {dailyActionItems.map((item) => (
                <article
                  key={item.key}
                  style={{
                    border: "1px solid rgba(226, 232, 240, 0.85)",
                    borderRadius: 16,
                    background: "#ffffff",
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ minWidth: 0, flex: "1 1 420px" }}>
                    <strong style={{ display: "block", marginBottom: 6 }}>{item.title}</strong>
                    <p className="notice" style={{ margin: 0 }}>
                      今日目标 {item.target} · 已完成 {item.completed}
                    </p>
                  </div>
                  <div className="actions compact">
                    <button type="button" onClick={item.onClick}>{item.actionLabel}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel" ref={targetPoolRef}>
            <div className="section-title">
              <div>
                <h2>目标客户池</h2>
                <span>
                  {filteredTargetPool.length} 个目标客户
                  {selectedStage ? ` · 当前阶段：${selectedStage}` : ""}
                  {selectedChannel !== "全部来源" ? ` · 当前渠道：${selectedChannel}` : ""}
                </span>
              </div>
              <div className="actions compact">
                <button type="button" onClick={openCreateLeadModal}>新增目标客户</button>
                <button type="button" onClick={handleImportClick}>批量导入</button>
              </div>
            </div>
            <div className="tabs" style={{ flexWrap: "wrap", marginBottom: 12 }}>
              {simplifiedStageFilters.map((stage) => (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => setSelectedStage(stage.value)}
                  style={selectedStage === stage.value
                    ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
                    : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
                >
                  {stage.label}
                </button>
              ))}
            </div>
            <div className="tabs" style={{ flexWrap: "wrap", marginBottom: 16 }}>
              {channelFilters.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => setSelectedChannel(channel)}
                  style={selectedChannel === channel
                    ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
                    : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
                >
                  {channel}
                </button>
              ))}
            </div>
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>公司名</th>
                    <th>国家</th>
                    <th>客户类型</th>
                    <th>来源</th>
                    <th>当前阶段</th>
                    <th>下一步动作</th>
                    <th>下次跟进日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span>{getCustomerName(customer)}</span>
                          <span className="notice" style={{ margin: 0 }}>
                            线索价值：{customer.leadValueLabel}
                          </span>
                        </div>
                      </td>
                      <td>{customer.country || "待补充"}</td>
                      <td><span className="soft-badge">{getCustomerTypeLabel(getCustomerTypeValue(customer))}</span></td>
                      <td>{customer.leadSourceLabel || "待补充"}</td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <span>{customer.prospectingStage}</span>
                          <span className="notice" style={{ margin: 0 }}>
                            最后动作：{customer.lastActionRecord.content}
                          </span>
                        </div>
                      </td>
                      <td className="truncate-cell">
                        <div style={{ display: "grid", gap: 4 }}>
                          <span>{customer.prospectingAction}</span>
                          {customer.prospectingStage === "无效" && (
                            <span className="notice" style={{ margin: 0 }}>
                              无效原因：{customer.invalidReasonLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(getFollowUpDate(customer))}</td>
                      <td>
                        <div className="actions compact">
                          {customer.prospectingStage === "新线索" && (
                            <>
                              <button type="button" onClick={() => markFirstEmailSent(customer)}>标记已触达</button>
                              <button type="button" onClick={() => markInvalid(customer)}>标记无效</button>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                            </>
                          )}
                          {customer.prospectingStage === "已触达" && (
                            <>
                              <button type="button" onClick={() => markEngaged(customer)}>标记有互动</button>
                              <button type="button" onClick={() => markFollowUp(customer)}>跟进未回复</button>
                              <button type="button" onClick={() => markInvalid(customer)}>标记无效</button>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                            </>
                          )}
                          {customer.prospectingStage === "有互动" && (
                            <>
                              <button type="button" onClick={() => markHasNeed(customer)}>标记有需求</button>
                              <button type="button" onClick={() => markMaterialSent(customer)}>发送资料</button>
                              <button type="button" onClick={() => markInvalid(customer)}>标记无效</button>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                            </>
                          )}
                          {customer.prospectingStage === "有需求" && (
                            <>
                              <button type="button" onClick={() => markMaterialSent(customer)}>标记已发资料</button>
                              <button type="button" onClick={() => convertToFormalCustomer(customer)}>转正式客户</button>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                            </>
                          )}
                          {customer.prospectingStage === "已发资料" && (
                            <>
                              <button type="button" onClick={() => markQuoted(customer)}>标记已报价</button>
                              <button type="button" onClick={() => convertToFormalCustomer(customer)}>转正式客户</button>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                            </>
                          )}
                          {customer.prospectingStage === "已报价" && (
                            <>
                              <button type="button" onClick={() => convertToFormalCustomer(customer)}>转正式客户</button>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                            </>
                          )}
                          {customer.prospectingStage === "无效" && (
                            <>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                              <button type="button" onClick={() => restoreProspectingCustomer(customer)}>恢复为新线索</button>
                            </>
                          )}
                          {!["新线索", "已触达", "有互动", "有需求", "已发资料", "已报价", "无效"].includes(customer.prospectingStage) && (
                            <>
                              <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                              {customer.prospectingStage !== "成交" && customer.prospectingStage !== "丢单" && (
                                <button type="button" onClick={() => convertToFormalCustomer(customer)}>转正式客户</button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTargetPool.length === 0 && <p className="empty">暂无目标客户。请先下载模板，整理客户名单后上传 CSV。</p>}
            {filteredTargetPool.length > 0 && (
              <div className="actions compact" style={{ marginTop: 16, justifyContent: "space-between" }}>
              <span>第 {page} / {totalPages} 页</span>
                <div className="actions compact">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    上一页
                  </button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    下一页
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {showCreateLeadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.36)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50
          }}
        >
          <div
            style={{
              width: "min(860px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 20,
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.18)",
              padding: 24
            }}
          >
            <div className="section-title" style={{ marginBottom: 16 }}>
              <div>
                <h2>新增目标客户</h2>
                <span>保存后默认进入“新线索”，下次跟进日期为今天。</span>
              </div>
              <button type="button" onClick={closeCreateLeadModal} style={{ border: "none", background: "transparent", color: "#475569", fontSize: 18 }}>
                关闭
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit}>
              <div style={{ display: "grid", gap: 18 }}>
                <section
                  style={{
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    borderRadius: 16,
                    padding: 18,
                    background: "#f8fafc"
                  }}
                >
                  <div className="section-title" style={{ marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18 }}>基础信息</h3>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16
                    }}
                  >
                    <FieldLike label="公司名">
                      <input value={manualLeadForm.companyName} onChange={(event) => updateManualLeadField("companyName", event.target.value)} placeholder="请输入公司名" />
                    </FieldLike>
                    <FieldLike label="国家">
                      <input value={manualLeadForm.country} onChange={(event) => updateManualLeadField("country", event.target.value)} placeholder="请输入国家" />
                    </FieldLike>
                    <FieldLike label="客户类型">
                      <select value={manualLeadForm.customerType} onChange={(event) => updateManualLeadField("customerType", event.target.value)}>
                        <option value="Unknown">待判断</option>
                        <option value="Solar Installer">Solar Installer</option>
                        <option value="Solar Distributor">Solar Distributor</option>
                        <option value="Battery Wholesaler">Battery Wholesaler</option>
                        <option value="Inverter Distributor">Inverter Distributor</option>
                        <option value="OEM / Brand Owner">OEM / Brand Owner</option>
                        <option value="End User">End User</option>
                      </select>
                    </FieldLike>
                    <FieldLike label="来源渠道">
                      <select value={manualLeadForm.sourceChannel} onChange={(event) => updateManualLeadField("sourceChannel", event.target.value)}>
                        {channelFilters.filter((item) => item !== "全部渠道").map((channel) => (
                          <option key={channel} value={channel}>{channel}</option>
                        ))}
                      </select>
                    </FieldLike>
                  </div>
                </section>

                <section
                  style={{
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    borderRadius: 16,
                    padding: 18,
                    background: "#f8fafc"
                  }}
                >
                  <div className="section-title" style={{ marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18 }}>联系渠道</h3>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16
                    }}
                  >
                    <FieldLike label="网站">
                      <input value={manualLeadForm.website} onChange={(event) => updateManualLeadField("website", event.target.value)} placeholder="https://example.com" />
                    </FieldLike>
                    <FieldLike label="Email">
                      <input value={manualLeadForm.email} onChange={(event) => updateManualLeadField("email", event.target.value)} placeholder="sales@example.com" />
                    </FieldLike>
                    <FieldLike label="LinkedIn">
                      <input value={manualLeadForm.linkedin} onChange={(event) => updateManualLeadField("linkedin", event.target.value)} placeholder="LinkedIn 链接" />
                    </FieldLike>
                    <FieldLike label="FB">
                      <input value={manualLeadForm.facebook} onChange={(event) => updateManualLeadField("facebook", event.target.value)} placeholder="Facebook 链接" />
                    </FieldLike>
                    <FieldLike label="WhatsApp">
                      <input value={manualLeadForm.whatsapp} onChange={(event) => updateManualLeadField("whatsapp", event.target.value)} placeholder="+86 ..." />
                    </FieldLike>
                  </div>
                </section>

                <section
                  style={{
                    border: "1px solid rgba(226, 232, 240, 0.9)",
                    borderRadius: 16,
                    padding: 18,
                    background: "#f8fafc"
                  }}
                >
                  <div className="section-title" style={{ marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18 }}>推进信息</h3>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16
                    }}
                  >
                    <FieldLike label="下一步动作">
                      <input
                        list="prospecting-next-action-options"
                        value={manualLeadForm.nextAction}
                        onChange={(event) => updateManualLeadField("nextAction", event.target.value)}
                        placeholder="例如：发送首封开发信"
                      />
                    </FieldLike>
                    <datalist id="prospecting-next-action-options">
                      <option value="筛选客户价值" />
                      <option value="查找 LinkedIn 负责人" />
                      <option value="查看 FB 是否活跃" />
                      <option value="发送 LinkedIn 连接" />
                      <option value="发送 FB 私信" />
                      <option value="发送英文开发信" />
                      <option value="等待客户回复" />
                      <option value="跟进未回复客户" />
                    </datalist>
                    <FieldLike label="备注">
                      <textarea
                        value={manualLeadForm.note}
                        onChange={(event) => updateManualLeadField("note", event.target.value)}
                        placeholder="补充记录客户背景、产品需求、判断依据等"
                        rows={5}
                      />
                    </FieldLike>
                  </div>
                </section>
              </div>

              <div className="actions" style={{ marginTop: 20, justifyContent: "flex-end" }}>
                <button type="button" onClick={closeCreateLeadModal} disabled={savingLead}>取消</button>
                <button type="submit" disabled={savingLead}>
                  {savingLead ? "保存中..." : "保存目标客户"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
