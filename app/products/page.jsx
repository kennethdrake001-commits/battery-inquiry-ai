"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { emptyProductForm, productStatusOptions } from "../../lib/options";

const basicFields = [
  ["product_name", "产品名称"],
  ["model", "产品型号"],
  ["category", "产品分类"],
  ["application", "应用场景"],
  ["short_description", "简短描述", "textarea"],
  ["status", "状态", "select"]
];

const technicalFields = [
  ["voltage", "电压"],
  ["capacity_ah", "容量 Ah"],
  ["energy_kwh", "能量 kWh"],
  ["cell_type", "电芯类型"],
  ["bms", "BMS"],
  ["cycle_life", "循环寿命"],
  ["max_charge_current", "最大充电电流"],
  ["max_discharge_current", "最大放电电流"],
  ["communication", "通信方式"],
  ["parallel_support", "并联支持"],
  ["dimensions", "尺寸"],
  ["weight", "重量"],
  ["ip_rating", "IP 等级 / IP Rating"],
  ["warranty", "质保"],
  ["certifications", "认证", "textarea"],
  ["compatible_inverters", "兼容逆变器", "textarea"]
];

const priceFields = [
  ["currency", "币种"],
  ["base_price", "基础价格"],
  ["price_term", "价格条款"],
  ["port", "港口"],
  ["moq", "MOQ"],
  ["price_note", "价格备注", "textarea"],
  ["lead_time", "交期"]
];

const assetGroups = [
  { type: "main_image", label: "主图", accept: "image/*", multiple: false },
  { type: "gallery_image", label: "图库图片", accept: "image/*", multiple: true },
  { type: "datasheet", label: "产品规格书", accept: ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar", multiple: true },
  { type: "user_manual", label: "用户手册", accept: ".pdf,.doc,.docx,.zip,.rar", multiple: false },
  { type: "certificate", label: "认证文件", accept: ".pdf,.jpg,.jpeg,.png,.zip,.rar", multiple: true },
  { type: "test_report", label: "测试报告", accept: ".pdf,.doc,.docx,.zip,.rar", multiple: false },
  { type: "product_catalog", label: "产品目录", accept: ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar", multiple: false },
  { type: "installation_guide", label: "安装指南", accept: ".pdf,.doc,.docx,.zip,.rar", multiple: false }
];

const fileSectionConfigs = [
  { key: "datasheet", title: "产品规格书", assetTypes: ["datasheet"], emptyText: "暂无规格书", uploadTypes: ["datasheet"] },
  { key: "certificate", title: "认证文件", assetTypes: ["certificate"], emptyText: "暂无认证文件", uploadTypes: ["certificate"] },
  { key: "user_manual", title: "用户手册", assetTypes: ["user_manual"], emptyText: "暂无用户手册", uploadTypes: ["user_manual"] },
  { key: "installation", title: "安装图 / 接线图", assetTypes: ["gallery_image", "installation_guide"], emptyText: "暂无安装图 / 接线图", uploadTypes: ["gallery_image", "installation_guide"] },
  { key: "others", title: "其他文件", assetTypes: ["test_report", "product_catalog"], emptyText: "暂无其他文件", uploadTypes: ["test_report", "product_catalog"] }
];

const productSections = ["壁挂式电池", "落地式电池", "一体机", "未分类产品", "归档产品"];
const productCategoryOptions = ["壁挂式电池", "落地式电池", "一体机"];
const simpleProductFields = [
  ["product_name", "产品名称"],
  ["category", "产品分类"]
];

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

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function bucketForAssetType(assetType) {
  return ["main_image", "gallery_image"].includes(assetType) ? "product-images" : "product-files";
}

function isImageAsset(asset) {
  return ["main_image", "gallery_image"].includes(asset.asset_type) || String(asset.file_type || "").startsWith("image/");
}

function normalizeProductToForm(product) {
  return {
    ...emptyProductForm,
    ...product,
    model: product.model || product.common_name || "",
    energy_kwh: product.energy_kwh ?? product.capacity_kwh ?? "",
    cell_type: product.cell_type || product.battery_type || "",
    bms: product.bms || product.bms_current || "",
    category: product.category || product.installation_type || "",
    application: product.application || product.suitable_scenarios || "",
    base_price: product.base_price ?? product.fob_price ?? "",
    port: product.port || product.fob_port || "",
    price_note: product.price_note || product.risk_notes || "",
    price_term: product.price_term || "FOB",
    currency: product.currency || "USD",
    internal_notes: product.risk_notes || product.internal_notes || product.product_note || product.notes || ""
  };
}

function buildProductPayload(form, userId) {
  const energyKwh = numberOrNull(form.energy_kwh);
  const capacityAh = numberOrNull(form.capacity_ah);
  const basePrice = numberOrNull(form.base_price);

  return {
    product_name: form.product_name,
    model: form.model,
    category: form.category,
    application: form.application,
    short_description: form.short_description,
    status: form.status,
    voltage: form.voltage,
    capacity_ah: capacityAh,
    energy_kwh: energyKwh,
    cell_type: form.cell_type,
    bms: form.bms,
    cycle_life: form.cycle_life,
    max_charge_current: form.max_charge_current,
    max_discharge_current: form.max_discharge_current,
    communication: form.communication,
    parallel_support: form.parallel_support,
    dimensions: form.dimensions,
    weight: form.weight,
    ip_rating: form.ip_rating,
    warranty: form.warranty,
    certifications: form.certifications,
    compatible_inverters: form.compatible_inverters,
    currency: form.currency,
    base_price: basePrice,
    price_term: form.price_term,
    port: form.port,
    moq: form.moq,
    price_note: form.price_note,
    lead_time: form.lead_time,
    common_name: form.model || form.product_name || "",
    capacity_kwh: energyKwh,
    battery_type: form.cell_type,
    installation_type: form.category,
    bms_current: form.bms,
    fob_price: form.price_term === "FOB" && basePrice !== null ? String(basePrice) : null,
    fob_port: form.port || null,
    suitable_customers: form.category || "",
    suitable_scenarios: form.application || "",
    risk_notes: form.internal_notes || form.risk_notes || "",
    created_by: userId,
    updated_at: new Date().toISOString()
  };
}

function getInternalNoteValue(product) {
  return product?.risk_notes || product?.internal_notes || product?.product_note || product?.notes || "";
}

function getProductSection(product) {
  if (String(product?.status || "").toLowerCase() === "archived") return "归档产品";
  const category = String(product?.category || product?.product_type || "").trim();
  if (category === "壁挂式电池") return "壁挂式电池";
  if (category === "落地式电池") return "落地式电池";
  if (category === "一体机") return "一体机";

  const haystack = [product?.product_name, product?.model].filter(Boolean).join(" ").toLowerCase();

  if (
    haystack.includes("壁挂")
    || haystack.includes("wall")
    || haystack.includes("wall-mounted")
  ) return "壁挂式电池";

  if (
    haystack.includes("落地")
    || haystack.includes("floor")
    || haystack.includes("standing")
    || haystack.includes("stack")
    || haystack.includes("tower")
  ) return "落地式电池";

  if (
    haystack.includes("一体机")
    || haystack.includes("all-in-one")
    || haystack.includes("inverter")
    || haystack.includes("ess")
  ) return "一体机";

  return "未分类产品";
}

function getUploadInputId(productId, assetType) {
  return `product-upload-${productId}-${assetType}`;
}

export default function ProductsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [assetsByProduct, setAssetsByProduct] = useState({});
  const [coverImageMap, setCoverImageMap] = useState({});
  const [uploadQueue, setUploadQueue] = useState({});
  const [editingProductId, setEditingProductId] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function hydrateAssetUrls(rows) {
    if (!supabase || !rows?.length) return [];
    const resolved = await Promise.all(rows.map(async (item) => {
      const bucket = bucketForAssetType(item.asset_type);
      const { data } = await supabase.storage.from(bucket).createSignedUrl(item.storage_path, 3600);
      return {
        ...item,
        signed_url: data?.signedUrl || item.file_url || ""
      };
    }));
    return resolved;
  }

  async function loadAssetsForProducts(productRows) {
    if (!supabase || !session?.user || !productRows?.length) {
      setAssetsByProduct({});
      setCoverImageMap({});
      return;
    }

    const ids = productRows.map((product) => product.id);
    const { data: rows, error: queryError } = await supabase
      .from("product_assets")
      .select("*")
      .in("product_id", ids)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }

    const resolved = await hydrateAssetUrls(rows || []);
    const nextAssetMap = {};
    const nextCoverMap = {};

    resolved.forEach((asset) => {
      if (!nextAssetMap[asset.product_id]) nextAssetMap[asset.product_id] = [];
      nextAssetMap[asset.product_id].push(asset);
      if (!nextCoverMap[asset.product_id] && asset.asset_type === "main_image" && asset.signed_url) {
        nextCoverMap[asset.product_id] = asset.signed_url;
      }
    });

    setAssetsByProduct(nextAssetMap);
    setCoverImageMap(nextCoverMap);
  }

  async function loadProducts(preferredId = null) {
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
      setLoading(false);
      return;
    }

    setProducts(rows || []);
    const nextSelected =
      (preferredId && rows?.find((item) => item.id === preferredId))
      || (selectedProduct?.id && rows?.find((item) => item.id === selectedProduct.id))
      || rows?.[0]
      || null;
    setSelectedProduct(nextSelected || null);
    if (nextSelected) {
      setForm(normalizeProductToForm(nextSelected));
    }
    await loadAssetsForProducts(rows || []);
    setLoading(false);
  }

  async function loadAssets(productId) {
    if (!supabase || !session?.user || !productId) {
      setAssetsByProduct((current) => ({ ...current, [productId]: [] }));
      return;
    }

    const { data: rows, error: queryError } = await supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setAssetsByProduct((current) => ({ ...current, [productId]: [] }));
      setError(queryError.message);
      return;
    }

    const resolved = await hydrateAssetUrls(rows || []);
    setAssetsByProduct((current) => ({ ...current, [productId]: resolved }));
    const cover = resolved.find((a) => a.asset_type === "main_image");
    if (cover?.signed_url) {
      setCoverImageMap((current) => ({ ...current, [productId]: cover.signed_url }));
    } else {
      setCoverImageMap((current) => ({ ...current, [productId]: "" }));
    }
  }

  useEffect(() => {
    loadProducts();
  }, [supabase]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startNewProduct() {
    setSelectedProduct(null);
    setForm({ ...emptyProductForm, category: "壁挂式电池", status: "active", currency: "USD", price_term: "FOB" });
    setUploadQueue({});
    setEditingProductId("__new__");
    setError("");
    setSuccess("");
  }

  function startEditProduct(product) {
    setSelectedProduct(product);
    setForm(normalizeProductToForm(product));
    setEditingProductId(product.id);
    setError("");
    setSuccess("");
  }

  async function saveProduct() {
    if (!session?.user) {
      setError("请先登录后再管理产品。");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = buildProductPayload(form, session.user.id);
    const query = selectedProduct
      ? supabase.from("products").update(payload).eq("id", selectedProduct.id).select("*").single()
      : supabase.from("products").insert(payload).select("*").single();

    const { data: savedProduct, error: saveError } = await query;
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSelectedProduct(savedProduct);
    setForm(normalizeProductToForm(savedProduct));
    setEditingProductId("");
    setSuccess(selectedProduct ? "产品已更新。" : "产品已新增。");
    await loadProducts(savedProduct.id);
  }

  function queueUpload(productId, assetType, files) {
    setUploadQueue((current) => ({ ...current, [`${productId}:${assetType}`]: Array.from(files || []) }));
  }

  async function uploadAssetGroup(product, config) {
    if (!session?.user || !product?.id) {
      setError("请先保存产品，再上传图片或文件。");
      return;
    }

    const queueKey = `${product.id}:${config.type}`;
    const files = uploadQueue[queueKey] || [];
    if (!files.length) {
      setError("请先选择要上传的文件。");
      return;
    }

    setUploadingType(config.type);
    setError("");
    setSuccess("");

    try {
      let successCount = 0;
      const failedMessages = [];

      for (const file of files) {
        try {
          const safeName = file.name.replace(/\s+/g, "-");
          const storagePath = `${session.user.id}/${product.id}/${config.type}/${Date.now()}-${safeName}`;
          const bucket = bucketForAssetType(config.type);

          const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined
          });

          if (uploadError) throw uploadError;

          const { error: assetError } = await supabase.from("product_assets").insert({
            product_id: product.id,
            asset_type: config.type,
            file_type: file.type || "application/octet-stream",
            file_name: file.name,
            file_url: null,
            storage_path: storagePath
          });

          if (assetError) throw assetError;
          successCount += 1;
        } catch (singleError) {
          failedMessages.push(`${file.name}：${singleError.message || "上传失败"}`);
        }
      }

      setUploadQueue((current) => ({ ...current, [queueKey]: [] }));
      if (successCount > 0) setSuccess(`成功上传 ${successCount} 个文件`);
      if (failedMessages.length > 0) setError(`部分文件上传失败：${failedMessages.join("；")}`);
      await loadAssets(product.id);
    } catch (uploadError) {
      setError(uploadError.message || "上传失败，请检查 Storage 配置。");
    } finally {
      setUploadingType("");
    }
  }

  function isPdfAsset(asset) {
    return asset.file_type === "application/pdf"
      || String(asset.file_name || "").toLowerCase().endsWith(".pdf");
  }

  async function openAsset(asset) {
    const bucket = bucketForAssetType(asset.asset_type);
    const { data, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(asset.storage_path, 3600);
    if (urlError || !data?.signedUrl) {
      setError(urlError?.message || "无法生成预览链接。");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteAsset(asset) {
    if (!session?.user) {
      setError("请先登录后再删除文件。");
      return;
    }

    const bucket = bucketForAssetType(asset.asset_type);
    const { error: storageError } = await supabase.storage.from(bucket).remove([asset.storage_path]);
    if (storageError) {
      setError(storageError.message);
      return;
    }

    const { error: deleteError } = await supabase.from("product_assets").delete().eq("id", asset.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSuccess("文件已删除。");
    await loadAssets(asset.product_id);
  }

  async function updateProductStatus(product, status) {
    if (!session?.user) {
      setError("请先登录后再更新产品状态。");
      return;
    }

    const confirmText = status === "archived"
      ? "确定归档这个产品吗？归档后默认不在启用产品中显示。"
      : "确定恢复启用这个产品吗？";
    if (!window.confirm(confirmText)) return;

    const { error: updateError } = await supabase
      .from("products")
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", product.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(status === "archived" ? "产品已归档。" : "产品已恢复启用。");
    await loadProducts(product.id);
  }

  async function deleteProduct(product) {
    if (!session?.user) {
      setError("请先登录后再删除产品。");
      return;
    }
    if (!window.confirm("确定删除这个产品吗？删除后不可恢复。建议真实产品优先归档。")) return;

    try {
      const productAssets = getAssetsForProduct(product.id);
      const bucketGroups = productAssets.reduce((acc, asset) => {
        const bucket = bucketForAssetType(asset.asset_type);
        if (!acc[bucket]) acc[bucket] = [];
        acc[bucket].push(asset.storage_path);
        return acc;
      }, {});

      for (const [bucket, paths] of Object.entries(bucketGroups)) {
        if (!paths.length) continue;
        const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
        if (storageError) throw storageError;
      }

      const { error: assetDeleteError } = await supabase.from("product_assets").delete().eq("product_id", product.id);
      if (assetDeleteError) throw assetDeleteError;

      const { error: productDeleteError } = await supabase.from("products").delete().eq("id", product.id);
      if (productDeleteError) throw productDeleteError;

      setSuccess("产品已删除。");
      await loadProducts();
    } catch (deleteError) {
      setError(deleteError.message || "删除失败。");
    }
  }

  async function saveInternalNote(product) {
    if (!session?.user) {
      setError("请先登录后再保存备注。");
      return;
    }

    const nextNote = noteDrafts[product.id] ?? "";
    const { error: updateError } = await supabase
      .from("products")
      .update({
        risk_notes: nextNote,
        updated_at: new Date().toISOString()
      })
      .eq("id", product.id);

    if (updateError) {
      setError(`保存备注失败：${updateError.message}`);
      return;
    }

    setEditingNoteId("");
    setSuccess("内部备注已保存。");
    await loadProducts(product.id);
  }

  function getAssetsForProduct(productId) {
    return assetsByProduct[productId] || [];
  }

  function getMainImageForProduct(productId) {
    const productAssets = getAssetsForProduct(productId);
    return productAssets.find((asset) => asset.asset_type === "main_image") || null;
  }

  function getFilesByTypes(productId, types) {
    return getAssetsForProduct(productId).filter((asset) => types.includes(asset.asset_type));
  }

  const groupedProducts = useMemo(() => {
    const nextGroups = {
      "壁挂式电池": [],
      "落地式电池": [],
      "一体机": [],
      "未分类产品": [],
      "归档产品": []
    };

    products.forEach((product) => {
      nextGroups[getProductSection(product)].push(product);
    });

    return nextGroups;
  }, [products]);

  function renderField([key, label, type]) {
    if (key === "category") {
      return (
        <Field key={key} label={label}>
          <select value={form[key]} onChange={(event) => updateForm(key, event.target.value)}>
            {productCategoryOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </Field>
      );
    }

    if (type === "select") {
      return (
        <Field key={key} label={label}>
          <select value={form[key]} onChange={(event) => updateForm(key, event.target.value)}>
            {productStatusOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </Field>
      );
    }

    if (type === "textarea") {
      return (
        <Field key={key} label={label}>
          <textarea rows={3} value={form[key]} onChange={(event) => updateForm(key, event.target.value)} />
        </Field>
      );
    }

    return (
      <Field key={key} label={label}>
        <input value={form[key]} onChange={(event) => updateForm(key, event.target.value)} />
      </Field>
    );
  }

  function triggerFileSelect(productId, assetType) {
    const input = document.getElementById(getUploadInputId(productId, assetType));
    input?.click();
  }

  function renderSimpleEditor() {
    return (
      <>
        <div className="form-grid">
          {simpleProductFields.map(renderField)}
          <Field label="产品型号 / 简短描述">
            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={form.model}
                placeholder="产品型号"
                onChange={(event) => updateForm("model", event.target.value)}
              />
              <textarea
                rows={3}
                value={form.short_description}
                placeholder="简短描述"
                onChange={(event) => updateForm("short_description", event.target.value)}
              />
            </div>
          </Field>
          <Field label="内部备注">
            <textarea
              rows={4}
              value={form.internal_notes || ""}
              placeholder="记录价格变化、库存情况、资料问题、客户常问问题等"
              onChange={(event) => updateForm("internal_notes", event.target.value)}
            />
          </Field>
        </div>
      </>
    );
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">产品知识库</p>
          <h1>产品知识库</h1>
          <p>维护产品参数、价格、图片和文件资料，供业务团队和 AI 安全调用。</p>
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
              <h2>产品资料卡</h2>
              <div className="actions compact">
                <button className="primary" onClick={startNewProduct}>新增产品</button>
              </div>
            </div>
            {editingProductId === "__new__" && (
              <div className="panel" style={{ marginTop: 16, background: "#f8fafc" }}>
                <div className="section-title">
                  <h3>新增产品</h3>
                  <span>填写产品资料后创建</span>
                </div>
                {renderSimpleEditor()}
                <div className="actions">
                  <button className="primary" onClick={saveProduct} disabled={saving}>
                    {saving ? "保存中..." : "创建产品"}
                  </button>
                  <button type="button" onClick={() => setEditingProductId("")}>取消</button>
                </div>
              </div>
            )}

            {productSections.map((sectionName) => {
              const sectionProducts = groupedProducts[sectionName] || [];
              return (
                <section className="panel" key={sectionName} style={{ marginTop: 16 }}>
                  <div className="section-title">
                    <h2>{sectionName}</h2>
                    <span>{sectionProducts.length} 个产品</span>
                  </div>
                  {sectionProducts.length === 0 ? (
                    <p className="empty">暂无产品，请先新增产品。</p>
                  ) : (
                    <div style={{ display: "grid", gap: 16 }}>
                      {sectionProducts.map((product) => {
                        const mainImage = getMainImageForProduct(product.id);
                        const editOpen = editingProductId === product.id;
                        const internalNote = getInternalNoteValue(product);
                        return (
                          <article key={product.id} className="detail-item" style={{ padding: 20 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
                              <div
                                style={{
                                  borderRadius: 16,
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                  minHeight: 320,
                                  padding: 16,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 12
                                }}
                              >
                                <input
                                  id={getUploadInputId(product.id, "main_image")}
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={(event) => queueUpload(product.id, "main_image", event.target.files)}
                                  disabled={String(product.status || "").toLowerCase() === "archived"}
                                />
                                <div
                                  style={{
                                    flex: 1,
                                    minHeight: 220,
                                    borderRadius: 12,
                                    border: mainImage ? "none" : "1px dashed #cbd5e1",
                                    background: mainImage ? "#fff" : "#f8fafc",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    textAlign: "center",
                                    padding: 12
                                  }}
                                >
                                  {mainImage ? (
                                    <img
                                      src={mainImage.signed_url || mainImage.file_url}
                                      alt={product.product_name || "product"}
                                      style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 12 }}
                                    />
                                  ) : (
                                    <div>
                                      <p style={{ marginBottom: 12 }}>暂无主图，请上传产品主图</p>
                                      <button
                                        type="button"
                                        onClick={() => triggerFileSelect(product.id, "main_image")}
                                        disabled={String(product.status || "").toLowerCase() === "archived"}
                                      >
                                        上传 / 替换主图
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {mainImage && (
                                  <div className="actions compact" style={{ flexWrap: "wrap" }}>
                                    <button
                                      type="button"
                                      onClick={() => triggerFileSelect(product.id, "main_image")}
                                      disabled={String(product.status || "").toLowerCase() === "archived"}
                                    >
                                      替换主图
                                    </button>
                                    <button type="button" onClick={() => mainImage && openAsset(mainImage)} disabled={!mainImage}>预览主图</button>
                                    <button type="button" onClick={() => mainImage && deleteAsset(mainImage)} disabled={!mainImage}>删除主图</button>
                                  </div>
                                )}
                                {(uploadQueue[`${product.id}:main_image`] || []).length > 0 && (
                                  <div className="actions compact" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                    <span className="muted">已选 {(uploadQueue[`${product.id}:main_image`] || []).length} 个文件</span>
                                    <button type="button" onClick={() => uploadAssetGroup(product, assetGroups.find((item) => item.type === "main_image"))}>
                                      上传主图
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div className="section-title" style={{ marginBottom: 12 }}>
                                  <div>
                                    <h3 style={{ margin: 0 }}>{product.product_name || "未命名产品"}</h3>
                                    <p className="muted" style={{ marginTop: 6, marginBottom: 4 }}>
                                      {[product.model || "待补充型号", product.short_description || ""].filter(Boolean).join(" / ")}
                                    </p>
                                    <p style={{ margin: 0, color: "#475569" }}>产品分类：{product.category || product.product_type || getProductSection(product)}</p>
                                  </div>
                                  <div className="actions compact" style={{ flexWrap: "wrap" }}>
                                    <button type="button" onClick={() => startEditProduct(product)}>编辑</button>
                                    <button
                                      type="button"
                                      onClick={() => updateProductStatus(product, String(product.status || "").toLowerCase() === "archived" ? "active" : "archived")}
                                    >
                                      {String(product.status || "").toLowerCase() === "archived" ? "恢复启用" : "归档"}
                                    </button>
                                    <button type="button" onClick={() => deleteProduct(product)}>删除</button>
                                  </div>
                                </div>

                                <div className="detail-item" style={{ marginBottom: 16 }}>
                                  <div className="section-title" style={{ marginBottom: 8 }}>
                                    <strong>内部备注</strong>
                                    {editingNoteId === product.id ? (
                                      <div className="actions compact">
                                        <button type="button" onClick={() => saveInternalNote(product)}>保存备注</button>
                                        <button type="button" onClick={() => setEditingNoteId("")}>取消</button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNoteId(product.id);
                                          setNoteDrafts((current) => ({ ...current, [product.id]: internalNote }));
                                        }}
                                      >
                                        编辑备注
                                      </button>
                                    )}
                                  </div>
                                  {editingNoteId === product.id ? (
                                    <textarea
                                      rows={3}
                                      value={noteDrafts[product.id] ?? ""}
                                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [product.id]: event.target.value }))}
                                    />
                                  ) : (
                                    <p>{internalNote || "暂无备注"}</p>
                                  )}
                                </div>

                                <div style={{ display: "grid", gap: 12 }}>
                                  {fileSectionConfigs.slice(0, 2).map((section) => {
                                    const files = getFilesByTypes(product.id, section.assetTypes);
                                    return (
                                      <div key={section.key} className="detail-item">
                                        <div className="section-title" style={{ marginBottom: 8 }}>
                                          <strong>{section.title}</strong>
                                          <div className="actions compact" style={{ flexWrap: "wrap" }}>
                                            {section.uploadTypes.map((type) => {
                                              const config = assetGroups.find((item) => item.type === type);
                                              if (!config) return null;
                                              const queueKey = `${product.id}:${config.type}`;
                                              return (
                                                <div key={config.type} className="actions compact">
                                                  <input
                                                    id={getUploadInputId(product.id, config.type)}
                                                    type="file"
                                                    accept={config.accept}
                                                    multiple={config.multiple}
                                                    style={{ display: "none" }}
                                                    onChange={(event) => queueUpload(product.id, config.type, event.target.files)}
                                                    disabled={String(product.status || "").toLowerCase() === "archived"}
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => (uploadQueue[queueKey] || []).length
                                                      ? uploadAssetGroup(product, config)
                                                      : triggerFileSelect(product.id, config.type)}
                                                  >
                                                    {section.key === "datasheet" ? "上传规格书" : "上传认证文件"}
                                                  </button>
                                                  {(uploadQueue[queueKey] || []).length > 0 && <span className="muted">已选 {(uploadQueue[queueKey] || []).length} 个</span>}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        {files.length === 0 ? (
                                          <p>{section.emptyText}</p>
                                        ) : (
                                          <div style={{ display: "grid", gap: 8 }}>
                                            {files.map((asset) => (
                                              <div key={asset.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid #eef2f7" }}>
                                                <div style={{ minWidth: 0 }}>
                                                  <strong style={{ display: "block" }}>{asset.file_name}</strong>
                                                  <span className="muted">{asset.file_type || "-"}</span>
                                                </div>
                                                <div className="actions compact">
                                                  <button type="button" onClick={() => openAsset(asset)}>{isPdfAsset(asset) || isImageAsset(asset) ? "预览" : "打开"}</button>
                                                  <button type="button" onClick={() => openAsset(asset)}>下载</button>
                                                  <button type="button" onClick={() => deleteAsset(asset)}>删除</button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {editOpen && (
                                  <div className="panel" style={{ marginTop: 16, background: "#f8fafc" }}>
                                    <div className="section-title">
                                      <h3>编辑产品</h3>
                                      <span>{`更新时间：${formatTime(product.updated_at)}`}</span>
                                    </div>
                                    {renderSimpleEditor()}
                                    <div className="actions">
                                      <button className="primary" onClick={saveProduct} disabled={saving}>
                                        {saving ? "保存中..." : "保存修改"}
                                      </button>
                                      <button type="button" onClick={() => setEditingProductId("")}>取消</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
