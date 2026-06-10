"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CustomerBoard from "../../../components/customers/CustomerBoard";
import CustomerIntakeForm from "../../../components/customers/CustomerIntakeForm";
import TaskListPanel from "../../../components/tasks/TaskListPanel";
import CustomerWorkflowCard from "../../../components/workflow/CustomerWorkflowCard";
import { emptyCustomerForm } from "../../../lib/options";
import { generateCustomerWorkflow } from "../../../lib/customerWorkflow";
import { buildTaskRows } from "../../../lib/taskWorkflow";

const initialMockCustomers = [
  {
    id: "test-1",
    customer_name: "Amina Home Backup",
    country: "Kenya",
    source: "Alibaba",
    current_status: "待补信息",
    customer_type: "End User",
    stage: "Need Shipping Check",
    lead_level: "B",
    quantity: "",
    shipping_term: "DDP",
    destination_city: "",
    next_action: "Ask destination city and country before checking DDP shipping.",
    missing_info: "Order quantity\nDestination city/country",
    follow_up_date: "",
    latest_analysis: { mainBlocker: "运费" },
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "test-2",
    customer_name: "Bright Solar Tech",
    country: "Nigeria",
    source: "WhatsApp",
    current_status: "待报价",
    customer_type: "Solar Installer",
    stage: "Need Qualification",
    lead_level: "A",
    quantity: "2 sets",
    shipping_term: "FOB",
    destination_city: "Lagos",
    next_action: "Send datasheet, installation photos, and inverter compatibility information.",
    missing_info: "",
    follow_up_date: "",
    latest_analysis: { mainBlocker: "需求不清" },
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }
];

function toMockCustomerRecord(form) {
  return {
    id: `test-${Date.now()}`,
    customer_name: form.customerName || "未命名客户",
    country: form.country,
    source: form.source,
    current_status: form.currentStatus,
    customer_type: form.customerType,
    stage: form.stage,
    lead_level: form.leadLevel,
    quantity: form.quantity,
    shipping_term: form.shippingTerm,
    destination_city: form.destinationCity,
    next_action: form.nextAction,
    missing_info: form.missingInfo,
    follow_up_date: form.followUpDate,
    latest_analysis: {
      mainBlocker: form.missingInfo ? "需求不清" : "其他"
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export default function TestWorkflowPage() {
  const [form, setForm] = useState({
    ...emptyCustomerForm,
    customerName: "Demo Prospect",
    country: "Tanzania",
    source: "Email",
    originalMessage: "Need DDP quote for 10kWh battery system.",
    question: "Need to know city and quantity first."
  });
  const [customers, setCustomers] = useState(initialMockCustomers);
  const [message, setMessage] = useState("");

  const tasks = useMemo(() => buildTaskRows(customers), [customers]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function generateNextAction() {
    const recommendation = generateCustomerWorkflow(form);
    setForm((current) => ({
      ...current,
      nextAction: recommendation.nextAction,
      missingInfo: recommendation.missingInfo.join("\n"),
      followUpDate: recommendation.followUpDate || current.followUpDate,
      leadLevel: recommendation.leadLevel || current.leadLevel
    }));
    setMessage("Testing mode: workflow recommendation generated from shared logic.");
  }

  function saveCustomer() {
    const recommendation = generateCustomerWorkflow(form);
    const nextForm = {
      ...form,
      nextAction: form.nextAction || recommendation.nextAction,
      missingInfo: form.missingInfo || recommendation.missingInfo.join("\n"),
      followUpDate: form.followUpDate || recommendation.followUpDate,
      leadLevel: form.leadLevel || recommendation.leadLevel
    };
    setForm(nextForm);
    setCustomers((current) => [toMockCustomerRecord(nextForm), ...current]);
    setMessage("Testing mode: customer saved to local page state only.");
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">测试模式</p>
          <h1>流程测试页</h1>
          <p>测试模式，仅使用模拟数据</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/demo/workflow">流程演示</Link>
          <Link href="/demo/tasks">演示任务</Link>
          <Link href="/test/workflow">流程测试</Link>
        </nav>
      </header>

      <div className="auth-card demo-banner">测试模式，仅使用模拟数据</div>

      <CustomerIntakeForm
        title="客户录入表单"
        subtitle="公开测试页：使用真实共享组件，但只保存到本地状态。"
        form={form}
        onChange={updateForm}
        primaryAction={
          <button className="primary" onClick={saveCustomer} type="button">
            保存客户
          </button>
        }
        secondaryActions={[
          {
            label: "AI 生成跟进方案",
            onClick: generateNextAction
          }
        ]}
        footer={message ? <div className="success">{message}</div> : null}
      />

      <CustomerWorkflowCard
        form={form}
        onChange={updateForm}
        onGenerate={generateNextAction}
        title="推荐下一步动作"
        subtitle="与真实登录页共用同一套 workflow 组件和逻辑。"
      />

      <CustomerBoard customers={customers} />
      <TaskListPanel tasks={tasks} title="今日跟进任务" subtitle="测试模式下基于本地客户数据生成" />
    </main>
  );
}
