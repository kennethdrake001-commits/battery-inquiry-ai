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
      <div className="auth-card">
        <span>已登录：{session.user.email}</span>
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

function SummaryCard({ title, count, subtitle }) {
  return (
    <article className="notice-panel">
      <strong>{title}</strong>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginTop: 8 }}>{count}</div>
      <p>{subtitle}</p>
    </article>
  );
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
        subtitle: "今天应该处理的客户推进事项",
        customers: mapSummaryCustomers(todayFollowUpCustomers)
      },
      {
        key: "new-lead",
        title: "新线索待筛选",
        subtitle: "刚进入系统，待判断价值与类型",
        customers: mapSummaryCustomers(newLeadCustomers)
      },
      {
        key: "linkedin-connected",
        title: "LinkedIn 已通过未私信",
        subtitle: "适合立刻发 LinkedIn 破冰私信",
        customers: mapSummaryCustomers(linkedinConnectedCustomers)
      },
      {
        key: "facebook-message-sent",
        title: "FB 已私信未回复",
        subtitle: "需要按节奏继续跟进 FB 对话",
        customers: mapSummaryCustomers(facebookMessageSentCustomers)
      },
      {
        key: "has-need",
        title: "有需求未报价",
        subtitle: "已有明确需求，但还没推进到报价",
        customers: mapSummaryCustomers(hasNeedCustomers)
      },
      {
        key: "quoted-follow-up",
        title: "已报价待跟进",
        subtitle: "报价已发出，需要跟进反馈",
        customers: mapSummaryCustomers(quotedFollowUpCustomers)
      },
      {
        key: "high-potential",
        title: "高潜客户",
        subtitle: "安装商/经销商类高价值推进客户",
        customers: mapSummaryCustomers(highPotentialCustomers)
      }
    ];
  }, [leadProgressCustomers]);

  const dashboardCards = useMemo(() => {
    return summaryGroups.map((group) => ({
      key: group.key,
      title: group.title,
      count: group.customers.length,
      subtitle: group.subtitle
    }));
  }, [summaryGroups]);

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
        nextAction: formatNextActionForDisplay(task.current_next_action || getNextAction(customer || task))
      };
    });
  }, [tasks, visibleCustomers]);

  const remainingTaskCount = Math.max(tasks.length - 5, 0);
  const activeSummary = summaryGroups.find((group) => group.key === activeSummaryKey) || null;

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
              <h2>核心提醒</h2>
              <span>只看今天真正要处理的事情</span>
            </div>
            <div className="task-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {dashboardCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setActiveSummaryKey(card.key)}
                  style={{ all: "unset", cursor: "pointer", display: "block" }}
                  aria-label={`查看${card.title}客户列表`}
                >
                  <SummaryCard title={card.title} count={card.count} subtitle={card.subtitle} />
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>今日行动列表</h2>
              <div className="actions compact">
                <Link href="/tasks">查看全部任务</Link>
              </div>
            </div>

            {loading ? (
              <p className="empty">加载中...</p>
            ) : actionRows.length === 0 ? (
              <p className="empty">今天暂时没有待处理动作。</p>
            ) : (
              <div className="table-wrap">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>优先级</th>
                      <th>客户名</th>
                      <th>客户类型</th>
                      <th>当前状态</th>
                      <th>下一步动作</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionRows.map((item) => (
                      <tr key={item.id}>
                        <td><span className={`priority-badge priority-${item.priority}`}>{item.priority}</span></td>
                        <td>{item.customerName}</td>
                        <td>{item.customerType}</td>
                        <td>{item.currentStatus}</td>
                        <td className="truncate-cell">{item.nextAction}</td>
                        <td>
                          <Link href={`/customers/${item.id}`}>进入处理</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {remainingTaskCount > 0 && (
              <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="notice">还有 {remainingTaskCount} 个任务</span>
                <Link href="/tasks">查看全部任务</Link>
              </div>
            )}
          </section>
        </>
      )}

      {session && activeSummary && (
        <div className="modal-backdrop">
          <div
            className="modal wide-modal"
            style={{ maxWidth: 860, width: "min(860px, calc(100vw - 32px))", maxHeight: "80vh", overflow: "auto" }}
          >
            <div className="section-title" style={{ marginBottom: 16 }}>
              <h2>{activeSummary.title}</h2>
              <button onClick={() => setActiveSummaryKey("")}>关闭</button>
            </div>

            {activeSummary.customers.length === 0 ? (
              <p className="empty">暂无对应客户</p>
            ) : (
              <div className="table-wrap">
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>客户名</th>
                      <th>国家</th>
                      <th>客户类型</th>
                      <th>当前状态</th>
                      <th>下一步动作</th>
                      <th>跟进日期</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSummary.customers.map((item) => (
                      <tr key={item.id}>
                        <td>{item.customerName}</td>
                        <td>{item.country}</td>
                        <td>{item.customerType}</td>
                        <td>{item.currentStatus}</td>
                        <td className="truncate-cell">{item.nextAction}</td>
                        <td>{item.followUpDate}</td>
                        <td>
                          <Link href={`/customers/${item.id}`}>进入处理</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
