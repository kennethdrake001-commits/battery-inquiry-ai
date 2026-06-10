import Link from "next/link";
import CustomerStageBadge from "../workflow/CustomerStageBadge";
import LeadLevelBadge from "../workflow/LeadLevelBadge";
import RecommendedScriptCard from "../workflow/RecommendedScriptCard";
import { formatDateTime } from "../../lib/followUp";
import { getRecommendedScript } from "../../lib/scriptTemplates";

export default function TaskCard({ task, href = null }) {
  const recommendedScript = getRecommendedScript({
    nextAction: task.current_next_action,
    currentNextAction: task.current_next_action,
    customerType: task.customer_type,
    stage: task.stage,
    missingInfo: task.missing_info,
    shippingTerm: task.shipping_term,
    quantity: task.quantity,
    destinationCity: task.destination_city,
    customerName: task.customer_name
  });

  const summary = (
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
    return (
      <article className="task-card">
        {summary}
        <RecommendedScriptCard
          scriptTitle={recommendedScript.scriptTitle}
          scriptText={recommendedScript.scriptText}
          scriptType={recommendedScript.scriptType}
        />
      </article>
    );
  }

  return (
    <article className="task-card">
      <Link className="task-card-link" href={href}>
        {summary}
      </Link>
      <RecommendedScriptCard
        scriptTitle={recommendedScript.scriptTitle}
        scriptText={recommendedScript.scriptText}
        scriptType={recommendedScript.scriptType}
      />
    </article>
  );
}
