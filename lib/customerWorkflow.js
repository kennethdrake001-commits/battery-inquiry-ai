function addMissing(list, value) {
  if (!value || list.includes(value)) return;
  list.push(value);
}

function plusDays(days) {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function mapAnalysisCustomerType(value) {
  const mapping = {
    "End User": "End User",
    Installer: "Solar Installer",
    Distributor: "Solar Distributor",
    Wholesaler: "Battery Wholesaler",
    OEM: "OEM / Brand Owner",
    Unknown: "Unknown"
  };

  return mapping[value] || "Unknown";
}

export function mapAnalysisLeadLevel(value) {
  if (value === "A" || value === "B") return value;
  return "C";
}

export function getMissingInfo(input) {
  const quantity = `${input.quantity || ""}`.trim();
  const country = `${input.country || ""}`.trim();
  const destinationCity = `${input.destinationCity || ""}`.trim();
  const shippingTerm = input.shippingTerm || "Unknown";
  const combinedText = [input.originalMessage, input.question, input.quoteContent].filter(Boolean).join(" ").toLowerCase();
  const ddpRequested = shippingTerm === "DDP" || combinedText.includes("ddp");
  const missingInfo = [];

  if (!quantity) {
    addMissing(missingInfo, "Order quantity");
  }

  if (ddpRequested && (!country || !destinationCity)) {
    addMissing(missingInfo, "Destination city/country");
  }

  return missingInfo;
}

export function getLeadLevel(input) {
  if (input.leadLevel === "A" || input.leadLevel === "B" || input.leadLevel === "C") {
    return input.leadLevel;
  }

  const customerType = input.customerType || "Unknown";
  if (customerType === "Solar Distributor" || customerType === "OEM / Brand Owner") return "A";
  if (customerType === "Solar Installer" || customerType === "Battery Wholesaler") return "B";
  return "C";
}

export function getFollowUpSuggestion(input) {
  const stage = input.stage || "New Inquiry";
  const followUpDate = input.followUpDate || "";

  if (followUpDate) return followUpDate;
  if (stage === "Quoted") return plusDays(2);
  if (stage === "Waiting Reply") return plusDays(1);
  return "";
}

export function generateNextAction(input) {
  const customerType = input.customerType || "Unknown";
  const stage = input.stage || "New Inquiry";
  const shippingTerm = input.shippingTerm || "Unknown";
  let nextAction = "";

  if (customerType === "Unknown") {
    nextAction = "Confirm whether the customer is an end user, installer, distributor, wholesaler, inverter distributor, or OEM brand owner.";
  }

  if (getMissingInfo(input).includes("Order quantity")) {
    nextAction = "Ask customer for order quantity.";
  }

  if (getMissingInfo(input).includes("Destination city/country")) {
    nextAction = "Ask destination city and country before checking DDP shipping.";
  }

  if (customerType === "End User") {
    nextAction = "Ask if the customer already has a local solar installer.";
  }

  if (customerType === "Solar Installer") {
    nextAction = "Send datasheet, installation photos, and inverter compatibility information.";
  }

  if (customerType === "Solar Distributor") {
    nextAction = "Send product catalog, wholesale supply information, and main recommended models.";
  }

  if (customerType === "OEM / Brand Owner") {
    nextAction = "Ask about logo, label, packaging, MOQ, and sample requirements.";
  }

  if (shippingTerm === "DDP") {
    nextAction = "Check DDP shipping cost and explain lithium battery shipping cost may be high for small orders.";
  }

  if (stage === "Quoted") {
    nextAction = "Follow up with the customer after 2 days.";
  }

  if (stage === "Waiting Reply") {
    nextAction = "Send follow-up message.";
  }

  return nextAction || "Review customer background and confirm the next qualification step.";
}

export function generateCustomerWorkflow(input) {
  const missingInfo = getMissingInfo(input);
  const nextAction = generateNextAction(input);
  const followUpDate = getFollowUpSuggestion(input);
  const leadLevel = getLeadLevel(input);

  return {
    nextAction,
    missingInfo,
    followUpDate,
    leadLevel
  };
}
