import Link from "next/link";
import CustomerStageBadge from "../workflow/CustomerStageBadge";
import LeadLevelBadge from "../workflow/LeadLevelBadge";
import { formatDateTime } from "../../lib/followUp";

export default function CustomerCard({ customer, href = null }) {
  const analysis = customer.latest_analysis || {};
  const stage = customer.stage || analysis.stage || customer.current_status || "New Inquiry";
  const leadLevel = customer.lead_level || analysis.customerLevel || customer.leadLevel || "C";
  const nextAction = customer.next_action || customer.current_next_action || analysis.suggestedAction || customer.nextAction || "暂无建议动作";
  const missingInfo = customer.missing_info || customer.missingInfo || (Array.isArray(analysis.missingInformation) ? analysis.missingInformation.join(", ") : "");
  const followUpDate = customer.follow_up_date || customer.next_follow_up_at || customer.followUpDate || "";
  const customerType = customer.customer_type || analysis.customerType || customer.customerType || "Unknown";

  const content = (
    <>
      <div className="card-title">
        <strong>{customer.customer_name || customer.customerName || "未命名客户"}</strong>
        <LeadLevelBadge level={leadLevel} />
      </div>
      <p className="muted">{customer.country || "未知国家"} · {customer.source || "未知来源"}</p>
      <p>客户类型：{customerType}</p>
      <p>当前阶段：<CustomerStageBadge stage={stage} /></p>
      <p>客户等级：{leadLevel}</p>
      <p>卡点：{analysis.mainBlocker || customer.main_blocker || "其他"}</p>
      <p>缺失信息：{missingInfo || "-"}</p>
      <p>跟进日期：{followUpDate ? formatDateTime(followUpDate) : "-"}</p>
      <p className="action-text">{nextAction}</p>
      {analysis.needSupervisorReview === "是" && <p className="review">需主管复核：{analysis.reviewReason || "AI 建议复核"}</p>}
    </>
  );

  if (!href) {
    return <article className="customer-card">{content}</article>;
  }

  return (
    <Link className="customer-card" href={href}>
      {content}
    </Link>
  );
}
