import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, RefreshCw, Eye, Pencil, UserX,
  ChevronLeft, ChevronRight, Users, UserCheck, UserMinus,
  Briefcase, X, AlertCircle, SlidersHorizontal,
} from "lucide-react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { employeeApi, type EmployeeResponse } from "../../api/employeeApi";

// ── Types ─────────────────────────────────────────────────────────────────────
export type EmployeeStatus = "Active" | "Inactive";

export interface EmployeeData {
  id:             string;
  employeeCode:   string;
  accountId:      string;
  cinemaId:       string;
  fullName:       string;
  phoneNumber:    string;
  position:       string;
  positionRaw:    string;
  department:     string;
  departmentRaw:  string;
  employmentType: string;
  status:         EmployeeStatus;
  hireDate:       string;
  avatar:         string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#3b82f6,#6366f1)",
  "linear-gradient(135deg,#10b981,#059669)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "linear-gradient(135deg,#f97316,#f59e0b)",
];
function gradientFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}

const DEPARTMENT_LABELS: Record<string, string> = {
  BOX_OFFICE: "Box Office", CONCESSION: "Concession", FLOOR: "Floor",
  PROJECTION: "Projection", MANAGEMENT: "Management", CUSTOMER_SERVICE: "Customer Service",
};
const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time", PART_TIME: "Part-time", PROBATION: "Probation",
  INTERN: "Intern", CONTRACT: "Contract",
};
const POSITION_LABELS: Record<string, string> = {
  STAFF: "Staff", SUPERVISOR: "Supervisor", MANAGER: "Manager",
};

// badge colour per department
const DEPT_COLOR: Record<string, { bg: string; text: string }> = {
  BOX_OFFICE:       { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  CONCESSION:       { bg: "rgba(245,158,11,0.12)",  text: "#d97706" },
  FLOOR:            { bg: "rgba(16,185,129,0.12)",  text: "#059669" },
  PROJECTION:       { bg: "rgba(139,92,246,0.12)",  text: "#7c3aed" },
  MANAGEMENT:       { bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
  CUSTOMER_SERVICE: { bg: "rgba(6,182,212,0.12)",   text: "#0891b2" },
};

const EMPLOYMENT_COLOR: Record<string, { bg: string; text: string }> = {
  FULL_TIME:  { bg: "rgba(16,185,129,0.10)",  text: "#059669" },
  PART_TIME:  { bg: "rgba(245,158,11,0.10)",  text: "#b45309" },
  PROBATION:  { bg: "rgba(99,102,241,0.10)",  text: "#4f46e5" },
  INTERN:     { bg: "rgba(6,182,212,0.10)",   text: "#0891b2" },
  CONTRACT:   { bg: "rgba(107,114,128,0.10)", text: "#4b5563" },
};

function mapResponse(r: EmployeeResponse): EmployeeData {
  return {
    id:             r.employeeId,
    employeeCode:   r.employeeCode || "—",
    accountId:      r.accountId,
    cinemaId:       r.cinemaId || "",
    fullName:       r.fullName || "—",
    phoneNumber:    r.phoneNumber || "—",
    positionRaw:    r.position,
    position:       POSITION_LABELS[r.position] ?? r.position,
    departmentRaw:  r.department ?? "",
    department:     r.department ? DEPARTMENT_LABELS[r.department] ?? r.department : "—",
    employmentType: r.employmentType ? EMPLOYMENT_LABELS[r.employmentType] ?? r.employmentType : "—",
    status:         r.status === "ACTIVE" ? "Active" : "Inactive",
    hireDate:       r.hireDate
      ? new Date(r.hireDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—",
    avatar: r.avatarUrl || gradientFromId(r.employeeId),
  };
}

const ITEMS_PER_PAGE = 10;

// ── Sub-components ────────────────────────────────────────────────────────────
function Avatar({ name, avatar }: { name: string; avatar: string }) {
  const initials = name.split(" ").map((n) => n[0] ?? "").join("").toUpperCase().slice(0, 2);
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
      style={{ background: avatar, fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em" }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const active = status === "Active";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        background: active ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.10)",
        color:      active ? "#059669" : "#6b7280",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? "#10b981" : "#9ca3af" }} />
      {status}
    </span>
  );
}

function Pill({ label, raw, map }: { label: string; raw: string; map: Record<string, { bg: string; text: string }> }) {
  const c = map[raw] ?? { bg: "rgba(107,114,128,0.10)", text: "#6b7280" };
  if (!raw || label === "—") return <span style={{ fontSize: "12px", color: "var(--text-sub)" }}>—</span>;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold" style={{ background: c.bg, color: c.text }}>
      {label}
    </span>
  );
}

// Stats cards
function StatsCards({ total, active, inactive }: { total: number; active: number; inactive: number }) {
  const cards = [
    { label: "Total Employees", value: total,    icon: Users,     color: "#3b82f6", bg: "rgba(59,130,246,0.08)"   },
    { label: "Active",          value: active,   icon: UserCheck, color: "#10b981", bg: "rgba(16,185,129,0.08)"   },
    { label: "Inactive",        value: inactive, icon: UserMinus, color: "#6b7280", bg: "rgba(107,114,128,0.08)"  },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="rounded-2xl border p-5 flex items-center gap-4"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
            <Icon size={20} style={{ color }} />
          </div>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "2px" }}>
              {label}
            </p>
            <p style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1 }}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Deactivate confirm modal
function ConfirmModal({ employee, loading, onConfirm, onCancel }: {
  employee: EmployeeData; loading: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onClick={onCancel}>
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
          <UserX size={22} className="text-rose-500" />
        </div>
        <h3 className="text-base font-semibold text-center mb-2" style={{ color: "var(--text-main)" }}>Deactivate Employee</h3>
        <p className="text-sm text-center mb-5 leading-relaxed" style={{ color: "var(--text-sub)" }}>
          Deactivate <span className="font-semibold" style={{ color: "var(--text-main)" }}>{employee.fullName}</span>?
          <br />Their account will be marked as Disabled.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:opacity-80 transition-all"
            style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: "#ef4444" }}>
            {loading ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ManageEmployeePage() {
  const { isDarkMode } = useOutletContext<{ isDarkMode: boolean }>();
  const navigate = useNavigate();

  const [employees, setEmployees]         = useState<EmployeeData[]>([]);
  const [loading, setLoading]             = useState(true);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [deptFilter, setDeptFilter]       = useState("");
  const [posFilter, setPosFilter]         = useState("");
  const [showFilters, setShowFilters]     = useState(false);
  const [page, setPage]                   = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<EmployeeData | null>(null);
  const [disabling, setDisabling]         = useState(false);

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res  = await employeeApi.getAll();
      const data: EmployeeResponse[] = (res as any)?.result?.data ?? [];
      setEmployees(data.map(mapResponse));
    } catch (err: any) {
      setApiError(err.response?.data?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const filtered = employees.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || e.fullName.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q)
      || e.position.toLowerCase().includes(q) || e.phoneNumber.includes(q) || e.department.toLowerCase().includes(q);
    return matchQ
      && (!statusFilter || e.status === statusFilter)
      && (!deptFilter   || e.departmentRaw === deptFilter)
      && (!posFilter    || e.positionRaw === posFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const activeFilters = [statusFilter, deptFilter, posFilter].filter(Boolean).length;

  const handleDeactivate = async (id: string) => {
    setDisabling(true);
    try {
      await employeeApi.disable(id);
      setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, status: "Inactive" } : e));
    } catch (err: any) {
      setApiError(err.response?.data?.message || "Failed to deactivate employee.");
    } finally {
      setDisabling(false);
      setConfirmTarget(null);
    }
  };

  const clearFilters = () => { setStatusFilter(""); setDeptFilter(""); setPosFilter(""); setPage(1); };
  const stats = {
    total:    employees.length,
    active:   employees.filter((e) => e.status === "Active").length,
    inactive: employees.filter((e) => e.status === "Inactive").length,
  };

  return (
    <>
      {confirmTarget && (
        <ConfirmModal
          employee={confirmTarget}
          loading={disabling}
          onConfirm={() => handleDeactivate(confirmTarget.id)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "4px" }}>
            Employee Management
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>Manage staff accounts, positions, and employment status.</p>
        </div>
        <button
          onClick={() => navigate("/admin/employees/create")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: accentColor }}
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <StatsCards {...stats} />

      {/* Error banner */}
      {apiError && (
        <div className="mb-5 rounded-xl border border-red-500/25 overflow-hidden">
          <div className="h-1 bg-red-500" />
          <div className="flex items-center gap-3 px-4 py-3">
            <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
            <p className="text-sm flex-1" style={{ color: "var(--text-main)" }}>{apiError}</p>
            <button onClick={() => setApiError(null)} className="hover:opacity-70 transition-opacity" style={{ color: "var(--text-sub)" }}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-60">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search name, code, position, phone…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl outline-none"
            style={{ fontSize: "13px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70" style={{ color: "var(--text-sub)" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80 relative"
          style={{ fontSize: "13px", background: showFilters ? accentColor : "var(--bg-card)", color: showFilters ? "#fff" : "var(--text-main)", borderColor: showFilters ? accentColor : "var(--border-color)" }}
        >
          <SlidersHorizontal size={14} /> Filters
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white flex items-center justify-center"
              style={{ fontSize: "10px", fontWeight: 700, background: "#ef4444" }}>
              {activeFilters}
            </span>
          )}
        </button>

        {/* Refresh */}
        <button
          onClick={fetchEmployees} disabled={loading}
          className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-sub)" }}
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-5 p-4 rounded-2xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          <div className="flex flex-wrap gap-6">
            {/* Status */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-sub)" }}>Status</p>
              <div className="flex gap-1.5">
                {["", "Active", "Inactive"].map((v) => (
                  <button key={v || "all"} onClick={() => { setStatusFilter(v); setPage(1); }}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                    style={{
                      background: statusFilter === v ? accentColor : "transparent",
                      color: statusFilter === v ? "#fff" : "var(--text-sub)",
                      borderColor: statusFilter === v ? accentColor : "var(--border-color)",
                    }}>
                    {v || "All"}
                  </button>
                ))}
              </div>
            </div>

            {/* Department */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-sub)" }}>Department</p>
              <div className="flex flex-wrap gap-1.5">
                {["", ...Object.keys(DEPARTMENT_LABELS)].map((v) => (
                  <button key={v || "all"} onClick={() => { setDeptFilter(v); setPage(1); }}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                    style={{
                      background: deptFilter === v ? accentColor : "transparent",
                      color: deptFilter === v ? "#fff" : "var(--text-sub)",
                      borderColor: deptFilter === v ? accentColor : "var(--border-color)",
                    }}>
                    {v ? DEPARTMENT_LABELS[v] : "All"}
                  </button>
                ))}
              </div>
            </div>

            {/* Position */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-sub)" }}>Position</p>
              <div className="flex gap-1.5">
                {["", ...Object.keys(POSITION_LABELS)].map((v) => (
                  <button key={v || "all"} onClick={() => { setPosFilter(v); setPage(1); }}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                    style={{
                      background: posFilter === v ? accentColor : "transparent",
                      color: posFilter === v ? "#fff" : "var(--text-sub)",
                      borderColor: posFilter === v ? accentColor : "var(--border-color)",
                    }}>
                    {v ? POSITION_LABELS[v] : "All"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {activeFilters > 0 && (
            <button onClick={clearFilters} className="mt-3 text-xs font-medium hover:opacity-70 transition-opacity flex items-center gap-1" style={{ color: "#ef4444" }}>
              <X size={11} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                {[
                  { label: "Employee",    w: "" },
                  { label: "Code",        w: "w-28" },
                  { label: "Department",  w: "" },
                  { label: "Position",    w: "" },
                  { label: "Type",        w: "" },
                  { label: "Status",      w: "w-28" },
                  { label: "Hire Date",   w: "w-32" },
                  { label: "Actions",     w: "w-28", right: true },
                ].map(({ label, w, right }) => (
                  <th key={label} className={`px-5 py-3.5 text-${right ? "right" : "left"} ${w}`}>
                    <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accentColor}40`, borderTopColor: accentColor }} />
                      <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Loading employees…</p>
                    </div>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1" style={{ background: "rgba(107,114,128,0.08)" }}>
                        <Briefcase size={22} style={{ color: "var(--text-sub)" }} />
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>
                        {employees.length === 0 ? "No employees yet" : "No results found"}
                      </p>
                      <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
                        {employees.length === 0 ? "Click Add Employee to get started." : "Try adjusting your search or filters."}
                      </p>
                      {activeFilters > 0 && (
                        <button onClick={clearFilters} className="mt-1 text-xs font-medium hover:opacity-70 transition-opacity" style={{ color: accentColor }}>
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className="group transition-colors"
                    style={{ borderTop: idx > 0 ? "1px solid var(--border-color)" : undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Employee */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.fullName} avatar={emp.avatar} />
                        <div className="min-w-0">
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap" }}>{emp.fullName}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "1px" }}>{emp.phoneNumber}</p>
                        </div>
                      </div>
                    </td>

                    {/* Code */}
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "12px", color: "var(--text-sub)", fontFamily: "monospace", letterSpacing: "0.03em" }}>
                        {emp.employeeCode}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3.5">
                      <Pill label={emp.department} raw={emp.departmentRaw} map={DEPT_COLOR} />
                    </td>

                    {/* Position */}
                    <td className="px-5 py-3.5">
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{emp.position}</p>
                    </td>

                    {/* Employment Type */}
                    <td className="px-5 py-3.5">
                      <Pill label={emp.employmentType} raw={emp.employmentType.replace("-", "_").toUpperCase()} map={EMPLOYMENT_COLOR} />
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={emp.status} />
                    </td>

                    {/* Hire Date */}
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "12px", color: "var(--text-sub)", whiteSpace: "nowrap" }}>{emp.hireDate}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => navigate(`/admin/employees/${emp.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors opacity-50 group-hover:opacity-100 hover:!opacity-100"
                          style={{ color: "var(--text-sub)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#3b82f6"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sub)"; }}
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/employees/edit/${emp.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors opacity-50 group-hover:opacity-100 hover:!opacity-100"
                          style={{ color: "var(--text-sub)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(107,114,128,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-main)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sub)"; }}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => emp.status === "Active" && setConfirmTarget(emp)}
                          disabled={emp.status === "Inactive"}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors opacity-50 group-hover:opacity-100 hover:!opacity-100 disabled:!opacity-20 disabled:cursor-not-allowed"
                          style={{ color: "var(--text-sub)" }}
                          onMouseEnter={(e) => { if (emp.status === "Active") { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; } }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-sub)"; }}
                          title={emp.status === "Active" ? "Deactivate" : "Already disabled"}
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
            <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
              Showing{" "}
              <span style={{ color: "var(--text-main)", fontWeight: 600 }}>
                {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
              </span>
              {" "}of{" "}
              <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{filtered.length}</span> employees
            </p>

            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70 transition-opacity"
                style={{ color: "var(--text-sub)" }}>
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === "number" && (arr[i - 1] as number) + 1 < p) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} style={{ width: 32, textAlign: "center", fontSize: "13px", color: "var(--text-sub)" }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{
                        fontSize: "13px", fontWeight: p === safePage ? 700 : 400,
                        background: p === safePage ? accentColor : "transparent",
                        color: p === safePage ? "#fff" : "var(--text-sub)",
                      }}>
                      {p}
                    </button>
                  )
                )}

              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70 transition-opacity"
                style={{ color: "var(--text-sub)" }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
