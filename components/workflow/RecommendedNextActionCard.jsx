export default function RecommendedNextActionCard({ nextAction, missingInfo, followUpDate }) {
  return (
    <div className="notice-panel workflow-warning">
      <strong>{nextAction || "还没有规则建议，先点击 Generate Next Action。"}</strong>
      <p>Missing Info: {missingInfo || "-"}</p>
      <p>Follow-up Date: {followUpDate || "-"}</p>
    </div>
  );
}
