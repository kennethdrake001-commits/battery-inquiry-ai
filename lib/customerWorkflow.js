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

export function generateCustomerWorkflow(input) {
  const customerType = input.customerType || "Unknown";
  const stage = input.stage || "New Inquiry";
  const quantity = `${input.quantity || ""}`.trim();
  const country = `${input.country || ""}`.trim();
  const destinationCity = `${input.destinationCity || ""}`.trim();
  const shippingTerm = input.shippingTerm || "Unknown";
  const combinedText = [input.originalMessage, input.question, input.quoteContent].filter(Boolean).join(" ").toLowerCase();
  const ddpRequested = shippingTerm === "DDP" || combinedText.includes("ddp");
  const missingInfo = [];

  let nextAction = "";
  let followUpDate = input.followUpDate || "";

  if (customerType === "Unknown") {
    nextAction = "Confirm whether the customer is an end user, installer, distributor, wholesaler, inverter distributor, or OEM brand owner.";
  }

  if (!quantity) {
    addMissing(missingInfo, "Order quantity");
    nextAction = "Ask customer for order quantity.";
  }

  if (ddpRequested && (!country || !destinationCity)) {
    addMissing(missingInfo, "Destination city/country");
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
    if (!followUpDate) followUpDate = plusDays(2);
  }

  if (stage === "Waiting Reply") {
    nextAction = "Send follow-up message.";
    if (!followUpDate) followUpDate = plusDays(1);
  }

  return {
    nextAction: nextAction || "Review customer background and confirm the next qualification step.",
    missingInfo,
    followUpDate
  };
}
