"use client";

import {
  customerTypeOptions,
  leadLevelOptions,
  shippingTermOptions,
  workflowStageOptions
} from "../../lib/options";
import GenerateNextActionButton from "./GenerateNextActionButton";
import RecommendedNextActionCard from "./RecommendedNextActionCard";

const customerTypeLabelMap = {
  "End User": "终端用户",
  "Solar Installer": "太阳能安装商",
  "Solar Distributor": "太阳能经销商",
  "Battery Wholesaler": "电池批发商",
  "Inverter Distributor": "逆变器经销商",
  "OEM / Brand Owner": "OEM / 品牌方",
  Unknown: "待确认"
};

const stageLabelMap = {
  new_lead: "新线索",
  contacted: "已触达",
  engaged: "有互动",
  has_need: "有需求",
  material_sent: "已发资料",
  quoted: "已报价",
  follow_up: "跟进中",
  won: "成交",
  lost: "丢单",
  invalid: "无效",
  "New Inquiry": "新询盘",
  "Need Qualification": "待补信息",
  "Need Shipping Check": "待运费核算",
  "Need Quotation": "待报价",
  Quoted: "已报价",
  "Waiting Reply": "待回复",
  "Follow-up Needed": "需要跟进",
  Negotiation: "谈判中",
  "Trial Order": "试单",
  "Closed Won": "已成交",
  "Closed Lost": "已丢单"
};

const shippingTermLabelMap = {
  Unknown: "待确认",
  FOB: "FOB",
  CIF: "CIF",
  DDP: "DDP",
  EXW: "EXW",
  Other: "其他"
};

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function CustomerWorkflowCard({
  title = "客户流程",
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
        <Field label="客户类型">
          <select value={form.customerType} onChange={(event) => onChange("customerType", event.target.value)}>
            {customerTypeOptions.map((option) => (
              <option key={option} value={option}>
                {customerTypeLabelMap[option] || option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="当前阶段">
          <select value={form.stage} onChange={(event) => onChange("stage", event.target.value)}>
            {workflowStageOptions.map((option) => (
              <option key={option} value={option}>
                {stageLabelMap[option] || option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="客户等级">
          <select value={form.leadLevel} onChange={(event) => onChange("leadLevel", event.target.value)}>
            {leadLevelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="数量">
          <input value={form.quantity} onChange={(event) => onChange("quantity", event.target.value)} />
        </Field>
        <Field label="贸易方式">
          <select value={form.shippingTerm} onChange={(event) => onChange("shippingTerm", event.target.value)}>
            {shippingTermOptions.map((option) => (
              <option key={option} value={option}>
                {shippingTermLabelMap[option] || option}
              </option>
            ))}
          </select>
        </Field>
        <Field label="目的地城市">
          <input value={form.destinationCity} onChange={(event) => onChange("destinationCity", event.target.value)} />
        </Field>
        <Field label="下一步动作">
          <textarea rows={3} value={form.nextAction} onChange={(event) => onChange("nextAction", event.target.value)} />
        </Field>
        <Field label="缺失信息">
          <textarea rows={3} value={form.missingInfo} onChange={(event) => onChange("missingInfo", event.target.value)} />
        </Field>
        <Field label="跟进日期">
          <input type="date" value={form.followUpDate} onChange={(event) => onChange("followUpDate", event.target.value)} />
        </Field>
      </div>
    </section>
  );
}
