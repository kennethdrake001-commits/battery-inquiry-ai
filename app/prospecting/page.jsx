"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/layout/AppNav";
import { formatNextActionForDisplay } from "../../lib/displayText";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import {
  getCustomerName,
  getCustomerTypeLabel,
  getCustomerTypeValue,
  getSourceLabel
} from "../../lib/customerViews";

const prospectingStages = [
  "未联系",
  "已发第一封",
  "第一次跟进",
  "第二次跟进",
  "已回复",
  "有兴趣",
  "不合适",
  "已转正式客户"
];

const importHeaders = ["公司名", "国家", "客户类型", "官网", "邮箱", "LinkedIn", "联系人", "WhatsApp", "来源渠道", "备注"];

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到工作台登录邮箱账号。</div>;
}

function formatDate(value) {
  if (!value) return "未设置";
  try {
    return new Date(value).toLocaleDateString("zh-CN");
  } catch {
    return "未设置";
  }
}

function getProspectingStage(customer) {
  const savedStatus = customer.current_status || "";
  if (prospectingStages.includes(savedStatus)) return savedStatus;

  if (savedStatus === "归档" || customer.stage === "Closed Lost") return "不合适";
  if (customer.last_customer_reply_at) {
    if (customer.stage === "Need Quotation" || customer.stage === "Negotiation" || customer.stage === "Trial Order") {
      return "有兴趣";
    }
    return "已回复";
  }

  if (customer.last_contacted_at && customer.follow_up_date) {
    const days = Math.floor((Date.now() - new Date(customer.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 6) return "第二次跟进";
    return "第一次跟进";
  }

  if (customer.last_contacted_at) return "已发第一封";
  return "未联系";
}

function getProspectingNextAction(customer) {
  const stage = getProspectingStage(customer);
  if (customer.current_next_action || customer.next_action) {
    return formatNextActionForDisplay(customer.current_next_action || customer.next_action);
  }

  switch (stage) {
    case "未联系":
      return "发送首封开发信，介绍主营产品并确认客户方向";
    case "已发第一封":
      return "等待 3 天后进行第一次跟进";
    case "第一次跟进":
      return "补充产品卖点、应用案例和可供货能力";
    case "第二次跟进":
      return "进行最后一次轻跟进，确认是否继续保持联系";
    case "已回复":
      return "判断客户是否有真实需求，并补齐数量、应用和采购时间";
    case "有兴趣":
      return "转入正式客户流程，准备资料、报价或样品推进";
    case "不合适":
      return "标记为暂不推进，保留档案备查";
    case "已转正式客户":
      return "进入正式客户详情页继续推进需求与报价";
    default:
      return "需要人工判断下一步动作";
  }
}

function getProspectingScript(customer) {
  const stage = getProspectingStage(customer);
  const name = getCustomerName(customer);
  const type = getCustomerTypeValue(customer);

  if (stage === "未联系") {
    return {
      title: "首封开发信",
      text: `Hi ${name}, we are a supplier of lithium battery energy storage solutions for solar projects and backup power. I noticed your company may be active in this market, so I wanted to ask whether you are currently sourcing home storage batteries, commercial battery systems, or related solar products. If yes, I can share our main models and offer details for your review.`
    };
  }

  if (stage === "已发第一封" || stage === "第一次跟进") {
    return {
      title: "第一次跟进话术",
      text: `Hi ${name}, just following up on my previous message. We supply LiFePO4 battery systems for solar installers and distributors, with support for common inverter brands and project applications. Please let me know if you are currently looking for any battery products, and I can send the most relevant models and pricing information.`
    };
  }

  if (stage === "第二次跟进") {
    return {
      title: "第二次跟进话术",
      text: `Hi ${name}, I’m checking in one more time in case battery storage products are still in your plan. If now is not the right time, no problem. If you want, I can still send a short product list so you have it on hand when needed.`
    };
  }

  if (stage === "已回复") {
    return {
      title: "回复后需求确认",
      text: `Hi ${name}, thanks for your reply. To recommend the right solution, may I know what battery capacity, quantity, and main application you are looking for? If you already have a target inverter brand or project type, I can check the most suitable option for you.`
    };
  }

  if (stage === "有兴趣" && type === "Solar Distributor") {
    return {
      title: "经销商推进话术",
      text: `Hi ${name}, thanks for your interest. I can send you our main battery models, distributor supply information, and recommended capacities for your market. Please let me know which capacity range and order quantity you are mainly evaluating, and I will prepare the most relevant offer for you.`
    };
  }

  if (stage === "有兴趣" && type === "Solar Installer") {
    return {
      title: "安装商推进话术",
      text: `Hi ${name}, thanks for your interest. I can send you the battery datasheet, installation photos, and inverter compatibility information for review. Please share the inverter brand and model you are using, and I will prepare the matching information for you.`
    };
  }

  if (stage === "有兴趣") {
    return {
      title: "有兴趣客户推进话术",
      text: `Hi ${name}, thanks for your interest. Please let me know the product capacity, target quantity, and delivery destination you need, and I will prepare the most suitable quotation and product information for you.`
    };
  }

  return {
    title: "通用开发话术",
    text: `Hi ${name}, I’m following up to see whether your company is currently evaluating lithium battery storage products. If you share your target application, quantity, and market focus, I can prepare the most relevant product information for you.`
  };
}

function getTaskReason(customer) {
  const stage = getProspectingStage(customer);
  if (stage === "未联系") return "今天应发送首封开发信";
  if (stage === "已发第一封") return "首封已发，准备第一次跟进";
  if (stage === "第一次跟进") return "已到第一次跟进节点";
  if (stage === "第二次跟进") return "已到第二次跟进节点";
  if (stage === "已回复") return "客户已回复，需要判断是否有真实需求";
  if (stage === "有兴趣") return "客户表现出兴趣，需要尽快转入正式流程";
  return "根据当前开发阶段继续推进";
}

function getFollowUpDate(customer) {
  return customer.next_follow_up_at || customer.follow_up_date || customer.updated_at || customer.created_at || "";
}

function getContactSummary(customer) {
  const parts = [customer.email, customer.website].filter(Boolean);
  return parts.length ? parts.join(" / ") : "待补充";
}

const pageSize = 10;

export default function ProspectingPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef(null);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setError("请先配置 Supabase 环境变量。");
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (!data.session) {
        setLoading(false);
        return;
      }

      await loadCustomers();
      setLoading(false);
    }

    init();
  }, [supabase]);

  async function loadCustomers() {
    const { data: rows, error: queryError } = await supabase
      .from("customers")
      .select("*")
      .order("updated_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    setCustomers(rows || []);
  }

  const activeCustomers = useMemo(() => {
    return customers.filter((customer) => customer.current_status !== "归档" && customer.stage !== "Archived");
  }, [customers]);

  const todayTasks = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return activeCustomers
      .filter((customer) => {
        const stage = getProspectingStage(customer);
        if (stage === "不合适" || stage === "已转正式客户") return false;
        if (stage === "未联系" || stage === "已回复" || stage === "有兴趣") return true;
        const followUpAt = getFollowUpDate(customer);
        return followUpAt ? new Date(followUpAt).getTime() <= today.getTime() : false;
      })
      .map((customer) => ({
        ...customer,
        prospectingStage: getProspectingStage(customer),
        prospectingAction: getProspectingNextAction(customer),
        taskReason: getTaskReason(customer)
      }));
  }, [activeCustomers]);

  const targetPool = useMemo(() => {
    return activeCustomers
      .filter((customer) => getProspectingStage(customer) !== "已转正式客户")
      .map((customer) => ({
        ...customer,
        prospectingStage: getProspectingStage(customer),
        prospectingAction: getProspectingNextAction(customer)
      }));
  }, [activeCustomers]);

  const boardGroups = useMemo(() => {
    const map = Object.fromEntries(prospectingStages.map((stage) => [stage, []]));
    targetPool.forEach((customer) => {
      map[customer.prospectingStage].push(customer);
    });
    return map;
  }, [targetPool]);

  const filteredTargetPool = useMemo(() => {
    if (!selectedStage) return targetPool;
    return targetPool.filter((customer) => customer.prospectingStage === selectedStage);
  }, [selectedStage, targetPool]);

  const totalPages = Math.max(1, Math.ceil(filteredTargetPool.length / pageSize));
  const pagedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTargetPool.slice(start, start + pageSize);
  }, [filteredTargetPool, page]);

  useEffect(() => {
    if (selectedId && !targetPool.find((customer) => customer.id === selectedId)) {
      setSelectedId("");
    }
  }, [selectedId, targetPool]);

  useEffect(() => {
    setPage(1);
  }, [selectedStage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const selectedCustomer = targetPool.find((customer) => customer.id === selectedId) || null;
  const selectedScript = selectedCustomer ? getProspectingScript(selectedCustomer) : null;

  async function copyScript(text) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("英文开发信已复制。");
    } catch {
      setNotice("复制失败，请手动复制。");
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function downloadTemplate() {
    const csv = [
      importHeaders.join(","),
      "ABC Solar,Kenya,Solar Distributor,https://example.com,sales@example.com,https://linkedin.com/company/example,John,+254700000000,主动开发,重点跟进东非市场"
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "目标客户导入模板.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice("导入模板已下载。");
  }

  function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === "\"") {
        if (inQuotes && nextChar === "\"") {
          current += "\"";
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  async function handleCsvUpload(event) {
    setError("");
    setNotice("");

    const file = event.target.files?.[0];
    if (!file) return;

    if (!session?.user?.id) {
      setError("请先登录后再导入客户。");
      event.target.value = "";
      return;
    }

    try {
      const content = await file.text();
      const lines = content
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setError("导入失败：请使用模板字段上传 CSV");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((item) => item.trim());
      if (
        headers.length < importHeaders.length
        || importHeaders.some((header, index) => headers[index] !== header)
      ) {
        setError("导入失败：请使用模板字段上传 CSV");
        return;
      }

      const now = new Date().toISOString();
      const rows = lines.slice(1);
      const inserts = rows
        .map((line) => {
          const cols = parseCsvLine(line);
          const companyName = cols[0]?.trim();
          if (!companyName) return null;

          const country = cols[1]?.trim() || "";
          const customerType = cols[2]?.trim() || "Unknown";
          const website = cols[3]?.trim() || "";
          const email = cols[4]?.trim() || "";
          const linkedin = cols[5]?.trim() || "";
          const contactName = cols[6]?.trim() || "";
          const whatsapp = cols[7]?.trim() || "";
          const sourceChannel = cols[8]?.trim() || "主动开发";
          const note = cols[9]?.trim() || "";

          const contactLines = [
            website ? `官网：${website}` : "",
            email ? `邮箱：${email}` : "",
            linkedin ? `LinkedIn：${linkedin}` : "",
            contactName ? `联系人：${contactName}` : "",
            whatsapp ? `WhatsApp：${whatsapp}` : "",
            sourceChannel ? `来源渠道：${sourceChannel}` : "",
            note ? `备注：${note}` : ""
          ].filter(Boolean);

          return {
            user_id: session.user.id,
            customer_name: companyName,
            country,
            source: "主动开发",
            customer_type: customerType,
            stage: "Prospecting",
            current_status: "未联系",
            lead_level: "C",
            next_action: "发送首封开发信",
            current_next_action: "发送首封开发信",
            original_message: contactLines.join("\n"),
            question: note || "主动开发导入客户",
            updated_at: now
          };
        })
        .filter(Boolean);

      if (inserts.length === 0) {
        setError("导入失败：没有可导入的客户，请确认公司名不为空。");
        return;
      }

      const { error: insertError } = await supabase.from("customers").insert(inserts);
      if (insertError) {
        setError(`导入失败：${insertError.message}`);
        return;
      }

      await loadCustomers();
      setNotice(`成功导入 ${inserts.length} 个目标客户`);
    } catch {
      setError("导入失败：请使用模板字段上传 CSV");
    } finally {
      event.target.value = "";
    }
  }

  async function convertToFormalCustomer(customer) {
    setError("");
    setNotice("");

    const confirmed = window.confirm("确定将这个客户转为正式客户吗？转入后请在客户详情中继续推进需求和报价。");
    if (!confirmed) return;

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        current_status: "已转正式客户",
        stage: customer.stage && customer.stage !== "Archived" ? customer.stage : "Need Qualification",
        current_next_action: customer.current_next_action || "补齐需求并推进正式报价",
        updated_at: now
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(`转为正式客户失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    setNotice("已转为正式客户。");
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">主动开发</p>
          <h1>主动开发流程推进器</h1>
          <p>从目标客户收集、开发信发送、跟进判断到转为正式客户，都集中在这里推进。</p>
        </div>
        <AppNav />
      </header>

      <AuthNotice session={session} />
      {loading && <section className="panel">加载中...</section>}
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      {!loading && session && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={handleCsvUpload}
          />

          <section className="panel">
            <div className="section-title">
              <h2>今日开发任务</h2>
              <span>{todayTasks.length} 项</span>
            </div>
            <div className="card-list">
              {todayTasks.slice(0, 5).map((customer) => (
                <article className="customer-card" key={customer.id}>
                  <strong>{getCustomerName(customer)}</strong>
                  <p>当前阶段：{customer.prospectingStage}</p>
                  <p>下一步动作：{customer.prospectingAction}</p>
                  <p>下次跟进：{formatDate(getFollowUpDate(customer))}</p>
                  <div className="actions compact">
                    <button type="button" onClick={() => setSelectedId(customer.id)}>生成英文开发信</button>
                    <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                  </div>
                </article>
              ))}
              {todayTasks.length === 0 && <p className="empty">今天暂无待推进的开发任务</p>}
            </div>
            {todayTasks.length > 5 && (
              <p className="empty">还有 {todayTasks.length - 5} 个开发任务，查看全部。</p>
            )}
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>批量导入目标客户</h2>
              <span>先支持 CSV 模板</span>
            </div>
            <p className="notice">
              把从 Google Maps、LinkedIn、官网收集到的客户整理成 CSV 后导入，系统会加入目标客户池并从“未联系”阶段开始推进。
            </p>
            <div className="actions compact">
              <button type="button" onClick={handleImportClick}>上传 CSV</button>
              <button type="button" onClick={downloadTemplate}>下载导入模板</button>
            </div>
            <div className="detail-grid" style={{ marginTop: 16 }}>
              <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                <strong>导入模板字段</strong>
                <p>公司名、国家、客户类型、官网、邮箱、LinkedIn、联系人、WhatsApp、来源渠道、备注</p>
              </div>
              <div className="detail-item"><strong>默认阶段</strong><p>未联系</p></div>
              <div className="detail-item"><strong>默认下一步动作</strong><p>发送首封开发信</p></div>
              <div className="detail-item"><strong>默认下次跟进日期</strong><p>空</p></div>
              <div className="detail-item"><strong>默认客户来源</strong><p>主动开发</p></div>
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>开发阶段概览</h2>
              <div className="actions compact">
                <button
                  type="button"
                  onClick={() => setSelectedStage("")}
                  style={selectedStage ? undefined : { border: "1px solid #155eef", color: "#155eef", background: "#eff6ff", fontWeight: 700 }}
                >
                  全部客户
                </button>
              </div>
            </div>
            <div
              className="summary-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12
              }}
            >
              {prospectingStages.map((stage) => (
                <button
                  key={stage}
                  type="button"
                  className="summary-card"
                  onClick={() => setSelectedStage(stage)}
                  style={selectedStage === stage
                    ? {
                      border: "1px solid #155eef",
                      boxShadow: "0 0 0 2px rgba(21,94,239,0.08)",
                      background: "#eff6ff",
                      borderRadius: 16,
                      padding: 16,
                      textAlign: "left"
                    }
                    : {
                      background: "#ffffff",
                      borderRadius: 16,
                      padding: 16,
                      textAlign: "left",
                      border: "1px solid #dbe5f1"
                    }}
                >
                  <strong>{stage}</strong>
                  <span style={{ display: "block", marginTop: 8, fontSize: 28, fontWeight: 700 }}>
                    {(boardGroups[stage] || []).length}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>目标客户池</h2>
              <span>{filteredTargetPool.length} 个目标客户{selectedStage ? ` · 当前筛选：${selectedStage}` : ""}</span>
            </div>
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>公司名</th>
                    <th>国家</th>
                    <th>客户类型</th>
                    <th>当前阶段</th>
                    <th>下一步动作</th>
                    <th>下次跟进日期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>{getCustomerName(customer)}</td>
                      <td>{customer.country || "待补充"}</td>
                      <td><span className="soft-badge">{getCustomerTypeLabel(getCustomerTypeValue(customer))}</span></td>
                      <td>{customer.prospectingStage}</td>
                      <td className="truncate-cell">{customer.prospectingAction}</td>
                      <td>{formatDate(getFollowUpDate(customer))}</td>
                      <td>
                        <div className="actions compact">
                          <button type="button" onClick={() => setSelectedId(customer.id)}>生成英文开发信</button>
                          <Link href={`/customers/${customer.id}`}>查看/编辑</Link>
                          <button type="button" onClick={() => convertToFormalCustomer(customer)}>转为正式客户</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTargetPool.length === 0 && <p className="empty">暂无目标客户。请先下载模板，整理客户名单后上传 CSV。</p>}
            {filteredTargetPool.length > 0 && (
              <div className="actions compact" style={{ marginTop: 16, justifyContent: "space-between" }}>
                <span>第 {page} / {totalPages} 页</span>
                <div className="actions compact">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    上一页
                  </button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    下一页
                  </button>
                </div>
              </div>
            )}
          </section>

          {selectedCustomer && (
            <section className="panel">
              <div className="section-title">
                <h2>开发信操作面板</h2>
                <span>{getCustomerName(selectedCustomer)}</span>
              </div>
              {selectedScript && (
                <>
                  <div className="detail-grid">
                    <div className="detail-item"><strong>当前客户名</strong><p>{getCustomerName(selectedCustomer)}</p></div>
                    <div className="detail-item"><strong>当前阶段</strong><p>{getProspectingStage(selectedCustomer)}</p></div>
                    <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                      <strong>下一步动作</strong>
                      <p>{getProspectingNextAction(selectedCustomer)}</p>
                    </div>
                    <div className="detail-item" style={{ gridColumn: "1 / -1" }}>
                      <strong>{selectedScript.title}</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{selectedScript.text}</p>
                    </div>
                  </div>
                  <div className="actions compact">
                    <button type="button" onClick={() => copyScript(selectedScript.text)}>复制英文开发信</button>
                    <Link href={`/customers/${selectedCustomer.id}`}>查看/编辑客户</Link>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
