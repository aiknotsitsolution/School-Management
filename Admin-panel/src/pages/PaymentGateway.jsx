import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Plug, RefreshCw, ShieldCheck, ExternalLink } from "lucide-react";
import { PageIntro, Card, Button, Input, Select, Pill, toast } from "../components/UI";
import { api } from "../lib/api";

const MODE_LABELS = {
  platform: "Platform managed",
  razorpay: "Razorpay",
  stripe: "Stripe",
  phonepe: "PhonePe",
  upi: "UPI",
  qr: "QR code",
  bank: "Bank transfer",
  manual: "Manual / cash",
};

const ONLINE_MODES = ["razorpay", "stripe", "phonepe"];

const modeKind = (mode) =>
  ONLINE_MODES.includes(mode)
    ? "online"
    : ["upi", "qr", "bank"].includes(mode)
      ? "display"
      : "manual";

const SECRET_PLACEHOLDER = "Leave blank to keep the saved value";

const StatusPill = ({ status }) => {
  const tone =
    status === "active"
      ? "success"
      : status === "pending_verification"
        ? "warning"
        : status === "disabled"
          ? "alert"
          : "neutral";
  const label =
    status === "pending_verification"
      ? "Pending verification"
      : (status || "unknown").replace(/^\w/, (c) => c.toUpperCase());
  return <Pill tone={tone}>{label}</Pill>;
};

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[12px] font-semibold text-ink mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[11.5px] text-slate-text/70 mt-1">{hint}</p>}
    </div>
  );
}

export default function PaymentGateway() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [mode, setMode] = useState("platform");
  const [display, setDisplay] = useState({});
  const [secrets, setSecrets] = useState({});

  const applyConfig = useCallback((data) => {
    setConfig(data);
    setMode(data?.mode || "platform");
    setDisplay(data?.display || {});
    setSecrets({});
    setTestResult(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.school.paymentGateway.get();
      applyConfig(data);
    } catch (err) {
      setLoadError(err.message || "Could not load payment gateway configuration");
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  const setSecret = (provider, field) => (e) =>
    setSecrets((s) => ({ ...s, [provider]: { ...(s[provider] || {}), [field]: e.target.value } }));

  const setDisplayField = (field) => (e) =>
    setDisplay((d) => ({ ...d, [field]: e.target.value }));

  const providerPayload = () => {
    const payload = {};
    if (mode === "razorpay") {
      const p = config?.providers?.razorpay || {};
      payload.razorpay = {
        keyId: p.keyId || "",
        testMode: p.testMode,
        ...(secrets.razorpay?.keySecret ? { keySecret: secrets.razorpay.keySecret } : {}),
        ...(secrets.razorpay?.webhookSecret ? { webhookSecret: secrets.razorpay.webhookSecret } : {}),
      };
    }
    if (mode === "stripe") {
      const p = config?.providers?.stripe || {};
      payload.stripe = {
        publishableKey: p.publishableKey || "",
        testMode: p.testMode,
        ...(secrets.stripe?.secretKey ? { secretKey: secrets.stripe.secretKey } : {}),
        ...(secrets.stripe?.webhookSecret ? { webhookSecret: secrets.stripe.webhookSecret } : {}),
      };
    }
    if (mode === "phonepe") {
      const p = config?.providers?.phonepe || {};
      payload.phonepe = {
        merchantId: p.merchantId || "",
        saltIndex: p.saltIndex || "",
        env: p.env || "uat",
        ...(secrets.phonepe?.saltKey ? { saltKey: secrets.phonepe.saltKey } : {}),
      };
    }
    return payload;
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const { data } = await api.school.paymentGateway.update({
        mode,
        providers: providerPayload(),
        display,
      });
      applyConfig(data);
      toast("Payment gateway configuration saved", "success");
    } catch (err) {
      toast(err.message || "Could not save configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.school.paymentGateway.test({
        mode,
        providers: providerPayload(),
        display,
      });
      setTestResult(data);
      toast(data?.ok ? data.message || "Connection test passed" : data.message || "Connection test failed", data?.ok ? "success" : "error");
      if (data?.ok) await load();
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
      toast(err.message || "Connection test failed", "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Finance"
          title="Payment Gateway"
          description="Loading payment gateway configuration."
        />
        <Card>
          <p className="text-[13px] text-slate-text/70">Loading configuration…</p>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Finance"
          title="Payment Gateway"
          description="Configure how the school accepts fee payments."
        />
        <Card>
          <div className="py-10 text-center">
            <p className="text-[14px] font-medium text-ink">Could not load configuration</p>
            <p className="text-[13px] text-slate-text/70 mt-1">{loadError}</p>
            <Button variant="outline" className="mt-4" onClick={load}>
              <RefreshCw size={14} /> Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const kind = modeKind(mode);
  const prov = config?.providers || {};

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Finance"
        title="Payment Gateway"
        description="Choose how the school collects fee payments. Secrets are encrypted at rest and never shown again after saving."
        right={
          <div className="flex items-center gap-2">
            {config?.status && <StatusPill status={config.status} />}
            <Link
              to="/online-payment"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:text-ink transition-colors"
            >
              <ExternalLink size={13} /> Open Online Payments
            </Link>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Collection mode">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Gateway mode">
                <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {(config?.availableModes || Object.keys(MODE_LABELS)).map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m] || m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Last tested">
                <Input
                  readOnly
                  value={
                    config?.testedAt
                      ? new Date(config.testedAt).toLocaleString("en-IN")
                      : "Never tested"
                  }
                />
              </Field>
            </div>

            <div className="mt-3 rounded-xl bg-paper px-3.5 py-3 text-[12.5px] text-slate-text">
              {kind === "online"
                ? "Online mode — parents pay through a hosted checkout. Credentials are verified with the provider by running a connection test."
                : kind === "display"
                  ? "Display mode — no online checkout. The school shows payment details to parents and confirms collections manually."
                  : "Manual mode — payments are collected offline and recorded by staff in Fees Collection."}
            </div>
          </Card>

          {kind === "online" && (
            <Card title="Provider credentials">
              <div className="space-y-4">
                {mode === "razorpay" && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Key ID" hint={prov.razorpay?.keyId ? `Saved: ${prov.razorpay.keyId}` : ""}>
                        <Input
                          value={prov.razorpay?.keyId || ""}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              providers: {
                                ...c.providers,
                                razorpay: { ...prov.razorpay, keyId: e.target.value },
                              },
                            }))
                          }
                          placeholder="rzp_live_xxxxxxxx"
                        />
                      </Field>
                      <Field label="Key Secret" hint={prov.razorpay?.keySecret || ""}>
                        <Input
                          type="password"
                          value={secrets.razorpay?.keySecret || ""}
                          onChange={setSecret("razorpay", "keySecret")}
                          placeholder={SECRET_PLACEHOLDER}
                        />
                      </Field>
                    </div>
                    <Field label="Webhook secret" hint={prov.razorpay?.webhookSecret || ""}>
                      <Input
                        type="password"
                        value={secrets.razorpay?.webhookSecret || ""}
                        onChange={setSecret("razorpay", "webhookSecret")}
                        placeholder={SECRET_PLACEHOLDER}
                      />
                    </Field>
                  </>
                )}

                {mode === "stripe" && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Publishable key" hint={prov.stripe?.publishableKey || ""}>
                        <Input
                          value={prov.stripe?.publishableKey || ""}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              providers: {
                                ...c.providers,
                                stripe: { ...prov.stripe, publishableKey: e.target.value },
                              },
                            }))
                          }
                          placeholder="pk_live_xxxxxxxx"
                        />
                      </Field>
                      <Field label="Secret key" hint={prov.stripe?.secretKey || ""}>
                        <Input
                          type="password"
                          value={secrets.stripe?.secretKey || ""}
                          onChange={setSecret("stripe", "secretKey")}
                          placeholder={SECRET_PLACEHOLDER}
                        />
                      </Field>
                    </div>
                    <Field label="Webhook secret" hint={prov.stripe?.webhookSecret || ""}>
                      <Input
                        type="password"
                        value={secrets.stripe?.webhookSecret || ""}
                        onChange={setSecret("stripe", "webhookSecret")}
                        placeholder={SECRET_PLACEHOLDER}
                      />
                    </Field>
                  </>
                )}

                {mode === "phonepe" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Merchant ID" hint={prov.phonepe?.merchantId || ""}>
                      <Input
                        value={prov.phonepe?.merchantId || ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            providers: {
                              ...c.providers,
                              phonepe: { ...prov.phonepe, merchantId: e.target.value },
                            },
                          }))
                        }
                        placeholder="MERCHANTxxxxxx"
                      />
                    </Field>
                    <Field label="Salt key" hint={prov.phonepe?.saltKey || ""}>
                      <Input
                        type="password"
                        value={secrets.phonepe?.saltKey || ""}
                        onChange={setSecret("phonepe", "saltKey")}
                        placeholder={SECRET_PLACEHOLDER}
                      />
                    </Field>
                    <Field label="Salt index">
                      <Input
                        value={prov.phonepe?.saltIndex || ""}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            providers: {
                              ...c.providers,
                              phonepe: { ...prov.phonepe, saltIndex: e.target.value },
                            },
                          }))
                        }
                        placeholder="1"
                      />
                    </Field>
                    <Field label="Environment">
                      <Select
                        value={prov.phonepe?.env || "uat"}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            providers: {
                              ...c.providers,
                              phonepe: { ...prov.phonepe, env: e.target.value },
                            },
                          }))
                        }
                      >
                        <option value="uat">UAT (sandbox)</option>
                        <option value="prod">Production</option>
                      </Select>
                    </Field>
                  </div>
                )}

                <label className="flex items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={Boolean(mode === "razorpay" ? prov.razorpay?.testMode : prov.stripe?.testMode)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setConfig((c) => ({
                        ...c,
                        providers: {
                          ...c.providers,
                          [mode]: { ...prov[mode], testMode: checked },
                        },
                      }));
                    }}
                    className="rounded border-slate-300"
                  />
                  Test mode (sandbox keys)
                </label>
              </div>
            </Card>
          )}

          {kind === "display" && (
            <Card title="Payment details shown to parents">
              <div className="space-y-4">
                {mode === "upi" && (
                  <Field label="UPI ID" hint="Required for UPI mode">
                    <Input
                      value={display.upiId || ""}
                      onChange={setDisplayField("upiId")}
                      placeholder="school@upi"
                    />
                  </Field>
                )}
                {mode === "qr" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="QR image URL">
                      <Input
                        value={display.qrCodeUrl || ""}
                        onChange={setDisplayField("qrCodeUrl")}
                        placeholder="https://…/qr.png"
                      />
                    </Field>
                    <Field label="QR payload / UPI string" hint="Required when no image URL is set">
                      <Input
                        value={display.qrCodeData || ""}
                        onChange={setDisplayField("qrCodeData")}
                        placeholder="upi://pay?pa=school@upi"
                      />
                    </Field>
                  </div>
                )}
                {mode === "bank" && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Bank name" hint="Required for bank mode">
                      <Input
                        value={display.bankName || ""}
                        onChange={setDisplayField("bankName")}
                        placeholder="Bank of India"
                      />
                    </Field>
                    <Field label="Account number" hint="Required for bank mode">
                      <Input
                        value={display.accountNumber || ""}
                        onChange={setDisplayField("accountNumber")}
                        placeholder="0000 0000 0000"
                      />
                    </Field>
                    <Field label="Account holder">
                      <Input
                        value={display.accountHolder || ""}
                        onChange={setDisplayField("accountHolder")}
                        placeholder="School name"
                      />
                    </Field>
                    <Field label="IFSC">
                      <Input
                        value={display.ifsc || ""}
                        onChange={setDisplayField("ifsc")}
                        placeholder="ABCD0000123"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </Card>
          )}

          {kind === "manual" && (
            <Card title="Offline collection">
              <p className="text-[13px] text-slate-text">
                No configuration required. Staff record cash, cheque, UPI and card
                collections directly in{" "}
                <Link to="/fees-collection" className="text-info font-semibold hover:underline">
                  Fees Collection
                </Link>
                .
              </p>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save configuration"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || saving}
            >
              <Plug size={14} /> {testing ? "Testing…" : "Run connection test"}
            </Button>
            {testResult && (
              <Pill tone={testResult.ok ? "success" : "alert"}>
                {testResult.message || (testResult.ok ? "Test passed" : "Test failed")}
              </Pill>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-text/70">Mode</span>
                <span className="font-semibold text-ink">{MODE_LABELS[mode]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-text/70">Status</span>
                <StatusPill status={config?.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-text/70">Verified</span>
                <span className="font-semibold text-ink">
                  {config?.verified?.at
                    ? new Date(config.verified.at).toLocaleDateString("en-IN")
                    : "Not verified"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-text/70">Updated</span>
                <span className="font-semibold text-ink">
                  {config?.updatedAt
                    ? new Date(config.updatedAt).toLocaleDateString("en-IN")
                    : "—"}
                </span>
              </div>
            </div>
          </Card>

          <Card title="How it works">
            <ul className="space-y-2.5 text-[12.5px] text-slate-text">
              <li className="flex gap-2">
                <ShieldCheck size={14} className="text-success mt-0.5 shrink-0" />
                Secrets are encrypted before storage and are never returned by the
                API — only masked previews are shown.
              </li>
              <li className="flex gap-2">
                <CreditCard size={14} className="text-info mt-0.5 shrink-0" />
                Saving a non-platform mode moves the gateway to{" "}
                <span className="font-semibold text-ink">pending verification</span>{" "}
                until a connection test passes.
              </li>
              <li className="flex gap-2">
                <Plug size={14} className="text-warning mt-0.5 shrink-0" />
                The connection test validates your keys with the provider without
                saving them.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
