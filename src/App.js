    // src/App.js
import React, { useEffect, useMemo, useState, createContext, useContext, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";

/** =========================
 * CONFIG
 * ========================= */
const API_BASE_URL = "https://app2backend-master-h5vfqb.laravel.cloud/api"; // <-- بدّلها إذا لازم

/** =========================
 * HELPERS
 * ========================= */
const money = (v) => Math.round(Number(v || 0)).toLocaleString("ar-MA") + " د.م";
const todayISO = () => new Date().toISOString().slice(0, 10);

function orderProfit(o) {
  // MVP rule: profit only for delivered
  if (o.status !== "delivered") return 0;
  return Number(o.sell) - Number(o.cost) - Number(o.ship);
}

function calcTotals(orders, expenses) {
  const total = orders.length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const returned = orders.filter((o) => o.status === "returned").length;
  const pending = total - delivered - returned;

  const revenue = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + Number(o.sell || 0), 0);
  const grossProfit = orders.reduce((s, o) => s + orderProfit(o), 0);
  const costs = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const net = grossProfit - costs;
  return { total, delivered, returned, pending, revenue, grossProfit, costs, net };
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

/** =========================
 * API (fetch wrapper)
 * ========================= */
async function apiRequest(path, { method = "GET", body, token, isForm = false } = {}) {
  const headers = {
    Accept: "application/json",
  };
  if (!isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || "Request failed";
    throw new Error(msg);
  }
  return data;
}

/** =========================
 * AUTH CONTEXT
 * ========================= */
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [loading, setLoading] = useState(false);

  const saveAuth = (u, t) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("token", t);
  };

  const logout = async () => {
    try {
      if (token) await apiRequest("/logout", { method: "POST", token });
    } catch {
      // ignore
    }
    setUser(null);
    setToken("");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const refreshVerify = useCallback(async () => {
    if (!user?.email) return;
    const r = await apiRequest("/email/check", { method: "POST", body: { email: user.email } });
    const verified = !!r?.verified;
    const updated = { ...user, verified };
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
    return verified;
  }, [user]);

  const value = {
    user,
    token,
    loading,
    setLoading,
    saveAuth,
    logout,
    refreshVerify,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** =========================
 * UI (tiny)
 * ========================= */
function Page({ title, children, max = 900 }) {
  return (
    <div style={styles.page}>
      <div style={{ width: "100%", maxWidth: max }}>
        {title && <h2 style={styles.h2}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

function Card({ children }) {
  return <div style={styles.card}>{children}</div>;
}

function Input(props) {
  return <input {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
}
function Select(props) {
  return <select {...props} style={{ ...styles.input, ...(props.style || {}) }} />;
}
function Textarea(props) {
  return <textarea {...props} style={{ ...styles.textarea, ...(props.style || {}) }} />;
}
function Btn({ variant = "primary", ...props }) {
  const s = variant === "primary" ? styles.btnPrimary : variant === "danger" ? styles.btnDanger : styles.btn;
  return <button {...props} style={{ ...s, ...(props.style || {}) }} />;
}
function Badge({ tone = "default", children }) {
  const s =
    tone === "good" ? styles.badgeGood : tone === "bad" ? styles.badgeBad : tone === "warn" ? styles.badgeWarn : styles.badge;
  return <span style={s}>{children}</span>;
}

function Toast({ text }) {
  if (!text) return null;
  return <div style={styles.toast}>{text}</div>;
}

function TopBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div style={styles.topbar}>
      <Link to="/" style={styles.brand}>
        💰 مختصر الأرباح
      </Link>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {user ? (
          <>
            {!user.verified && (
              <Link to="/verify" style={styles.linkPillWarn}>
                توثيق البريد ⚠️
              </Link>
            )}
            <Link to="/app" style={styles.linkPill}>
              التطبيق
            </Link>
            <Link to="/settings" style={styles.linkPill}>
              الإعدادات
            </Link>
            <Btn
              variant="danger"
              onClick={async () => {
                await logout();
                nav("/login");
              }}
            >
              خروج
            </Btn>
          </>
        ) : (
          <>
            <Link to="/login" style={styles.linkPill}>
              دخول
            </Link>
            <Link to="/register" style={styles.linkPillPrimary}>
              حساب جديد
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/** =========================
 * GUARDS
 * ========================= */
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
function RequireVerified({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.verified) return <Navigate to="/verify" replace />;
  return children;
}

/** =========================
 * AUTH PAGES
 * ========================= */
function Login() {
  const { saveAuth, setLoading, loading, refreshVerify } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  return (
    <Page title="تسجيل الدخول" max={520}>
      <Card>
        {err && <div style={styles.alertBad}>{err}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          <Input placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="كلمة المرور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Btn
            disabled={loading}
            onClick={async () => {
              setErr("");
              setLoading(true);
              try {
                const r = await apiRequest("/login", { method: "POST", body: { email, password } });
                saveAuth(r.user, r.token);
                await refreshVerify();
                nav("/app");
              } catch (e) {
                setErr(e.message || "فشل");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "..." : "دخول"}
          </Btn>

          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <Link to="/register">إنشاء حساب</Link>
            <Link to="/forgot">نسيت كلمة المرور؟</Link>
          </div>
        </div>
      </Card>
    </Page>
  );
}

function Register() {
  const { saveAuth, setLoading, loading, refreshVerify } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  return (
    <Page title="حساب جديد" max={520}>
      <Card>
        {err && <div style={styles.alertBad}>{err}</div>}
        <div style={{ display: "grid", gap: 10 }}>
          <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="كلمة المرور (8 أحرف+)" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />

          <Btn
            disabled={loading}
            onClick={async () => {
              setErr("");
              if (pass.length < 8) return setErr("كلمة المرور خاصها 8 أحرف على الأقل");
              setLoading(true);
              try {
                const r = await apiRequest("/register", { method: "POST", body: { name, email, password: pass } });
                saveAuth(r.user, r.token);
                await refreshVerify();
                nav("/verify");
              } catch (e) {
                setErr(e.message || "فشل");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "..." : "تسجيل"}
          </Btn>

          <div>
            عندك حساب؟ <Link to="/login">دخول</Link>
          </div>
        </div>
      </Card>
    </Page>
  );
}

/**
 * Verify page:
 * - Send verification (backend may return dev_token for testing)
 * - Confirm verification by email+token (manual entry OR link: /verify/confirm?email=..&token=..)
 * - Refresh status
 */
function VerifyEmail() {
  const { user, refreshVerify } = useAuth();
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const [devToken, setDevToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");

  const send = async () => {
    setErr("");
    setToast("");
    try {
      const r = await apiRequest("/email/send-verification", { method: "POST", body: { email: user.email } });
      if (r?.dev_token) setDevToken(r.dev_token); // for DEV
      setToast("تم إرسال طلب التوثيق ✅");
    } catch (e) {
      setErr(e.message || "فشل");
    }
  };

  const confirm = async () => {
    setErr("");
    setToast("");
    try {
      await apiRequest("/email/confirm", { method: "POST", body: { email: user.email, token: tokenInput } });
      await refreshVerify();
      setToast("تم توثيق البريد ✅");
    } catch (e) {
      setErr(e.message || "فشل");
    }
  };

  if (!user) return <Navigate to="/login" replace />;

  return (
    <Page title="توثيق البريد الإلكتروني" max={720}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            البريد: <b>{user.email}</b>
            <div style={{ marginTop: 6 }}>
              الحالة:{" "}
              {user.verified ? <Badge tone="good">موثّق ✅</Badge> : <Badge tone="warn">غير موثّق ⚠️</Badge>}
            </div>
          </div>

          <Btn
            onClick={async () => {
              try {
                const v = await refreshVerify();
                setToast(v ? "الحساب موثّق ✅" : "مازال غير موثّق");
              } catch {
                setToast("تم التحديث");
              }
            }}
          >
            تحديث الحالة
          </Btn>
        </div>

        {err && <div style={styles.alertBad}>{err}</div>}
        <Toast text={toast} />

        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          <Btn variant="primary" onClick={send}>
            إرسال رسالة التوثيق
          </Btn>

          {devToken && (
            <div style={styles.alertInfo}>
              <b>DEV TOKEN:</b> {devToken}
              <div style={{ fontSize: 12, marginTop: 6, color: "#334155" }}>
                فـ production خصو يتسيفط عبر email. دابا تقدر تلسقو فالحقل لتحت وتدير Confirm.
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            <Input
              placeholder="Token ديال التوثيق (إلا عندك)"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <Btn onClick={confirm} disabled={!tokenInput.trim()}>
              Confirm
            </Btn>
          </div>

          <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
            📌 إلا درتي email provider، الرابط غادي يكون بحال: <code>/verify/confirm?email=...&token=...</code>
          </div>

          <Link to="/app" style={{ marginTop: 8 }}>
            رجوع للتطبيق →
          </Link>
        </div>
      </Card>
    </Page>
  );
}

function VerifyConfirm() {
  const q = useQuery();
  const email = q.get("email") || "";
  const token = q.get("token") || "";
  const { refreshVerify } = useAuth();
  const nav = useNavigate();

  const [msg, setMsg] = useState("Processing...");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!email || !token) throw new Error("رابط غير صالح");
        await apiRequest("/email/confirm", { method: "POST", body: { email, token } });
        await refreshVerify();
        setMsg("تم توثيق البريد ✅");
        setTimeout(() => nav("/app"), 900);
      } catch (e) {
        setErr(e.message || "فشل");
        setMsg("");
      }
    })();
    // eslint-disable-next-line
  }, []);

  return (
    <Page title="تأكيد التوثيق" max={640}>
      <Card>
        {msg && <div style={styles.alertInfo}>{msg}</div>}
        {err && <div style={styles.alertBad}>{err}</div>}
        <div style={{ marginTop: 12 }}>
          <Link to="/verify">رجوع</Link>
        </div>
      </Card>
    </Page>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [devToken, setDevToken] = useState("");
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  return (
    <Page title="نسيت كلمة المرور" max={640}>
      <Card>
        {err && <div style={styles.alertBad}>{err}</div>}
        <Toast text={toast} />

        <div style={{ display: "grid", gap: 10 }}>
          <Input placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Btn
            variant="primary"
            onClick={async () => {
              setErr("");
              setToast("");
              setDevToken("");
              try {
                const r = await apiRequest("/password/forgot", { method: "POST", body: { email } });
                if (r?.dev_token) setDevToken(r.dev_token);
                setToast("تم إرسال طلب الاسترجاع ✅");
              } catch (e) {
                setErr(e.message || "فشل");
              }
            }}
          >
            إرسال
          </Btn>

          {devToken && (
            <div style={styles.alertInfo}>
              <b>DEV RESET TOKEN:</b> {devToken}
              <div style={{ marginTop: 8 }}>
                استعمله فـ{" "}
                <Link to={`/reset?email=${encodeURIComponent(email)}&token=${encodeURIComponent(devToken)}`}>
                  صفحة Reset
                </Link>
              </div>
            </div>
          )}

          <Link to="/login">رجوع للدخول</Link>
        </div>
      </Card>
    </Page>
  );
}

function ResetPassword() {
  const q = useQuery();
  const emailQ = q.get("email") || "";
  const tokenQ = q.get("token") || "";

  const [email, setEmail] = useState(emailQ);
  const [token, setToken] = useState(tokenQ);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [ok, setOk] = useState(null);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const verify = async () => {
    setErr("");
    setToast("");
    setOk(null);
    try {
      const r = await apiRequest("/password/verify-token", { method: "POST", body: { email, token } });
      setOk(!!r?.valid);
      setToast(r?.valid ? "Token صالح ✅" : "Token غير صالح ❌");
    } catch (e) {
      setErr(e.message || "فشل");
    }
  };

  const reset = async () => {
    setErr("");
    setToast("");
    try {
      if (pass.length < 8) throw new Error("كلمة المرور خاصها 8 أحرف على الأقل");
      if (pass !== pass2) throw new Error("كلمتا المرور غير متطابقتين");
      await apiRequest("/password/reset", {
        method: "POST",
        body: { email, token, password: pass, password_confirmation: pass2 },
      });
      setToast("تم تغيير كلمة المرور ✅");
      setTimeout(() => nav("/login"), 900);
    } catch (e) {
      setErr(e.message || "فشل");
    }
  };

  return (
    <Page title="إعادة تعيين كلمة المرور" max={700}>
      <Card>
        {err && <div style={styles.alertBad}>{err}</div>}
        <Toast text={toast} />

        <div style={{ display: "grid", gap: 10 }}>
          <Input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="token" value={token} onChange={(e) => setToken(e.target.value)} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={verify}>Verify token</Btn>
            {ok === true && <Badge tone="good">OK</Badge>}
            {ok === false && <Badge tone="bad">NO</Badge>}
          </div>

          <div style={styles.divider} />

          <Input placeholder="كلمة المرور الجديدة" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <Input placeholder="تأكيد كلمة المرور" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          <Btn variant="primary" onClick={reset} disabled={!email || !token}>
            Reset
          </Btn>

          <Link to="/login">رجوع للدخول</Link>
        </div>
      </Card>
    </Page>
  );
}

function Settings() {
  const { user, token, refreshVerify } = useAuth();
  const [current, setCurrent] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  if (!user) return <Navigate to="/login" replace />;

  const change = async () => {
    setErr("");
    setToast("");
    try {
      if (p1.length < 8) throw new Error("كلمة المرور خاصها 8 أحرف على الأقل");
      if (p1 !== p2) throw new Error("كلمتا المرور غير متطابقتين");
      await apiRequest("/password/change", {
        method: "POST",
        token,
        body: { current_password: current, password: p1, password_confirmation: p2 },
      });
      setToast("تم تغيير كلمة المرور ✅");
      setCurrent("");
      setP1("");
      setP2("");
    } catch (e) {
      setErr(e.message || "فشل");
    }
  };

  return (
    <Page title="الإعدادات" max={720}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div>
              الحساب: <b>{user.email}</b>
            </div>
            <div style={{ marginTop: 6 }}>
              {user.verified ? <Badge tone="good">موثّق ✅</Badge> : <Badge tone="warn">غير موثّق ⚠️</Badge>}
            </div>
          </div>
          <Btn onClick={async () => { await refreshVerify(); setToast("تم تحديث الحالة"); }}>
            تحديث التوثيق
          </Btn>
        </div>

        {err && <div style={styles.alertBad}>{err}</div>}
        <Toast text={toast} />

        <div style={{ marginTop: 14 }}>
          <h3 style={styles.h3}>تغيير كلمة المرور</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <Input placeholder="كلمة المرور الحالية" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <Input placeholder="كلمة المرور الجديدة" type="password" value={p1} onChange={(e) => setP1(e.target.value)} />
            <Input placeholder="تأكيد كلمة المرور" type="password" value={p2} onChange={(e) => setP2(e.target.value)} />
            <Btn variant="primary" onClick={change}>
              حفظ
            </Btn>
          </div>
        </div>
      </Card>
    </Page>
  );
}

/** =========================
 * APP (EARNINGS) PAGES
 * ========================= */
function EarningsApp() {
  return (
    <RequireAuth>
      <RequireVerified>
        <EarningsShell />
      </RequireVerified>
    </RequireAuth>
  );
}

function EarningsShell() {
  const { token, setLoading, loading } = useAuth();

  const [tab, setTab] = useState("main"); // main | products | orders | expenses
  const [toast, setToast] = useState("");

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const [err, setErr] = useState("");

  const reloadAll = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [p, o, e] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/orders", { token }),
        apiRequest("/expenses", { token }),
      ]);
      setProducts(Array.isArray(p) ? p : []);
      setOrders(Array.isArray(o) ? o : []);
      setExpenses(Array.isArray(e) ? e : []);
    } catch (e2) {
      setErr(e2.message || "فشل التحميل");
    } finally {
      setLoading(false);
    }
  }, [token, setLoading]);

  useEffect(() => void reloadAll(), [reloadAll]);

  // today filter
  const t = todayISO();
  const todayOrders = useMemo(() => orders.filter((o) => String(o.date) === t), [orders, t]);
  const todayExpenses = useMemo(() => expenses.filter((e) => String(e.date) === t), [expenses, t]);

  const totalsToday = useMemo(() => calcTotals(todayOrders, todayExpenses), [todayOrders, todayExpenses]);
  const totalsAll = useMemo(() => calcTotals(orders, expenses), [orders, expenses]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // profit by product (simple)
  const profitByProductToday = useMemo(() => computeProfitByProduct(todayOrders, todayExpenses, productsById), [todayOrders, todayExpenses, productsById]);
  const profitByProductAll = useMemo(() => computeProfitByProduct(orders, expenses, productsById), [orders, expenses, productsById]);

  const showToast = (m) => {
    setToast(m);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 1500);
  };

  // Upload to backend
  const uploadProductImage = async (file) => {
    const fd = new FormData();
    fd.append("image", file);
    const r = await apiRequest("/upload/image", { method: "POST", token, body: fd, isForm: true });
    return r?.url || "";
  };

  // Products CRUD
  const createProduct = async (payload) => {
    const r = await apiRequest("/products", { method: "POST", token, body: payload });
    setProducts((prev) => [r, ...prev]);
    showToast("تمت إضافة المنتج ✅");
  };

  const updateProduct = async (id, payload) => {
    const r = await apiRequest(`/products/${id}`, { method: "PUT", token, body: payload });
    setProducts((prev) => prev.map((p) => (p.id === id ? r : p)));
    showToast("تم تحديث المنتج ✅");
  };

  const deleteProduct = async (id) => {
    await apiRequest(`/products/${id}`, { method: "DELETE", token });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast("تم حذف المنتج ✅");
  };

  // Orders CRUD
  const createOrder = async (payload) => {
    const r = await apiRequest("/orders", { method: "POST", token, body: payload });
    setOrders((prev) => [r, ...prev]);
    showToast("تمت إضافة الطلب ✅");
  };

  const updateOrder = async (id, payload) => {
    const r = await apiRequest(`/orders/${id}`, { method: "PUT", token, body: payload });
    setOrders((prev) => prev.map((o) => (o.id === id ? r : o)));
    showToast("تم تحديث الطلب ✅");
  };

  const deleteOrder = async (id) => {
    await apiRequest(`/orders/${id}`, { method: "DELETE", token });
    setOrders((prev) => prev.filter((o) => o.id !== id));
    showToast("تم حذف الطلب ✅");
  };

  // Expenses CRUD
  const createExpense = async (payload) => {
    const r = await apiRequest("/expenses", { method: "POST", token, body: payload });
    setExpenses((prev) => [r, ...prev]);
    showToast("تمت إضافة المصروف ✅");
  };

  const updateExpense = async (id, payload) => {
    const r = await apiRequest(`/expenses/${id}`, { method: "PUT", token, body: payload });
    setExpenses((prev) => prev.map((e) => (e.id === id ? r : e)));
    showToast("تم تحديث المصروف ✅");
  };

  const deleteExpense = async (id) => {
    await apiRequest(`/expenses/${id}`, { method: "DELETE", token });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    showToast("تم حذف المصروف ✅");
  };

  return (
    <Page title={null} max={980}>
      <div style={styles.headerRow}>
        <div style={styles.brandBox}>
          <div style={styles.logo}>💰</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>مختصر الأرباح</div>
            <div style={{ fontSize: 12, color: "#5e6f8d" }}>اليوم / الإجمالي + الربح حسب المنتج</div>
          </div>
        </div>

        <div style={styles.pills}>
          <div style={styles.pill}>
            اليوم:{" "}
            <b style={{ color: totalsToday.net < 0 ? "#b91c1c" : "#0066ff" }}>
              {money(totalsToday.net)}
            </b>
          </div>
          <div style={styles.pill}>
            الإجمالي:{" "}
            <b style={{ color: totalsAll.net < 0 ? "#b91c1c" : "#166534" }}>
              {money(totalsAll.net)}
            </b>
          </div>
        </div>
      </div>

      {err && <div style={styles.alertBad}>{err}</div>}
      <Toast text={toast} />

      <div style={styles.tabs}>
        <button style={tab === "main" ? styles.tabActive : styles.tab} onClick={() => setTab("main")}>ملخص</button>
        <button style={tab === "products" ? styles.tabActive : styles.tab} onClick={() => setTab("products")}>🧾 منتجات</button>
        <button style={tab === "orders" ? styles.tabActive : styles.tab} onClick={() => setTab("orders")}>📋 طلبات</button>
        <button style={tab === "expenses" ? styles.tabActive : styles.tab} onClick={() => setTab("expenses")}>💸 مصاريف</button>
      </div>

      {loading && <div style={{ padding: 8, color: "#64748b" }}>Loading...</div>}

      {tab === "main" && (
        <Card>
          <div style={styles.sectionTitle}>
            <h3 style={styles.h3}>ملخص اليوم ({t})</h3>
            <Badge>أهم شيء</Badge>
          </div>

          <div style={styles.statsRow}>
            <StatBox n={totalsToday.total} label="كل الطلبات" />
            <StatBox n={totalsToday.delivered} label="تم التوصيل" />
            <StatBox n={totalsToday.returned} label="مرتجع" />
          </div>

          <div style={styles.divider} />

          <LineRow left="💰 المداخيل (المسلم)" right={money(totalsToday.revenue)} />
          <LineRow left="📉 المصاريف" right={money(totalsToday.costs)} />

          <div style={styles.netBox}>
            <span style={{ fontWeight: 800, color: "#0a3622" }}>✅ الربح الصافي اليوم</span>
            <span style={{ fontWeight: 900, fontSize: 22, color: totalsToday.net < 0 ? "#b91c1c" : "#0b4b2e" }}>
              {money(totalsToday.net)}
            </span>
          </div>

          <div style={styles.divider} />

          <div style={styles.sectionTitle}>
            <h3 style={styles.h3}>الربح حسب المنتج (اليوم)</h3>
            <Badge tone="good">Product Profit</Badge>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {profitByProductToday.length ? profitByProductToday.map((p) => (
              <ProductProfitRow key={p.productId} row={p} />
            )) : <div style={{ color: "#64748b" }}>لا توجد طلبات مسلّمة اليوم.</div>}
          </div>

          <div style={styles.divider} />

          <div style={styles.sectionTitle}>
            <h3 style={styles.h3}>الإجمالي</h3>
            <Badge tone="warn">All time</Badge>
          </div>

          <div style={styles.grid2}>
            <KpiBox value={money(totalsAll.net)} label="الربح الإجمالي" tone={totalsAll.net < 0 ? "bad" : "good"} />
            <KpiBox value={money(totalsAll.revenue)} label="مجموع المداخيل" />
            <KpiBox value={money(totalsAll.costs)} label="مجموع المصاريف" />
            <KpiBox value={`${totalsAll.delivered}/${totalsAll.total}`} label="تم التسليم / مجموع الطلبات" />
          </div>

          <div style={styles.divider} />

          <div style={styles.sectionTitle}>
            <h3 style={styles.h3}>الربح حسب المنتج (الإجمالي)</h3>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {profitByProductAll.length ? profitByProductAll.map((p) => (
              <ProductProfitRow key={p.productId} row={p} />
            )) : <div style={{ color: "#64748b" }}>لا توجد بيانات بعد.</div>}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#8495b2" }}>
            ✔ الربح = ثمن البيع − تكلفة المنتج − التوصيل (فقط الطلبات delivered).  
            المصاريف كتتوزع بالتساوي على المنتجات اللي عندها delivered (مؤقتاً).
          </div>
        </Card>
      )}

      {tab === "products" && (
        <ProductsTab
          products={products}
          onCreate={createProduct}
          onUpdate={updateProduct}
          onDelete={deleteProduct}
          onUpload={async (id, file) => {
            const url = await uploadProductImage(file);
            await updateProduct(id, { image_url: url });
          }}
        />
      )}

      {tab === "orders" && (
        <OrdersTab
          products={products}
          orders={orders}
          onCreate={createOrder}
          onUpdate={updateOrder}
          onDelete={deleteOrder}
        />
      )}

      {tab === "expenses" && (
        <ExpensesTab
          expenses={expenses}
          onCreate={createExpense}
          onUpdate={updateExpense}
          onDelete={deleteExpense}
        />
      )}
    </Page>
  );
}

/** =========================
 * Profit-by-product computation
 * ========================= */
function computeProfitByProduct(orders, expenses, productsById) {
  const deliveredOrders = orders.filter((o) => o.status === "delivered");
  const pids = Array.from(new Set(deliveredOrders.map((o) => o.product_id).filter(Boolean)));
  const totalExp = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const perProductExp = pids.length ? totalExp / pids.length : 0;

  const map = new Map();

  for (const o of orders) {
    const pid = o.product_id;
    if (!pid) continue;
    const p = productsById.get(pid);
    if (!p) continue;

    const row = map.get(pid) || {
      productId: pid,
      name: p.name,
      image_url: p.image_url,
      orders: 0,
      delivered: 0,
      returned: 0,
      pending: 0,
      revenue: 0,
      grossProfit: 0,
      expensesShare: 0,
      netProfit: 0,
    };

    row.orders += 1;
    if (o.status === "delivered") {
      row.delivered += 1;
      row.revenue += Number(o.sell || 0);
      row.grossProfit += orderProfit({ ...o, ship: o.ship ?? 0 });
    } else if (o.status === "returned") {
      row.returned += 1;
    } else {
      row.pending += 1;
    }

    map.set(pid, row);
  }

  for (const [pid, row] of map.entries()) {
    row.expensesShare = row.delivered > 0 ? perProductExp : 0;
    row.netProfit = row.grossProfit - row.expensesShare;
    map.set(pid, row);
  }

  return Array.from(map.values()).sort((a, b) => b.netProfit - a.netProfit);
}

function ProductProfitRow({ row }) {
  return (
    <div style={styles.productRow}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
        {row.image_url ? (
          <img src={row.image_url} alt={row.name} style={styles.img} onError={(e) => (e.currentTarget.style.display = "none")} />
        ) : (
          <div style={styles.imgFallback}>📦</div>
        )}
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <b>{row.name}</b>
            <span style={{ color: "#64748b", fontSize: 12 }}>• {row.delivered} مسلم</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>• {row.returned} مرجع</span>
          </div>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            ربح إجمالي: {money(row.grossProfit)} • مصاريف (تقريباً): {money(row.expensesShare)}
          </div>
        </div>
      </div>

      <div>
        <Badge tone={row.netProfit >= 0 ? "good" : "bad"}>{money(row.netProfit)}</Badge>
      </div>
    </div>
  );
}

/** =========================
 * Tabs (Products / Orders / Expenses)
 * ========================= */
function ProductsTab({ products, onCreate, onUpdate, onDelete, onUpload }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [ship, setShip] = useState("");
  const [sell, setSell] = useState("");

  return (
    <Card>
      <div style={styles.sectionTitle}>
        <h3 style={styles.h3}>المنتجات</h3>
        <Badge tone="warn">{products.length} منتج</Badge>
      </div>

      <div style={styles.formGrid}>
        <Input placeholder="اسم المنتج" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="تكلفة افتراضية" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Input placeholder="توصيل افتراضي" type="number" value={ship} onChange={(e) => setShip(e.target.value)} />
        <Input placeholder="ثمن بيع افتراضي" type="number" value={sell} onChange={(e) => setSell(e.target.value)} />
        <Btn
          variant="primary"
          onClick={async () => {
            if (!name.trim()) return alert("دخل اسم المنتج");
            await onCreate({
              name,
              default_cost: cost ? Number(cost) : null,
              default_ship: ship ? Number(ship) : null,
              default_sell: sell ? Number(sell) : null,
            });
            setName(""); setCost(""); setShip(""); setSell("");
          }}
        >
          + إضافة
        </Btn>
      </div>

      <div style={styles.divider} />

      <div style={{ display: "grid", gap: 10 }}>
        {products.map((p) => (
          <div key={p.id} style={styles.itemRow}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} style={styles.img} onError={(e) => (e.currentTarget.style.display = "none")} />
              ) : (
                <div style={styles.imgFallback}>📦</div>
              )}
              <div style={{ display: "grid", gap: 4 }}>
                <b>{p.name}</b>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  تكلفة: {p.default_cost ?? "—"} • توصيل: {p.default_ship ?? "—"} • بيع: {p.default_sell ?? "—"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label style={styles.uploadBtn}>
                📷 صورة
                <input
                  style={{ display: "none" }}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    onUpload(p.id, f);
                    e.target.value = "";
                  }}
                />
              </label>

              <Btn
                onClick={() => {
                  const newName = prompt("اسم المنتج:", p.name);
                  if (newName == null) return;
                  onUpdate(p.id, { name: newName });
                }}
              >
                ✏️
              </Btn>

              <Btn
                variant="danger"
                onClick={() => {
                  if (!window.confirm("حذف المنتج؟")) return;
                  onDelete(p.id);
                }}
              >
                🗑️
              </Btn>
            </div>
          </div>
        ))}

        {!products.length && <div style={{ color: "#64748b" }}>زيد أول منتج باش تبدا.</div>}
      </div>
    </Card>
  );
}

function OrdersTab({ products, orders, onCreate, onUpdate, onDelete }) {
  const [date, setDate] = useState(todayISO());
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("delivered");
  const [city, setCity] = useState("");
  const [sell, setSell] = useState("");
  const [cost, setCost] = useState("");
  const [ship, setShip] = useState("");

  // auto-fill from product defaults
  useEffect(() => {
    if (!productId) return;
    const p = products.find((x) => String(x.id) === String(productId));
    if (!p) return;
    if (!sell && p.default_sell != null) setSell(String(p.default_sell));
    if (!cost && p.default_cost != null) setCost(String(p.default_cost));
    if (!ship && p.default_ship != null) setShip(String(p.default_ship));
    // eslint-disable-next-line
  }, [productId]);

  return (
    <Card>
      <div style={styles.sectionTitle}>
        <h3 style={styles.h3}>الطلبات</h3>
        <Badge tone="warn">{orders.length} طلب</Badge>
      </div>

      <div style={styles.formGrid}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">(اختَر المنتج)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="delivered">✅ تم التسليم</option>
          <option value="pending">🕒 قيد التوصيل</option>
          <option value="returned">🔄 مرتجع</option>
        </Select>
        <Input placeholder="المدينة (اختياري)" value={city} onChange={(e) => setCity(e.target.value)} />

        <Input placeholder="ثمن البيع" type="number" value={sell} onChange={(e) => setSell(e.target.value)} />
        <Input placeholder="تكلفة السلعة" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Input placeholder="التوصيل" type="number" value={ship} onChange={(e) => setShip(e.target.value)} />

        <Btn
          variant="primary"
          onClick={async () => {
            if (!date) return alert("اختار التاريخ");
            if (!productId) return alert("اختار المنتج");
            if (!sell || !cost) return alert("دخل ثمن البيع والتكلفة");
            await onCreate({
              date,
              product_id: Number(productId),
              status,
              city: city || null,
              sell: Number(sell),
              cost: Number(cost),
              ship: ship ? Number(ship) : 0,
            });
            setCity(""); setSell(""); setCost(""); setShip("");
          }}
        >
          + إضافة
        </Btn>
      </div>

      <div style={styles.divider} />

      <div style={{ display: "grid", gap: 10 }}>
        {orders.map((o) => {
          const p = products.find((x) => x.id === o.product_id);
          const prof = orderProfit({ ...o, ship: o.ship ?? 0 });
          const st = o.status === "delivered" ? { text: "✅ تم التسليم", tone: "good" }
            : o.status === "returned" ? { text: "🔄 مرتجع", tone: "bad" }
            : { text: "🕒 قيد التوصيل", tone: "warn" };

          return (
            <div key={o.id} style={styles.itemRow}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <b>{p?.name || "منتج"}</b>
                  <span style={{ color: "#64748b", fontSize: 12 }}>• {o.date}</span>
                  {o.city && <span style={{ color: "#64748b", fontSize: 12 }}>• {o.city}</span>}
                </div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                  بيع {o.sell} • تكلفة {o.cost} • توصيل {o.ship ?? 0}
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                <Badge tone={st.tone}>{st.text}</Badge>
                <Badge tone={prof >= 0 ? "good" : "bad"}>{money(prof)}</Badge>

                <div style={{ display: "flex", gap: 8 }}>
                  <Btn
                    onClick={() => {
                      const newStatus = prompt("status: delivered/pending/returned", o.status);
                      if (!newStatus) return;
                      onUpdate(o.id, { status: newStatus });
                    }}
                  >
                    ✏️
                  </Btn>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm("حذف الطلب؟")) return;
                      onDelete(o.id);
                    }}
                  >
                    🗑️
                  </Btn>
                </div>
              </div>
            </div>
          );
        })}

        {!orders.length && <div style={{ color: "#64748b" }}>زيد أول طلب.</div>}
      </div>
    </Card>
  );
}

function ExpensesTab({ expenses, onCreate, onUpdate, onDelete }) {
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState("ads");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const typeLabel = {
    ads: "📱 إعلانات",
    packaging: "📦 تغليف",
    tools: "🔧 أدوات",
    other: "📌 أخرى",
  };

  return (
    <Card>
      <div style={styles.sectionTitle}>
        <h3 style={styles.h3}>المصاريف</h3>
        <Badge tone="bad">{expenses.length} مصروف</Badge>
      </div>

      <div style={styles.formGrid}>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ads">إعلانات</option>
          <option value="packaging">تغليف</option>
          <option value="tools">أدوات</option>
          <option value="other">أخرى</option>
        </Select>
        <Input placeholder="المبلغ" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Btn
          variant="primary"
          onClick={async () => {
            if (!date) return alert("اختار التاريخ");
            if (!amount) return alert("دخل المبلغ");
            await onCreate({
              date,
              type,
              amount: Number(amount),
              note: note || null,
            });
            setAmount(""); setNote("");
          }}
        >
          + إضافة
        </Btn>
      </div>

      <div style={styles.divider} />

      <div style={{ display: "grid", gap: 10 }}>
        {expenses.map((e) => (
          <div key={e.id} style={styles.itemRow}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <b>{typeLabel[e.type] || e.type}</b>
                <span style={{ color: "#64748b", fontSize: 12 }}>• {e.date}</span>
              </div>
              {e.note && <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{e.note}</div>}
            </div>

            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <Badge tone="bad">{money(e.amount)}</Badge>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn
                  onClick={() => {
                    const newAmount = prompt("المبلغ:", e.amount);
                    if (newAmount == null) return;
                    onUpdate(e.id, { amount: Number(newAmount) });
                  }}
                >
                  ✏️
                </Btn>
                <Btn
                  variant="danger"
                  onClick={() => {
                    if (!window.confirm("حذف المصروف؟")) return;
                    onDelete(e.id);
                  }}
                >
                  🗑️
                </Btn>
              </div>
            </div>
          </div>
        ))}
        {!expenses.length && <div style={{ color: "#64748b" }}>زيد أول مصروف.</div>}
      </div>
    </Card>
  );
}

/** =========================
 * Small components
 * ========================= */
function StatBox({ n, label }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statNum}>{n}</div>
      <div style={styles.statLbl}>{label}</div>
    </div>
  );
}
function LineRow({ left, right }) {
  return (
    <div style={styles.lineRow}>
      <span style={{ color: "#50607c" }}>{left}</span>
      <b>{right}</b>
    </div>
  );
}
function KpiBox({ value, label, tone }) {
  const c = tone === "bad" ? "#b91c1c" : tone === "good" ? "#166534" : "#0f172a";
  return (
    <div style={styles.kpi}>
      <b style={{ fontSize: 18, color: c }}>{value}</b>
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>{label}</div>
    </div>
  );
}

/** =========================
 * ROOT
 * ========================= */
export default function App() {
  return (
    <div dir="rtl" lang="ar" style={styles.app}>
     

    <Router>
        <AuthProvider>
          <TopBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/app" element={<EarningsApp />} />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/verify" element={<VerifyEmail />} />
            <Route path="/verify/confirm" element={<VerifyConfirm />} />

            <Route path="/forgot" element={<ForgotPassword />} />
            <Route path="/reset" element={<ResetPassword />} />

            <Route path="/settings" element={<Settings />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Router>
    </div>
  );
}

/** =========================
 * HOME / NOT FOUND
 * ========================= */
function Home() {
  const { user } = useAuth();
  return (
    <Page title={null} max={900}>
      <Card>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 28 }}>📊</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>تطبيق بسيط باش تعرف الربح والخسارة</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                الربح اليوم + الربح الإجمالي + الربح حسب كل منتج + رفع صور المنتجات.
              </div>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.kpi}>
              <b>✅ اليوم</b>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                شحال ربحت/خسرت اليوم من الطلبات المسلّمة + مصاريف اليوم.
              </div>
            </div>
            <div style={styles.kpi}>
              <b>📦 حسب المنتج</b>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
                تعرف شكون كيربح وشكون كيدير خسارة.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {user ? (
              <Link to="/app" style={styles.linkPillPrimary}>
                دخول للتطبيق →
              </Link>
            ) : (
              <>
                <Link to="/register" style={styles.linkPillPrimary}>
                  جرّب الآن (حساب جديد)
                </Link>
                <Link to="/login" style={styles.linkPill}>
                  عندي حساب
                </Link>
              </>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#8495b2" }}>
            ملاحظة: حالياً الربح كيتحسب غير فالطلبات delivered. نقدر نزيد خسارة المرتجعات (رجوع السلعة + مصاريف شحن إضافية) فالإصدار الجاي.
          </div>
        </div>
      </Card>
    </Page>
  );
}

function NotFound() {
  return (
    <Page title="404" max={600}>
      <Card>
        <div style={{ display: "grid", gap: 10 }}>
          <div>الصفحة غير موجودة.</div>
          <Link to="/">رجوع للرئيسية</Link>
        </div>
      </Card>
    </Page>
  );
}

/** =========================
 * STYLES (inline to keep App.js only)
 * ========================= */
const styles = {
  app: {
    minHeight: "100vh",
    background: "#f4f7fb",
    color: "#1e293b",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  page: {
    padding: 14,
    display: "flex",
    justifyContent: "center",
  },
  h2: {
    margin: "10px 0 14px",
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  h3: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "rgba(244,247,251,0.9)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #e8eef6",
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  brand: {
    textDecoration: "none",
    fontWeight: 900,
    color: "#0f172a",
  },
  linkPill: {
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #dbe1ea",
    color: "#1e2c47",
    fontWeight: 800,
    fontSize: 13,
  },
  linkPillPrimary: {
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0066ff",
    border: "1px solid #0066ff",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    boxShadow: "0 8px 16px rgba(0,102,255,0.2)",
  },
  linkPillWarn: {
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 900,
    fontSize: 13,
  },
  card: {
    background: "#fff",
    borderRadius: 28,
    boxShadow: "0 8px 26px rgba(0,0,0,0.04), 0 3px 8px rgba(0,0,0,0.03)",
    padding: "1.2rem 1rem",
    border: "1px solid #eef2f6",
  },
  input: {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: 40,
    border: "1px solid #dce3ec",
    background: "#fff",
    outline: "none",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: 18,
    border: "1px solid #dce3ec",
    background: "#fff",
    outline: "none",
    fontSize: 14,
    minHeight: 90,
    resize: "vertical",
  },
  btn: {
    background: "#f1f5f9",
    border: "1px solid #dbe1ea",
    padding: "0.85rem 1.1rem",
    borderRadius: 999,
    fontWeight: 900,
    color: "#1e2c47",
    cursor: "pointer",
    fontSize: 13,
  },
  btnPrimary: {
    background: "#0066ff",
    border: "1px solid #0066ff",
    color: "#fff",
    padding: "0.85rem 1.1rem",
    borderRadius: 999,
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
    boxShadow: "0 8px 16px rgba(0,102,255,0.2)",
  },
  btnDanger: {
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: "0.85rem 1.1rem",
    borderRadius: 999,
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 13,
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #dbe1ea",
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
    whiteSpace: "nowrap",
  },
  badgeGood: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    fontSize: 12,
    fontWeight: 900,
    color: "#166534",
    whiteSpace: "nowrap",
  },
  badgeBad: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    fontSize: 12,
    fontWeight: 900,
    color: "#b91c1c",
    whiteSpace: "nowrap",
  },
  badgeWarn: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    fontSize: 12,
    fontWeight: 900,
    color: "#9a3412",
    whiteSpace: "nowrap",
  },
  toast: {
    position: "fixed",
    bottom: 18,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1e293b",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    zIndex: 50,
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
  },
  alertBad: {
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    padding: 10,
    borderRadius: 16,
    marginBottom: 10,
    fontWeight: 800,
  },
  alertInfo: {
    background: "#eaf3ff",
    border: "1px solid #cddfff",
    color: "#0b3a88",
    padding: 10,
    borderRadius: 16,
    marginTop: 8,
  },
  divider: { height: 2, background: "#e9eef3", margin: "14px 0" },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  brandBox: { display: "flex", alignItems: "center", gap: 10 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    background: "#0066ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 900,
    boxShadow: "0 5px 12px rgba(0,102,255,0.2)",
  },
  pills: { display: "flex", gap: 10, flexWrap: "wrap" },
  pill: {
    background: "#eaf3ff",
    border: "1px solid #cddfff",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 900,
    color: "#0f172a",
  },

  tabs: {
    display: "flex",
    gap: 8,
    background: "#f1f5f9",
    border: "1px solid #e8eef6",
    padding: 6,
    borderRadius: 999,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  tab: {
    flex: "1 1 auto",
    padding: "10px 12px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    fontWeight: 900,
    color: "#4b5a72",
    cursor: "pointer",
  },
  tabActive: {
    flex: "1 1 auto",
    padding: "10px 12px",
    borderRadius: 999,
    border: "none",
    background: "#fff",
    fontWeight: 900,
    color: "#0b1e3c",
    boxShadow: "0 4px 10px rgba(0,0,0,0.02)",
    cursor: "pointer",
  },

  statsRow: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 },
  stat: {
    background: "#f9faff",
    border: "1px solid #e7edf4",
    borderRadius: 24,
    padding: "14px 12px",
    textAlign: "center",
    flex: "1 1 120px",
  },
  statNum: { fontSize: 26, fontWeight: 900, lineHeight: 1.1 },
  statLbl: { fontSize: 12, color: "#5f6f8a", marginTop: 4, fontWeight: 800 },

  lineRow: { display: "flex", justifyContent: "space-between", padding: "0 6px", margin: "10px 0" },

  netBox: {
    background: "#f0fdf4",
    border: "1px solid #d1fae5",
    borderRadius: 24,
    padding: "14px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },

  sectionTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0,1fr))",
    gap: 10,
    marginTop: 12,
  },

  itemRow: {
    background: "#fff",
    border: "1px solid #eef2f8",
    borderRadius: 22,
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 2px 6px rgba(0,0,0,0.01)",
    flexWrap: "wrap",
  },

  productRow: {
    background: "#ffffff",
    border: "1px solid #eef2f8",
    borderRadius: 22,
    padding: "12px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  img: { width: 48, height: 48, borderRadius: 14, objectFit: "cover", border: "1px solid #eef2f8" },
  imgFallback: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
    border: "1px solid #dbe1ea",
  },

  uploadBtn: {
    cursor: "pointer",
    padding: "10px 12px",
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #dbe1ea",
    fontWeight: 900,
    fontSize: 13,
    color: "#1e2c47",
    userSelect: "none",
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: 10,
    marginTop: 12,
  },
  kpi: {
    background: "#fff",
    border: "1px solid #eef2f8",
    borderRadius: 22,
    padding: "14px 14px",
  },
};

/** Responsive tweaks (since we're inline-only):
 * If screen small, collapse grids.
 */
(function injectResponsive() {
  if (typeof document === "undefined") return;
  const id = "responsive-inline-css";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.innerHTML = `
    @media (max-width: 780px) {
      ._dummy {}
    }
  `;
  document.head.appendChild(style);
})();
  