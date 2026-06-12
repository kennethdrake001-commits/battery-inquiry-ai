"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/layout/AppNav";
import { formatNextActionForDisplay } from "../../lib/displayText";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import {
  getCustomerName,
  getCustomerTypeLabel,
  getCustomerTypeValue,
  getLeadLevel,
  getNextAction,
  getSourceLabel,
  getStageLabel,
  getStageValue,
  isPartnerCandidate
} from "../../lib/customerViews";
import {
  getChannelStatusLabel,
  getLeadProgressStageLabel,
  getLeadSourceLabel,
  getLeadSourceValue,
  isLeadProgressCustomer
} from "../../lib/leadProgress";

function AuthNotice({ session }) {
  if (session) return <div className="auth-card">已登录：{session.user.email}</div>;
  return <div className="auth-card">请先回到工作台登录邮箱账号。</div>;
}

const emptyFilters = {
  customerScope: "全部客户",
  keyword: "",
  country: "",
  customerType: "",
  leadSource: "",
  leadLevel: "",
  status: "",
  nextAction: "",
  followUpRange: "",
  channelStatus: "",
  partnerCandidate: "",
  onlyImportant: "否"
};

function isImportantCustomer(customer) {
  return customer?.lead_level === "A" || customer?.priority === true || customer?.is_important === true;
}

function isArchivedCustomer(customer) {
  return customer?.current_status === "归档"
    || customer?.current_status === "已归档"
    || customer?.stage === "Archived"
    || customer?.stage === "归档";
}

function isProspectingCustomer(customer) {
  return customer?.source === "主动开发"
    || customer?.customer_source === "主动开发"
    || customer?.stage === "Prospecting"
    || customer?.current_status === "Prospecting";
}

function matchLeadSource(customer, leadSource) {
  if (!leadSource) return true;
  return `${getLeadSourceValue(customer)}` === leadSource;
}

function formatDateOnly(value) {
  if (!value) return "待安排";
  const text = `${value}`.trim();
  if (!text) return "待安排";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CustomersPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [isSavingProspect, setIsSavingProspect] = useState(false);
  const [prospectForm, setProspectForm] = useState({
    customer_name: "",
    country: "",
    customer_type: "Unknown",
    lead_source: "Google Maps",
    website: "",
    linkedin: "",
    facebook: "",
    whatsapp: "",
    email: "",
    note: ""
  });
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
    if (!supabase) return;

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

  async function insertCustomerWithFallback(payload) {
    let draft = { ...payload };

    for (let index = 0; index < 6; index += 1) {
      const { data, error: insertError } = await supabase
        .from("customers")
        .insert(draft)
        .select("*")
        .single();

      if (!insertError) {
        return { data, error: null };
      }

      const missingColumn = insertError.message?.match(/Could not find the '([^']+)' column/i)?.[1];
      if (!missingColumn || !(missingColumn in draft)) {
        return { data: null, error: insertError };
      }

      const nextDraft = { ...draft };
      delete nextDraft[missingColumn];
      draft = nextDraft;
    }

    return { data: null, error: new Error("保存客户失败：字段兼容处理超过重试次数。") };
  }

  const filteredCustomers = useMemo(() => {
    return [...customers]
      .filter((customer) => {
        const country = customer.country || "";
        const type = getCustomerTypeValue(customer);
        const level = getLeadLevel(customer);
        const status = isLeadProgressCustomer(customer)
          ? getLeadProgressStageLabel(customer)
          : getStageLabel(getStageValue(customer));
        const partnerCandidate = isPartnerCandidate(customer);
        const isArchived = isArchivedCustomer(customer);
        const isProspect = isProspectingCustomer(customer);
        const important = isImportantCustomer(customer);
        const keyword = filters.keyword.trim().toLowerCase();
        const nameText = String(customer.customer_name || customer.company_name || "").toLowerCase();
        const messageText = String(customer.original_message || "").toLowerCase();
        const nextActionText = formatNextActionForDisplay(customer.current_next_action || customer.next_action || getNextAction(customer)).toLowerCase();
        const followUpText = customer.next_follow_up_at || customer.follow_up_date || "";
        const followUpDate = followUpText ? new Date(followUpText) : null;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const channelText = [
          getChannelStatusLabel("linkedin_status", customer.linkedin_status, customer),
          getChannelStatusLabel("facebook_status", customer.facebook_status, customer),
          getChannelStatusLabel("email_status", customer.email_status, customer),
          getChannelStatusLabel("whatsapp_status", customer.whatsapp_status, customer)
        ].join(" ").toLowerCase();

        if (filters.customerScope === "已归档") {
          if (!isArchived) return false;
        } else if (isArchived) {
          return false;
        }

        if (filters.customerScope === "询盘客户" && isProspect) {
          return false;
        }

        if (filters.customerScope === "主动开发客户" && !isProspect) {
          return false;
        }

        if (filters.customerScope === "重点客户" && !important) {
          return false;
        }

        if (keyword && !nameText.includes(keyword) && !messageText.includes(keyword)) {
          return false;
        }

        return (!filters.country || country === filters.country)
          && (!filters.customerType || type === filters.customerType)
          && matchLeadSource(customer, filters.leadSource)
          && (!filters.leadLevel || level === filters.leadLevel)
          && (!filters.status || status === filters.status)
          && (!filters.nextAction || nextActionText.includes(filters.nextAction.trim().toLowerCase()))
          && (!filters.channelStatus || channelText.includes(filters.channelStatus.trim().toLowerCase()))
          && (
            !filters.followUpRange
            || (filters.followUpRange === "今日及以前" && followUpDate && followUpDate.getTime() <= today.getTime())
            || (filters.followUpRange === "已安排" && followUpText)
            || (filters.followUpRange === "未安排" && !followUpText)
          )
          && (!filters.partnerCandidate
            || (filters.partnerCandidate === "是" ? partnerCandidate : !partnerCandidate))
          && (filters.onlyImportant !== "是" || important);
      })
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });
  }, [customers, filters]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function updateProspectForm(field, value) {
    setProspectForm((current) => ({ ...current, [field]: value }));
  }

  const customerScopeOptions = ["全部客户", "询盘客户", "主动开发客户", "重点客户", "已归档"];

  async function saveProspectCustomer() {
    if (!supabase || !session?.user) {
      setError("请先登录后再新增主动开发客户。");
      return;
    }

    const customerName = prospectForm.customer_name.trim();
    if (!customerName) {
      setError("请先填写公司名或客户名。");
      return;
    }

    setError("");
    setNotice("");
    setIsSavingProspect(true);

    const now = new Date().toISOString();
    const note = prospectForm.note.trim();
    const leadSource = prospectForm.lead_source || "Google Maps";
    const website = prospectForm.website.trim();
    const linkedin = prospectForm.linkedin.trim();
    const facebook = prospectForm.facebook.trim();
    const whatsapp = prospectForm.whatsapp.trim();
    const email = prospectForm.email.trim();
    const payload = {
      user_id: session.user.id,
      customer_name: customerName,
      company_name: customerName,
      country: prospectForm.country.trim() || null,
      customer_type: prospectForm.customer_type || "Unknown",
      source: "主动开发",
      customer_source: "主动开发",
      lead_source: leadSource,
      website: website || null,
      linkedin: linkedin || null,
      facebook: facebook || null,
      whatsapp: whatsapp || null,
      email: email || null,
      stage: "Prospecting",
      current_status: "新线索",
      current_next_action: "判断是否值得触达",
      next_action: "判断是否值得触达",
      lead_level: "C",
      notes: note || null,
      note: note || null,
      internal_note: note || null,
      question: note || null,
      original_message: [
        "客户来源：主动开发",
        `线索渠道：${leadSource}`,
        website ? `官网：${website}` : "",
        linkedin ? `LinkedIn：${linkedin}` : "",
        facebook ? `Facebook：${facebook}` : "",
        whatsapp ? `WhatsApp：${whatsapp}` : "",
        email ? `邮箱：${email}` : "",
        note ? `备注：${note}` : ""
      ].filter(Boolean).join("\n"),
      updated_at: now
    };

    const { error: insertError } = await insertCustomerWithFallback(payload);
    setIsSavingProspect(false);

    if (insertError) {
      setError(`新增主动开发客户失败：${insertError.message}`);
      return;
    }

    setProspectForm({
      customer_name: "",
      country: "",
      customer_type: "Unknown",
      lead_source: "Google Maps",
      website: "",
      linkedin: "",
      facebook: "",
      whatsapp: "",
      email: "",
      note: ""
    });
    setShowProspectModal(false);
    await loadCustomers();
    setNotice("主动开发客户已保存。");
  }

  async function archiveCustomer(customer) {
    setError("");
    setNotice("");

    const confirmed = window.confirm("确定归档这个客户吗？归档后默认不再显示在客户列表中。");
    if (!confirmed) return;

    const { error: archiveError } = await supabase
      .from("customers")
      .update({
        current_status: "归档",
        stage: "Archived",
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id);

    if (archiveError) {
      setError(`归档失败：${archiveError.message}`);
      return;
    }

    await loadCustomers();
    setNotice("客户已归档。可在“显示归档客户”中查看。");
  }

  async function toggleImportantCustomer(customer) {
    setError("");
    setNotice("");

    const nextLevel = isImportantCustomer(customer) ? "C" : "A";
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        lead_level: nextLevel,
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id);

    if (updateError) {
      setError(`更新重点客户失败：${updateError.message}`);
      return;
    }

    await loadCustomers();
    setNotice(nextLevel === "A" ? "客户已标记为重点跟进。" : "已取消重点跟进标记。");
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">客户</p>
          <h1>客户列表</h1>
          <p>列表页只看核心判断信息，完整资料进入详情页查看。</p>
        </div>
        <AppNav />
      </header>

      <AuthNotice session={session} />

      {loading && <section className="panel">加载客户中...</section>}
      {error && <div className="error">{error}</div>}
      {notice && <div className="success">{notice}</div>}

      {!loading && session && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>客户筛选</h2>
              <div className="actions compact">
                <Link className="primary" href="/customers/new">新增询盘客户</Link>
                <button type="button" onClick={() => setShowProspectModal(true)}>新增主动开发客户</button>
                <button type="button" onClick={() => setFilters(emptyFilters)}>清空筛选</button>
              </div>
            </div>
            <p className="subtle" style={{ marginTop: 0 }}>
              客户列表统一管理询盘客户和主动开发客户。主动开发客户可通过“新增主动开发客户”录入，并在“主动开发客户”筛选中查看。
            </p>
            <div className="field" style={{ marginBottom: 16 }}>
              <span>客户范围</span>
              <div className="actions compact" style={{ flexWrap: "wrap", marginTop: 8, gap: 10 }}>
                {customerScopeOptions.map((option) => {
                  const active = filters.customerScope === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={active ? "primary" : ""}
                      onClick={() => updateFilter("customerScope", option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>搜索客户名 / 公司名</span>
                <input value={filters.keyword} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="输入客户名或公司名" />
              </label>
            </div>
            <div className="panel" style={{ marginTop: 16, padding: 16 }}>
              <div className="section-title">
                <div>
                  <h3 style={{ marginBottom: 6 }}>高级筛选</h3>
                  <p className="subtle" style={{ margin: 0 }}>
                    按国家、客户类型、来源、阶段、跟进时间进一步筛选。
                  </p>
                </div>
                <button type="button" onClick={() => setShowAdvancedFilters((current) => !current)}>
                  {showAdvancedFilters ? "收起高级筛选" : "展开高级筛选"}
                </button>
              </div>
              {showAdvancedFilters && (
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <label className="field">
                    <span>国家</span>
                    <input value={filters.country} onChange={(event) => updateFilter("country", event.target.value)} placeholder="输入国家筛选" />
                  </label>
                  <label className="field">
                    <span>客户类型</span>
                    <select value={filters.customerType} onChange={(event) => updateFilter("customerType", event.target.value)}>
                      <option value="">全部</option>
                      <option value="End User">终端用户</option>
                      <option value="Solar Installer">安装商</option>
                      <option value="Solar Distributor">太阳能经销商</option>
                      <option value="Battery Wholesaler">电池批发商</option>
                      <option value="Inverter Distributor">逆变器经销商</option>
                      <option value="OEM / Brand Owner">OEM / 品牌方</option>
                      <option value="Unknown">待判断</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>来源渠道</span>
                    <select value={filters.leadSource} onChange={(event) => updateFilter("leadSource", event.target.value)}>
                      <option value="">全部</option>
                      {["Google Maps", "LinkedIn", "FB", "Alibaba", "Website", "Referral", "Email", "WhatsApp", "主动开发", "Other"].map((item) => (
                        <option key={item} value={item}>{getLeadSourceLabel(item) || getSourceLabel(item)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>客户等级</span>
                    <select value={filters.leadLevel} onChange={(event) => updateFilter("leadLevel", event.target.value)}>
                      <option value="">全部</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>当前状态</span>
                    <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                      <option value="">全部</option>
                      {["新线索", "已触达", "有互动", "有需求", "已发资料", "已报价", "跟进中", "成交", "丢单", "无效"].map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>下一步动作</span>
                    <input value={filters.nextAction} onChange={(event) => updateFilter("nextAction", event.target.value)} placeholder="输入下一步动作关键词" />
                  </label>
                  <label className="field">
                    <span>下次跟进时间</span>
                    <select value={filters.followUpRange} onChange={(event) => updateFilter("followUpRange", event.target.value)}>
                      <option value="">全部</option>
                      <option value="今日及以前">今日及以前</option>
                      <option value="已安排">已安排</option>
                      <option value="未安排">未安排</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>渠道状态</span>
                    <input value={filters.channelStatus} onChange={(event) => updateFilter("channelStatus", event.target.value)} placeholder="如 已发送连接 / 已私信 / 已回复" />
                  </label>
                  <label className="field">
                    <span>是否合作商候选</span>
                    <select value={filters.partnerCandidate} onChange={(event) => updateFilter("partnerCandidate", event.target.value)}>
                      <option value="">全部</option>
                      <option value="是">是</option>
                      <option value="否">否</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>只看重点客户</span>
                    <select value={filters.onlyImportant} onChange={(event) => updateFilter("onlyImportant", event.target.value)}>
                      <option value="否">否</option>
                      <option value="是">是</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>客户列表</h2>
              <span>{filteredCustomers.length} 个客户</span>
            </div>
            <div className="table-wrap">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>客户名 / 公司名</th>
                    <th>国家</th>
                    <th>客户类型</th>
                    <th>客户来源</th>
                    <th>客户等级</th>
                    <th>当前状态</th>
                    <th>下一步动作</th>
                    <th>下次跟进时间</th>
                    <th>合作商候选</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>{getCustomerName(customer)}</td>
                      <td>{customer.country || "-"}</td>
                      <td><span className="soft-badge">{getCustomerTypeLabel(getCustomerTypeValue(customer))}</span></td>
                      <td>
                        <div className="actions compact" style={{ gap: 8, justifyContent: "flex-start", flexWrap: "wrap" }}>
                          <span className="soft-badge">{getLeadSourceLabel(getLeadSourceValue(customer)) || getSourceLabel(customer.source)}</span>
                          <span className="soft-badge">{isProspectingCustomer(customer) ? "主动开发" : "询盘客户"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="actions compact" style={{ gap: 8, justifyContent: "flex-start" }}>
                          <span className={`level level-${getLeadLevel(customer)}`}>{getLeadLevel(customer)}</span>
                          {isImportantCustomer(customer) && <span className="soft-badge">重点</span>}
                        </div>
                      </td>
                      <td>{isLeadProgressCustomer(customer) ? getLeadProgressStageLabel(customer) : getStageLabel(getStageValue(customer))}</td>
                      <td className="truncate-cell">{formatNextActionForDisplay(customer.next_action || customer.current_next_action || getNextAction(customer))}</td>
                      <td>{formatDateOnly(customer.next_follow_up_at || customer.follow_up_date)}</td>
                      <td>{isPartnerCandidate(customer) ? "是" : "否"}</td>
                      <td>
                        <div className="actions compact">
                          <Link href={`/customers/${customer.id}`}>查看详情</Link>
                          <button type="button" onClick={() => toggleImportantCustomer(customer)}>
                            {isImportantCustomer(customer) ? "取消重点" : "标记重点"}
                          </button>
                          <button type="button" onClick={() => archiveCustomer(customer)}>归档</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCustomers.length === 0 && <p className="empty">暂无客户</p>}
          </section>
        </>
      )}

      {showProspectModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowProspectModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 1000
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 680,
              background: "#fff",
              borderRadius: 20,
              padding: 24,
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
              border: "1px solid rgba(148, 163, 184, 0.24)"
            }}
          >
            <div className="section-title" style={{ alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h2 style={{ marginBottom: 8 }}>新增主动开发客户</h2>
                <p className="subtle" style={{ margin: 0 }}>
                  用于录入你从 Google Maps、LinkedIn、FB、官网等渠道主动找到的目标客户。保存后默认进入主动开发客户池。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProspectModal(false)}
                aria-label="关闭弹窗"
                style={{
                  minWidth: 44,
                  width: 44,
                  height: 44,
                  padding: 0,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>公司名 / 客户名</span>
                <input
                  value={prospectForm.customer_name}
                  onChange={(event) => updateProspectForm("customer_name", event.target.value)}
                  placeholder="输入公司名或客户名"
                />
              </label>
              <label className="field">
                <span>国家</span>
                <input
                  value={prospectForm.country}
                  onChange={(event) => updateProspectForm("country", event.target.value)}
                  placeholder="输入国家"
                />
              </label>
              <label className="field">
                <span>客户类型</span>
                <select value={prospectForm.customer_type} onChange={(event) => updateProspectForm("customer_type", event.target.value)}>
                  <option value="Unknown">待判断</option>
                  <option value="Solar Installer">安装商</option>
                  <option value="Solar Distributor">经销商</option>
                  <option value="Battery Wholesaler">批发商</option>
                  <option value="OEM / Brand Owner">品牌商 / OEM</option>
                  <option value="End User">终端用户</option>
                </select>
              </label>
              <label className="field">
                <span>来源渠道</span>
                <select value={prospectForm.lead_source} onChange={(event) => updateProspectForm("lead_source", event.target.value)}>
                  <option value="Google Maps">Google Maps</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="FB">FB</option>
                  <option value="Website">Website</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Other">其他</option>
                </select>
              </label>
              <label className="field">
                <span>官网</span>
                <input
                  value={prospectForm.website}
                  onChange={(event) => updateProspectForm("website", event.target.value)}
                  placeholder="输入公司官网，例如 https://example.com"
                />
              </label>
              <label className="field">
                <span>LinkedIn</span>
                <input
                  value={prospectForm.linkedin}
                  onChange={(event) => updateProspectForm("linkedin", event.target.value)}
                  placeholder="输入 LinkedIn 公司页或个人链接"
                />
              </label>
              <label className="field">
                <span>Facebook</span>
                <input
                  value={prospectForm.facebook}
                  onChange={(event) => updateProspectForm("facebook", event.target.value)}
                  placeholder="输入 Facebook 主页链接"
                />
              </label>
              <label className="field">
                <span>WhatsApp</span>
                <input
                  value={prospectForm.whatsapp}
                  onChange={(event) => updateProspectForm("whatsapp", event.target.value)}
                  placeholder="输入 WhatsApp 号码"
                />
              </label>
              <label className="field">
                <span>邮箱</span>
                <input
                  value={prospectForm.email}
                  onChange={(event) => updateProspectForm("email", event.target.value)}
                  placeholder="输入客户邮箱"
                />
              </label>
              <label className="field field-span-2">
                <span>备注</span>
                <textarea
                  rows={4}
                  value={prospectForm.note}
                  onChange={(event) => updateProspectForm("note", event.target.value)}
                  placeholder="补充这个目标客户的背景、渠道来源或判断依据"
                />
              </label>
            </div>
            <div className="actions compact" style={{ justifyContent: "flex-end", marginTop: 24, gap: 14, paddingTop: 8 }}>
              <button type="button" onClick={() => setShowProspectModal(false)}>取消</button>
              <button className="primary" type="button" onClick={saveProspectCustomer} disabled={isSavingProspect} style={{ minWidth: 168 }}>
                {isSavingProspect ? "保存中..." : "保存主动开发客户"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
