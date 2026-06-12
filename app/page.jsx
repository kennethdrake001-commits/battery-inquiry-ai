"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../components/layout/AppNav";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";
import { buildTaskRows } from "../lib/taskWorkflow";
import { formatNextActionForDisplay } from "../lib/displayText";
import {
  getCustomerName,
  getCustomerTypeLabel,
  getCustomerTypeValue,
  getNextAction,
  getStageLabel,
  getStageValue,
  getTaskPriority
} from "../lib/customerViews";
import {
  getLeadProgressStageLabel,
  isLeadProgressCustomer
} from "../lib/leadProgress";

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
      <div
        className="auth-card"
        style={{
          padding: "12px 16px",
          minHeight: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 4px 10px rgba(15, 23, 42, 0.04)"
        }}
      >
        <span style={{ color: "#475569", fontSize: 14 }}>已登录：{session.user.email}</span>
        <div className="actions compact">
          <Link href="/customers/new">新增客户</Link>
          <button onClick={signOut}>退出登录</button>
        </div>
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

function getCardAppearance(kind, isActive) {
  const appearanceMap = {
    urgent: {
      border: isActive ? "1px solid rgb(191, 219, 254)" : "1px solid rgb(191, 219, 254)",
      background: "rgba(239, 246, 255, 0.4)",
      shadow: isActive ? "0 10px 22px rgba(59, 130, 246, 0.12)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
      accent: "#2563eb"
    },
    value: {
      border: isActive ? "1px solid rgb(191, 219, 254)" : "1px solid rgb(191, 219, 254)",
      background: "rgba(239, 246, 255, 0.4)",
      shadow: isActive ? "0 10px 22px rgba(59, 130, 246, 0.12)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
      accent: "#2563eb"
    },
    channel: {
      border: isActive ? "1px solid rgb(226, 232, 240)" : "1px solid rgb(226, 232, 240)",
      background: "#ffffff",
      shadow: isActive ? "0 10px 22px rgba(59, 130, 246, 0.12)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
      accent: "#334155"
    }
  };
  return appearanceMap[kind] || appearanceMap.channel;
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

function isArchivedCustomer(customer) {
  return customer?.current_status === "归档"
    || customer?.stage === "Archived"
    || customer?.stage === "归档";
}

function isWonCustomer(customer = {}) {
  const stage = `${customer.stage || ""}`.trim();
  const status = `${customer.current_status || ""}`.trim();
  return ["Closed Won", "成交", "已成交", "已转正式客户", "won"].includes(stage)
    || ["成交", "已成交", "已转正式客户", "won"].includes(status);
}

function isInvalidCustomer(customer = {}) {
  const stage = `${customer.stage || ""}`.trim();
  const status = `${customer.current_status || ""}`.trim();
  return ["Archived", "归档", "invalid", "无效", "Closed Lost", "丢单", "已丢单", "lost"].includes(stage)
    || ["归档", "无效", "不合适", "丢单", "已丢单", "invalid", "lost"].includes(status);
}

function needsProgress(customer = {}) {
  return !isArchivedCustomer(customer) && !isWonCustomer(customer) && !isInvalidCustomer(customer);
}

function isQuotedWaitingReplyCustomer(customer = {}) {
  const stage = `${customer.stage || ""}`.trim();
  const status = `${customer.current_status || ""}`.trim();
  if (!needsProgress(customer)) return false;
  return [
    "Quoted",
    "Waiting Reply",
    "已报价",
    "已报价未回复",
    "报价后待跟进"
  ].includes(stage) || [
    "已报价",
    "已报价未回复",
    "报价后待跟进",
    "待客户回复"
  ].includes(status);
}

function isCustomerReplyPending(customer = {}) {
  const stage = `${customer.stage || ""}`.trim();
  const status = `${customer.current_status || ""}`.trim();
  if (!needsProgress(customer)) return false;
  return [
    "Customer Replied",
    "Responded",
    "engaged",
    "有回应",
    "已回复",
    "客户已回复"
  ].includes(stage) || [
    "有回应",
    "已回复",
    "客户已回复"
  ].includes(status);
}

function isProspectingCustomer(customer = {}) {
  return customer?.source === "主动开发"
    || customer?.customer_source === "主动开发"
    || customer?.stage === "Prospecting"
    || customer?.current_status === "Prospecting";
}

function isHighPriorityCustomer(customer = {}) {
  const priority = `${customer.priority || customer.customer_priority || ""}`.trim().toLowerCase();
  return priority === "high"
    || priority === "高"
    || `${customer.lead_level || ""}`.trim() === "A";
}

function isFollowUpOverdue(customer, today = new Date()) {
  const dateValue = customer?.next_follow_up_at || customer?.follow_up_date;
  if (!dateValue || !needsProgress(customer)) return false;
  const followUpDate = new Date(dateValue);
  if (Number.isNaN(followUpDate.getTime())) return false;
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  return followUpDate.getTime() < startOfToday.getTime();
}

function isDueForFollowUp(customer, today = new Date()) {
  const dateValue = customer?.next_follow_up_at || customer?.follow_up_date;
  if (!dateValue || !needsProgress(customer)) return false;
  const followUpDate = new Date(dateValue);
  if (Number.isNaN(followUpDate.getTime())) return false;

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  return followUpDate.getTime() <= endOfToday.getTime();
}

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeSummaryKey, setActiveSummaryKey] = useState("");
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function loadCustomers(options = {}) {
    const { silent = false } = options;

    if (!supabase || !session) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    const { data: rows, error: queryError } = await supabase
      .from("customers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (queryError) {
      setCustomers([]);
      setError(queryError.message);
    } else {
      setCustomers(rows || []);
      setError("");
    }

    if (!silent) {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [supabase, session]);

  async function insertInteraction(payload) {
    return supabase.from("interactions").insert(payload);
  }

  async function handleQuickAction(customerId, actionType) {
    if (!customerId) {
      setError("客户 ID 缺失，无法更新");
      return;
    }

    if (!supabase || !session?.user) {
      setError("请先登录后再处理客户");
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const actionKey = `${customerId}:${actionType}`;
    let customerUpdate = null;
    let interactionPayload = null;
    let successMessage = "";

    if (actionType === "material-sent") {
      const followUp = new Date(now);
      followUp.setDate(followUp.getDate() + 3);
      customerUpdate = {
        last_contacted_at: nowIso,
        current_status: "待客户回复",
        stage: "Waiting Reply",
        current_next_action: "等待客户回复，必要时再次跟进",
        next_action: "等待客户回复，必要时再次跟进",
        next_follow_up_at: followUp.toISOString(),
        follow_up_date: formatDateOnly(followUp.toISOString()),
        updated_at: nowIso
      };
      interactionPayload = {
        customer_id: customerId,
        interaction_status: "已发资料",
        operator_note: "已发送资料，等待客户回复",
        created_at: nowIso
      };
      successMessage = "已标记为已发资料，客户状态已更新。";
    }

    if (actionType === "quoted") {
      const followUp = new Date(now);
      followUp.setDate(followUp.getDate() + 2);
      customerUpdate = {
        last_quote_at: nowIso,
        current_status: "已报价",
        stage: "Quoted",
        current_next_action: "报价已发送，2天后跟进客户反馈",
        next_action: "报价已发送，2天后跟进客户反馈",
        next_follow_up_at: followUp.toISOString(),
        follow_up_date: formatDateOnly(followUp.toISOString()),
        updated_at: nowIso
      };
      interactionPayload = {
        customer_id: customerId,
        interaction_status: "已报价",
        operator_note: "已在工作台标记报价已发送，等待客户反馈",
        created_at: nowIso
      };
      successMessage = "已标记为已报价，2天后会继续跟进。";
    }

    if (actionType === "archive") {
      const confirmed = window.confirm("确认将该客户标记为无效并归档吗？");
      if (!confirmed) return;

      customerUpdate = {
        current_status: "已归档",
        stage: "Archived",
        current_next_action: "已归档，无需继续跟进",
        next_action: "已归档，无需继续跟进",
        updated_at: nowIso
      };
      interactionPayload = {
        customer_id: customerId,
        interaction_status: "已归档",
        operator_note: "在工作台标记为无效客户",
        created_at: nowIso
      };
      successMessage = "客户已归档。";
    }

    if (!customerUpdate || !interactionPayload) {
      setError("未识别的快捷动作");
      return;
    }

    setActionLoading((current) => ({ ...current, [actionKey]: true }));
    setError("");
    setNotice("");

    const { error: customerError } = await supabase
      .from("customers")
      .update(customerUpdate)
      .eq("id", customerId);

    if (customerError) {
      setActionLoading((current) => ({ ...current, [actionKey]: false }));
      setError(customerError.message);
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    let interactionError = null;

    if (!user?.id) {
      console.warn("No auth user found, skip interaction log");
    } else {
      const { error } = await insertInteraction({
        ...interactionPayload,
        user_id: user.id
      });
      interactionError = error;
    }

    await loadCustomers({ silent: true });
    setActionLoading((current) => ({ ...current, [actionKey]: false }));

    if (interactionError) {
      console.warn("客户状态已更新，但跟进记录未保存", interactionError);
      setNotice("客户状态已更新，但跟进记录未保存");
      return;
    }

    setNotice(successMessage);
  }

  const visibleCustomers = useMemo(() => {
    return customers.filter((customer) => !isArchivedCustomer(customer));
  }, [customers]);

  const tasks = useMemo(() => buildTaskRows(visibleCustomers), [visibleCustomers]);

  function mapSummaryCustomers(list) {
    return list.map((customer) => ({
      id: customer.id,
      customerName: getCustomerName(customer),
      country: customer.country || "待补充",
      source: customer.source || customer.customer_source || "待补充",
      customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
      currentStatus: isLeadProgressCustomer(customer)
        ? getLeadProgressStageLabel(customer)
        : getStageLabel(getStageValue(customer)),
      nextAction: formatNextActionForDisplay(customer.current_next_action || customer.next_action || getNextAction(customer)),
      followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date),
      isHighPriority: isHighPriorityCustomer(customer)
    }));
  }

  const summaryGroups = useMemo(() => {
    const progressCustomers = visibleCustomers.filter((customer) => needsProgress(customer));
    const todayFollowUpCustomers = progressCustomers.filter((customer) => isDueForFollowUp(customer));
    const overdueCustomers = progressCustomers.filter((customer) => isFollowUpOverdue(customer));
    const quotedFollowUpCustomers = progressCustomers.filter((customer) => isQuotedWaitingReplyCustomer(customer));
    const repliedPendingCustomers = progressCustomers.filter((customer) => isCustomerReplyPending(customer));

    return [
      {
        key: "today-follow-up",
        title: "今日需跟进",
        subtitle: todayFollowUpCustomers.length === 0 ? "今天暂无需要推进的客户" : "今天应优先推进的客户",
        listTitle: "今日需跟进客户",
        appearance: "urgent",
        reason: "今天需要跟进",
        customers: mapSummaryCustomers(todayFollowUpCustomers)
      },
      {
        key: "overdue-follow-up",
        title: "超期未跟进",
        subtitle: overdueCustomers.length === 0 ? "暂无超期未跟进客户" : "这些客户已经超过计划跟进日期",
        listTitle: "超期未跟进客户",
        appearance: "channel",
        reason: "跟进已超期，需要尽快处理",
        customers: mapSummaryCustomers(overdueCustomers)
      },
      {
        key: "quoted-follow-up",
        title: "已报价待跟进",
        subtitle: quotedFollowUpCustomers.length === 0 ? "暂无报价后待跟进客户" : "报价已发出，需要确认客户反馈",
        listTitle: "已报价待跟进客户",
        appearance: "channel",
        reason: "报价已发送，需要跟进反馈",
        customers: mapSummaryCustomers(quotedFollowUpCustomers)
      },
      {
        key: "reply-pending",
        title: "客户已回复待处理",
        subtitle: repliedPendingCustomers.length === 0 ? "暂无待处理客户回复" : "客户已回复，需要尽快继续推进",
        listTitle: "客户已回复待处理",
        appearance: "channel",
        reason: "客户已回复，待判断下一步",
        customers: mapSummaryCustomers(repliedPendingCustomers)
      }
    ];
  }, [visibleCustomers]);

  const highPriorityRows = useMemo(() => {
    return mapSummaryCustomers(
      visibleCustomers.filter((customer) => isHighPriorityCustomer(customer) && needsProgress(customer))
    ).slice(0, 5);
  }, [visibleCustomers]);
  const prospectingRows = useMemo(() => {
    return mapSummaryCustomers(
      visibleCustomers.filter((customer) => isProspectingCustomer(customer) && needsProgress(customer))
    ).slice(0, 5);
  }, [visibleCustomers]);
  const summaryCards = useMemo(() => {
    return [
      ...summaryGroups,
      {
        key: "high-priority",
        title: "重点客户",
        subtitle: highPriorityRows.length === 0 ? "暂无重点客户" : "即使今天无明确日期，也建议优先关注",
        listTitle: "重点客户",
        appearance: "value",
        reason: "高优先级客户，建议优先处理",
        customers: highPriorityRows
      },
      {
        key: "prospecting-progress",
        title: "主动开发待推进",
        subtitle: prospectingRows.length === 0 ? "暂无主动开发待推进客户" : "需要继续跟进的主动开发客户",
        listTitle: "主动开发待推进客户",
        appearance: "channel",
        reason: "主动开发客户需要继续推进",
        customers: prospectingRows
      }
    ];
  }, [summaryGroups, highPriorityRows, prospectingRows]);

  const actionRows = useMemo(() => {
    return tasks.slice(0, 5).map((task) => {
      const customer = visibleCustomers.find((item) => item.id === task.id) || null;
      return {
        id: task.id,
        priority: getTaskPriority(task, customer),
        customerName: task.customer_name,
        source: (customer && (customer.source || customer.customer_source)) || "待补充",
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer || task)),
        currentStatus: customer && isLeadProgressCustomer(customer)
          ? getLeadProgressStageLabel(customer)
          : getStageLabel(getStageValue(customer || task)),
        nextAction: formatNextActionForDisplay(task.current_next_action || getNextAction(customer || task)),
        followUpDate: formatDateOnly((customer && (customer.next_follow_up_at || customer.follow_up_date)) || task.next_follow_up_at),
        reason: task.task_reason || "根据当前推进建议执行",
        isHighPriority: customer ? isHighPriorityCustomer(customer) : false
      };
    });
  }, [tasks, visibleCustomers]);

  const remainingTaskCount = Math.max(tasks.length - 5, 0);
  const activeSummary = summaryCards.find((group) => group.key === activeSummaryKey) || null;
  const selectedActionGroup = activeSummary || {
    key: "default-actions",
    title: "今日行动列表",
    listTitle: "今日行动列表",
    customers: actionRows,
    reason: "根据当前推进建议执行"
  };

  const selectedRows = (selectedActionGroup.customers || []).map((item) => ({
    id: item.id,
    customerName: item.customerName,
    source: item.source,
    customerType: item.customerType,
    currentStatus: item.currentStatus,
    nextAction: item.nextAction,
    followUpDate: item.followUpDate || "待安排",
    reason: item.reason || selectedActionGroup.reason || "根据当前推进建议执行",
    isHighPriority: Boolean(item.isHighPriority)
  }));

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">工作台</p>
          <h1>今日工作台</h1>
          <p>集中处理今天需要推进的客户，包括询盘客户、已报价客户、已回复客户和主动开发客户。</p>
        </div>
        <AppNav />
      </header>

      <AuthPanel session={session} onSessionChange={setSession} />

      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      {session && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>今日工作重点</h2>
              <span>先看今天最需要推进的客户，再进入具体处理</span>
            </div>
            <div
              className="task-grid"
              style={{
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 12,
                alignItems: "stretch"
              }}
            >
              {summaryCards.map((card) => {
                const appearance = getCardAppearance(card.appearance, activeSummaryKey === card.key);
                const isActive = activeSummaryKey === card.key;
                return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setActiveSummaryKey(card.key === activeSummaryKey ? "" : card.key)}
                  style={{ all: "unset", cursor: "pointer", display: "block" }}
                  aria-label={`查看${card.title}客户列表`}
                >
                  <article
                    className="notice-panel"
                    style={{
                      border: appearance.border,
                      background: appearance.background,
                      boxShadow: appearance.shadow,
                      minHeight: 108,
                      borderRadius: 18,
                      padding: "14px 14px 12px",
                      transition: "all 0.2s ease",
                      position: "relative",
                      transform: isActive ? "translateY(-1px)" : "none"
                    }}
                  >
                    {card.customers.length > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: isActive ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.66)",
                          color: appearance.accent,
                          border: `1px solid ${appearance.border.includes("rgba") ? appearance.border.match(/rgba?\([^)]+\)|#[0-9a-fA-F]+/)?.[0] || "rgba(148,163,184,.25)" : "rgba(148,163,184,.25)"}`
                        }}
                      >
                        建议处理
                      </span>
                    )}
                    <strong
                      style={{
                        color: appearance.accent,
                        display: "block",
                        fontSize: 16,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        paddingRight: card.customers.length > 0 ? 84 : 0
                      }}
                    >
                      {card.title}
                    </strong>
                    <div style={{ fontSize: card.customers.length > 0 ? 30 : 28, fontWeight: 800, lineHeight: 1.05, marginTop: 6, color: "#0f172a" }}>
                      {card.customers.length}
                    </div>
                    <p style={{ marginTop: 6, color: card.appearance === "channel" ? "#64748b" : "#475569", lineHeight: 1.35, fontSize: 12 }}>{card.subtitle}</p>
                  </article>
                </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <div>
                <h2>{selectedActionGroup.listTitle}</h2>
                <span>优先处理今天会影响成交推进的客户</span>
              </div>
              <div className="actions compact">
                <Link href="/tasks">查看全部任务</Link>
              </div>
            </div>

            {loading ? (
              <p className="empty">加载中...</p>
            ) : selectedRows.length === 0 ? (
              <p className="empty">暂无对应客户</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {selectedRows.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      border: "1px solid rgba(226, 232, 240, 0.85)",
                      borderRadius: 16,
                      padding: "15px 16px",
                      background: "#ffffff",
                      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.04)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: "1 1 520px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                          <strong style={{ fontSize: 17, color: "#0f172a" }}>{item.customerName}</strong>
                          {item.isHighPriority && (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                padding: "4px 8px",
                                borderRadius: 999,
                                background: "rgba(16, 185, 129, 0.12)",
                                color: "#047857",
                                border: "1px solid rgba(16, 185, 129, 0.2)"
                              }}
                            >
                              高优先级
                            </span>
                          )}
                          <span className="soft-badge">{item.source || "待补充"}</span>
                          <span className="soft-badge">{item.customerType}</span>
                          <span className="soft-badge">{item.currentStatus}</span>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div><strong>下一步建议：</strong>{item.nextAction || "暂无动作"}</div>
                          <div><strong>提醒原因：</strong>{item.reason}</div>
                          <div><strong>跟进日期：</strong>{item.followUpDate}</div>
                        </div>
                      </div>
                        <div className="actions compact" style={{ justifyContent: "flex-end", flex: "0 1 auto", gap: 8 }}>
                          <Link className="primary" href={`/customers/${item.id}`}>进入处理</Link>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(item.id, "material-sent")}
                            disabled={actionLoading[`${item.id}:material-sent`]}
                            style={{ opacity: 0.85 }}
                          >
                            {actionLoading[`${item.id}:material-sent`] ? "处理中..." : "标记已发资料"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(item.id, "quoted")}
                            disabled={actionLoading[`${item.id}:quoted`]}
                            style={{ opacity: 0.85 }}
                          >
                            {actionLoading[`${item.id}:quoted`] ? "处理中..." : "标记已报价"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(item.id, "archive")}
                            disabled={actionLoading[`${item.id}:archive`]}
                            style={{ opacity: 0.7 }}
                          >
                            {actionLoading[`${item.id}:archive`] ? "处理中..." : "标记无效"}
                          </button>
                        </div>
                      </div>
                  </article>
                ))}
              </div>
            )}

            {!activeSummary && remainingTaskCount > 0 && (
              <div className="actions" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
                <span className="notice">还有 {remainingTaskCount} 个任务</span>
                <Link href="/tasks">查看全部任务</Link>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
