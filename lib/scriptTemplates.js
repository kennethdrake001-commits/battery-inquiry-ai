function includesText(value, needles) {
  const text = String(value || "").toLowerCase();
  return needles.some((needle) => text.includes(String(needle).toLowerCase()));
}

function normalizeMissingInfo(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderCustomerName(customerName) {
  return customerName || "there";
}

export function getRecommendedScript(input = {}) {
  const nextAction = input.nextAction || input.currentNextAction || "";
  const customerType = input.customerType || "Unknown";
  const shippingTerm = input.shippingTerm || "Unknown";
  const customerName = renderCustomerName(input.customerName);
  const missingInfo = normalizeMissingInfo(input.missingInfo);

  const missingQuantity = missingInfo.includes("Order quantity") || includesText(nextAction, ["order quantity"]);
  const missingDestination = missingInfo.includes("Destination city/country") || includesText(nextAction, ["destination city/country", "destination city and country"]);

  if (missingQuantity && missingDestination) {
    return {
      scriptTitle: "Ask for quantity and destination",
      scriptType: "qualification",
      scriptText: `Hi ${customerName}, may I know your order quantity and destination city/country? Then I can check the most suitable shipping option and quotation for you.`
    };
  }

  if (includesText(nextAction, ["ddp shipping cost", "check ddp shipping"]) || shippingTerm === "DDP") {
    return {
      scriptTitle: "DDP shipping check",
      scriptType: "shipping",
      scriptText: `Hi ${customerName}, since lithium batteries require special shipping and customs clearance, the DDP cost depends on the destination, quantity, and local delivery distance. I will check the shipping cost for you based on your details.`
    };
  }

  if (includesText(nextAction, ["follow up quotation"])) {
    return {
      scriptTitle: "Quotation follow-up",
      scriptType: "follow-up",
      scriptText: `Hi ${customerName}, I’m following up on the quotation we sent earlier. Please let me know if the price, shipping term, or product specification needs any adjustment.`
    };
  }

  if (customerType === "Solar Installer" || includesText(nextAction, ["datasheet", "installation photos", "inverter compatibility"])) {
    return {
      scriptTitle: "Installer support",
      scriptType: "technical-support",
      scriptText: `Hi ${customerName}, I can send you the battery datasheet, installation photos, and inverter compatibility information for review. Please let me know which inverter brand or model you are using.`
    };
  }

  if (customerType === "Solar Distributor" || includesText(nextAction, ["catalog", "wholesale"])) {
    return {
      scriptTitle: "Distributor support",
      scriptType: "channel-support",
      scriptText: `Hi ${customerName}, I can send you our main battery models, wholesale supply information, and recommended products for your market. May I know which capacity range you are mainly looking for?`
    };
  }

  return {
    scriptTitle: "General follow-up",
    scriptType: "general",
    scriptText: `Hi ${customerName}, I’m following up on your battery inquiry. Could you share more details about your project, quantity, and application so I can recommend the most suitable solution?`
  };
}
