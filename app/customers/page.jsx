"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { boardStages } from "../../lib/options";

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到客户录入页登录邮箱账号。</div>;
}

function CustomerCard({ customer }) {
  const analysis = customer.latest_analysis || {};

  return (
    <Link className="customer-card" href={`/customers/${customer.id}`}>
      <div className="card-title">
        <strong>{customer.customer_name || "未命名客户"}</strong>
        <span className={`level level-${analysis.customerLevel || "D"}`}>{analysis.customerLevel || "-"}</span>
      </div>
      <p className="muted">{customer.country || "未知国家"} · {customer.source || "Unknown"}</p>
      <p>身份：{analysis.customerType || "Unknown"}</p>
      <p>评分：{analysis.customerScore ?? "-"}</p>
      <p>卡点：{analysis.mainBlocker || "其他"}</p>
      <p>下次跟进：{analysis.followUpTime || "-"}</p>
      <p className="action-text">{analysis.suggestedAction || "暂无建议动作"}</p>
      {analysis.needSupervisorReview === "是" && <p className="review">需主管复核：{analysis.reviewReason || "AI 建议复核"}</p>}
    </Link>
  );
}

export default function CustomersPage() {
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

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(boardStages.map((stage) => [stage, []]));
    customers.forEach((customer) => {
      const stage = customer.latest_analysis?.stage || customer.current_status || "新询盘";
      if (!groups[stage]) groups[stage] = [];
      groups[stage].push(customer);
    });
    return groups;
  }, [customers]);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Supabase Customers</p>
          <h1>客户列表页</h1>
          <p>按 AI 判断的当前阶段展示客户。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/customers">客户列表</Link>
        </nav>
      </header>

      <AuthNotice session={session} />

      {loading && <section className="panel">加载客户中...</section>}
      {error && <div className="error">{error}</div>}

      {!loading && session && (
        <section className="board">
          {boardStages.map((stage) => (
            <div className="stage-column" key={stage}>
              <h2>{stage}</h2>
              <div className="card-list">
                {(grouped[stage] || []).map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} />
                ))}
                {(grouped[stage] || []).length === 0 && <p className="empty">暂无客户</p>}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
