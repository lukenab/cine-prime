import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { useOutletContext } from "react-router-dom";

import {
  paymentApi,
  type AdminRefund,
  type RefundApproval,
  type ReconciliationCase,
} from "../../api/paymentApi";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { useAuth } from "../../context/AuthContext";
import "./RefundReconciliationPage.css";

type Tab = "refunds" | "cases";
type Detail = { kind: "refund"; value: AdminRefund } | { kind: "case"; value: ReconciliationCase };

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const moneyValue = (value: number, currency = "VND") => currency === "VND" ? money.format(value ?? 0) : `${(value ?? 0).toLocaleString()} ${currency}`;
const when = (value?: string) => value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
const human = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^| )\S/g, (letter) => letter.toUpperCase());

function tone(status: string) {
  if (status === "SUCCEEDED" || status === "RESOLVED") return "success";
  if (status === "FAILED" || status === "MANUAL_REVIEW") return "danger";
  return "warning";
}

function StatusPill({ status }: { status: string }) {
  return <span className={`rr-pill rr-pill--${tone(status)}`}>{human(status)}</span>;
}

export default function RefundReconciliationPage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const { user } = useAuth();
  const canApproveRefund = user?.permissions.includes("REFUND_APPROVE")
    || user?.roles.some((role) => role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN");
  const canReviewRefund = user?.permissions.includes("REFUND_REVIEW")
    || user?.roles.some((role) => role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN");
  const [tab, setTab] = useState<Tab>("refunds");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [refunds, setRefunds] = useState<AdminRefund[]>([]);
  const [cases, setCases] = useState<ReconciliationCase[]>([]);
  const [approvals, setApprovals] = useState<Record<string, RefundApproval>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      if (tab === "refunds") {
        const [result, approvalPage] = await Promise.all([
          paymentApi.getAdminRefunds({ status: status || undefined, bookingId: search || undefined, page: 0, size: 100 }),
          paymentApi.getRefundApprovals({ page: 0, size: 200 }),
        ]);
        setRefunds(result.content ?? []);
        const latest: Record<string, RefundApproval> = {};
        for (const approval of approvalPage.content ?? []) if (!latest[approval.refundId]) latest[approval.refundId] = approval;
        setApprovals(latest);
      } else {
        const result = await paymentApi.getAdminReconciliation({ status: status || undefined, severity: severity || undefined, bookingId: search || undefined, page: 0, size: 100 });
        setCases(result.content ?? []);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? "Could not load refund and reconciliation data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, severity, status, tab]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => ({
    pending: refunds.filter((item) => item.status === "PENDING").length,
    failed: refunds.filter((item) => item.status === "FAILED").length,
    open: cases.filter((item) => item.status === "OPEN" || item.status === "RETRYING").length,
    manual: cases.filter((item) => item.status === "MANUAL_REVIEW" || item.severity === "CRITICAL").length,
  }), [cases, refunds]);

  const action = async (key: string, task: () => Promise<unknown>) => {
    setActionId(key);
    setError("");
    try {
      await task();
      await load(true);
      setDetail(null);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message ?? "The action could not be completed.");
    } finally {
      setActionId(null);
    }
  };

  const note = (title: string) => window.prompt(title, "Verified against provider/payment ledger.") ?? "";

  const approvalAction = (refund: AdminRefund) => {
    const approval = approvals[refund.refundId];
    if (!approval && canReviewRefund) return <button className="rr-button rr-button--primary rr-full" disabled={!!actionId} onClick={() => void action(refund.refundId, async () => {
      const draft = await paymentApi.createRefundApprovalDraft(refund.refundId, note("Reason for refund retry request"));
      await paymentApi.submitRefundApproval(draft.requestId);
    })}><ClipboardCheck size={16} /> Request approval</button>;
    if (approval?.status === "DRAFT" && canReviewRefund) return <button className="rr-button rr-button--primary rr-full" disabled={!!actionId} onClick={() => void action(approval.requestId, () => paymentApi.submitRefundApproval(approval.requestId))}><ClipboardCheck size={16} /> Submit for approval</button>;
    if (approval?.status === "SUBMITTED" && canApproveRefund) return <div className="rr-action-row"><button className="rr-button rr-button--primary" disabled={!!actionId} onClick={() => void action(approval.requestId, () => paymentApi.approveRefundApproval(approval.requestId, note("Approval note")))}><CheckCircle2 size={15} /> Approve</button><button className="rr-button rr-button--danger" disabled={!!actionId} onClick={() => void action(approval.requestId, () => paymentApi.rejectRefundApproval(approval.requestId, note("Rejection reason")))}><X size={15} /> Reject</button></div>;
    if (approval?.status === "APPROVED" && canReviewRefund) return <button className="rr-button rr-button--primary rr-full" disabled={!!actionId} onClick={() => void action(approval.requestId, () => paymentApi.executeRefundApproval(approval.requestId))}><RotateCcw size={16} /> Execute approved refund</button>;
    if (approval) return <div className="rr-error"><ShieldAlert size={16} /> Approval workflow: {human(approval.status)}</div>;
    return <div className="rr-error"><ShieldAlert size={16} /> Finance officer action required.</div>;
  };

  return (
    <main className={`rr-page ${isDarkMode ? "rr-page--dark" : ""}`}>
      <AdminPageHeader
        eyebrow="Payment operations"
        title="Refunds & Reconciliation"
        description="Monitor customer refunds and resolve payment outcomes that need an operational decision."
        actions={(
          <button className="rr-button rr-button--secondary" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? <LoaderCircle className="rr-spin" size={16} /> : <RefreshCw size={16} />} Refresh
          </button>
        )}
      />

      <section className="rr-stats">
        <div><span>Pending refunds</span><strong>{stats.pending}</strong><small>Provider confirmation required</small></div>
        <div><span>Failed refunds</span><strong>{stats.failed}</strong><small>Needs retry or review</small></div>
        <div><span>Open cases</span><strong>{stats.open}</strong><small>Payment state mismatch</small></div>
        <div><span>Manual review</span><strong>{stats.manual}</strong><small>Escalated exceptions</small></div>
      </section>

      <section className="rr-toolbar">
        <div className="rr-tabs" role="tablist">
          <button className={tab === "refunds" ? "active" : ""} onClick={() => { setTab("refunds"); setStatus(""); setSeverity(""); }}>Refunds</button>
          <button className={tab === "cases" ? "active" : ""} onClick={() => { setTab("cases"); setStatus(""); setSeverity(""); }}>Reconciliation cases</button>
        </div>
        <label className="rr-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search booking or payment ID..." /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          {tab === "refunds" ? <>
            <option value="PENDING">Pending</option><option value="SUCCEEDED">Succeeded</option><option value="FAILED">Failed</option><option value="MANUAL_REVIEW">Manual review</option>
          </> : <>
            <option value="OPEN">Open</option><option value="RETRYING">Retrying</option><option value="RESOLVED">Resolved</option><option value="MANUAL_REVIEW">Manual review</option>
          </>}
        </select>
        {tab === "cases" && <select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Severity filter">
          <option value="">All severities</option>
          <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
        </select>}
      </section>

      {error && <div className="rr-error"><AlertTriangle size={17} /> <span>{error}</span></div>}

      <section className="rr-table-card">
        {loading ? <div className="rr-empty"><LoaderCircle className="rr-spin" size={22} /> Loading operational data...</div> : tab === "refunds" ? (
          refunds.length === 0 ? <div className="rr-empty"><ClipboardCheck size={22} /> No refund records match this filter.</div> : <div className="rr-table-scroll"><table><thead><tr><th>Refund</th><th>Booking / payment</th><th>Amount</th><th>Status</th><th>Updated</th><th /></tr></thead><tbody>
            {refunds.map((item) => <tr key={item.refundId}>
              <td><strong>{item.refundId}</strong><small>{item.reasonCode ?? "Refund request"}</small></td>
              <td><strong>{item.bookingId}</strong><small>{item.paymentReference ?? item.paymentId ?? "—"}</small></td>
              <td><strong>{moneyValue(item.amount, item.currency)}</strong><small>{item.providerRefundReference ?? "Provider reference pending"}</small></td>
              <td><StatusPill status={item.status} />{item.failureMessage && <small className="rr-danger-text">{item.failureMessage}</small>}</td>
              <td><small>{when(item.updatedAt ?? item.createdAt)}</small></td>
              <td><button className="rr-link" onClick={() => setDetail({ kind: "refund", value: item })}>View</button></td>
            </tr>)}
          </tbody></table></div>
        ) : cases.length === 0 ? <div className="rr-empty"><CheckCircle2 size={22} /> No reconciliation cases match this filter.</div> : <div className="rr-table-scroll"><table><thead><tr><th>Case</th><th>Booking / payment</th><th>Severity</th><th>Status</th><th>Attempts</th><th /></tr></thead><tbody>
          {cases.map((item) => <tr key={item.caseId}>
            <td><strong>Case #{item.caseId}</strong><small>{human(item.caseType)}</small></td>
            <td><strong>{item.bookingId}</strong><small>{item.paymentId}</small></td>
            <td><span className={`rr-severity rr-severity--${item.severity.toLowerCase()}`}>{human(item.severity)}</span></td>
            <td><StatusPill status={item.status} /><small>{item.details}</small></td>
            <td>{item.attemptCount}</td>
            <td><button className="rr-link" onClick={() => setDetail({ kind: "case", value: item })}>View</button></td>
          </tr>)}
        </tbody></table></div>}
      </section>

      {detail && <div className="rr-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
        <aside className="rr-drawer">
          <div className="rr-drawer__head"><div><span className="rr-eyebrow">OPERATIONS DETAIL</span><h2>{detail.kind === "refund" ? "Refund detail" : `Reconciliation case #${detail.value.caseId}`}</h2></div><button className="rr-icon-button" onClick={() => setDetail(null)}><X size={18} /></button></div>
          {detail.kind === "refund" ? <>
            <div className="rr-detail-grid"><div><span>Status</span><StatusPill status={detail.value.status} /></div><div><span>Amount</span><strong>{moneyValue(detail.value.amount, detail.value.currency)}</strong></div><div><span>Booking</span><strong>{detail.value.bookingId}</strong></div><div><span>Provider reference</span><strong>{detail.value.providerRefundReference ?? "Pending"}</strong></div></div>
            <dl className="rr-detail-list"><div><dt>Reason</dt><dd>{detail.value.reason ?? detail.value.reasonCode ?? "—"}</dd></div><div><dt>Failure</dt><dd>{detail.value.failureMessage ?? "No failure recorded"}</dd></div><div><dt>Requested</dt><dd>{when(detail.value.createdAt)}</dd></div><div><dt>Completed</dt><dd>{when(detail.value.completedAt)}</dd></div></dl>
            {detail.value.status !== "SUCCEEDED" && approvalAction(detail.value)}
          </> : <>
            <div className="rr-detail-grid"><div><span>Status</span><StatusPill status={detail.value.status} /></div><div><span>Severity</span><strong>{human(detail.value.severity)}</strong></div><div><span>Booking</span><strong>{detail.value.bookingId}</strong></div><div><span>Attempts</span><strong>{detail.value.attemptCount}</strong></div></div>
            <dl className="rr-detail-list"><div><dt>Details</dt><dd>{detail.value.details}</dd></div><div><dt>Created</dt><dd>{when(detail.value.createdAt)}</dd></div><div><dt>Resolved by</dt><dd>{detail.value.resolvedBy ?? "Unassigned"}</dd></div><div><dt>Resolution note</dt><dd>{detail.value.resolutionNote ?? "No resolution yet"}</dd></div></dl>
            {detail.value.status !== "RESOLVED" && <div className="rr-action-row"><button className="rr-button rr-button--secondary" disabled={actionId === `sync-${detail.value.caseId}`} onClick={() => void action(`sync-${detail.value.caseId}`, () => paymentApi.syncReconciliation(detail.value.caseId))}><RefreshCw size={15} /> Sync</button><button className="rr-button rr-button--primary" disabled={actionId === `resolve-${detail.value.caseId}`} onClick={() => void action(`resolve-${detail.value.caseId}`, () => paymentApi.resolveReconciliation(detail.value.caseId, note("Resolution note")))}><CheckCircle2 size={15} /> Resolve</button><button className="rr-button rr-button--danger" disabled={actionId === `escalate-${detail.value.caseId}`} onClick={() => void action(`escalate-${detail.value.caseId}`, () => paymentApi.escalateReconciliation(detail.value.caseId, note("Escalation note")))}><ShieldAlert size={15} /> Escalate</button></div>}
          </>}
        </aside>
      </div>}
    </main>
  );
}
