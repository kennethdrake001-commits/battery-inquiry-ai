export function formatNextActionForDisplay(value) {
  const text = `${value || ""}`.trim();
  if (!text) return "暂无动作";

  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  if (hasChinese) return text;

  const normalized = text.toLowerCase();

  if (normalized.includes("follow up quotation after 2 days")) {
    return "报价后第 2 天跟进客户";
  }

  if (normalized.includes("follow up quotation")) {
    return "跟进报价，确认客户是否有价格、运输或规格问题";
  }

  if (
    normalized.includes("quantity")
    || normalized.includes("destination")
    || normalized.includes("city")
  ) {
    return "确认数量和目的地信息";
  }

  if (
    normalized.includes("datasheet")
    || normalized.includes("installation photos")
    || normalized.includes("inverter compatibility")
  ) {
    return "发送规格书、安装图片和逆变器兼容信息";
  }

  if (
    normalized.includes("backup needs")
    || normalized.includes("home appliances")
    || normalized.includes("power outages")
  ) {
    return "询问客户备用电需求和使用场景";
  }

  if (
    normalized.startsWith("ask ")
    || normalized.includes("ask customer")
    || /ask\s+.+\s+about/.test(normalized)
  ) {
    return "询问客户更多需求信息";
  }

  if (
    normalized.includes("ddp")
    || normalized.includes("shipping")
    || normalized.includes("freight")
  ) {
    return "核算运输方式和费用";
  }

  return "需要人工判断下一步动作";
}

function normalizeText(value) {
  return `${value || ""}`.trim().toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasMeaningfulValue(value) {
  return value !== null && value !== undefined && `${value}`.trim() !== "";
}

function getStatusText(customer = {}) {
  return normalizeText([
    customer.stage,
    customer.current_status,
    customer.status,
    customer.source,
    customer.customer_source,
    customer.lead_source
  ].filter(Boolean).join(" "));
}

function hasCompleteInquiryInfo(customer = {}) {
  const hasCountry = hasMeaningfulValue(customer.country || customer.destination_country);
  const hasCustomerType = hasMeaningfulValue(customer.customer_type || customer.customerType)
    && normalizeText(customer.customer_type || customer.customerType) !== "unknown";
  const hasProductNeed = hasMeaningfulValue(
    customer.product_need
    || customer.productNeed
    || customer.target_capacity
    || customer.recommended_product
  );
  const hasQuantity = hasMeaningfulValue(customer.quantity);
  return hasCountry && hasCustomerType && hasProductNeed && hasQuantity;
}

function hasInquiryInfoGap(customer = {}) {
  return !hasMeaningfulValue(customer.country || customer.destination_country)
    || !hasMeaningfulValue(customer.customer_type || customer.customerType)
    || normalizeText(customer.customer_type || customer.customerType) === "unknown"
    || !hasMeaningfulValue(customer.product_need || customer.productNeed || customer.target_capacity || customer.recommended_product)
    || !hasMeaningfulValue(customer.quantity)
    || !hasMeaningfulValue(customer.application_scenario || customer.application_scene);
}

export function isInvalidOrArchivedCustomer(customer = {}) {
  const stageText = getStatusText(customer);
  return includesAny(stageText, [
    "无效",
    "已归档",
    "归档",
    "archived",
    "invalid",
    "closed lost",
    "丢单",
    "已丢单",
    "lost"
  ]);
}

export function isCustomerReplyPending(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) return false;
  const stageText = getStatusText(customer);
  if (includesAny(stageText, ["已回复", "客户已回复", "responded", "有回应", "engaged"])) {
    return true;
  }
  if (customer.last_customer_reply_at) {
    const replyTime = new Date(customer.last_customer_reply_at).getTime();
    const contactedTime = customer.last_contacted_at ? new Date(customer.last_contacted_at).getTime() : null;
    if (!Number.isNaN(replyTime) && (contactedTime === null || Number.isNaN(contactedTime) || replyTime > contactedTime)) {
      return true;
    }
  }
  return false;
}

export function isQuotedCustomer(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) return false;
  const stageText = getStatusText(customer);
  return includesAny(stageText, [
    "已报价",
    "quoted",
    "quote sent",
    "waiting reply",
    "已报价未回复",
    "报价后待跟进"
  ]) || hasMeaningfulValue(customer.last_quote_at);
}

export function isSentInfoCustomer(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) return false;
  const stageText = getStatusText(customer);
  return includesAny(stageText, [
    "已发资料",
    "已发送资料",
    "sent info",
    "material_sent",
    "material sent"
  ]);
}

export function isNeedQuotationCustomer(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) return false;
  const stageText = getStatusText(customer);
  return includesAny(stageText, [
    "待报价",
    "need quotation",
    "need quote",
    "待出报价"
  ]);
}

export function isProspectingCustomer(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) return false;
  const stageText = getStatusText(customer);
  return includesAny(stageText, [
    "主动开发",
    "prospecting"
  ]);
}

export function isNewInquiryCustomer(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) return false;
  if (isProspectingCustomer(customer)) return false;
  const stageText = getStatusText(customer);
  return includesAny(stageText, [
    "新询盘",
    "新线索",
    "new inquiry",
    "new lead",
    "new"
  ]);
}

export function getCustomerNextAction(customer = {}) {
  if (isInvalidOrArchivedCustomer(customer)) {
    return "不再推进，除非客户重新回复";
  }

  if (isCustomerReplyPending(customer)) {
    return "查看客户回复内容，确认下一步沟通方向";
  }

  if (isQuotedCustomer(customer)) {
    return "跟进报价反馈，确认价格、交期和付款方式";
  }

  if (isSentInfoCustomer(customer)) {
    return "跟进资料阅读情况，确认客户是否需要报价";
  }

  if (isNeedQuotationCustomer(customer)) {
    return "确认关键报价信息，准备推荐方案或报价";
  }

  if (isProspectingCustomer(customer)) {
    return "判断客户是否匹配目标买家，并完成第一次触达";
  }

  if (isNewInquiryCustomer(customer)) {
    if (hasInquiryInfoGap(customer)) {
      return "补充客户关键信息，确认国家、数量、客户身份和应用场景";
    }
    if (hasCompleteInquiryInfo(customer)) {
      return "确认贸易条款、交期和认证要求，准备推荐方案或报价";
    }
  }

  return "补充客户关键信息，判断是否值得继续推进";
}

export function getCustomerQueueCategory(customer = {}, today = new Date()) {
  if (isInvalidOrArchivedCustomer(customer)) return "hidden";
  if (isCustomerReplyPending(customer)) return "reply_pending";
  if (isQuotedCustomer(customer)) return "quoted_follow_up";
  if (isSentInfoCustomer(customer)) return "sent_info_follow_up";

  const dateValue = customer.next_follow_up_at || customer.follow_up_date;
  if (dateValue) {
    const followUpDate = new Date(dateValue);
    if (!Number.isNaN(followUpDate.getTime())) {
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);
      if (followUpDate.getTime() < startOfToday.getTime()) {
        return "overdue_follow_up";
      }
      if (followUpDate.getTime() <= endOfToday.getTime()) {
        return "today_follow_up";
      }
    }
  }

  if (isNewInquiryCustomer(customer)) return "new_inquiry";
  if (isProspectingCustomer(customer)) return "prospecting";
  if (isNeedQuotationCustomer(customer)) return "need_quotation";
  return "default";
}
