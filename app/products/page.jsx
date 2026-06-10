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
  { type: "datasheet", label: "产品规格书", accept: ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar", multiple: false },
  { type: "user_manual", label: "用户手册", accept: ".pdf,.doc,.docx,.zip,.rar", multiple: false },
  { type: "certificate", label: "认证文件", accept: ".pdf,.jpg,.jpeg,.png,.zip,.rar", multiple: false },
  { type: "test_report", label: "测试报告", accept: ".pdf,.doc,.docx,.zip,.rar", multiple: false },
  { type: "product_catalog", label: "产品目录", accept: ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar", multiple: false },
  { type: "installation_guide", label: "安装指南", accept: ".pdf,.doc,.docx,.zip,.rar", multiple: false }
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
    currency: product.currency || "USD"
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
    risk_notes: form.price_note || "",
    created_by: userId,
    updated_at: new Date().toISOString()
  };
}

function ProductCard({ product, onSelect, selected, mainImageUrl }) {
  return (
    <button className={`product-card ${selected ? "selected-card" : ""}`} onClick={() => onSelect(product)} type="button">
      {mainImageUrl && (
        <img
          src={mainImageUrl}
          alt={product.product_name || "product"}
          style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
        />
      )}
      <div className="card-title">
        <strong>{product.product_name || "未命名产品"}</strong>
        <span>{product.status || "-"}</span>
      </div>
      <p>{product.model || product.common_name || "-"}</p>
      <p>{product.energy_kwh ?? product.capacity_kwh ?? "-"} kWh · {product.voltage || "-"}</p>
      <p>{product.category || product.installation_type || "-"}</p>
      <p>{product.currency || "USD"} {product.base_price ?? product.fob_price ?? "-"}</p>
      <p>{product.application || product.suitable_scenarios || "-"}</p>
    </button>
  );
}

export default function ProductsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyProductForm);
  const [assets, setAssets] = useState([]);
  const [coverImageMap, setCoverImageMap] = useState({});
  const [uploadQueue, setUploadQueue] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productImages = assets.filter(isImageAsset);
  const mainImage = productImages.find((asset) => asset.asset_type === "main_image") || productImages[0] || null;
  const galleryImages = productImages.filter((asset) => asset.asset_type === "gallery_image");
  const fileAssets = assets.filter((asset) => !isImageAsset(asset));

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

  async function loadCoverImages(productRows) {
    if (!supabase || !productRows?.length) return;
    const ids = productRows.map((p) => p.id);
    const { data: coverRows } = await supabase
      .from("product_assets")
      .select("product_id, storage_path")
      .in("product_id", ids)
      .eq("asset_type", "main_image");
    if (!coverRows?.length) return;
    const map = {};
    await Promise.all(coverRows.map(async (row) => {
      const { data } = await supabase.storage
        .from("product-images")
        .createSignedUrl(row.storage_path, 3600);
      if (data?.signedUrl) map[row.product_id] = data.signedUrl;
    }));
    setCoverImageMap(map);
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
    loadCoverImages(rows || []);
    const nextSelected =
      (preferredId && rows?.find((item) => item.id === preferredId))
      || (selectedProduct?.id && rows?.find((item) => item.id === selectedProduct.id))
      || rows?.[0]
      || null;
    setSelectedProduct(nextSelected || null);
    if (nextSelected) {
      setForm(normalizeProductToForm(nextSelected));
    }
    setLoading(false);
  }

  async function loadAssets(productId) {
    if (!supabase || !session?.user || !productId) {
      setAssets([]);
      return;
    }

    const { data: rows, error: queryError } = await supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setAssets([]);
      setError(queryError.message);
      return;
    }

    const resolved = await hydrateAssetUrls(rows || []);
    setAssets(resolved);
    const cover = resolved.find((a) => a.asset_type === "main_image");
    if (cover?.signed_url) {
      setCoverImageMap((current) => ({ ...current, [productId]: cover.signed_url }));
    }
  }

  useEffect(() => {
    loadProducts();
  }, [supabase]);

  useEffect(() => {
    if (selectedProduct?.id) {
      loadAssets(selectedProduct.id);
    } else {
      setAssets([]);
    }
  }, [selectedProduct?.id, supabase, session?.user?.id]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startNewProduct() {
    setSelectedProduct(null);
    setForm(emptyProductForm);
    setAssets([]);
    setUploadQueue({});
    setError("");
    setSuccess("");
  }

  function startEditProduct(product) {
    setSelectedProduct(product);
    setForm(normalizeProductToForm(product));
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
    setSuccess(selectedProduct ? "产品已更新。" : "产品已新增。");
    await loadProducts(savedProduct.id);
  }

  function queueUpload(assetType, files) {
    setUploadQueue((current) => ({ ...current, [assetType]: Array.from(files || []) }));
  }

  async function uploadAssetGroup(config) {
    if (!session?.user || !selectedProduct?.id) {
      setError("请先保存产品，再上传图片或文件。");
      return;
    }

    const files = uploadQueue[config.type] || [];
    if (!files.length) {
      setError("请先选择要上传的文件。");
      return;
    }

    setUploadingType(config.type);
    setError("");
    setSuccess("");

    try {
      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, "-");
        const storagePath = `${session.user.id}/${selectedProduct.id}/${config.type}/${Date.now()}-${safeName}`;
        const bucket = bucketForAssetType(config.type);

        const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined
        });

        if (uploadError) throw uploadError;

        const { error: assetError } = await supabase.from("product_assets").insert({
          product_id: selectedProduct.id,
          asset_type: config.type,
          file_type: file.type || "application/octet-stream",
          file_name: file.name,
          file_url: null,
          storage_path: storagePath
        });

        if (assetError) throw assetError;
      }

      setUploadQueue((current) => ({ ...current, [config.type]: [] }));
      setSuccess(`${config.label} 上传成功。`);
      await loadAssets(selectedProduct.id);
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
    await loadAssets(selectedProduct.id);
  }

  function renderField([key, label, type]) {
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
                  mainImageUrl={coverImageMap[product.id]}
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

            <h3>基础信息</h3>
            <div className="form-grid">
              {basicFields.map(renderField)}
            </div>

            <h3>技术参数</h3>
            <div className="form-grid">
              {technicalFields.map(renderField)}
            </div>

            <h3>价格信息</h3>
            <div className="form-grid">
              {priceFields.map(renderField)}
            </div>

            <div className="actions">
              <button className="primary" onClick={saveProduct} disabled={saving}>
                {saving ? "保存中..." : selectedProduct ? "保存修改" : "创建产品"}
              </button>
              <button onClick={startNewProduct}>清空表单</button>
            </div>
          </section>

          <section className="panel">
            <div className="section-title">
              <h2>上传图片与文件</h2>
              <span>{selectedProduct ? "上传后会挂到当前产品名下" : "请先保存产品，再上传文件"}</span>
            </div>
            <div className="detail-grid">
              {assetGroups.map((group) => (
                <div className="detail-item" key={group.type}>
                  <strong>{group.label}</strong>
                  <input
                    type="file"
                    accept={group.accept}
                    multiple={group.multiple}
                    onChange={(event) => queueUpload(group.type, event.target.files)}
                    disabled={!selectedProduct}
                  />
                  <div className="actions compact">
                    <button
                      onClick={() => uploadAssetGroup(group)}
                      disabled={!selectedProduct || uploadingType === group.type}
                      type="button"
                    >
                      {uploadingType === group.type ? "上传中..." : "上传"}
                    </button>
                  </div>
                  <p className="muted">
                    {(uploadQueue[group.type] || []).length
                      ? `已选择 ${(uploadQueue[group.type] || []).length} 个文件`
                      : "未选择文件"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {selectedProduct && (
            <>
              <section className="panel">
                <div className="section-title">
                  <h2>产品详情</h2>
                  <span>{selectedProduct.product_name || "-"}</span>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>产品名称</strong>
                    <p>{selectedProduct.product_name || "待确认"}</p>
                  </div>
                  <div className="detail-item">
                    <strong>型号</strong>
                    <p>{selectedProduct.model || "待确认"}</p>
                  </div>
                  <div className="detail-item">
                    <strong>关键规格</strong>
                    <p>{selectedProduct.voltage || "待确认"} / {selectedProduct.energy_kwh ?? selectedProduct.capacity_kwh ?? "待确认"} kWh / {selectedProduct.capacity_ah ?? "待确认"} Ah</p>
                  </div>
                  <div className="detail-item">
                    <strong>电芯 + BMS</strong>
                    <p>{selectedProduct.cell_type || "待确认"} / {selectedProduct.bms || "待确认"}</p>
                  </div>
                  <div className="detail-item">
                    <strong>价格</strong>
                    <p>{selectedProduct.currency || "USD"} {selectedProduct.base_price ?? "待确认"} · {selectedProduct.price_term || "待确认"} · {selectedProduct.port || "待确认"}</p>
                  </div>
                  <div className="detail-item">
                    <strong>适合场景</strong>
                    <p>{selectedProduct.application || "待确认"}</p>
                  </div>
                  <div className="detail-item">
                    <strong>认证</strong>
                    <p>{selectedProduct.certifications || "待确认"}</p>
                  </div>
                  <div className="detail-item">
                    <strong>兼容逆变器</strong>
                    <p>{selectedProduct.compatible_inverters || "待确认"}</p>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="section-title">
                  <h2>产品图片</h2>
                  <span>{productImages.length} 张</span>
                </div>
                {mainImage && (
                  <>
                    <img
                      src={mainImage.signed_url || mainImage.file_url}
                      alt={selectedProduct.product_name || "product"}
                      style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16, marginBottom: 16 }}
                    />
                    <div className="actions compact" style={{ marginBottom: 16 }}>
                      <button type="button" onClick={() => openAsset(mainImage)}>预览</button>
                      <button type="button" onClick={() => deleteAsset(mainImage)}>删除</button>
                    </div>
                  </>
                )}
                <div className="product-grid">
                  {galleryImages.map((asset) => (
                    <article className="detail-item" key={asset.id}>
                      <img
                        src={asset.signed_url || asset.file_url}
                        alt={asset.file_name}
                        style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, marginBottom: 12 }}
                      />
                      <strong>{asset.file_name}</strong>
                      <p>{asset.file_type || "-"}</p>
                      <div className="actions compact">
                        <button type="button" onClick={() => openAsset(asset)}>预览</button>
                        <button type="button" onClick={() => deleteAsset(asset)}>删除</button>
                      </div>
                    </article>
                  ))}
                  {!productImages.length && <p className="empty">暂无产品图片</p>}
                </div>
              </section>

              <section className="panel">
                <div className="section-title">
                  <h2>可下载文件</h2>
                  <span>{fileAssets.length} 个文件</span>
                </div>
                <div className="detail-grid">
                  {fileAssets.map((asset) => (
                    <div className="detail-item" key={asset.id}>
                      <strong>{asset.file_name}</strong>
                      <p>类型：{asset.asset_type}</p>
                      <p>文件格式：{asset.file_type || "-"}</p>
                      <p>上传时间：{formatTime(asset.created_at)}</p>
                      <div className="actions compact">
                        <button type="button" onClick={() => openAsset(asset)}>
                          {isPdfAsset(asset) ? "预览" : "打开"}
                        </button>
                        <button type="button" onClick={() => openAsset(asset)}>下载</button>
                        <button type="button" onClick={() => deleteAsset(asset)}>删除</button>
                      </div>
                    </div>
                  ))}
                  {!fileAssets.length && <p className="empty">暂无可下载文件</p>}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
