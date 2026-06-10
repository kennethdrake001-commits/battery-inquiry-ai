import { daysSince, hoursSince } from "./followUp";

function toFollowUpAt(customer) {
  return customer.next_follow_up_at ||
    (customer.follow_up_date ? `${customer.follow_up_date}T09:00:00.000Z` : null) ||
    (customer.followUpDate ? `${customer.followUpDate}T09:00:00.000Z` : null);
}

function normalizeMissingInfo(customer, analysis) {
  const rawMissing = customer.missing_info || customer.missingInfo || analysis.missingInformation || [];
  if (Array.isArray(rawMissing)) return rawMissing.map((item) => `${item}`.trim()).filter(Boolean);
  return `${rawMissing}`
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTaskForCustomer(customer, now) {
  const analysis = customer.latest_analysis || {};
  const stage = customer.stage || analysis.stage || customer.current_status || "新询盘";
  const customerLevel = customer.lead_level || analysis.customerLevel || customer.leadLevel || "C";
  const customerType = customer.customer_type || analysis.customerType || customer.customerType || "Unknown";
  const nextAction = customer.next_action || customer.current_next_action || customer.nextAction || analysis.suggestedAction || "暂无动作";
  const nextFollowUpAt = toFollowUpAt(customer);
  const missingInfo = normalizeMissingInfo(customer, analysis);
  const shippingTerm = customer.shipping_term || customer.shippingTerm || "Unknown";
  const hasQuantity = !!`${customer.quantity || ""}`.trim();
  const hasDestinationCity = !!`${customer.destination_city || customer.destinationCity || ""}`.trim();

  let taskAction = "";
  let taskReason = "";

  if (missingInfo.includes("Order quantity") && missingInfo.includes("Destination city/country")) {
    taskAction = "Ask customer for order quantity and destination city/country";
    taskReason = "DDP 报价缺少目的城市/国家 / 缺少订单数量";
  } else if (missingInfo.includes("Order quantity")) {
    taskAction = "Ask customer for order quantity";
    taskReason = "缺少订单数量";
  } else if (missingInfo.includes("Destination city/country")) {
    taskAction = "Ask customer for destination city/country";
    taskReason = "DDP 报价缺少目的城市/国家";
  } else if (shippingTerm === "DDP" && hasQuantity && hasDestinationCity) {
    taskAction = "Check DDP shipping cost";
    taskReason = "客户要求 DDP，需要核算运费";
  } else {
    const nextFollowUpDate = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    if (nextFollowUpDate && nextFollowUpDate <= now) {
      taskAction = nextAction;
      taskReason = "今天到期跟进";
    } else {
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
        taskAction = "Follow up quotation after 2 days";
        taskReason = "已报价 2-4 天未回复";
      } else if (stage === "PI付款" || stage === "Trial Order") {
        taskAction = "Follow up on PI payment";
        taskReason = "PI 发出但未付款";
      } else if (
        customer.last_customer_reply_at &&
        (!customer.last_contacted_at ||
          new Date(customer.last_customer_reply_at).getTime() > new Date(customer.last_contacted_at).getTime())
      ) {
        taskAction = "Handle customer reply";
        taskReason = "客户有新回复但未处理";
      } else {
        const lastFollowUpHours = hoursSince(customer.last_contacted_at || customer.updated_at || customer.created_at, now);
        const newInquiryHours = hoursSince(customer.created_at, now);

        if (customerLevel === "A" && lastFollowUpHours !== null && lastFollowUpHours > 24) {
          taskAction = nextAction;
          taskReason = "A 级客户超过 24 小时未跟进";
        } else if ((stage === "新询盘" || stage === "New Inquiry") && !customer.last_contacted_at && newInquiryHours !== null && newInquiryHours > 2) {
          taskAction = nextAction;
          taskReason = "新询盘超过 2 小时未处理";
        } else if (nextAction && nextAction !== "暂无动作") {
          taskAction = nextAction;
          taskReason = "根据当前 workflow 建议执行";
        }
      }
    }
  }

  if (!taskReason) return null;

  return {
    id: customer.id,
    customer_name: customer.customer_name || customer.customerName || "未命名客户",
    country: customer.country || "未知国家",
    customer_type: customerType,
    customer_level: customerLevel,
    stage,
    main_blocker: analysis.mainBlocker || customer.main_blocker || "其他",
    current_next_action: taskAction || nextAction,
    next_follow_up_at: nextFollowUpAt,
    task_reason: taskReason
  };
}

export function buildTaskRows(customers) {
  const now = new Date();

  return customers
    .map((customer) => buildTaskForCustomer(customer, now))
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}
