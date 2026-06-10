import { boardStages } from "../../lib/options";
import CustomerCard from "./CustomerCard";

export default function CustomerBoard({ customers, hrefForCustomer = null }) {
  const groups = Object.fromEntries(boardStages.map((stage) => [stage, []]));

  customers.forEach((customer) => {
    const stage = customer.current_status || customer.latest_analysis?.stage || "新询盘";
    if (!groups[stage]) groups[stage] = [];
    groups[stage].push(customer);
  });

  return (
    <section className="board">
      {boardStages.map((stage) => (
        <div className="stage-column" key={stage}>
          <h2>{stage}</h2>
          <div className="card-list">
            {(groups[stage] || []).map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                href={hrefForCustomer ? hrefForCustomer(customer) : null}
              />
            ))}
            {(groups[stage] || []).length === 0 && <p className="empty">暂无客户</p>}
          </div>
        </div>
      ))}
    </section>
  );
}
