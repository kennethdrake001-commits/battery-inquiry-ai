"use client";

import { useState } from "react";

export default function RecommendedScriptCard({ scriptTitle, scriptText, scriptType = "general" }) {
  const [copied, setCopied] = useState(false);
  const scriptTypeMap = {
    general: "通用",
    shipping: "运费",
    quotation: "报价跟进",
    installer: "安装商支持",
    distributor: "经销支持",
    qualification: "信息确认"
  };

  async function copyScript() {
    if (!scriptText) return;
    await navigator.clipboard.writeText(scriptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="notice-panel">
      <div className="card-title">
        <strong>{scriptTitle || "推荐英文回复"}</strong>
        <span>{scriptTypeMap[scriptType] || scriptType}</span>
      </div>
      <p>{scriptText || "暂时还没有可用的推荐英文回复。"}</p>
      <div className="actions compact">
        <button onClick={copyScript}>{copied ? "已复制" : "复制英文回复"}</button>
      </div>
    </div>
  );
}
