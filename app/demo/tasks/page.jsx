"use client";

import Link from "next/link";
import CustomerStageBadge from "../../../components/workflow/CustomerStageBadge";
import LeadLevelBadge from "../../../components/workflow/LeadLevelBadge";
import { formatDateTime } from "../../../lib/followUp";

const demoTasks = [
  {
    id: "demo-1",
    customer_name: "Mariam",
    country: "Kenya",
    customer_type: "End User",
    customer_level: "B",
    stage: "新询盘",
    main_blocker: "需求不清",
    current_next_action: "2 小时内先确认用途、负载和数量",
    next_follow_up_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    task_reason: "新询盘超过 2 小时未处理"
  },
  {
    id: "demo-2",
    customer_name: "Ahmed Solar",
    country: "Egypt",
    customer_type: "Installer",
    customer_level: "A",
    stage: "已报价未回复",
    main_blocker: "价格",
    current_next_action: "Touch 2，确认客户是在比较价格、运费还是兼容性",
    next_follow_up_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    task_reason: "报价后 Touch 2"
  },
  {
    id: "demo-3",
    customer_name: "Ravi Energy",
    country: "India",
    customer_type: "Distributor",
    customer_level: "A",
    stage: "PI付款",
    main_blocker: "付款推进",
    current_next_action: "确认 PI、收款信息和预计付款时间",
    next_follow_up_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    task_reason: "PI 发出未付款"
  },
  {
    id: "demo-4",
    customer_name: "Carlos EPC",
    country: "Chile",
    customer_type: "EPC",
    customer_level: "A",
    stage: "异议处理",
    main_blocker: "技术解释太复杂",
    current_next_action: "简化方案说明，先回到项目容量和备电时间",
    next_follow_up_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    task_reason: "A 级客户超过 24 小时未跟进"
  },
  {
    id: "demo-5",
    customer_name: "Samuel Trade",
    country: "Nigeria",
    customer_type: "Wholesaler",
    customer_level: "B",
    stage: "待补信息",
    main_blocker: "信任不足",
    current_next_action: "提交给主管复核，再决定是否继续压价或补资料",
    next_follow_up_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    task_reason: "需要主管审核"
  }
];

function DemoTaskCard({ task }) {
  return (
    <article className="task-card">
      <div className="card-title">
        <strong>{task.customer_name}</strong>
        <LeadLevelBadge level={task.customer_level || "D"} />
      </div>
      <p className="muted">{task.country}</p>
      <p>客户类型：{task.customer_type}</p>
      <p>当前阶段：<CustomerStageBadge stage={task.stage} /></p>
      <p>主要卡点：{task.main_blocker}</p>
      <p>当前动作：{task.current_next_action}</p>
      <p>下次跟进：{formatDateTime(task.next_follow_up_at)}</p>
      <p className="task-reason">{task.task_reason}</p>
    </article>
  );
}

export default function DemoTasksPage() {
  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Demo Tasks</p>
          <h1>今日跟进任务 Demo</h1>
          <p>只用于测试 UI 和逻辑展示，不会读取或保存真实客户数据。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/demo/workflow">Workflow Demo</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/playbook">有效案例库</Link>
          <Link href="/products">产品知识库</Link>
          <Link href="/system-checker">系统搭配校验器</Link>
          <Link href="/tasks">今日任务</Link>
          <Link href="/demo/tasks">Demo Tasks</Link>
        </nav>
      </header>

      <div className="auth-card demo-banner">Demo mode, using sample data only.</div>

      <section className="panel">
        <div className="section-title">
          <h2>任务列表</h2>
          <span>{demoTasks.length} 条演示任务</span>
        </div>
        <div className="task-grid">
          {demoTasks.map((task) => (
            <DemoTaskCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </main>
  );
}
