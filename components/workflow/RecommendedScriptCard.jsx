"use client";

import { useState } from "react";

export default function RecommendedScriptCard({ scriptTitle, scriptText, scriptType = "general" }) {
  const [copied, setCopied] = useState(false);

  async function copyScript() {
    if (!scriptText) return;
    await navigator.clipboard.writeText(scriptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="notice-panel">
      <div className="card-title">
        <strong>{scriptTitle || "Recommended Script"}</strong>
        <span>{scriptType}</span>
      </div>
      <p>{scriptText || "No recommended script yet."}</p>
      <div className="actions compact">
        <button onClick={copyScript}>{copied ? "Copied" : "Copy Script"}</button>
      </div>
    </div>
  );
}
