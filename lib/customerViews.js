const customerTypeLabelMap = {
  "End User": "终端用户",
  "Solar Installer": "安装商",
  "Solar Distributor": "太阳能经销商",
  "Battery Wholesaler": "电池批发商",
  "Inverter Distributor": "逆变器经销商",
  "OEM / Brand Owner": "OEM / 品牌方",
  Unknown: "待判断"
};

const stageLabelMap = {
  "New Inquiry": "新询盘",
  "Need Qualification": "待补信息",
  "Need Shipping Check": "待运费核算",
  "Need Quotation": "待报价",
  Quoted: "已报价",
  "Waiting Reply": "待回复",
  "Follow-up Needed": "需要跟进",
  Negotiation: "谈判中",
  "Trial Order": "试单",
  "Closed Won": "已成交",
  "Closed Lost": "已丢单"
};

const sourceLabelMap = {
  Alibaba: "阿里国际站",
  WhatsApp: "WhatsApp",
  Email: "邮箱",
  LinkedIn: "LinkedIn",
  Other: "其他"
};

export function getCustomerName(customer) {
  return customer.customer_name || customer.customerName || "未命名客户";
}

export function getCustomerTypeValue(customer) {
  return customer.customer_type || customer.latest_analysis?.customerType || customer.customerType || "Unknown";
}

export function getCustomerTypeLabel(value) {
  return customerTypeLabelMap[value] || value || "待判断";
}

export function getStageValue(customer) {
  return customer.stage || customer.current_status || customer.latest_analysis?.stage || "New Inquiry";
}

export function getStageLabel(value) {
  return stageLabelMap[value] || value || "待判断";
}

export function getSourceLabel(value) {
  return sourceLabelMap[value] || value || "未知来源";
}

export function getLeadLevel(customer) {
  return customer.lead_level || customer.latest_analysis?.customerLevel || customer.leadLevel || "C";
}

export function getNextAction(customer) {
  return customer.current_next_action || customer.next_action || customer.latest_analysis?.suggestedAction || "待处理";
}

export function getMissingInfoList(customer) {
  const raw = customer.missing_info || customer.missingInfo || customer.latest_analysis?.missingInformation || [];
  if (Array.isArray(raw)) {
    return raw.map((item) => `${item}`.trim()).filter(Boolean);
  }
  return `${raw}`
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isPartnerCandidate(customer) {
  return [
    "Solar Distributor",
    "Battery Wholesaler",
    "Inverter Distributor",
    "OEM / Brand Owner"
  ].includes(getCustomerTypeValue(customer));
}

export function isConsumerCandidate(customer) {
  const type = getCustomerTypeValue(customer);
  return type === "End User" || type === "Unknown";
}

export function getProspectingLane(customer) {
  const stage = getStageValue(customer);
  const hasContacted = Boolean(customer.last_contacted_at);
  const hasReplied = Boolean(customer.last_customer_reply_at);

  if (!hasContacted) return "待开发";
  if (hasContacted && !hasReplied) return "已联系";
  if (hasReplied && (stage === "Need Qualification" || stage === "Need Quotation" || stage === "Negotiation")) return "可推进";
  if (hasReplied) return "已回复";
  return "待开发";
}

export function getTaskPriority(task, customer) {
  const level = customer ? getLeadLevel(customer) : task.customer_level || "C";
  const reason = task.task_reason || "";
  if (reason.includes("逾期") || reason.includes("24 小时") || level === "A") return "高";
  if (reason.includes("报价") || reason.includes("DDP") || reason.includes("待补")) return "中";
  return "普通";
}

export function getQuoteStatus(quote, customer) {
  const stage = customer ? getStageValue(customer) : "";
  if (stage === "Closed Won") return "已成交";
  if (stage === "Closed Lost") return "已丢单";
  if (stage === "Quoted" || stage === "Waiting Reply" || customer?.current_status === "已报价未回复") return "待回复";
  return "已发送";
}
