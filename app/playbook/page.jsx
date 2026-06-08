"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";

const filterFields = [
  { key: "customer_type", label: "客户类型" },
  { key: "stage", label: "阶段" },
  { key: "problem", label: "问题" },
  { key: "reply_tag", label: "话术标签" },
  { key: "result", label: "结果" }
];

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))];
}

export default function PlaybookPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState({
    customer_type: "",
    stage: "",
    problem: "",
    reply_tag: "",
    result: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCases() {
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
        .from("playbook_cases")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
      } else {
        setCases(rows || []);
      }
      setLoading(false);
    }

    loadCases();
  }, [supabase]);

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      return filterFields.every(({ key }) => !filters[key] || item[key] === filters[key]);
    });
  }, [cases, filters]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Playbook Cases</p>
          <h1>有效案例库</h1>
          <p>沉淀有效话术，后续 AI 分析会自动参考相似案例。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/playbook">有效案例库</Link>
        </nav>
      </header>

      {session ? <div className="auth-card">已登录：{session.user.email}</div> : <div className="auth-card">请先回到客户录入页登录邮箱账号。</div>}
      {loading && <section className="panel">加载有效案例中...</section>}
      {error && <div className="error">{error}</div>}

      {!loading && session && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>筛选</h2>
              <span>{filteredCases.length} / {cases.length} 条案例</span>
            </div>
            <div className="filter-grid">
              {filterFields.map(({ key, label }) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <select value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)}>
                    <option value="">全部</option>
                    {uniqueValues(cases, key).map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="panel playbook-list">
            <div className="section-title">
              <h2>案例列表</h2>
              <span>只展示你保存的案例</span>
            </div>
            {filteredCases.map((item) => (
              <article className="playbook-card" key={item.id}>
                <div className="card-title">
                  <strong>{item.scene_name || "未命名场景"}</strong>
                  <span>{item.reply_tag || "-"}</span>
                </div>
                <div className="case-meta">
                  <span>客户类型：{item.customer_type || "-"}</span>
                  <span>阶段：{item.stage || "-"}</span>
                  <span>问题：{item.problem || "-"}</span>
                  <span>结果：{item.result || "-"}</span>
                  <span>创建时间：{formatTime(item.created_at)}</span>
                </div>
                <h4>有效话术</h4>
                <p>{item.effective_reply || "无"}</p>
                {item.notes && (
                  <>
                    <h4>备注</h4>
                    <p>{item.notes}</p>
                  </>
                )}
              </article>
            ))}
            {filteredCases.length === 0 && <p className="empty">暂无有效案例</p>}
          </section>
        </>
      )}
    </main>
  );
}
