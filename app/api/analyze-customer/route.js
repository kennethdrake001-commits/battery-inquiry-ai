import { NextResponse } from "next/server";

const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "customerType",
    "customerLevel",
    "customerScore",
    "stage",
    "mainBlocker",
    "missingInformation",
    "nextGoal",
    "suggestedAction",
    "englishReply",
    "followUpTime",
    "priority",
    "confidence",
    "reasoning",
    "needSupervisorReview",
    "reviewReason"
  ],
  properties: {
    customerType: {
      type: "string",
      enum: ["End User", "Installer", "Distributor", "Wholesaler", "EPC", "OEM", "Unknown"]
    },
    customerLevel: { type: "string", enum: ["A", "B", "C", "D"] },
    customerScore: { type: "integer", minimum: 0, maximum: 100 },
    stage: {
      type: "string",
      enum: ["新询盘", "待补信息", "待报价", "已报价未回复", "异议处理", "PI付款", "成交", "归档"]
    },
    mainBlocker: {
      type: "string",
      enum: ["价格", "运费", "清关", "证书", "逆变器兼容", "技术解释太复杂", "需求不清", "信任不足", "其他"]
    },
    missingInformation: {
      type: "array",
      items: { type: "string" }
    },
    nextGoal: { type: "string" },
    suggestedAction: { type: "string" },
    englishReply: { type: "string" },
    followUpTime: { type: "string" },
    priority: { type: "string", enum: ["是", "否"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string" },
    needSupervisorReview: { type: "string", enum: ["是", "否"] },
    reviewReason: { type: "string" }
  }
};

const systemPrompt = `
You are an AI sales assistant for energy storage battery export inquiries.
Return only strict JSON matching the schema. Do not include markdown or extra text.

Task:
- Analyze the customer inquiry, previous seller reply, quotation content and current status.
- Generate customer classification, level, score, sales stage, blocker, missing information, next goal, suggested action, concise English reply, follow-up time, priority, confidence, reasoning, and supervisor review flag.

Output rules:
- customerScore is 0-100. A: 80-100, B: 60-79, C: 35-59, D: 0-34.
- confidence is 0-1.
- priority must be 是 for A/B or urgent PI/order/project cases; otherwise 否.
- needSupervisorReview must be 是 if confidence < 0.65, order/PI terms are unclear, customs clearance risk is high, compatibility risk is high, or the reply may need manager approval.
- missingInformation must be an array of concrete missing items, e.g. ["country", "quantity", "application", "inverter brand and model"].
- English reply must be short, natural, suitable for Alibaba / WhatsApp, and include one clear next action.
- Do not overpromise customs clearance.
- Do not promise all inverters are compatible.
- Any quotation-related reply must clearly mention FOB / CIF / DDP when discussing price or quotation.
- For end users, explain application simply and avoid complex BMS terms.
- For B2B customers, be professional but concise.

Energy storage battery export sales SOP:
1. End User: If customer says my home / home backup / power outage / refrigerator / TV / lights, classify as End User. Reply simply about usage and backup needs.
2. Installer: If customer says installation / my client / inverter compatibility / wiring / CAN / RS485, classify as Installer. Focus on compatibility, communication, installation documents, and technical support.
3. Distributor: If customer says distributor / resale / local market / catalog / marketing materials, classify as Distributor. Focus on mainstream specs, materials support, and market testing.
4. Wholesaler: If customer says wholesale / bulk / 10pcs / 20pcs / MOQ / container, classify as Wholesaler. Focus on quantity, tier pricing, FOB, and lead time.
5. EPC: If customer says project / resort / farm / school / commercial / 40kWh / 50kWh / 100kWh, classify as EPC. Focus on solution, capacity, loads, and backup time.
6. OEM: If customer asks logo / private label / OEM / customized branding, classify as OEM unless another stronger buyer identity is clear.
7. Price only: If customer only asks price/how much, do not give a formal quote. Stage is 待补信息. Ask country, quantity, application, and whether they already have an inverter.
8. Quoted but no reply: Stage is 已报价未回复. Do not push hard. Find blocker: price, shipping cost, inverter compatibility, or delivery time.
9. DDP/shipping/to door: Ask city, postal code, quantity. Do not directly promise DDP or customs clearance.
10. Certificate/CE/UN38.3/MSDS/customs: Say documents can be provided when applicable, but countries differ. Suggest local customs broker pre-check. Never absolutely promise clearance.
11. Inverter compatibility: Ask inverter brand and model. Never guarantee all inverters are compatible.
12. Too expensive: Do not directly lower price. Ask comparison offer, whether specs are the same, target price, and quantity.
13. I will think about it: Ask whether the customer compares price, shipping cost, specification, or supplier reliability.
14. Send PI / want to order: Stage is PI付款. Confirm model, quantity, trade term, address, consignee, and payment method.
`;

const jsonSchemaInstruction = `
Return exactly one JSON object with these fields and no extra text:
{
  "customerType": "End User | Installer | Distributor | Wholesaler | EPC | OEM | Unknown",
  "customerLevel": "A | B | C | D",
  "customerScore": 0,
  "stage": "新询盘 | 待补信息 | 待报价 | 已报价未回复 | 异议处理 | PI付款 | 成交 | 归档",
  "mainBlocker": "价格 | 运费 | 清关 | 证书 | 逆变器兼容 | 技术解释太复杂 | 需求不清 | 信任不足 | 其他",
  "missingInformation": [],
  "nextGoal": "",
  "suggestedAction": "",
  "englishReply": "",
  "followUpTime": "",
  "priority": "是 | 否",
  "confidence": 0,
  "reasoning": "",
  "needSupervisorReview": "是 | 否",
  "reviewReason": ""
}
`;

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
      if (typeof content.output_text === "string") parts.push(content.output_text);
    }
  }
  return parts.join("\n");
}

function parseJsonWithRepair(text) {
  if (!text || typeof text !== "string") throw new Error("empty_model_output");

  const attempts = [
    text,
    text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()
  ];

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // Continue with the next repair attempt.
    }
  }

  throw new Error("invalid_model_json");
}

function assertAnalysis(value) {
  const missing = analysisSchema.required.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) throw new Error(`missing_fields:${missing.join(",")}`);
  return value;
}

async function callOpenAI(customerInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("provider_not_configured");
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: openaiModel,
        input: [
          { role: "system", content: `${systemPrompt}\n${jsonSchemaInstruction}` },
          {
            role: "user",
            content: JSON.stringify(
              {
                currentDate: new Date().toISOString().slice(0, 10),
                customerInput
              },
              null,
              2
            )
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "customer_analysis",
            strict: true,
            schema: analysisSchema
          }
        }
      })
    });

  const data = await openaiResponse.json();

  if (!openaiResponse.ok) {
    console.error("OpenAI API error:", data);
    throw new Error("provider_request_failed");
  }

  return assertAnalysis(parseJsonWithRepair(extractOutputText(data)));
}

async function callGroq(customerInput) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("provider_not_configured");
  }

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: groqModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${systemPrompt}\n${jsonSchemaInstruction}` },
        {
          role: "user",
          content: JSON.stringify(
            {
              currentDate: new Date().toISOString().slice(0, 10),
              customerInput
            },
            null,
            2
          )
        }
      ]
    })
  });

  const data = await groqResponse.json();

  if (!groqResponse.ok) {
    console.error("Groq API error:", data);
    throw new Error("provider_request_failed");
  }

  const rawText = data?.choices?.[0]?.message?.content;
  return assertAnalysis(parseJsonWithRepair(rawText));
}

async function analyzeWithProvider(customerInput) {
  if (provider === "openai") return callOpenAI(customerInput);
  if (provider === "groq") return callGroq(customerInput);
  throw new Error("provider_not_configured");
}

export async function POST(request) {
  try {
    const customerInput = await request.json();
    const analysis = await analyzeWithProvider(customerInput);
    return NextResponse.json({ analysis });
  } catch (error) {
    if (error.message === "provider_not_configured") {
      return NextResponse.json({ error: "AI provider is not configured." }, { status: 500 });
    }

    console.error("Analyze customer failed:", error);
    return NextResponse.json({ error: "AI分析失败，请稍后重试" }, { status: 502 });
  }
}
