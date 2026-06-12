"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/layout/AppNav";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { formatDateTime } from "../../lib/followUp";
import { getQuoteStatus } from "../../lib/customerViews";

export default function QuotesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [customersById, setCustomersById] = useState({});
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

      const [{ data: quoteRows, error: quoteError }, { data: customerRows, error: customerError }] = await Promise.all([
        supabase.from("quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("*")
      ]);

      if (quoteError || customerError) {
        setError(quoteError?.message || customerError?.message || "加载报价失败");
      } else {
        setQuotes(quoteRows || []);
        setCustomersById(Object.fromEntries((customerRows || []).map((item) => [item.id, item])));
      }
      setLoading(false);
    }

    init();
  }, [supabase]);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">报价</p>
          <h1>报价管理</h1>
          <p>这里只管理报价本身，不混入过多客户开发信息。</p>
        </div>
        <AppNav />
      </header>

      {loading && <section className="panel">加载报价中...</section>}
      {error && <div className="error">{error}</div>}

      {!loading && session && (
        <section className="panel">
          <div className="section-title">
            <h2>报价列表</h2>
            <span>{quotes.length} 条报价记录</span>
          </div>
          <div className="table-wrap">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>客户名</th>
                  <th>报价产品</th>
                  <th>报价金额</th>
                  <th>贸易条款</th>
                  <th>报价状态</th>
                  <th>报价时间</th>
                  <th>下次跟进时间</th>
                  <th>查看</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => {
                  const customer = customersById[quote.customer_id];
                  return (
                    <tr key={quote.id}>
                      <td>{customer?.customer_name || "未知客户"}</td>
                      <td>{quote.product || "-"}</td>
                      <td>{quote.total_price || quote.unit_price || "-"}</td>
                      <td>{quote.trade_term || "-"}</td>
                      <td>{getQuoteStatus(quote, customer)}</td>
                      <td>{formatDateTime(quote.created_at)}</td>
                      <td>{customer?.next_follow_up_at ? formatDateTime(customer.next_follow_up_at) : (customer?.follow_up_date || "-")}</td>
                      <td>{customer ? <Link href={`/customers/${customer.id}`}>查看</Link> : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {quotes.length === 0 && <p className="empty">暂无报价记录</p>}
        </section>
      )}
    </main>
  );
}
