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
  getLeadLevel,
  getNextAction,
  getProspectingLane,
  getStageLabel,
  getStageValue,
  getTaskPriority,
  isConsumerCandidate,
  isPartnerCandidate
} from "../lib/customerViews";

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

function isProspectingCustomer(customer) {
  const source = String(customer?.source || "").trim().toLowerCase();
  const customerSource = String(customer?.customer_source || "").trim().toLowerCase();
  const stage = String(customer?.stage || "").trim().toLowerCase();
  const currentStatus = String(customer?.current_status || "").trim().toLowerCase();
  const customerType = String(customer?.customer_type || "").trim();

  return source === "主动开发"
    || customerSource === "主动开发"
    || stage === "prospecting"
    || currentStatus === "prospecting"
    || (customerType === "太阳能经销商" && source === "主动开发");
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

  const activeCustomers = useMemo(() => {
    return customers.filter((customer) => !isArchivedCustomer(customer) && !isProspectingCustomer(customer));
  }, [customers]);

  const tasks = useMemo(() => buildTaskRows(activeCustomers), [activeCustomers]);

  const taskCustomers = useMemo(() => {
    return tasks.map((task) => {
      const customer = activeCustomers.find((item) => item.id === task.id) || null;
      return {
        id: task.id,
        customerName: task.customer_name,
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer || task)),
        currentStatus: getStageLabel(getStageValue(customer || task)),
        nextAction: formatNextActionForDisplay(task.current_next_action || getNextAction(customer || task)),
        followUpDate: formatDateOnly(task.next_follow_up_at || customer?.next_follow_up_at || customer?.follow_up_date)
      };
    });
  }, [activeCustomers, tasks]);

  const developingCustomers = useMemo(() => {
    return activeCustomers
      .filter((customer) => getProspectingLane(customer) === "待开发")
      .map((customer) => ({
        id: customer.id,
        customerName: getCustomerName(customer),
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
        currentStatus: getStageLabel(getStageValue(customer)),
        nextAction: formatNextActionForDisplay(customer.current_next_action || getNextAction(customer)),
        followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)
      }));
  }, [activeCustomers]);

  const highValueCustomers = useMemo(() => {
    return activeCustomers
      .filter((customer) => getLeadLevel(customer) === "A")
      .map((customer) => ({
        id: customer.id,
        customerName: getCustomerName(customer),
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
        currentStatus: getStageLabel(getStageValue(customer)),
        nextAction: formatNextActionForDisplay(customer.current_next_action || getNextAction(customer)),
        followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)
      }));
  }, [activeCustomers]);

  const quotedWaitingCustomers = useMemo(() => {
    return activeCustomers
      .filter((customer) => {
        const stage = getStageValue(customer);
        return stage === "Quoted" || stage === "Waiting Reply" || customer.current_status === "已报价未回复";
      })
      .map((customer) => ({
        id: customer.id,
        customerName: getCustomerName(customer),
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
        currentStatus: getStageLabel(getStageValue(customer)),
        nextAction: formatNextActionForDisplay(customer.current_next_action || getNextAction(customer)),
        followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)
      }));
  }, [activeCustomers]);

  const partnerCandidateCustomers = useMemo(() => {
    return activeCustomers
      .filter((customer) => isPartnerCandidate(customer))
      .map((customer) => ({
        id: customer.id,
        customerName: getCustomerName(customer),
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
        currentStatus: getStageLabel(getStageValue(customer)),
        nextAction: formatNextActionForDisplay(customer.current_next_action || getNextAction(customer)),
        followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)
      }));
  }, [activeCustomers]);

  const consumerCandidateCustomers = useMemo(() => {
    return activeCustomers
      .filter((customer) => isConsumerCandidate(customer))
      .map((customer) => ({
        id: customer.id,
        customerName: getCustomerName(customer),
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer)),
        currentStatus: getStageLabel(getStageValue(customer)),
        nextAction: formatNextActionForDisplay(customer.current_next_action || getNextAction(customer)),
        followUpDate: formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)
      }));
  }, [activeCustomers]);

  const summaryGroups = useMemo(() => {
    return [
      {
        key: "today-follow-up",
        title: "今日待跟进",
        subtitle: "来自当前客户流程的实际动作",
        customers: taskCustomers
      },
      {
        key: "today-develop",
        title: "今日待开发",
        subtitle: "今天可以主动触达的客户",
        customers: developingCustomers
      },
      {
        key: "high-value",
        title: "A级高价值客户",
        subtitle: "需要优先处理和重点关注",
        customers: highValueCustomers
      },
      {
        key: "quoted-waiting",
        title: "已报价待回复",
        subtitle: "报价已发出，等待客户反馈",
        customers: quotedWaitingCustomers
      },
      {
        key: "partner-candidate",
        title: "合作商候选",
        subtitle: "重点看渠道、经销、贴牌机会",
        customers: partnerCandidateCustomers
      },
      {
        key: "consumer-candidate",
        title: "C端待筛选",
        subtitle: "终端用户或待判断客户",
        customers: consumerCandidateCustomers
      }
    ];
  }, [
    taskCustomers,
    developingCustomers,
    highValueCustomers,
    quotedWaitingCustomers,
    partnerCandidateCustomers,
    consumerCandidateCustomers
  ]);

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
      const customer = activeCustomers.find((item) => item.id === task.id) || null;
      return {
        id: task.id,
        priority: getTaskPriority(task, customer),
        customerName: task.customer_name,
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer || task)),
        currentStatus: getStageLabel(getStageValue(customer || task)),
        nextAction: formatNextActionForDisplay(task.current_next_action || getNextAction(customer || task))
      };
    });
  }, [activeCustomers, tasks]);

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
            <div className="task-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
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
