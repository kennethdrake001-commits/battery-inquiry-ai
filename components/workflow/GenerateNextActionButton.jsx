export default function GenerateNextActionButton({ onClick, disabled = false }) {
  return (
    <button className="primary" onClick={onClick} disabled={disabled} type="button">
      生成下一步动作
    </button>
  );
}
