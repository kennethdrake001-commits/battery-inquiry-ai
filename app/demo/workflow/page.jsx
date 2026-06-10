"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { generateCustomerWorkflow } from "../../../lib/customerWorkflow";
import CustomerStageBadge from "../../../components/workflow/CustomerStageBadge";
import CustomerWorkflowCard from "../../../components/workflow/CustomerWorkflowCard";
import LeadLevelBadge from "../../../components/workflow/LeadLevelBadge";

const demoCustomers = [
  {
    id: "end-user-ddp",
    customerName: "Amina",
    country: "Kenya",
    source: "Alibaba",
    customerType: "End User",
    stage: "Need Shipping Check",
    leadLevel: "B",
    quantity: "",
    destinationCity: "",
    shippingTerm: "DDP",
    originalMessage:
      "Hi, I need a home backup battery. Can you send me DDP price to my country?",
    question: "Customer wants DDP price but did not provide city yet.",
    nextAction: "",
    missingInfo: "",
    followUpDate: ""
  },
  {
    id: "installer-10kwh",
    customerName: "Bright Solar Tech",
    country: "Nigeria",
    source: "WhatsApp",
    customerType: "Solar Installer",
    stage: "Need Qualification",
    leadLevel: "A",
    quantity: "2 sets",
    destinationCity: "Lagos",
    shippingTerm: "FOB",
    originalMessage:
      "We need a 10kWh battery for a residential solar project. Please share inverter compatibility.",
    question: "Installer asked for 10kWh battery and compatibility details.",
    nextAction: "",
    missingInfo: "",
    followUpDate: ""
  },
  {
    id: "distributor-waiting",
    customerName: "Sunrise Energy Distribution",
    country: "South Africa",
    source: "Email",
    customerType: "Solar Distributor",
    stage: "Waiting Reply",
    leadLevel: "A",
    quantity: "50 pcs",
    destinationCity: "Johannesburg",
    shippingTerm: "FOB",
    originalMessage:
      "Thanks for the quotation. We are reviewing your 6kWh and 10kWh options now.",
    question: "Already quoted. Waiting for distributor feedback.",
    nextAction: "",
    missingInfo: "",
    followUpDate: ""
  }
];

function DemoCustomerCard({ customer, isActive, onSelect }) {
  return (
    <button
      className={`customer-card demo-customer-card ${isActive ? "selected-card" : ""}`}
      onClick={() => onSelect(customer.id)}
      type="button"
    >
      <div className="card-title">
        <strong>{customer.customerName}</strong>
        <LeadLevelBadge level={customer.leadLevel} />
      </div>
      <p>{customer.customerType}</p>
      <p><CustomerStageBadge stage={customer.stage} /></p>
      <p>Shipping: {customer.shippingTerm}</p>
      <p className="task-reason">{customer.question}</p>
    </button>
  );
}

export default function DemoWorkflowPage() {
  const initialCustomer = useMemo(() => {
    const first = demoCustomers[0];
    const recommendation = generateCustomerWorkflow(first);
    return {
      ...first,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate
    };
  }, []);

  const [selectedId, setSelectedId] = useState(demoCustomers[0].id);
  const [form, setForm] = useState(initialCustomer);

  function loadCustomer(customerId) {
    const customer = demoCustomers.find((item) => item.id === customerId);
    if (!customer) return;
    const recommendation = generateCustomerWorkflow(customer);
    setSelectedId(customerId);
    setForm({
      ...customer,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate
    });
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleGenerate() {
    const recommendation = generateCustomerWorkflow(form);
    setForm((current) => ({
      ...current,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate || current.followUpDate
    }));
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Demo Workflow</p>
          <h1>Customer Workflow Demo</h1>
          <p>公开演示客户推进逻辑，不需要登录，不会读取或保存真实数据。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/demo/workflow">Workflow Demo</Link>
          <Link href="/demo/tasks">Demo Tasks</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/tasks">今日任务</Link>
        </nav>
      </header>

      <div className="auth-card demo-banner">Demo mode, using sample data only.</div>

      <section className="panel">
        <div className="section-title">
          <h2>Sample Demo Customers</h2>
          <span>点击任意客户查看推荐跟进动作</span>
        </div>
        <div className="product-grid demo-customer-grid">
          {demoCustomers.map((customer) => (
            <DemoCustomerCard
              key={customer.id}
              customer={customer}
              isActive={customer.id === selectedId}
              onSelect={loadCustomer}
            />
          ))}
        </div>
      </section>

      <CustomerWorkflowCard
        title="Workflow Fields"
        subtitle="外部评审可直接查看 next action 逻辑是否合理"
        form={form}
        onChange={updateForm}
        onGenerate={handleGenerate}
      />

      <section className="panel">
        <div className="section-title">
          <h2>Customer Context</h2>
          <span>这些文本也会影响推荐动作</span>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>originalMessage</span>
            <textarea
              rows={4}
              value={form.originalMessage}
              onChange={(event) => updateForm("originalMessage", event.target.value)}
            />
          </label>
          <label className="field">
            <span>question</span>
            <textarea rows={4} value={form.question} onChange={(event) => updateForm("question", event.target.value)} />
          </label>
        </div>
      </section>
    </main>
  );
}
