"use client";

import { sourceOptions, statusOptions } from "../../lib/options";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function CustomerIntakeForm({
  title = "客户录入页",
  subtitle = "",
  form,
  onChange,
  primaryAction,
  secondaryActions = [],
  footer = null
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{subtitle}</span>
      </div>
      <div className="form-grid">
        <Field label="customerName 客户姓名">
          <input value={form.customerName} onChange={(event) => onChange("customerName", event.target.value)} />
        </Field>
        <Field label="country 国家">
          <input value={form.country} onChange={(event) => onChange("country", event.target.value)} />
        </Field>
        <Field label="source 客户来源">
          <select value={form.source} onChange={(event) => onChange("source", event.target.value)}>
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="quoted 是否已报价">
          <select value={form.quoted} onChange={(event) => onChange("quoted", event.target.value)}>
            <option value="no">否</option>
            <option value="yes">是</option>
          </select>
        </Field>
        <Field label="currentStatus 当前状态">
          <select value={form.currentStatus} onChange={(event) => onChange("currentStatus", event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="quoteContent 报价内容">
          <textarea rows={4} value={form.quoteContent} onChange={(event) => onChange("quoteContent", event.target.value)} />
        </Field>
        <Field label="originalMessage 客户原始消息">
          <textarea rows={5} value={form.originalMessage} onChange={(event) => onChange("originalMessage", event.target.value)} />
        </Field>
        <Field label="ourReply 我方已回复内容">
          <textarea rows={5} value={form.ourReply} onChange={(event) => onChange("ourReply", event.target.value)} />
        </Field>
        <Field label="question 我的困惑">
          <textarea rows={3} value={form.question} onChange={(event) => onChange("question", event.target.value)} />
        </Field>
      </div>
      <div className="actions">
        {primaryAction}
        {secondaryActions.map((action) => (
          <button
            key={action.label}
            className={action.primary ? "primary" : undefined}
            onClick={action.onClick}
            disabled={action.disabled}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
      {footer}
    </section>
  );
}
