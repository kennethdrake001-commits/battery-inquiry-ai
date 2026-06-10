"use client";

import {
  customerTypeOptions,
  leadLevelOptions,
  shippingTermOptions,
  workflowStageOptions
} from "../../lib/options";
import GenerateNextActionButton from "./GenerateNextActionButton";
import RecommendedNextActionCard from "./RecommendedNextActionCard";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function CustomerWorkflowCard({
  title = "Customer Workflow",
  subtitle = "维护阶段、客户类型、缺失信息和跟进日期。",
  form,
  onChange,
  onGenerate,
  actions = null
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      <RecommendedNextActionCard
        nextAction={form.nextAction}
        missingInfo={form.missingInfo}
        followUpDate={form.followUpDate}
      />
      <div className="actions compact">
        <GenerateNextActionButton onClick={onGenerate} />
        {actions}
      </div>
      <div className="form-grid">
        <Field label="customerType">
          <select value={form.customerType} onChange={(event) => onChange("customerType", event.target.value)}>
            {customerTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="stage">
          <select value={form.stage} onChange={(event) => onChange("stage", event.target.value)}>
            {workflowStageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="leadLevel">
          <select value={form.leadLevel} onChange={(event) => onChange("leadLevel", event.target.value)}>
            {leadLevelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="quantity">
          <input value={form.quantity} onChange={(event) => onChange("quantity", event.target.value)} />
        </Field>
        <Field label="shippingTerm">
          <select value={form.shippingTerm} onChange={(event) => onChange("shippingTerm", event.target.value)}>
            {shippingTermOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="destinationCity">
          <input value={form.destinationCity} onChange={(event) => onChange("destinationCity", event.target.value)} />
        </Field>
        <Field label="nextAction">
          <textarea rows={3} value={form.nextAction} onChange={(event) => onChange("nextAction", event.target.value)} />
        </Field>
        <Field label="missingInfo">
          <textarea rows={3} value={form.missingInfo} onChange={(event) => onChange("missingInfo", event.target.value)} />
        </Field>
        <Field label="followUpDate">
          <input type="date" value={form.followUpDate} onChange={(event) => onChange("followUpDate", event.target.value)} />
        </Field>
      </div>
    </section>
  );
}
