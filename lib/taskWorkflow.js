import { daysSince, hoursSince } from "./followUp";

function formatTaskReason(reasons) {
  return reasons.join(" / ");
}

export function buildTaskRows(customers) {
  const now = new Date();

  return customers
    .map((customer) => {
      const analysis = customer.latest_analysis || {};
      const stage = customer.stage || analysis.stage || customer.current_status || "新询盘";
      const customerLevel = customer.lead_level || analysis.customerLevel || customer.leadLevel || "C";
      const reasons = [];

      const nextFollowUpAt = customer.next_follow_up_at
        ? new Date(customer.next_follow_up_at)
        : customer.follow_up_date
          ? new Date(`${customer.follow_up_date}T09:00:00.000Z`)
          : customer.followUpDate
            ? new Date(`${customer.followUpDate}T09:00:00.000Z`)
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
        customer_name: customer.customer_name || customer.customerName || "未命名客户",
        country: customer.country || "未知国家",
        customer_type: customer.customer_type || analysis.customerType || customer.customerType || "Unknown",
        customer_level: customerLevel,
        stage,
        main_blocker: analysis.mainBlocker || customer.main_blocker || "其他",
        current_next_action: customer.next_action || customer.current_next_action || customer.nextAction || analysis.suggestedAction || "暂无动作",
        next_follow_up_at:
          customer.next_follow_up_at ||
          (customer.follow_up_date ? `${customer.follow_up_date}T09:00:00.000Z` : null) ||
          (customer.followUpDate ? `${customer.followUpDate}T09:00:00.000Z` : null),
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
