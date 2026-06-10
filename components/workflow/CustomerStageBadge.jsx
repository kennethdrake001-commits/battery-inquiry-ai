export default function CustomerStageBadge({ stage }) {
  return <span className="stage-badge">{stage || "待确认"}</span>;
}
