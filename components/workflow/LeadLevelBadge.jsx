export default function LeadLevelBadge({ level }) {
  const safeLevel = level || "C";
  return <span className={`level level-${safeLevel}`}>{safeLevel}</span>;
}
