export default function CustomerStageBadge({ stage }) {
  return <span className="stage-badge">{stage || "Unknown"}</span>;
}
