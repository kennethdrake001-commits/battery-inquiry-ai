"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../components/layout/AppNav";
import { getSupabaseBrowserClient } from "../lib/supabaseClient";
import { buildTaskRows } from "../lib/taskWorkflow";
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
      <div className="demo-entry">
        <Link className="primary demo-entry-button" href="/test/workflow">
          免登录体验 Demo
          <span>直接查看公开测试页面</span>
        </Link>
        <p className="notice">无需登录即可查看示例客户和今日跟进流程。</p>
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

function localizeNextAction(action = "") {
  const text = `${action}`.trim();
  if (!text) return "暂无动作";

  const normalized = text.toLowerCase();

  if (normalized === "no action" || text === "暂无动作") return "暂无动作";
  if (normalized.includes("follow up quotation after 2 days")) return "报价后第 2 天跟进客户";
  if (normalized.includes("ask customer for order quantity and destination city/country before checking ddp shipping")) {
    return "先询问客户数量和目的城市/国家，再进行 DDP 运费核算";
  }
  if (normalized.includes("ask customer for order quantity")) return "询问客户订单数量";
  if (normalized.includes("ask customer for destination city/country")) return "询问客户目的城市和国家";
  if (normalized.includes("check ddp shipping cost")) return "核算 DDP 运费并确认清关配送成本";
  if (normalized.includes("send follow-up message")) return "发送跟进消息，推动客户回复";
  if (normalized.includes("ask customer") || normalized.includes("confirm whether")) return "询问客户更多需求信息";
  if (normalized.includes("send datasheet")) return "发送规格书、安装照片和兼容性资料";
  if (normalized.includes("send product catalog") || normalized.includes("wholesale")) return "发送产品目录和批发供货资料";
  if (normalized.includes("logo") || normalized.includes("packaging") || normalized.includes("sample")) return "确认 logo、包装、MOQ 和样品要求";

  return text;
}

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const tasks = useMemo(() => buildTaskRows(customers), [customers]);

  const dashboardCards = useMemo(() => {
    return [
      {
        title: "今日待跟进",
        count: tasks.length,
        subtitle: "来自当前客户流程的实际动作"
      },
      {
        title: "今日待开发",
        count: customers.filter((customer) => getProspectingLane(customer) === "待开发").length,
        subtitle: "今天可以主动触达的客户"
      },
      {
        title: "A级高价值客户",
        count: customers.filter((customer) => getLeadLevel(customer) === "A").length,
        subtitle: "需要优先处理和重点关注"
      },
      {
        title: "已报价待回复",
        count: customers.filter((customer) => {
          const stage = getStageValue(customer);
          return stage === "Quoted" || stage === "Waiting Reply" || customer.current_status === "已报价未回复";
        }).length,
        subtitle: "报价已发出，等待客户反馈"
      },
      {
        title: "合作商候选",
        count: customers.filter((customer) => isPartnerCandidate(customer)).length,
        subtitle: "重点看渠道、经销、贴牌机会"
      },
      {
        title: "C端待筛选",
        count: customers.filter((customer) => isConsumerCandidate(customer)).length,
        subtitle: "终端用户或待判断客户"
      }
    ];
  }, [customers, tasks]);

  const actionRows = useMemo(() => {
    return tasks.slice(0, 5).map((task) => {
      const customer = customers.find((item) => item.id === task.id) || null;
      return {
        id: task.id,
        priority: getTaskPriority(task, customer),
        customerName: task.customer_name,
        customerType: getCustomerTypeLabel(getCustomerTypeValue(customer || task)),
        currentStatus: getStageLabel(getStageValue(customer || task)),
        nextAction: localizeNextAction(task.current_next_action || getNextAction(customer || task))
      };
    });
  }, [customers, tasks]);

  const remainingTaskCount = Math.max(tasks.length - 5, 0);

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

      {session && (
        <section className="panel">
          <div className="notice-panel">
            <strong>新增客户入口</strong>
            <p>点击上方“新增客户”后，会进入新询盘分析页面，只展示新询盘分析相关字段；原始 workflow 字段不会在首页默认展开。</p>
          </div>
        </section>
      )}

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
                <SummaryCard key={card.title} title={card.title} count={card.count} subtitle={card.subtitle} />
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
    </main>
  );
}
