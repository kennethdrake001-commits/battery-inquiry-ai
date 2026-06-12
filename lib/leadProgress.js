"use client";

import { getCustomerTypeValue } from "./customerViews";

export const leadStageLabelMap = {
  new_lead: "新线索",
  contacted: "已触达",
  engaged: "有互动",
  has_need: "有需求",
  material_sent: "已发资料",
  quoted: "已报价",
  follow_up: "跟进中",
  won: "成交",
  lost: "丢单",
  invalid: "无效"
};

export const leadSourceLabelMap = {
  "Google Maps": "Google Maps",
  LinkedIn: "LinkedIn",
  FB: "FB",
  Alibaba: "Alibaba",
  Website: "官网",
  Referral: "转介绍",
  "主动开发": "获客推进",
  Email: "邮箱",
  WhatsApp: "WhatsApp"
};

const linkedinStatusLabelMap = {
  not_found: "未找到",
  not_connected: "未连接",
  connection_sent: "已发送连接",
  connected: "已通过",
  message_sent: "已私信",
  replied: "已回复",
  "未找到": "未找到",
  "未连接": "未连接",
  "已发送连接": "已发送连接",
  "已通过": "已通过",
  "已私信": "已私信",
  "已回复": "已回复"
};

const facebookStatusLabelMap = {
  not_found: "未找到",
  followed: "已关注",
  friended: "已加好友",
  message_sent: "已私信",
  replied: "已回复",
  "未找到": "未找到",
  "已关注": "已关注",
  "已加好友": "已加好友",
  "已私信": "已私信",
  "已回复": "已回复"
};

const emailStatusLabelMap = {
  not_found: "未找到",
  not_sent: "未发送",
  material_sent: "已发资料",
  quotation_sent: "已发报价",
  followed_up: "已跟进",
  replied: "已回复",
  "未找到": "未找到",
  "未发送": "未发送",
  "已发资料": "已发资料",
  "已发报价": "已发报价",
  "已跟进": "已跟进",
  "已回复": "已回复"
};

const whatsappStatusLabelMap = {
  not_obtained: "未获得",
  obtained: "已获得",
  message_sent: "已发送消息",
  chatting: "沟通中",
  "未获得": "未获得",
  "已获得": "已获得",
  "已发送消息": "已发送消息",
  "沟通中": "沟通中"
};

export function extractLeadSourceFromText(text = "") {
  const match = `${text}`.match(/来源渠道[:：]\s*([^\n]+)/i);
  return match?.[1]?.trim() || "";
}

export function getLeadSourceValue(customer = {}) {
  return customer.lead_source
    || (customer.source === "主动开发" ? extractLeadSourceFromText(customer.original_message || "") : "")
    || customer.source
    || "";
}

export function getLeadSourceLabel(value = "") {
  return leadSourceLabelMap[value] || value || "待补充";
}

export function getLeadProgressStageValue(customer = {}) {
  const stage = `${customer.stage || ""}`.trim();
  const currentStatus = `${customer.current_status || ""}`.trim();

  if (leadStageLabelMap[stage]) return stage;
  if (stage === "Quoted") return "quoted";
  if (stage === "Waiting Reply") return "follow_up";
  if (stage === "Closed Won") return "won";
  if (stage === "Closed Lost") return "lost";
  if (stage === "Archived" || stage === "归档") return "invalid";
  if (stage === "Need Qualification" || stage === "New Inquiry") return "new_lead";
  if (stage === "Need Shipping Check" || stage === "Need Quotation") return "has_need";
  if (stage === "Negotiation" || stage === "Trial Order") return "follow_up";

  if (currentStatus === "未联系" || currentStatus === "新询盘") return "new_lead";
  if (["已触达", "已发第一封", "已发首封", "已发送 LinkedIn 邀请", "已发送 FB 私信"].includes(currentStatus)) return "contacted";
  if (["有互动", "已回复"].includes(currentStatus)) return "engaged";
  if (["有需求", "有兴趣", "待补信息", "待报价"].includes(currentStatus)) return "has_need";
  if (["已发资料"].includes(currentStatus)) return "material_sent";
  if (["已报价", "已报价未回复"].includes(currentStatus)) return "quoted";
  if (["跟进中", "第一次跟进", "第二次跟进", "待客户回复", "需要跟进"].includes(currentStatus)) return "follow_up";
  if (["成交", "已成交", "已转正式客户"].includes(currentStatus)) return "won";
  if (["丢单", "已丢单"].includes(currentStatus)) return "lost";
  if (["无效", "不合适", "归档"].includes(currentStatus)) return "invalid";

  if (stage === "Prospecting" || currentStatus === "Prospecting" || customer.source === "主动开发") {
    return "new_lead";
  }

  return stage || currentStatus || "new_lead";
}

export function getLeadProgressStageLabel(valueOrCustomer) {
  const value = typeof valueOrCustomer === "string"
    ? valueOrCustomer
    : getLeadProgressStageValue(valueOrCustomer);
  return leadStageLabelMap[value] || value || "待判断";
}

export function isLeadProgressCustomer(customer = {}) {
  const stage = getLeadProgressStageValue(customer);
  return Boolean(
    leadStageLabelMap[stage]
    || customer.source === "主动开发"
    || customer.stage === "Prospecting"
    || customer.current_status === "Prospecting"
  );
}

export function getChannelStatusLabel(channel, value, customer = {}) {
  if (channel === "linkedin_status") {
    const fallback = customer.linkedin ? "not_connected" : "not_found";
    return linkedinStatusLabelMap[value || fallback] || value || "未找到";
  }
  if (channel === "facebook_status") {
    const fallback = customer.facebook ? "friended" : "not_found";
    return facebookStatusLabelMap[value || fallback] || value || "未找到";
  }
  if (channel === "email_status") {
    const fallback = customer.email ? "not_sent" : "not_found";
    return emailStatusLabelMap[value || fallback] || value || "未找到";
  }
  if (channel === "whatsapp_status") {
    const fallback = customer.whatsapp ? "obtained" : "not_obtained";
    return whatsappStatusLabelMap[value || fallback] || value || "未获得";
  }
  return value || "待补充";
}

export function isHighPotentialLead(customer = {}) {
  const type = getCustomerTypeValue(customer);
  const stage = getLeadProgressStageValue(customer);
  return ["Solar Installer", "Solar Distributor", "Inverter Distributor"].includes(type)
    && ["has_need", "material_sent", "quoted", "follow_up"].includes(stage);
}

export function isClosedLeadStage(customer = {}) {
  const stage = getLeadProgressStageValue(customer);
  return ["won", "lost", "invalid"].includes(stage);
}
