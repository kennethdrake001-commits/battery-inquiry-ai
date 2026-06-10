"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TaskListPanel from "../../components/tasks/TaskListPanel";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { buildTaskRows } from "../../lib/taskWorkflow";

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到客户录入页登录邮箱账号。</div>;
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
        <TaskListPanel tasks={tasks} hrefForTask={(task) => `/customers/${task.id}`} />
      )}
    </main>
  );
}
