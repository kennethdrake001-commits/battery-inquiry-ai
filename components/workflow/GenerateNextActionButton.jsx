export default function GenerateNextActionButton({ onClick, disabled = false }) {
  return (
    <button className="primary" onClick={onClick} disabled={disabled} type="button">
      Generate Next Action
    </button>
  );
}
