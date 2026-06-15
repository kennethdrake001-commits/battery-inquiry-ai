import { NextResponse } from "next/server";
import { assertChatScreenshotAnalysis, chatScreenshotAnalysisSchema } from "../../../lib/chatScreenshotSchema";
import {
  buildChatScreenshotUserPayload,
  chatScreenshotJsonInstruction,
  chatScreenshotSystemPrompt
} from "../../../lib/chatScreenshotPrompt";

const openRouterVisionModel = process.env.OPENROUTER_VISION_MODEL || "openrouter/free";
const maxImages = 10;
const maxImageBytes = 8 * 1024 * 1024;
const supportedMimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const maxRequestBytes = 45 * 1024 * 1024;

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;

  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function parseJsonWithRepair(text) {
  if (!text) throw new Error("invalid_model_json");
  const attempts = [text.trim()];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // keep trying
    }
  }

  throw new Error("invalid_model_json");
}

async function getAuthenticatedUser(request) {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authorization || !supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: supabaseAnonKey
    },
    cache: "no-store"
  });

  if (!response.ok) return null;
  return response.json();
}

function ensureFreeVisionModel(modelId) {
  const normalized = String(modelId || "").trim();
  if (!normalized) {
    throw new Error("provider_not_configured");
  }
  if (normalized !== "openrouter/free" && !normalized.endsWith(":free")) {
    throw new Error("non_free_model_forbidden");
  }
  return normalized;
}

function inferMimeTypeFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match?.[1]?.toLowerCase() || "";
}

function estimateBase64Bytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.floor((base64.length * 3) / 4);
}

function validateImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("missing_images");
  }
  if (images.length > maxImages) {
    throw new Error("too_many_images");
  }

  images.forEach((image) => {
    const mimeType = inferMimeTypeFromDataUrl(image?.dataUrl);
    if (!supportedMimeTypes.has(mimeType)) {
      throw new Error("unsupported_image_type");
    }

    const byteLength = estimateBase64Bytes(image?.dataUrl);
    if (byteLength > maxImageBytes) {
      throw new Error("image_too_large");
    }
  });
}

async function callOpenRouterVision({ platform, salespersonName, salespersonBubbleSide, screenshots, customerContext, correctedMessages }) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("provider_not_configured");
  }
  const freeVisionModel = ensureFreeVisionModel(openRouterVisionModel);

  const payload = buildChatScreenshotUserPayload({
    platform,
    salespersonName,
    salespersonBubbleSide,
    screenshots,
    customerContext,
    correctedMessages
  });

  const userContent = [
    {
      type: "text",
      text: JSON.stringify(payload, null, 2)
    }
  ];

  if (Array.isArray(correctedMessages) && correctedMessages.length > 0) {
    userContent.push({
      type: "text",
      text: `人工纠正后的消息如下，请基于这些消息重新生成分析结果：\n${JSON.stringify(correctedMessages, null, 2)}`
    });
  } else {
    screenshots.forEach((image) => {
      userContent.push({
        type: "image_url",
        image_url: {
          url: image.dataUrl,
          detail: "high"
        }
      });
    });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "battery-inquiry-ai",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: freeVisionModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${chatScreenshotSystemPrompt}\n${chatScreenshotJsonInstruction}`
          },
          {
            role: "user",
            content: userContent
          }
        ]
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errorText = String(data?.error?.message || "");
      const lowerErrorText = errorText.toLowerCase();
      if (
        response.status === 402
        || lowerErrorText.includes("insufficient")
        || lowerErrorText.includes("payment")
        || lowerErrorText.includes("credit")
      ) {
        throw new Error("free_tier_limited");
      }
      if (
        response.status === 404
        || lowerErrorText.includes("no provider")
        || lowerErrorText.includes("no model")
        || lowerErrorText.includes("not available")
        || lowerErrorText.includes("unavailable")
        || lowerErrorText.includes("vision")
        || lowerErrorText.includes("image")
      ) {
        throw new Error("free_model_unavailable");
      }
      if (
        response.status === 429
        || lowerErrorText.includes("rate limit")
        || lowerErrorText.includes("too many requests")
        || lowerErrorText.includes("quota")
      ) {
        throw new Error("free_tier_limited");
      }
      if (
        response.status === 400
        || lowerErrorText.includes("image_url")
        || lowerErrorText.includes("base64")
        || lowerErrorText.includes("invalid image")
        || lowerErrorText.includes("unsupported image")
        || lowerErrorText.includes("invalid request")
      ) {
        throw new Error("invalid_image_request");
      }
      throw new Error(errorText || "provider_request_failed");
    }

    const rawText = data?.choices?.[0]?.message?.content || extractOutputText(data);
    return assertChatScreenshotAnalysis(parseJsonWithRepair(rawText));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "无法获取当前登录用户，请重新登录后再试。" }, { status: 401 });
    }

    const requestText = await request.text();
    if (requestText.length > maxRequestBytes) {
      return NextResponse.json({ error: "聊天截图分析失败，请减少截图数量后重试。" }, { status: 413 });
    }

    const body = JSON.parse(requestText || "{}");
    const {
      customerId,
      platform = "Other",
      salespersonName = "",
      salespersonBubbleSide = "auto",
      images = [],
      correctedMessages = [],
      customerContext = {}
    } = body || {};

    if (!customerId) {
      return NextResponse.json({ error: "缺少客户信息，无法分析聊天截图。" }, { status: 400 });
    }

    if ((!Array.isArray(correctedMessages) || correctedMessages.length === 0) && (!Array.isArray(images) || images.length === 0)) {
      return NextResponse.json({ error: "请至少粘贴或上传一张聊天截图。" }, { status: 400 });
    }

    if (!Array.isArray(correctedMessages) || correctedMessages.length === 0) {
      validateImages(images);
    } else if (correctedMessages.length > 200) {
      return NextResponse.json({ error: "对话明细过长，请先精简后再重新分析。" }, { status: 400 });
    }

    const analysis = await callOpenRouterVision({
      platform,
      salespersonName,
      salespersonBubbleSide,
      screenshots: images,
      customerContext,
      correctedMessages
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    if (error.name === "AbortError") {
      return NextResponse.json({ error: "聊天截图分析失败，请稍后重试。" }, { status: 504 });
    }
    if (error.message === "provider_not_configured") {
      return NextResponse.json({ error: "OpenRouter AI 服务尚未配置，请先设置 OPENROUTER_API_KEY。" }, { status: 500 });
    }
    if (error.message === "non_free_model_forbidden") {
      return NextResponse.json({ error: "当前仅允许使用 OpenRouter 免费模型路由或 :free 模型，已拒绝调用付费模型。" }, { status: 500 });
    }
    if (error.message === "free_tier_limited") {
      return NextResponse.json({ error: "OpenRouter 免费额度或请求频率已达到限制，请稍后再试。" }, { status: 429 });
    }
    if (error.message === "free_model_unavailable") {
      return NextResponse.json({ error: "当前没有可用的免费视觉模型，请稍后再试。" }, { status: 502 });
    }
    if (error.message === "invalid_image_request") {
      return NextResponse.json({ error: "聊天截图格式无法识别，请重新粘贴或上传更清晰的图片。" }, { status: 400 });
    }
    if (error.message === "too_many_images") {
      return NextResponse.json({ error: "最多分析10张聊天截图。" }, { status: 400 });
    }
    if (error.message === "unsupported_image_type") {
      return NextResponse.json({ error: "不支持该图片格式。" }, { status: 400 });
    }
    if (error.message === "image_too_large") {
      return NextResponse.json({ error: "图片过大，请压缩后重试。" }, { status: 400 });
    }
    if (error.message === "invalid_model_json" || String(error.message || "").startsWith("missing_fields:")) {
      return NextResponse.json({ error: "聊天截图分析失败，请稍后重试。" }, { status: 502 });
    }

    console.error("Analyze chat screenshots failed:", error?.message || error);
    return NextResponse.json({ error: "聊天截图分析失败，请稍后重试。" }, { status: 502 });
  }
}
