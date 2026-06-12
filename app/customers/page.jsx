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
  onlyImportant: "否",
  showArchived: "否"
};

function isImportantCustomer(customer) {
  return customer?.lead_level === "A" || customer?.priority === true || customer?.is_important === true;
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
        const isArchived = customer.current_status === "归档" || customer.stage === "Archived";
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

        if (filters.showArchived !== "是" && isArchived) {
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
              <h2>筛选条件</h2>
              <div className="actions compact">
                <Link className="primary" href="/customers/new">新增客户</Link>
                <button type="button" onClick={() => setFilters(emptyFilters)}>清空筛选</button>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>客户名 / 公司名搜索</span>
                <input value={filters.keyword} onChange={(event) => updateFilter("keyword", event.target.value)} placeholder="输入客户名或公司名" />
              </label>
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
                <span>显示归档客户</span>
                <select value={filters.showArchived} onChange={(event) => updateFilter("showArchived", event.target.value)}>
                  <option value="否">否</option>
                  <option value="是">是</option>
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
                      <td><span className="soft-badge">{getLeadSourceLabel(getLeadSourceValue(customer)) || getSourceLabel(customer.source)}</span></td>
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
    </main>
  );
}
