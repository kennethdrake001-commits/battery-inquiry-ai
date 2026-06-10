export default function RecommendedNextActionCard({ nextAction, missingInfo, followUpDate }) {
  return (
    <div className="notice-panel workflow-warning">
      <strong>{nextAction || "还没有建议动作，请先点击“生成下一步动作”。"}</strong>
      <p>缺失信息：{missingInfo || "-"}</p>
      <p>跟进日期：{followUpDate || "-"}</p>
    </div>
  );
}
