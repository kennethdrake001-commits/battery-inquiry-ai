"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { emptyProductForm, productFields, productStatusOptions } from "../../lib/options";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function ProductCard({ product, onSelect, selected }) {
  return (
    <button className={`product-card ${selected ? "selected-card" : ""}`} onClick={() => onSelect(product)} type="button">
      <div className="card-title">
        <strong>{product.product_name || "未命名产品"}</strong>
        <span>{product.status || "-"}</span>
      </div>
      <p>{product.common_name || "-"}</p>
      <p>{product.capacity_kwh ?? "-"} kWh · {product.voltage || "-"}</p>
      <p>{product.installation_type || "-"}</p>
      <p>FOB：{product.fob_price || "-"}</p>
      <p>{product.suitable_customers || "-"}</p>
    </button>
  );
}

export default function ProductsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProducts() {
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

    const { data: rows, error: queryError } = await supabase
      .from("products")
      .select("*")
      .order("updated_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setProducts(rows || []);
      if (rows?.length && !selectedProduct) {
        setSelectedProduct(rows[0]);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, [supabase]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startNewProduct() {
    setSelectedProduct(null);
    setForm(emptyProductForm);
    setError("");
    setSuccess("");
  }

  function startEditProduct(product) {
    setSelectedProduct(product);
    const nextForm = { ...emptyProductForm };
    Object.keys(nextForm).forEach((key) => {
      nextForm[key] = product[key] ?? nextForm[key];
    });
    setForm(nextForm);
    setError("");
    setSuccess("");
  }

  async function saveProduct() {
    if (!session) {
      setError("请先登录后再管理产品。");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      ...form,
      capacity_kwh: form.capacity_kwh === "" ? null : Number(form.capacity_kwh),
      capacity_ah: form.capacity_ah === "" ? null : Number(form.capacity_ah),
      created_by: session.user.id,
      updated_at: new Date().toISOString()
    };

    const query = selectedProduct
      ? supabase.from("products").update(payload).eq("id", selectedProduct.id)
      : supabase.from("products").insert(payload);

    const { error: saveError } = await query;
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSuccess(selectedProduct ? "产品已更新。" : "产品已新增。");
    await loadProducts();
    if (!selectedProduct) {
      setForm(emptyProductForm);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Product Knowledge</p>
          <h1>产品知识库</h1>
          <p>先维护最小版产品资料，供 AI 分析客户时参考，避免乱编参数。</p>
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

      {session ? <div className="auth-card">已登录：{session.user.email}</div> : <div className="auth-card">请先回到客户录入页登录邮箱账号。</div>}
      {loading && <section className="panel">加载产品中...</section>}
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {!loading && session && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>产品列表</h2>
              <div className="actions compact">
                <button className="primary" onClick={startNewProduct}>新增产品</button>
              </div>
            </div>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  selected={selectedProduct?.id === product.id}
                  onSelect={startEditProduct}
                />
              ))}
              {products.length === 0 && <p className="empty">暂无产品</p>}
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>{selectedProduct ? "编辑产品" : "新增产品"}</h2>
              <span>{selectedProduct ? `更新时间：${formatTime(selectedProduct.updated_at)}` : "填写产品资料"}</span>
            </div>
            <div className="form-grid">
              {productFields.map(([key, label]) => (
                <Field key={key} label={label}>
                  {key === "status" ? (
                    <select value={form[key]} onChange={(event) => updateForm(key, event.target.value)}>
                      {productStatusOptions.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  ) : ["suitable_customers", "suitable_scenarios", "risk_notes"].includes(key) ? (
                    <textarea rows={3} value={form[key]} onChange={(event) => updateForm(key, event.target.value)} />
                  ) : (
                    <input value={form[key]} onChange={(event) => updateForm(key, event.target.value)} />
                  )}
                </Field>
              ))}
            </div>
            <div className="actions">
              <button className="primary" onClick={saveProduct} disabled={saving}>
                {saving ? "保存中..." : selectedProduct ? "保存修改" : "创建产品"}
              </button>
              <button onClick={startNewProduct}>清空表单</button>
            </div>
          </section>

          {selectedProduct && (
            <section className="panel">
              <div className="section-title">
                <h2>产品详情</h2>
                <span>{selectedProduct.product_name || "-"}</span>
              </div>
              <div className="detail-grid">
                {productFields.map(([key, label]) => (
                  <div className="detail-item" key={key}>
                    <strong>{label}</strong>
                    <p>{selectedProduct[key] ?? "待确认"}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
