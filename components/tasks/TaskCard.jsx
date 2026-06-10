import Link from "next/link";
import CustomerStageBadge from "../workflow/CustomerStageBadge";
import LeadLevelBadge from "../workflow/LeadLevelBadge";
import { formatDateTime } from "../../lib/followUp";

export default function TaskCard({ task, href = null }) {
  const content = (
    <>
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
    </>
  );

  if (!href) {
    return <article className="task-card">{content}</article>;
  }

  return (
    <Link className="task-card" href={href}>
      {content}
    </Link>
  );
}
