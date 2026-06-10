export const sourceOptions = ["Alibaba", "WhatsApp", "Email", "LinkedIn", "Other"];

export const statusOptions = ["新询盘", "待补信息", "待报价", "已报价未回复", "异议处理", "PI付款", "成交", "归档"];

export const boardStages = ["新询盘", "待补信息", "待报价", "已报价未回复", "异议处理", "PI付款", "成交", "归档"];

export const customerTypeOptions = [
  "End User",
  "Solar Installer",
  "Solar Distributor",
  "Battery Wholesaler",
  "Inverter Distributor",
  "OEM / Brand Owner",
  "Unknown"
];

export const workflowStageOptions = [
  "New Inquiry",
  "Need Qualification",
  "Need Shipping Check",
  "Need Quotation",
  "Quoted",
  "Waiting Reply",
  "Follow-up Needed",
  "Negotiation",
  "Trial Order",
  "Closed Won",
  "Closed Lost"
];

export const leadLevelOptions = ["A", "B", "C"];

export const shippingTermOptions = ["Unknown", "FOB", "CIF", "DDP", "EXW", "Other"];

export const productStatusOptions = ["active", "draft", "archived"];

export const productFields = [
  ["product_name", "产品名称"],
  ["common_name", "常用简称"],
  ["voltage", "电压"],
  ["capacity_kwh", "容量 kWh"],
  ["capacity_ah", "容量 Ah"],
  ["battery_type", "电池类型"],
  ["installation_type", "安装方式"],
  ["bms_current", "BMS 电流"],
  ["discharge_rate", "放电倍率"],
  ["communication", "通信"],
  ["parallel_support", "并联支持"],
  ["cycle_life", "循环寿命"],
  ["certifications", "认证"],
  ["warranty", "质保"],
  ["fob_price", "FOB 价格"],
  ["fob_port", "FOB 港口"],
  ["moq", "MOQ"],
  ["lead_time", "交期"],
  ["suitable_customers", "适合客户"],
  ["suitable_scenarios", "适合场景"],
  ["risk_notes", "风险备注"],
  ["status", "状态"]
];

export const emptyProductForm = {
  product_name: "",
  model: "",
  category: "",
  application: "",
  short_description: "",
  status: "active",
  voltage: "",
  capacity_ah: "",
  energy_kwh: "",
  cell_type: "",
  bms: "",
  communication: "",
  parallel_support: "",
  cycle_life: "",
  max_charge_current: "",
  max_discharge_current: "",
  dimensions: "",
  weight: "",
  ip_rating: "",
  warranty: "",
  certifications: "",
  compatible_inverters: "",
  currency: "USD",
  base_price: "",
  price_term: "FOB",
  port: "",
  moq: "",
  price_note: "",
  lead_time: "",
  common_name: "",
  capacity_kwh: "",
  battery_type: "",
  installation_type: "",
  bms_current: "",
  discharge_rate: "",
  fob_price: "",
  fob_port: "",
  suitable_customers: "",
  suitable_scenarios: "",
  risk_notes: ""
};

export const emptyCustomerForm = {
  customerName: "",
  country: "",
  source: "Alibaba",
  originalMessage: "",
  ourReply: "",
  quoted: "no",
  quoteContent: "",
  currentStatus: "新询盘",
  question: "",
  customerType: "Unknown",
  stage: "New Inquiry",
  leadLevel: "C",
  quantity: "",
  destinationCity: "",
  shippingTerm: "Unknown",
  nextAction: "",
  missingInfo: "",
  followUpDate: ""
};
