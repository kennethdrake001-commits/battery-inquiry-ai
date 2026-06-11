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
