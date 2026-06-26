import { useState } from "react";
import { Search, Plus, SlidersHorizontal, RefreshCw, Eye, Pencil, Trash2, Mail, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { useOutletContext, useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────
export type EmployeeStatus = "Active" | "Inactive";

export interface EmployeeData {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  department: string;
  position: string;
  status: EmployeeStatus;
  joinedAt: string;
  avatar: string; // gradient string or URL
}

// ── Mock data — replace with API calls when user-service is ready ─────────────
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #f97316, #f59e0b)",
];

const MOCK_EMPLOYEES: EmployeeData[] = [
  {
    id: "1",
    employeeCode: "EMP001",
    fullName: "Nguyen Van An",
    email: "an.nguyen@cineprime.vn",
    phoneNumber: "0912 345 678",
    department: "Box Office",
    position: "Ticket Agent",
    status: "Active",
    joinedAt: "Jan 15, 2024",
    avatar: AVATAR_GRADIENTS[0],
  },
  {
    id: "2",
    employeeCode: "EMP002",
    fullName: "Tran Thi Bich",
    email: "bich.tran@cineprime.vn",
    phoneNumber: "0987 654 321",
    department: "Operations",
    position: "Shift Supervisor",
    status: "Active",
    joinedAt: "Mar 3, 2023",
    avatar: AVATAR_GRADIENTS[1],
  },
  {
    id: "3",
    employeeCode: "EMP003",
    fullName: "Le Minh Duc",
    email: "duc.le@cineprime.vn",
    phoneNumber: "0909 111 222",
    department: "Concessions",
    position: "F&B Staff",
    status: "Inactive",
    joinedAt: "Jun 20, 2022",
    avatar: AVATAR_GRADIENTS[2],
  },
  {
    id: "4",
    employeeCode: "EMP004",
    fullName: "Pham Quynh Anh",
    email: "anh.pham@cineprime.vn",
    phoneNumber: "0933 456 789",
    department: "Box Office",
    position: "Ticket Agent",
    status: "Active",
    joinedAt: "Sep 10, 2023",
    avatar: AVATAR_GRADIENTS[3],
  },
  {
    id: "5",
    employeeCode: "EMP005",
    fullName: "Hoang Van Khanh",
    email: "khanh.hoang@cineprime.vn",
    phoneNumber: "0978 888 999",
    department: "IT",
    position: "System Admin",
    status: "Active",
    joinedAt: "Feb 1, 2024",
    avatar: AVATAR_GRADIENTS[4],
  },
  {
    id: "6",
    employeeCode: "EMP006",
    fullName: "Do Thi My",
    email: "my.do@cineprime.vn",
    phoneNumber: "0911 222 333",
    department: "Operations",
    position: "Ticket Agent",
    status: "Active",
    joinedAt: "Nov 15, 2023",
    avatar: AVATAR_GRADIENTS[5],
  },
];

const DEPARTMENTS = ["Box Office", "Operations", "Concessions", "IT"];
const ITEMS_PER_PAGE = 8;

// ── Sub-components ────────────────────────────────────────────────────────────
function Avatar({ name, avatar }: { name: string; avatar: string }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0"
      style={{ background: avatar, fontWeight: 600 }}
    >
      {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
    </div>
  );
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full ${
          status === "Active" ? "bg-emerald-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
            status === "Active" ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </div>
      <span style={{ fontSize: "12px", color: status === "Active" ? "var(--text-main)" : "var(--text-sub)" }}>
        {status}
      </span>
    </div>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────────
function EmployeeStatsCards({ total, active, inactive }: { total: number; active: number; inactive: number }) {
  const cards = [
    { label: "Total Employees", value: total,    color: "#3b82f6", bg: "rgba(59,130,246,0.08)"  },
    { label: "Active",          value: active,   color: "#10b981", bg: "rgba(16,185,129,0.08)"  },
    { label: "Inactive",        value: inactive, color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map(({ label, value, color, bg }) => (
        <div
          key={label}
          className="rounded-2xl border p-5"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          <p style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-sub)", marginBottom: "8px" }}>
            {label}
          </p>
          <div className="flex items-end gap-3">
            <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-main)", lineHeight: 1 }}>{value}</span>
            <span
              className="px-2 py-0.5 rounded-lg text-xs font-semibold mb-0.5"
              style={{ color, background: bg }}
            >
              employees
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Deactivate confirmation modal ─────────────────────────────────────────────
function DeactivateModal({ employee, onConfirm, onCancel }: { employee: EmployeeData; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-rose-50 mx-auto mb-4">
          <Trash2 size={22} className="text-rose-500" />
        </div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", textAlign: "center", marginBottom: "8px" }}>
          Deactivate Employee
        </h3>
        <p style={{ fontSize: "13px", color: "var(--text-sub)", textAlign: "center", marginBottom: "20px" }}>
          Are you sure you want to deactivate{" "}
          <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{employee.fullName}</span>?
          <br />
          This account will no longer be able to log in.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--text-main)", borderColor: "var(--border-color)", background: "transparent" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: "#ef4444" }}
          >
            Deactivate
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

  const [employees, setEmployees] = useState<EmployeeData[]>(MOCK_EMPLOYEES);
  const [searchQuery, setSearchQuery]     = useState("");
  const [deptFilter, setDeptFilter]       = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [showFilters, setShowFilters]     = useState(false);
  const [page, setPage]                   = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<EmployeeData | null>(null);

  const accentColor = isDarkMode ? "#3b82f6" : "#2563eb";

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = employees.filter((e) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      e.fullName.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      e.phoneNumber.includes(q);
    const matchDept   = !deptFilter   || e.department === deptFilter;
    const matchStatus = !statusFilter || e.status     === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageItems  = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDeactivate = (id: string) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: "Inactive" as const } : e)));
    setConfirmTarget(null);
  };

  const stats = {
    total:    employees.length,
    active:   employees.filter((e) => e.status === "Active").length,
    inactive: employees.filter((e) => e.status === "Inactive").length,
  };

  return (
    <>
      {/* Deactivate modal */}
      {confirmTarget && (
        <DeactivateModal
          employee={confirmTarget}
          onConfirm={() => handleDeactivate(confirmTarget.id)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "22px", letterSpacing: "-0.01em", marginBottom: "5px" }}>
          Employee Management
        </h1>
        <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
          Manage staff accounts, departments, and access status.
        </p>
      </div>

      {/* Stats */}
      <EmployeeStatsCards {...stats} />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-sub)" }} />
          <input
            type="text"
            placeholder="Search by name, email, code, department..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl outline-none transition-all"
            style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", border: "1px solid var(--border-color)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-rose-500"
              style={{ fontSize: "16px", lineHeight: 1, color: "var(--text-sub)" }}
            >
              ×
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
        >
          <SlidersHorizontal size={15} />
          Filters
          {(deptFilter || statusFilter) && <span className="w-2 h-2 rounded-full ml-0.5" style={{ background: accentColor }} />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => { setEmployees(MOCK_EMPLOYEES); setPage(1); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:opacity-80"
          style={{ fontSize: "14px", background: "var(--bg-card)", color: "var(--text-main)", borderColor: "var(--border-color)" }}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>

        {/* Add employee */}
        <button
          onClick={() => navigate("/admin/employees/create")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-all shadow-sm"
          style={{ fontSize: "14px", fontWeight: 500, background: accentColor }}
        >
          <Plus size={16} />
          Add Employee
        </button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div
          className="flex items-center gap-3 flex-wrap p-4 rounded-xl border mb-6"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
        >
          {/* Department filter */}
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Department:</p>
          <div className="flex items-center gap-1 flex-wrap filter-btns">
            <button onClick={() => { setDeptFilter(""); setPage(1); }} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${!deptFilter ? "active-blue" : ""}`}>
              All
            </button>
            {DEPARTMENTS.map((d) => (
              <button
                key={d}
                onClick={() => { setDeptFilter(deptFilter === d ? "" : d); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${deptFilter === d ? "active-blue" : ""}`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border-color)" }} />

          {/* Status filter */}
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>Status:</p>
          <div className="flex items-center gap-1 filter-btns">
            <button onClick={() => { setStatusFilter(""); setPage(1); }} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${!statusFilter ? "active-blue" : ""}`}>
              All
            </button>
            <button onClick={() => { setStatusFilter(statusFilter === "Active" ? "" : "Active"); setPage(1); }} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${statusFilter === "Active" ? "active-green" : ""}`}>
              Active
            </button>
            <button onClick={() => { setStatusFilter(statusFilter === "Inactive" ? "" : "Inactive"); setPage(1); }} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${statusFilter === "Inactive" ? "active-gray" : ""}`}>
              Inactive
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-color)", backgroundColor: "rgba(128,128,128,0.04)" }}>
                {["Employee", "Contact", "Department / Position", "Status", "Joined"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left">
                    <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</span>
                  </th>
                ))}
                <th className="px-5 py-3.5 text-right">
                  <span style={{ color: "var(--text-sub)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center" style={{ fontSize: "14px", color: "var(--text-sub)" }}>
                    No employees found matching your filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((emp) => (
                  <tr
                    key={emp.id}
                    style={{ transition: "background-color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Employee */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.fullName} avatar={emp.avatar} />
                        <div>
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-main)" }}>{emp.fullName}</p>
                          <p style={{ fontSize: "11px", color: "var(--text-sub)", marginTop: "2px" }}>{emp.employeeCode}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5" style={{ color: "var(--text-sub)" }}>
                          <Mail size={11} />
                          <span style={{ fontSize: "12px" }}>{emp.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5" style={{ color: "var(--text-sub)" }}>
                          <Phone size={11} />
                          <span style={{ fontSize: "12px" }}>{emp.phoneNumber}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department / Position */}
                    <td className="px-5 py-3.5">
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>{emp.department}</p>
                      <p style={{ fontSize: "12px", color: "var(--text-sub)", marginTop: "2px" }}>{emp.position}</p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={emp.status} />
                    </td>

                    {/* Joined */}
                    <td className="px-5 py-3.5">
                      <span style={{ fontSize: "13px", color: "var(--text-sub)" }}>{emp.joinedAt}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/employees/${emp.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-50"
                          style={{ color: "var(--text-sub)" }}
                          title="View detail"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/employees/edit/${emp.id}`)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
                          style={{ color: "var(--text-sub)" }}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => emp.status === "Active" && setConfirmTarget(emp)}
                          disabled={emp.status === "Inactive"}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ color: "var(--text-sub)" }}
                          title={emp.status === "Active" ? "Deactivate" : "Already inactive"}
                        >
                          <Trash2 size={14} />
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
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
          <p style={{ fontSize: "13px", color: "var(--text-sub)" }}>
            Showing{" "}
            <span style={{ color: "var(--text-main)", fontWeight: 500 }}>
              {filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}
            </span>{" "}
            of <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{filtered.length}</span> employees
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: "var(--text-sub)" }}
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - safePage) <= 2)
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    fontSize: "13px",
                    fontWeight: p === safePage ? 600 : 400,
                    background: p === safePage ? accentColor : "transparent",
                    color: p === safePage ? "#fff" : "var(--text-sub)",
                  }}
                >
                  {p}
                </button>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ color: "var(--text-sub)" }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .filter-btns button {
          background: transparent;
          color: var(--text-sub);
          border-color: var(--border-color);
        }
        .filter-btns button:hover {
          background: rgba(128,128,128,0.1);
          color: var(--text-main);
        }
        .filter-btns button.active-blue  { background: #2563eb !important; color: #fff !important; border-color: #2563eb !important; }
        .filter-btns button.active-green { background: #059669 !important; color: #fff !important; border-color: #059669 !important; }
        .filter-btns button.active-gray  { background: #4b5563 !important; color: #fff !important; border-color: #4b5563 !important; }
      `}</style>
    </>
  );
}
