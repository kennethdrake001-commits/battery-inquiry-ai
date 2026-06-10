"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { daysSince, formatDateTime, hoursSince } from "../../lib/followUp";

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到客户录入页登录邮箱账号。</div>;
}

function formatTaskReason(reasons) {
  return reasons.join(" / ");
}

function buildTaskRows(customers) {
  const now = new Date();

  return customers
    .map((customer) => {
      const analysis = customer.latest_analysis || {};
      const stage = customer.stage || analysis.stage || customer.current_status || "新询盘";
      const customerLevel = customer.lead_level || analysis.customerLevel || "C";
      const reasons = [];

      const nextFollowUpAt = customer.next_follow_up_at
        ? new Date(customer.next_follow_up_at)
        : customer.follow_up_date
          ? new Date(`${customer.follow_up_date}T09:00:00.000Z`)
          : null;
      if (nextFollowUpAt && nextFollowUpAt <= now) {
        reasons.push("今天到期跟进");
      }

      const quoteDays = daysSince(customer.last_quote_at, now);
      const replyAfterQuote =
        customer.last_quote_at &&
        customer.last_customer_reply_at &&
        new Date(customer.last_customer_reply_at).getTime() >= new Date(customer.last_quote_at).getTime();
      if (
        (stage === "已报价未回复" || stage === "Quoted" || stage === "Waiting Reply") &&
        quoteDays !== null &&
        quoteDays >= 2 &&
        quoteDays <= 4 &&
        !replyAfterQuote
      ) {
        reasons.push("已报价 2-4 天未回复");
      }

      if (stage === "PI付款" || stage === "Trial Order") {
        reasons.push("PI 发出但未付款");
      }

      if (
        customer.last_customer_reply_at &&
        (!customer.last_contacted_at ||
          new Date(customer.last_customer_reply_at).getTime() > new Date(customer.last_contacted_at).getTime())
      ) {
        reasons.push("客户有新回复但未处理");
      }

      const lastFollowUpHours = hoursSince(customer.last_contacted_at || customer.updated_at || customer.created_at, now);
      if (customerLevel === "A" && lastFollowUpHours !== null && lastFollowUpHours > 24) {
        reasons.push("A 级客户超过 24 小时未跟进");
      }

      const newInquiryHours = hoursSince(customer.created_at, now);
      if ((stage === "新询盘" || stage === "New Inquiry") && !customer.last_contacted_at && newInquiryHours !== null && newInquiryHours > 2) {
        reasons.push("新询盘超过 2 小时未处理");
      }

      if (reasons.length === 0) return null;

      return {
        id: customer.id,
        customer_name: customer.customer_name || "未命名客户",
        country: customer.country || "未知国家",
        customer_type: customer.customer_type || analysis.customerType || "Unknown",
        customer_level: customerLevel,
        stage,
        main_blocker: analysis.mainBlocker || "其他",
        current_next_action: customer.next_action || customer.current_next_action || analysis.suggestedAction || "暂无动作",
        next_follow_up_at: customer.next_follow_up_at || (customer.follow_up_date ? `${customer.follow_up_date}T09:00:00.000Z` : null),
        task_reason: formatTaskReason(reasons)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

function TaskCard({ task }) {
  return (
    <Link className="task-card" href={`/customers/${task.id}`}>
      <div className="card-title">
        <strong>{task.customer_name}</strong>
        <span className={`level level-${task.customer_level || "D"}`}>{task.customer_level || "-"}</span>
      </div>
      <p className="muted">{task.country}</p>
      <p>客户类型：{task.customer_type}</p>
      <p>当前阶段：{task.stage}</p>
      <p>主要卡点：{task.main_blocker}</p>
      <p>当前动作：{task.current_next_action}</p>
      <p>下次跟进：{formatDateTime(task.next_follow_up_at)}</p>
      <p className="task-reason">{task.task_reason}</p>
    </Link>
  );
}

export default function TasksPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
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

  const tasks = useMemo(() => buildTaskRows(customers), [customers]);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Today Follow-up Tasks</p>
          <h1>今日跟进任务</h1>
          <p>集中查看今天优先需要处理的客户。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/playbook">有效案例库</Link>
          <Link href="/products">产品知识库</Link>
          <Link href="/system-checker">系统搭配校验器</Link>
          <Link href="/tasks">今日任务</Link>
        </nav>
      </header>

      <AuthNotice session={session} />

      {loading && <section className="panel">加载任务中...</section>}
      {error && <div className="error">{error}</div>}

      {!loading && session && (
        <section className="panel">
          <div className="section-title">
            <h2>任务列表</h2>
            <span>{tasks.length} 条需要处理</span>
          </div>
          <div className="task-grid">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
            {tasks.length === 0 && <p className="empty">今天暂时没有需要处理的跟进任务。</p>}
          </div>
        </section>
      )}
    </main>
  );
}
