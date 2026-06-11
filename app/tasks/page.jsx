"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/layout/AppNav";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { buildTaskRows } from "../../lib/taskWorkflow";
import { formatDateTime } from "../../lib/followUp";
import { getTaskPriority } from "../../lib/customerViews";

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到工作台登录邮箱账号。</div>;
}

function getTaskTab(task) {
  if (!task.next_follow_up_at) return "today";
  const now = new Date();
  const target = new Date(task.next_follow_up_at);
  if (target.getTime() < now.getTime()) return "overdue";

  const diffDays = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) return "today";
  if (diffDays <= 7) return "week";
  return "week";
}

function getTaskReasonLabel(reason = "") {
  const text = `${reason}`.trim();
  if (!text) return "根据当前推进建议执行";
  if (text.includes("新询盘") && text.includes("2")) return "新询盘超过 2 小时未处理";
  if (text.includes("报价") && text.includes("回复")) return "报价后未回复";
  if (text.includes("待补") || text.includes("缺少")) return "待补信息";
  return text;
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

export default function TasksPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      const { data: rows, error: queryError } = await supabase
        .from("customers")
        .select("*")
        .order("updated_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
      } else {
        setCustomers(rows || []);
      }
      setLoading(false);
    }

    init();
  }, [supabase]);

  const allTasks = useMemo(() => buildTaskRows(customers), [customers]);

  const tasksByTab = useMemo(() => {
    return {
      today: allTasks.filter((task) => getTaskTab(task) === "today"),
      week: allTasks.filter((task) => getTaskTab(task) === "week"),
      overdue: allTasks.filter((task) => getTaskTab(task) === "overdue")
    };
  }, [allTasks]);

  const currentTasks = tasksByTab[activeTab] || [];

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">任务</p>
          <h1>任务中心</h1>
          <p>任务页只展示要做的动作，不混入完整客户资料。</p>
        </div>
        <AppNav />
      </header>

      <AuthNotice session={session} />

      {loading && <section className="panel">加载任务中...</section>}
      {error && <div className="error">{error}</div>}

      {!loading && session && (
        <section className="panel">
          <div className="section-title">
            <h2>任务列表</h2>
            <span>按时间分组查看待处理事项</span>
          </div>

          <div className="tabs">
            <button
              className={activeTab === "today" ? "primary" : ""}
              style={activeTab === "today" ? { border: "1px solid #155eef", color: "#fff" } : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
              onClick={() => setActiveTab("today")}
            >
              今日任务
            </button>
            <button
              className={activeTab === "week" ? "primary" : ""}
              style={activeTab === "week" ? { border: "1px solid #155eef", color: "#fff" } : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
              onClick={() => setActiveTab("week")}
            >
              本周任务
            </button>
            <button
              className={activeTab === "overdue" ? "primary" : ""}
              style={activeTab === "overdue" ? { border: "1px solid #155eef", color: "#fff" } : { border: "1px solid #dbe5f1", color: "#1d2433", background: "#f8fafc" }}
              onClick={() => setActiveTab("overdue")}
            >
              逾期任务
            </button>
          </div>

          {currentTasks.length === 0 ? (
            <p className="empty" style={{ marginTop: 20 }}>当前标签下暂无任务</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 20 }}>
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>客户名</th>
                    <th>任务类型</th>
                    <th>任务内容</th>
                    <th>优先级</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTasks.map((task) => (
                    <tr key={task.id}>
                      <td>{formatDateTime(task.next_follow_up_at)}</td>
                      <td>{task.customer_name}</td>
                      <td>{getTaskReasonLabel(task.task_reason)}</td>
                      <td className="truncate-cell">{localizeNextAction(task.current_next_action)}</td>
                      <td><span className={`priority-badge priority-${getTaskPriority(task)}`}>{getTaskPriority(task)}</span></td>
                      <td>
                        <div className="actions compact">
                          <Link href={`/customers/${task.id}`}>查看客户</Link>
                          <Link className="primary" href={`/customers/${task.id}`}>进入处理</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
