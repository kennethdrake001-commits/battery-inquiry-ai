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
  getLeadProgressStageValue,
  isClosedLeadStage,
  isHighPotentialLead,
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
          <Link className="primary" href="/customers/new">新增客户</Link>
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
      border: isActive ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(245, 158, 11, 0.14)",
      background: isActive ? "linear-gradient(180deg, #fff9f1 0%, #fffdf8 100%)" : "#fffdfa",
      shadow: isActive ? "0 10px 22px rgba(245, 158, 11, 0.1)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
      accent: "#b45309"
    },
    value: {
      border: isActive ? "1px solid rgba(52, 211, 153, 0.42)" : "1px solid rgba(52, 211, 153, 0.14)",
      background: isActive ? "linear-gradient(180deg, #effcf6 0%, #f7fffb 100%)" : "#f7fffb",
      shadow: isActive ? "0 10px 22px rgba(16, 185, 129, 0.1)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
      accent: "#047857"
    },
    channel: {
      border: isActive ? "1px solid rgba(96, 165, 250, 0.42)" : "1px solid rgba(96, 165, 250, 0.16)",
      background: isActive ? "linear-gradient(180deg, #f3f8ff 0%, #f8fbff 100%)" : "#f8fbff",
      shadow: isActive ? "0 10px 22px rgba(59, 130, 246, 0.09)" : "0 4px 12px rgba(15, 23, 42, 0.04)",
      accent: "#1d4ed8"
    }
  };
  return appearanceMap[kind] || appearanceMap.channel;
}

function getSelectedBadgeStyle(kind) {
  const colorMap = {
    urgent: {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#b45309",
      border: "1px solid rgba(245, 158, 11, 0.24)"
    },
    value: {
      background: "rgba(16, 185, 129, 0.12)",
      color: "#047857",
      border: "1px solid rgba(16, 185, 129, 0.24)"
    },
    channel: {
      background: "rgba(59, 130, 246, 0.12)",
      color: "#1d4ed8",
      border: "1px solid rgba(59, 130, 246, 0.24)"
    }
  };
  return colorMap[kind] || colorMap.channel;
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

function isDueForFollowUp(customer, today = new Date()) {
  const dateValue = customer?.next_follow_up_at || customer?.follow_up_date;
  if (!dateValue) return false;
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
  const [activeSummaryKey, setActiveSummaryKey] = useState("");

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
        setLoading(false);
        return;
      }

      setLoading(true);
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
      setLoading(false);
    }

    loadCustomers();
  }, [supabase, session]);

  const visibleCustomers = useMemo(() => {
    return customers.filter((customer) => !isArchivedCustomer(customer));
  }, [customers]);

  const leadProgressCustomers = useMemo(() => {
    return visibleCustomers.filter((customer) => isLeadProgressCustomer(customer));
  }, [visibleCustomers]);

  const tasks = useMemo(() => buildTaskRows(visibleCustomers), [visibleCustomers]);

  function mapSummaryCustomers(list) {
    return list.map((customer) => ({
      id: customer.id,
      customerName: getCustomerName(customer),
      country: customer.country || "待补充",
      customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
      currentStatus: isLeadProgressCustomer(customer)
        ? getLeadProgressStageLabel(customer)
        : getStageLabel(getStageValue(customer)),
      nextAction: formatNextActionForDisplay(customer.current_next_action || customer.next_action || getNextAction(customer)),
      followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)
    }));
  }

  const summaryGroups = useMemo(() => {
    const todayFollowUpCustomers = leadProgressCustomers.filter((customer) => {
      return !isClosedLeadStage(customer) && isDueForFollowUp(customer);
    });
    const newLeadCustomers = leadProgressCustomers.filter((customer) => getLeadProgressStageValue(customer) === "new_lead");
    const linkedinConnectedCustomers = leadProgressCustomers.filter((customer) => `${customer.linkedin_status || ""}` === "connected");
    const facebookMessageSentCustomers = leadProgressCustomers.filter((customer) => `${customer.facebook_status || ""}` === "message_sent");
    const hasNeedCustomers = leadProgressCustomers.filter((customer) => getLeadProgressStageValue(customer) === "has_need");
    const quotedFollowUpCustomers = leadProgressCustomers.filter((customer) => {
      return getLeadProgressStageValue(customer) === "quoted" || `${customer.email_status || ""}` === "quotation_sent";
    });
    const highPotentialCustomers = leadProgressCustomers.filter((customer) => isHighPotentialLead(customer));

    return [
      {
        key: "today-follow-up",
        title: "今日待跟进",
        subtitle: todayFollowUpCustomers.length === 0 ? "今天暂无待跟进客户" : "今天应该优先处理的跟进事项",
        listTitle: "今日待跟进客户",
        appearance: "urgent",
        reason: "今天需要跟进",
        customers: mapSummaryCustomers(todayFollowUpCustomers)
      },
      {
        key: "has-need",
        title: "有需求未报价",
        subtitle: hasNeedCustomers.length === 0 ? "暂无未报价需求" : "客户已有明确需求，应尽快准备报价",
        listTitle: "有需求未报价客户",
        appearance: "urgent",
        reason: "客户有需求但还没报价",
        customers: mapSummaryCustomers(hasNeedCustomers)
      },
      {
        key: "quoted-follow-up",
        title: "已报价待跟进",
        subtitle: quotedFollowUpCustomers.length === 0 ? "报价已发送后，会在这里提醒跟进" : "报价已发出，需要跟进反馈",
        listTitle: "已报价待跟进客户",
        appearance: "urgent",
        reason: "报价已发送，需要跟进反馈",
        customers: mapSummaryCustomers(quotedFollowUpCustomers)
      },
      {
        key: "high-potential",
        title: "高潜客户",
        subtitle: highPotentialCustomers.length === 0 ? "暂无高潜客户" : "安装商/经销商类高价值推进客户",
        listTitle: "高潜客户",
        appearance: "value",
        reason: "安装商/经销商类高价值推进客户",
        customers: mapSummaryCustomers(highPotentialCustomers)
      },
      {
        key: "new-lead",
        title: "新线索待筛选",
        subtitle: newLeadCustomers.length === 0 ? "暂无待筛选新线索" : "刚进入系统，待判断价值与类型",
        listTitle: "新线索待筛选客户",
        appearance: "channel",
        reason: "新线索，待判断价值与类型",
        customers: mapSummaryCustomers(newLeadCustomers)
      },
      {
        key: "linkedin-connected",
        title: "LinkedIn 已通过未私信",
        subtitle: linkedinConnectedCustomers.length === 0 ? "暂无待发 LinkedIn 私信客户" : "适合立刻发 LinkedIn 破冰私信",
        listTitle: "LinkedIn 已通过未私信客户",
        appearance: "channel",
        reason: "LinkedIn 已通过但还未发送破冰私信",
        customers: mapSummaryCustomers(linkedinConnectedCustomers)
      },
      {
        key: "facebook-message-sent",
        title: "FB 已私信未回复",
        subtitle: facebookMessageSentCustomers.length === 0 ? "暂无待跟进 FB 对话" : "需要按节奏继续跟进 FB 对话",
        listTitle: "FB 已私信未回复客户",
        appearance: "channel",
        reason: "FB 已私信但还未回复",
        customers: mapSummaryCustomers(facebookMessageSentCustomers)
      }
    ];
  }, [leadProgressCustomers]);

  const priorityCards = useMemo(() => summaryGroups.slice(0, 4), [summaryGroups]);
  const leadActionCards = useMemo(() => summaryGroups.slice(4), [summaryGroups]);

  const actionRows = useMemo(() => {
    return tasks.slice(0, 5).map((task) => {
      const customer = visibleCustomers.find((item) => item.id === task.id) || null;
      return {
        id: task.id,
        priority: getTaskPriority(task, customer),
        customerName: task.customer_name,
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer || task)),
        currentStatus: customer && isLeadProgressCustomer(customer)
          ? getLeadProgressStageLabel(customer)
          : getStageLabel(getStageValue(customer || task)),
        nextAction: formatNextActionForDisplay(task.current_next_action || getNextAction(customer || task)),
        followUpDate: formatDateOnly((customer && (customer.next_follow_up_at || customer.follow_up_date)) || task.next_follow_up_at),
        reason: task.task_reason || "根据当前推进建议执行"
      };
    });
  }, [tasks, visibleCustomers]);

  const remainingTaskCount = Math.max(tasks.length - 5, 0);
  const activeSummary = summaryGroups.find((group) => group.key === activeSummaryKey) || null;
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
    customerType: item.customerType,
    currentStatus: item.currentStatus,
    nextAction: item.nextAction,
    followUpDate: item.followUpDate || "待安排",
    reason: item.reason || selectedActionGroup.reason || "根据当前推进建议执行"
  }));

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">工作台</p>
          <h1>销售工作台</h1>
          <p>首页只保留今日行动和关键提醒，先知道今天该做什么。</p>
        </div>
        <AppNav />
      </header>

      <AuthPanel session={session} onSessionChange={setSession} />

      {error && <div className="error">{error}</div>}

      {session && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>今日优先处理</h2>
              <span>先处理最影响成交推进的客户</span>
            </div>
            <div className="task-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
              {priorityCards.map((card) => {
                const appearance = getCardAppearance(card.appearance, activeSummaryKey === card.key);
                const isActive = activeSummaryKey === card.key;
                const selectedBadge = getSelectedBadgeStyle(card.appearance);
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
                      minHeight: 128,
                      borderRadius: 20,
                      padding: "16px 18px",
                      transition: "all 0.2s ease",
                      position: "relative",
                      transform: isActive ? "translateY(-1px)" : "none"
                    }}
                  >
                    {isActive && (
                      <span
                        style={{
                          position: "absolute",
                          top: 14,
                          right: 14,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: selectedBadge.background,
                          color: selectedBadge.color,
                          border: selectedBadge.border
                        }}
                      >
                        当前筛选
                      </span>
                    )}
                    {card.customers.length > 0 && (
                      <span
                        style={{
                          position: "absolute",
                          top: isActive ? 44 : 14,
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
                        {card.key === "high-potential" ? "优先关注" : "建议处理"}
                      </span>
                    )}
                    <strong style={{ color: appearance.accent, display: "block", paddingRight: card.customers.length > 0 ? 84 : 0 }}>{card.title}</strong>
                    <div style={{ fontSize: card.customers.length > 0 ? 38 : 32, fontWeight: 800, lineHeight: 1.05, marginTop: 8, color: "#111827" }}>
                      {card.customers.length}
                    </div>
                    <p style={{ marginTop: 8, color: "#475569", lineHeight: 1.45 }}>{card.subtitle}</p>
                  </article>
                </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>获客动作提醒</h2>
              <span>多渠道触达客户后，按节奏推进互动</span>
            </div>
            <div className="task-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              {leadActionCards.map((card) => {
                const appearance = getCardAppearance(card.appearance, activeSummaryKey === card.key);
                const isActive = activeSummaryKey === card.key;
                const selectedBadge = getSelectedBadgeStyle(card.appearance);
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
                        minHeight: 110,
                        borderRadius: 18,
                        padding: "14px 16px",
                        transition: "all 0.2s ease",
                        position: "relative",
                        transform: isActive ? "translateY(-1px)" : "none"
                      }}
                    >
                      {isActive && (
                        <span
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 7px",
                            borderRadius: 999,
                            background: selectedBadge.background,
                            color: selectedBadge.color,
                            border: selectedBadge.border
                          }}
                        >
                          当前筛选
                        </span>
                      )}
                      {card.customers.length > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: isActive ? 38 : 12,
                            right: 12,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 7px",
                            borderRadius: 999,
                            background: isActive ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.66)",
                            color: appearance.accent
                          }}
                        >
                          待处理
                        </span>
                      )}
                      <strong style={{ color: appearance.accent }}>{card.title}</strong>
                      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, marginTop: 6, color: "#111827" }}>
                        {card.customers.length}
                      </div>
                      <p style={{ marginTop: 6, color: "#64748b", lineHeight: 1.4 }}>{card.subtitle}</p>
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
                <span>打开今天该处理的客户，直接进入推进</span>
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
                          <span className="soft-badge">{item.customerType}</span>
                          <span className="soft-badge">{item.currentStatus}</span>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div><strong>下一步动作：</strong>{item.nextAction || "暂无动作"}</div>
                          <div><strong>提醒原因：</strong>{item.reason}</div>
                          <div><strong>跟进日期：</strong>{item.followUpDate}</div>
                        </div>
                      </div>
                      <div className="actions compact" style={{ justifyContent: "flex-end", flex: "0 1 auto" }}>
                        <Link className="primary" href={`/customers/${item.id}`}>进入处理</Link>
                        <Link href={`/customers/${item.id}`}>设置跟进</Link>
                        <Link href={`/customers/${item.id}`}>标记已发资料</Link>
                        <Link href={`/customers/${item.id}`}>标记已报价</Link>
                        <Link href={`/customers/${item.id}`}>标记无效</Link>
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
