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

const prospectingStages = [
  "新线索",
  "已触达",
  "有互动",
  "有需求",
  "已发资料",
  "已报价",
  "跟进中",
  "成交",
  "丢单",
  "无效"
];

const importHeaders = ["公司名", "国家", "客户类型", "官网", "邮箱", "LinkedIn", "联系人", "WhatsApp", "来源渠道", "备注"];
const reviewRanges = ["今天", "昨天", "本周", "上周", "本月", "上月", "自定义"];
const prospectingSources = ["Google Maps", "LinkedIn", "FB", "Website", "Referral", "主动开发"];

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
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [page, setPage] = useState(1);
  const [reviewRange, setReviewRange] = useState("本月");
  const [showImportRules, setShowImportRules] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
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
      prospectingAction: getProspectingNextAction(customer)
    }));
  }, [prospectingCustomers]);

  const boardGroups = useMemo(() => {
    const map = Object.fromEntries(prospectingStages.map((stage) => [stage, []]));
    targetPool.forEach((customer) => {
      map[customer.prospectingStage].push(customer);
    });
    return map;
  }, [targetPool]);

  const reviewStats = useMemo(() => {
    const { start, end } = getRangeBounds(reviewRange, customStartDate, customEndDate);

    const inRangeCustomers = prospectingCustomers.filter((customer) => {
      if (!start || !end) return reviewRange !== "自定义";
      const createdAt = customer.created_at ? new Date(customer.created_at) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
      return createdAt.getTime() >= start.getTime() && createdAt.getTime() <= end.getTime();
    });

    const stageCounts = inRangeCustomers.reduce((map, customer) => {
      const stage = getProspectingStage(customer);
      map[stage] = (map[stage] || 0) + 1;
      return map;
    }, {});

    const sentCount = inRangeCustomers.filter((customer) => ["已触达", "有互动", "有需求", "已发资料", "已报价", "跟进中", "成交", "丢单", "无效"].includes(getProspectingStage(customer))).length;
    const repliedTotalCount = inRangeCustomers.filter((customer) => {
      const stage = getProspectingStage(customer);
      return ["有互动", "有需求", "已发资料", "已报价", "跟进中", "成交", "丢单", "无效"].includes(stage);
    }).length;
    const repliedCount = stageCounts["有互动"] || 0;
    const convertedCount = stageCounts["成交"] || 0;
    const archivedCount = stageCounts["无效"] || 0;

    return [
      { title: "新增目标客户", value: inRangeCustomers.length },
      { title: "已发首封", value: stageCounts["已触达"] || 0 },
      { title: "跟进中", value: stageCounts["跟进中"] || 0 },
      { title: "已回复", value: repliedCount },
      { title: "已转正式客户", value: convertedCount },
      { title: "归档", value: archivedCount },
      { title: "回复率", value: formatPercent(repliedTotalCount, sentCount) },
      { title: "转化率", value: formatPercent(convertedCount, sentCount) }
    ];
  }, [prospectingCustomers, reviewRange, customStartDate, customEndDate]);

  const filteredTargetPool = useMemo(() => {
    if (!selectedStage) return targetPool;
    return targetPool.filter((customer) => customer.prospectingStage === selectedStage);
  }, [selectedStage, targetPool]);

  const totalPages = Math.max(1, Math.ceil(filteredTargetPool.length / pageSize));
  const pagedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTargetPool.slice(start, start + pageSize);
  }, [filteredTargetPool, page]);

  useEffect(() => {
    if (selectedId && !targetPool.find((customer) => customer.id === selectedId)) {
      setSelectedId("");
    }
  }, [selectedId, targetPool]);

  useEffect(() => {
    setPage(1);
  }, [selectedStage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedCustomer = targetPool.find((customer) => customer.id === selectedId) || null;
  const selectedScript = selectedCustomer ? getProspectingScript(selectedCustomer) : null;

  async function copyScript(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("英文开发信已复制。");
    } catch {
      setNotice("复制失败，请手动复制。");
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
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
            current_next_action: "发送首封开发信",
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

  async function convertToFormalCustomer(customer) {
    setError("");
    setNotice("");

    const confirmed = window.confirm("确定将这个客户转为正式客户吗？转入后请在客户详情中继续推进需求和报价。");
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

    const { error: updateError } = await supabase
      .from("customers")
      .update({
        current_status: "已触达",
        stage: "contacted",
        email_status: "not_sent",
        next_action: "3天后查看是否有回复",
        current_next_action: "3天后查看是否有回复",
        next_follow_up_at: followUpAt.toISOString(),
        follow_up_date: followUpAt.toISOString().slice(0, 10),
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

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">获客推进</p>
          <h1>获客推进系统</h1>
          <p>管理 Google Maps、LinkedIn、FB、Email、WhatsApp 多渠道线索，并按阶段持续推进。</p>
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
              <h2>今日获客任务</h2>
              <span>{todayTasks.length} 项</span>
            </div>
            <div className="card-list">
              {todayTasks.slice(0, 5).map((customer) => (
                <article className="customer-card" key={customer.id}>
                  <strong>{getCustomerName(customer)}</strong>
                  <p>当前阶段：{customer.prospectingStage}</p>
                  <p>下一步动作：{customer.prospectingAction}</p>
                  <p>下次跟进：{formatDate(getFollowUpDate(customer))}</p>
                  <div className="actions compact">
                    <button type="button" onClick={() => setSelectedId(customer.id)}>生成英文开发信</button>
                    <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                  </div>
                </article>
              ))}
              {todayTasks.length === 0 && <p className="empty">今天暂无待推进的获客任务</p>}
            </div>
            {todayTasks.length > 5 && (
              <p className="empty">还有 {todayTasks.length - 5} 个获客任务，查看全部。</p>
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>获客数据复盘</h2>
              <span>只统计获客推进线索</span>
            </div>
            <div className="tabs" style={{ flexWrap: "wrap" }}>
              {reviewRanges.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReviewRange(item)}
                  style={reviewRange === item
                    ? { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }
                    : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
                >
                  {item}
                </button>
              ))}
            </div>
            {reviewRange === "自定义" && (
              <div className="form-grid" style={{ marginTop: 16 }}>
                <FieldLike label="开始日期">
                  <input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
                </FieldLike>
                <FieldLike label="结束日期">
                  <input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
                </FieldLike>
              </div>
            )}
            <div
              className="summary-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, minmax(120px, 140px))",
                justifyContent: "center",
                gap: 24,
                marginTop: 16,
                overflow: "hidden"
              }}
            >
              {reviewStats.map((item) => (
                <article
                  key={item.title}
                  className="notice-panel"
                  style={{
                    padding: "12px 10px",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center"
                  }}
                >
                  <strong style={{ fontSize: 14, lineHeight: 1.3, color: "#1f2937" }}>{item.title}</strong>
                  <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6, lineHeight: 1.1 }}>{item.value}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>批量导入目标客户</h2>
              <span>先支持 CSV 模板</span>
            </div>
            <p className="notice">
              导入后默认进入“新线索”，下一步为“发送首封开发信”。
            </p>
            <div className="actions compact">
              <button type="button" onClick={handleImportClick}>上传 CSV</button>
              <button type="button" onClick={downloadTemplate}>下载导入模板</button>
              <button type="button" onClick={() => setShowImportRules((current) => !current)}>
                {showImportRules ? "收起导入规则" : "查看导入字段与默认规则"}
              </button>
            </div>
            {showImportRules && (
              <div className="detail-grid" style={{ marginTop: 16 }}>
                <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                  <strong>导入模板字段</strong>
                  <p>公司名、国家、客户类型、官网、邮箱、LinkedIn、联系人、WhatsApp、来源渠道、备注</p>
                </div>
                <div className="detail-item"><strong>默认阶段</strong><p>未联系</p></div>
                <div className="detail-item"><strong>默认下一步动作</strong><p>发送首封开发信</p></div>
                <div className="detail-item"><strong>默认下次跟进日期</strong><p>空</p></div>
                <div className="detail-item"><strong>默认客户来源</strong><p>获客推进</p></div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>开发阶段概览</h2>
              <div className="actions compact">
                <button
                  type="button"
                  onClick={() => setSelectedStage("")}
                  style={selectedStage ? undefined : { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }}
                >
                  全部客户
                </button>
              </div>
            </div>
            <div
              className="summary-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12
              }}
            >
              {prospectingStages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className="summary-card"
                  onClick={() => setSelectedStage(stage)}
                  style={selectedStage === stage
                    ? {
                      border: "1px solid #155eef",
                      boxShadow: "0 0 0 2px rgba(21,94,239,0.08)",
                      background: "#eff6ff",
                      borderRadius: 16,
                      padding: 16,
                      textAlign: "left"
                    }
                    : {
                      background: "#ffffff",
                      borderRadius: 16,
                      padding: 16,
                      textAlign: "left",
                      border: "1px solid #dbe5f1"
                    }}
                >
                  <strong>{stage}</strong>
                  <span style={{ display: "block", marginTop: 8, fontSize: 28, fontWeight: 700 }}>
                    {(boardGroups[stage] || []).length}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>目标客户池</h2>
              <span>{filteredTargetPool.length} 个目标客户{selectedStage ? ` · 当前筛选：${selectedStage}` : ""}</span>
            </div>
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>公司名</th>
                    <th>国家</th>
                    <th>客户类型</th>
                    <th>当前阶段</th>
                    <th>下一步动作</th>
                    <th>下次跟进日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>{getCustomerName(customer)}</td>
                      <td>{customer.country || "待补充"}</td>
                      <td><span className="soft-badge">{getCustomerTypeLabel(getCustomerTypeValue(customer))}</span></td>
                      <td>{customer.prospectingStage}</td>
                      <td className="truncate-cell">{customer.prospectingAction}</td>
                      <td>{formatDate(getFollowUpDate(customer))}</td>
                      <td>
                        <div className="actions compact">
                          <button type="button" onClick={() => setSelectedId(customer.id)}>生成英文开发信</button>
                          <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                          <button type="button" onClick={() => convertToFormalCustomer(customer)}>转为正式客户</button>
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

          {selectedCustomer && (
            <section className="panel">
              <div className="section-title">
                <h2>开发信操作面板</h2>
                <span>{getCustomerName(selectedCustomer)}</span>
              </div>
              {selectedScript && (
                <>
                  <div className="detail-grid">
                    <div className="detail-item"><strong>当前客户名</strong><p>{getCustomerName(selectedCustomer)}</p></div>
                    <div className="detail-item"><strong>当前阶段</strong><p>{getProspectingStage(selectedCustomer)}</p></div>
                    <div className="detail-item"><strong>来源渠道</strong><p>{getLeadSourceLabel(getLeadSourceValue(selectedCustomer)) || getSourceLabel(selectedCustomer.source)}</p></div>
                    <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                      <strong>下一步动作</strong>
                      <p>{getProspectingNextAction(selectedCustomer)}</p>
                    </div>
                    <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                      <strong>{selectedScript.title}</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{selectedScript.text}</p>
                    </div>
                  </div>
                  <div className="actions compact">
                    {getProspectingStage(selectedCustomer) === "新线索" && (
                      <>
                        <button type="button" onClick={() => copyScript(selectedScript.text)}>复制英文开发信</button>
                        <button type="button" onClick={() => markFirstEmailSent(selectedCustomer)}>标记已发送首封</button>
                        <Link href={`/customers/${selectedCustomer.id}`}>查看/编辑客户</Link>
                      </>
                    )}
                    {["已触达", "有互动", "有需求", "已发资料", "已报价", "跟进中"].includes(getProspectingStage(selectedCustomer)) && (
                      <>
                        <button type="button" onClick={() => copyScript(selectedScript.text)}>复制英文开发信</button>
                        <Link href={`/customers/${selectedCustomer.id}`}>查看/编辑客户</Link>
                        <button type="button" onClick={() => convertToFormalCustomer(selectedCustomer)}>转为正式客户</button>
                      </>
                    )}
                    {["成交", "无效", "丢单"].includes(getProspectingStage(selectedCustomer)) && (
                      <>
                        <button type="button" onClick={() => convertToFormalCustomer(selectedCustomer)}>转为正式客户</button>
                        <button type="button" onClick={() => archiveProspectingCustomer(selectedCustomer)}>归档</button>
                        <Link href={`/customers/${selectedCustomer.id}`}>查看/编辑客户</Link>
                      </>
                    )}
                    {!["新线索", "已触达", "成交", "无效", "丢单", "有互动", "有需求", "已发资料", "已报价", "跟进中"].includes(getProspectingStage(selectedCustomer)) && (
                      <>
                        <button type="button" onClick={() => copyScript(selectedScript.text)}>复制英文开发信</button>
                        <Link href={`/customers/${selectedCustomer.id}`}>查看/编辑客户</Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
