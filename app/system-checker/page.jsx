"use client";

import { useState } from "react";
import Link from "next/link";

const initialForm = {
  country: "",
  useScenario: "Unknown",
  dailyConsumptionKwh: "",
  backupHours: "",
  batteryCapacityKwh: "",
  batteryVoltage: "",
  bmsCurrent: "",
  dischargeRate: "Unknown",
  inverterPowerKw: "",
  inverterType: "Unknown",
  hasMppt: "Unknown",
  solarPanelPowerKw: "",
  peakSunHours: "",
  hasHighStartupLoad: "Unknown",
  inverterBrandModel: "",
  notes: ""
};

const scenarioOptions = ["Home Backup", "Residential Solar", "Small Business", "Project", "Resale", "Unknown"];
const inverterTypeOptions = ["Hybrid", "Off-grid", "On-grid", "Unknown"];
const yesNoUnknownOptions = ["Yes", "No", "Unknown"];
const dischargeRateOptions = ["0.5C", "1C", "Unknown"];
const scenarioLabelMap = {
  "Home Backup": "家庭备电",
  "Residential Solar": "户用光伏",
  "Small Business": "小型商用",
  Project: "项目",
  Resale: "转售",
  Unknown: "待确认"
};
const inverterTypeLabelMap = {
  Hybrid: "混合型",
  "Off-grid": "离网型",
  "On-grid": "并网型",
  Unknown: "待确认"
};
const yesNoUnknownLabelMap = {
  Yes: "是",
  No: "否",
  Unknown: "待确认"
};

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isNaN(next) ? null : next;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function estimateOverallResult(signals) {
  if (signals.notRecommended) return "不建议";
  if (signals.risky) return "有风险";
  if (signals.needConfirmation) return "基本可行，但需确认";
  return "适合";
}

function buildCustomerReply(form, output) {
  const installerTone = ["Project", "Resale", "Small Business"].includes(form.useScenario);
  const intro = installerTone
    ? "Thanks for sharing the system information."
    : "Thanks for sharing the system details.";

  const compatibilityLine = output.overallResult === "Suitable"
    ? "From the information available, this setup looks basically workable."
    : output.overallResult === "Basically suitable but need confirmation"
      ? "This setup looks basically workable, but we still need to confirm a few key points."
      : output.overallResult === "Risky"
        ? "This setup has some compatibility risks, so we need to confirm a few points before we recommend it."
        : "Based on the current information, we would not recommend confirming this setup yet.";

  const communicationLine = form.inverterBrandModel
    ? installerTone
      ? `We also need to verify communication details with your inverter model ${form.inverterBrandModel}, especially for CAN or RS485 if required.`
      : `We also need to double-check the inverter model ${form.inverterBrandModel} before confirming compatibility.`
    : installerTone
      ? "Please share the inverter brand and model, because we cannot confirm communication compatibility without that."
      : "Please share the inverter brand and model, so we can confirm whether the match is suitable.";

  const loadLine = form.hasHighStartupLoad === "Yes"
    ? "If the system will run air conditioner, pump, or motor loads, we also need to confirm the startup surge power first."
    : "";

  return [intro, compatibilityLine, communicationLine, loadLine, output.nextAction]
    .filter(Boolean)
    .join(" ");
}

function runCompatibilityCheck(form) {
  const batteryCapacityKwh = toNumber(form.batteryCapacityKwh);
  const batteryVoltage = toNumber(form.batteryVoltage);
  const bmsCurrent = toNumber(form.bmsCurrent);
  const inverterPowerKw = toNumber(form.inverterPowerKw);
  const solarPanelPowerKw = toNumber(form.solarPanelPowerKw);
  const peakSunHours = toNumber(form.peakSunHours);
  const dailyConsumptionKwh = toNumber(form.dailyConsumptionKwh);
  const backupHours = toNumber(form.backupHours);

  const usableEnergy = batteryCapacityKwh ? round(batteryCapacityKwh * 0.9 * 0.85) : null;
  const batteryDischargePower = batteryVoltage && bmsCurrent ? round((batteryVoltage * bmsCurrent) / 1000) : null;
  const pvDailyGeneration = solarPanelPowerKw && peakSunHours ? round(solarPanelPowerKw * peakSunHours * 0.75) : null;

  const risks = [];
  const mustConfirmQuestions = [];
  const internalNotes = [];
  const signals = { notRecommended: false, risky: false, needConfirmation: false };

  let batteryRuntimeEstimate = "待确认";
  if (usableEnergy && inverterPowerKw) {
    const fullLoadRuntime = round(usableEnergy / inverterPowerKw);
    batteryRuntimeEstimate = `可用电量约 ${usableEnergy} kWh，按 ${inverterPowerKw} kW 持续负载估算约 ${fullLoadRuntime} 小时。`;
    if (dailyConsumptionKwh) {
      const averageLoad = round(dailyConsumptionKwh / 24);
      const averageRuntime = averageLoad > 0 ? round(usableEnergy / averageLoad) : null;
      if (averageRuntime) {
        batteryRuntimeEstimate += ` 若按平均负载约 ${averageLoad} kW 估算，可支持约 ${averageRuntime} 小时。`;
      }
    }
  } else if (usableEnergy) {
    batteryRuntimeEstimate = `可用电量约 ${usableEnergy} kWh。缺少完整负载信息，暂不能精确估算运行时间。`;
  }

  let inverterMatch = "待确认";
  if (inverterPowerKw && batteryCapacityKwh) {
    if (inverterPowerKw <= batteryCapacityKwh) {
      inverterMatch = "逆变器功率与电池容量搭配基本合理。";
    } else if (inverterPowerKw <= batteryCapacityKwh * 1.5) {
      inverterMatch = "逆变器功率可用，但相对电池容量偏大，需要确认实际负载和备用时长。";
      signals.needConfirmation = true;
      mustConfirmQuestions.push("实际持续负载大约多少 kW？");
    } else {
      inverterMatch = "逆变器功率相对电池容量明显偏大，可能导致电池很快放空。";
      signals.risky = true;
      risks.push("逆变器功率偏大，电池备用时间可能明显不足。");
    }
  }

  let batteryDischargeMatch = "待确认";
  if (batteryDischargePower && inverterPowerKw) {
    if (batteryDischargePower < inverterPowerKw) {
      batteryDischargeMatch = `电池最大放电功率约 ${batteryDischargePower} kW，低于逆变器功率 ${inverterPowerKw} kW，存在放电能力不足风险。`;
      signals.notRecommended = true;
      risks.push("电池最大放电能力低于逆变器额定功率。");
    } else if (batteryDischargePower <= inverterPowerKw * 1.1) {
      batteryDischargeMatch = `电池最大放电功率约 ${batteryDischargePower} kW，接近逆变器功率 ${inverterPowerKw} kW，可以运行但余量偏小。`;
      signals.risky = true;
      risks.push("电池放电功率余量较小，高负载时风险更高。");
    } else {
      batteryDischargeMatch = `电池最大放电功率约 ${batteryDischargePower} kW，高于逆变器功率 ${inverterPowerKw} kW，放电能力基本匹配。`;
    }
  }

  if (form.dischargeRate === "0.5C" && inverterPowerKw && batteryCapacityKwh && inverterPowerKw >= batteryCapacityKwh * 0.8) {
    signals.risky = true;
    risks.push("0.5C 电池在较高功率持续输出场景下不适合长期运行。");
    internalNotes.push("如果客户需要长期高功率输出，建议评估更高放电能力版本。");
  }

  let pvMatch = "待确认";
  if (pvDailyGeneration !== null) {
    pvMatch = `按日照 ${peakSunHours} 小时估算，光伏日发电量约 ${pvDailyGeneration} kWh。`;
    if (dailyConsumptionKwh !== null) {
      if (pvDailyGeneration >= dailyConsumptionKwh) {
        pvMatch += " 从发电量角度看，基本可以覆盖当前日用电。";
      } else {
        pvMatch += " 发电量可能不足以完全覆盖当前日用电，需要确认是否接受电网补能。";
        signals.needConfirmation = true;
        risks.push("光伏发电量可能不足以覆盖客户全天用电。");
      }
    }
  } else {
    pvMatch = "待确认：缺少太阳能板功率或峰值日照小时。";
    signals.needConfirmation = true;
    mustConfirmQuestions.push("太阳能板总功率和当地峰值日照小时分别是多少？");
  }

  let communicationCheck = "待确认";
  if (form.inverterBrandModel) {
    communicationCheck = "已提供逆变器品牌型号，但仍需根据具体品牌型号确认 CAN / RS485 或协议兼容。";
    signals.needConfirmation = true;
    mustConfirmQuestions.push("请确认逆变器品牌型号以及需要的通信方式（CAN / RS485 / 无通信）。");
  } else {
    communicationCheck = "未提供逆变器品牌型号，不能承诺通信兼容。";
    signals.needConfirmation = true;
    risks.push("未提供逆变器品牌型号，无法确认通信兼容。");
    mustConfirmQuestions.push("请提供逆变器品牌和型号。");
  }

  if (form.hasHighStartupLoad === "Yes") {
    signals.needConfirmation = true;
    risks.push("空调、水泵、电机类负载的启动功率可能明显高于持续功率。");
    mustConfirmQuestions.push("是否有空调、水泵、电机类负载？启动功率是多少？");
  }

  if (backupHours !== null && usableEnergy !== null && inverterPowerKw !== null) {
    const expectedNeed = round(inverterPowerKw * backupHours);
    if (usableEnergy < expectedNeed) {
      risks.push(`按 ${backupHours} 小时和 ${inverterPowerKw} kW 估算，电池可用能量可能不足。`);
      signals.risky = true;
    }
  }

  if (dailyConsumptionKwh === null) {
    mustConfirmQuestions.push("客户每日大约用电多少 kWh？");
    internalNotes.push("缺少 dailyConsumptionKwh，当前只能估算电池可用能量，不能判断全天是否足够。");
  }

  const overallResult = estimateOverallResult(signals);
  const nextAction = mustConfirmQuestions.length
    ? `Please confirm ${mustConfirmQuestions.slice(0, 2).join(" and ")}.`
    : "If the customer agrees, the next step is to confirm the exact inverter model and final load list.";

  const output = {
    overallResult,
    batteryRuntimeEstimate,
    inverterMatch,
    batteryDischargeMatch,
    pvMatch,
    communicationCheck,
    risks: risks.length ? risks : ["当前未发现明显高风险，但仍建议按具体负载清单复核。"],
    mustConfirmQuestions: mustConfirmQuestions.length ? [...new Set(mustConfirmQuestions)] : ["请确认最终负载清单和逆变器品牌型号。"],
    internalSuggestion: [
      `可用电量约 ${usableEnergy ?? "待确认"} kWh。`,
      batteryDischargePower ? `电池最大放电功率约 ${batteryDischargePower} kW。` : "缺少电压或 BMS 电流，无法确认最大放电功率。",
      ...internalNotes
    ].join(" "),
    customerReply: "",
    nextAction
  };

  output.customerReply = buildCustomerReply(form, output);
  return output;
}

export default function SystemCheckerPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function copyReply() {
    if (!result?.customerReply) return;
    await navigator.clipboard.writeText(result.customerReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">系统搭配校验器</p>
          <h1>系统搭配校验器</h1>
          <p>用于内部判断客户的电池、逆变器、太阳能板搭配是否合理。</p>
        </div>
        <nav>
          <Link href="/">客户录入</Link>
          <Link href="/customers">客户列表</Link>
          <Link href="/playbook">有效案例库</Link>
          <Link href="/products">产品知识库</Link>
          <Link href="/system-checker">系统搭配校验器</Link>
          <Link href="/tasks">今日任务</Link>
        </nav>
      </header>

      <section className="panel notice-panel">
        <strong>内部判断 ≠ 直接发客户</strong>
        <p>上半部分是给运营和技术内部判断用的，`customerReply` 才是可复制发送给客户的话术。</p>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>开始校验</h2>
          <span>先录入客户提供的系统参数</span>
        </div>
        <div className="form-grid">
          <Field label="country 客户国家">
            <input value={form.country} onChange={(event) => update("country", event.target.value)} />
          </Field>
          <Field label="useScenario 使用场景">
            <select value={form.useScenario} onChange={(event) => update("useScenario", event.target.value)}>
              {scenarioOptions.map((option) => <option key={option}>{scenarioLabelMap[option] || option}</option>)}
            </select>
          </Field>
          <Field label="dailyConsumptionKwh 每日用电量">
            <input value={form.dailyConsumptionKwh} onChange={(event) => update("dailyConsumptionKwh", event.target.value)} />
          </Field>
          <Field label="backupHours 备用小时">
            <input value={form.backupHours} onChange={(event) => update("backupHours", event.target.value)} />
          </Field>
          <Field label="batteryCapacityKwh 电池容量">
            <input value={form.batteryCapacityKwh} onChange={(event) => update("batteryCapacityKwh", event.target.value)} />
          </Field>
          <Field label="batteryVoltage 电池电压">
            <input value={form.batteryVoltage} onChange={(event) => update("batteryVoltage", event.target.value)} />
          </Field>
          <Field label="bmsCurrent BMS 电流">
            <input value={form.bmsCurrent} onChange={(event) => update("bmsCurrent", event.target.value)} />
          </Field>
          <Field label="dischargeRate 放电倍率">
            <select value={form.dischargeRate} onChange={(event) => update("dischargeRate", event.target.value)}>
              {dischargeRateOptions.map((option) => <option key={option}>{yesNoUnknownLabelMap[option] || option}</option>)}
            </select>
          </Field>
          <Field label="inverterPowerKw 逆变器功率">
            <input value={form.inverterPowerKw} onChange={(event) => update("inverterPowerKw", event.target.value)} />
          </Field>
          <Field label="inverterType 逆变器类型">
            <select value={form.inverterType} onChange={(event) => update("inverterType", event.target.value)}>
              {inverterTypeOptions.map((option) => <option key={option}>{inverterTypeLabelMap[option] || option}</option>)}
            </select>
          </Field>
          <Field label="hasMppt 是否带 MPPT">
            <select value={form.hasMppt} onChange={(event) => update("hasMppt", event.target.value)}>
              {yesNoUnknownOptions.map((option) => <option key={option}>{yesNoUnknownLabelMap[option] || option}</option>)}
            </select>
          </Field>
          <Field label="solarPanelPowerKw 太阳能板功率">
            <input value={form.solarPanelPowerKw} onChange={(event) => update("solarPanelPowerKw", event.target.value)} />
          </Field>
          <Field label="peakSunHours 峰值日照小时">
            <input value={form.peakSunHours} onChange={(event) => update("peakSunHours", event.target.value)} />
          </Field>
          <Field label="hasHighStartupLoad 是否有高启动负载">
            <select value={form.hasHighStartupLoad} onChange={(event) => update("hasHighStartupLoad", event.target.value)}>
              {yesNoUnknownOptions.map((option) => <option key={option}>{yesNoUnknownLabelMap[option] || option}</option>)}
            </select>
          </Field>
          <Field label="inverterBrandModel 逆变器品牌型号">
            <input value={form.inverterBrandModel} onChange={(event) => update("inverterBrandModel", event.target.value)} />
          </Field>
          <Field label="notes 其他客户描述">
            <textarea rows={4} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setResult(runCompatibilityCheck(form))}>校验系统搭配</button>
        </div>
      </section>

      {result && (
        <section className="panel">
          <div className="section-title">
            <h2>校验结果</h2>
            <span>先看内部判断，再复制客户回复</span>
          </div>
          <div className="checker-grid">
            <Field label="overallResult">
              <input value={result.overallResult} readOnly />
            </Field>
            <Field label="电池可用时间估算">
              <textarea rows={4} value={result.batteryRuntimeEstimate} readOnly />
            </Field>
            <Field label="逆变器匹配判断">
              <textarea rows={4} value={result.inverterMatch} readOnly />
            </Field>
            <Field label="电池放电匹配判断">
              <textarea rows={4} value={result.batteryDischargeMatch} readOnly />
            </Field>
            <Field label="光伏匹配判断">
              <textarea rows={4} value={result.pvMatch} readOnly />
            </Field>
            <Field label="通信兼容判断">
              <textarea rows={4} value={result.communicationCheck} readOnly />
            </Field>
          </div>

          <div className="two-col checker-sections">
            <div>
              <h3>风险提示</h3>
              <ul className="checker-list">
                {result.risks.map((item) => <li key={item}>{item}</li>)}
              </ul>

              <h3>必须确认的问题</h3>
              <ul className="checker-list">
                {result.mustConfirmQuestions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h3>内部建议</h3>
              <p className="checker-box">{result.internalSuggestion}</p>

              <h3>下一步动作</h3>
              <p className="checker-box">{result.nextAction}</p>
            </div>
          </div>

          <div className="reply-panel">
            <div className="section-title">
              <h2>客户英文回复</h2>
              <div className="actions compact">
                <button onClick={copyReply}>复制客户英文回复</button>
              </div>
            </div>
            <textarea rows={6} value={result.customerReply} readOnly />
            {copied && <p className="notice">已复制客户英文回复。</p>}
          </div>
        </section>
      )}
    </main>
  );
}
