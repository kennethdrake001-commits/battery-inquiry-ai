"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/layout/AppNav";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import {
  getCustomerName,
  getCustomerTypeLabel,
  getCustomerTypeValue,
  getLeadLevel,
  getNextAction,
  getProspectingLane
} from "../../lib/customerViews";

const lanes = ["待开发", "已联系", "已回复", "可推进"];

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到工作台登录邮箱账号。</div>;
}

export default function ProspectingPage() {
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

  const groups = useMemo(() => {
    const map = Object.fromEntries(lanes.map((lane) => [lane, []]));
    customers.forEach((customer) => {
      map[getProspectingLane(customer)].push(customer);
    });
    return map;
  }, [customers]);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">主动开发</p>
          <h1>主动开发看板</h1>
          <p>用看板跟踪主动开发进度，不在这里堆完整客户资料。</p>
        </div>
        <AppNav />
      </header>

      <AuthNotice session={session} />
      {loading && <section className="panel">加载中...</section>}
      {error && <div className="error">{error}</div>}

      {!loading && session && (
        <section className="board">
          {lanes.map((lane) => (
            <div className="stage-column" key={lane}>
              <h2>{lane}</h2>
              <div className="card-list">
                {(groups[lane] || []).map((customer) => (
                  <article className="customer-card" key={customer.id}>
                    <strong>{getCustomerName(customer)}</strong>
                    <p>国家：{customer.country || "-"}</p>
                    <p>客户类型：{getCustomerTypeLabel(getCustomerTypeValue(customer))}</p>
                    <p>客户等级：{getLeadLevel(customer)}</p>
                    <p className="action-text">{getNextAction(customer)}</p>
                    <div className="actions compact">
                      <Link href={`/customers/${customer.id}`}>查看客户</Link>
                    </div>
                  </article>
                ))}
                {(groups[lane] || []).length === 0 && <p className="empty">暂无客户</p>}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
