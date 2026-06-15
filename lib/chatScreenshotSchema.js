export const chatScreenshotAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "platform",
    "conversationSummary",
    "messages",
    "messageCount",
    "customerMessageCount",
    "salespersonMessageCount",
    "lastSpeaker",
    "conversationTimeRange",
    "customerNeed",
    "customerType",
    "confirmedInformation",
    "missingInformation",
    "customerObjections",
    "sentMaterials",
    "currentBlocker",
    "suggestedStage",
    "nextAction",
    "englishReply",
    "warnings"
  ],
  properties: {
    platform: { type: "string", enum: ["Alibaba", "WhatsApp", "LinkedIn", "Email", "Other"] },
    conversationSummary: { type: "string" },
    messages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["speaker", "text", "time", "position", "confidence", "speakerReason"],
        properties: {
          speaker: { type: "string", enum: ["customer", "salesperson", "unknown"] },
          text: { type: "string" },
          time: { type: "string" },
          position: { type: "string", enum: ["left", "right", "unknown"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          speakerReason: { type: "string" }
        }
      }
    },
    messageCount: { type: "integer", minimum: 0 },
    customerMessageCount: { type: "integer", minimum: 0 },
    salespersonMessageCount: { type: "integer", minimum: 0 },
    lastSpeaker: { type: "string", enum: ["customer", "salesperson", "unknown"] },
    conversationTimeRange: { type: "string" },
    customerNeed: { type: "string" },
    customerType: { type: "string" },
    confirmedInformation: {
      type: "object",
      additionalProperties: false,
      required: [
        "country",
        "quantity",
        "targetCapacity",
        "productNeed",
        "shippingTerm",
        "inverterRequirement",
        "applicationScenario",
        "deliveryRequirement",
        "certificationRequirement",
        "budgetOrTargetPrice",
        "deliveryTime"
      ],
      properties: {
        country: { type: "string" },
        quantity: { type: "string" },
        targetCapacity: { type: "string" },
        productNeed: { type: "string" },
        shippingTerm: { type: "string" },
        inverterRequirement: { type: "string" },
        applicationScenario: { type: "string" },
        deliveryRequirement: { type: "string" },
        certificationRequirement: { type: "string" },
        budgetOrTargetPrice: { type: "string" },
        deliveryTime: { type: "string" }
      }
    },
    missingInformation: { type: "array", items: { type: "string" } },
    customerObjections: { type: "array", items: { type: "string" } },
    sentMaterials: { type: "array", items: { type: "string" } },
    currentBlocker: { type: "string" },
    suggestedStage: { type: "string" },
    nextAction: { type: "string" },
    englishReply: { type: "string" },
    warnings: { type: "array", items: { type: "string" } }
  }
};

export function createEmptyChatScreenshotAnalysis() {
  return {
    platform: "Other",
    conversationSummary: "",
    messages: [],
    messageCount: 0,
    customerMessageCount: 0,
    salespersonMessageCount: 0,
    lastSpeaker: "unknown",
    conversationTimeRange: "",
    customerNeed: "",
    customerType: "",
    confirmedInformation: {
      country: "",
      quantity: "",
      targetCapacity: "",
      productNeed: "",
      shippingTerm: "",
      inverterRequirement: "",
      applicationScenario: "",
      deliveryRequirement: "",
      certificationRequirement: "",
      budgetOrTargetPrice: "",
      deliveryTime: ""
    },
    missingInformation: [],
    customerObjections: [],
    sentMaterials: [],
    currentBlocker: "",
    suggestedStage: "",
    nextAction: "",
    englishReply: "",
    warnings: []
  };
}

export function assertChatScreenshotAnalysis(value) {
  const required = chatScreenshotAnalysisSchema.required || [];
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) {
    throw new Error(`missing_fields:${missing.join(",")}`);
  }
  return value;
}
