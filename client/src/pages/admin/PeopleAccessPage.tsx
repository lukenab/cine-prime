import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2, CheckCircle2, Clock3, Eye, KeyRound, MailPlus,
  MoreHorizontal, RefreshCw, RotateCcw, Search, ShieldCheck, UserCheck,
  SlidersHorizontal, UserRoundCheck, UserRoundX, UsersRound, X,
} from "lucide-react";

import { authApi } from "../../api/authApi";
import { employeeApi, type EmployeeResponse } from "../../api/employeeApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { userApi } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import { Toast } from "../../components/shared/Toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import InviteEmployeeModal from "./InviteEmployeeModal";

type WorkspaceTab = "customers" | "staff" | "invitations";

type Account = {
  accountId: string;
  username?: string;
  email?: string;
  status: "ACTIVE" | "PENDING" | "INACTIVE" | string;
  lastLoginAt?: string | null;
  createdAt?: string;
  roles?: Array<{ roleName: string }>;
};

type Profile = {
  accountId: string;
  fullName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  profileCompleted?: boolean;
  isActive?: boolean;
  createdAt?: string;
};

type CustomerRow = { account: Account; profile?: Profile };
type StaffRow = { account: Account; profile?: Profile; employee?: EmployeeResponse; cluster?: ClusterResponse };

type ConfirmAction = {
  title: string;
  description: string;
  label: string;
  successMessage?: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

const tabCopy: Record<WorkspaceTab, { title: string; description: string }> = {
  customers: { title: "Customers", description: "Manage customer account access and booking details." },
  staff: { title: "Staff", description: "Manage cinema assignments, employment and operational access." },
  invitations: { title: "Invitations", description: "Track pending staff activation and resend secure invitations." },
};

const validTab = (value: string | null): WorkspaceTab =>
  value === "staff" || value === "invitations" ? value : "customers";

const roleNames = (account: Account) => (account.roles ?? []).map((role) => role.roleName.toUpperCase());
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";
const formatEnum = (value?: string | null) => value ? value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "—";
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "?";

export default function PeopleAccessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = validTab(searchParams.get("tab"));
  const inviteOpen = searchParams.get("invite") === "1";
  const canInviteEmployee = user?.permissions.includes("EMPLOYEE_CREATE")
    || user?.roles.some((role) => role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<EmployeeResponse[]>([]);
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [profileFilter, setProfileFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [employmentFilter, setEmploymentFilter] = useState("ALL");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountResponse, profileResponse, employeeResponse, clusterResponse] = await Promise.all([
        authApi.getAllAccounts(),
        userApi.getAllUsers(1, 200),
        employeeApi.getAll(1, 200),
        movieApi.getClusters(),
      ]);
      setAccounts((accountResponse as any)?.result ?? []);
      setProfiles((profileResponse as any)?.result?.data ?? []);
      setEmployees((employeeResponse as any)?.result?.data ?? []);
      setClusters((clusterResponse as any)?.result ?? []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Unable to load people and access data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setSearch("");
    setStatusFilter("ALL");
    setProfileFilter("ALL");
    setBranchFilter("ALL");
    setDepartmentFilter("ALL");
    setPositionFilter("ALL");
    setEmploymentFilter("ALL");
    setShowFilters(false);
  }, [tab]);

  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.accountId, profile])), [profiles]);
  const employeeByAccount = useMemo(() => new Map(employees.map((employee) => [employee.accountId, employee])), [employees]);
  const clusterById = useMemo(() => new Map(clusters.map((cluster) => [String(cluster.clusterId), cluster])), [clusters]);

  const customerRows = useMemo<CustomerRow[]>(() => accounts
    .filter((account) => roleNames(account).includes("MEMBER"))
    .map((account) => ({ account, profile: profileById.get(account.accountId) })), [accounts, profileById]);

  const staffRows = useMemo<StaffRow[]>(() => accounts
    .filter((account) => roleNames(account).some((role) => [
      "EMPLOYEE", "BRANCH_MANAGER", "PROGRAMMING_OPERATOR", "PROGRAMMING_APPROVER",
      "FINANCE_OFFICER", "FINANCE_APPROVER", "COMMERCIAL_MANAGER", "SECURITY_AUDITOR", "SYSTEM_ADMIN",
    ].includes(role)))
    .map((account) => {
      const employee = employeeByAccount.get(account.accountId);
      return { account, employee, profile: profileById.get(account.accountId), cluster: employee?.cinemaId ? clusterById.get(employee.cinemaId) : undefined };
    }), [accounts, clusterById, employeeByAccount, profileById]);

  const pendingRows = useMemo(() => staffRows.filter((row) => row.account.status === "PENDING"), [staffRows]);

  const filteredCustomers = useMemo(() => customerRows.filter((row) => {
    const text = `${row.profile?.fullName ?? ""} ${row.account.email ?? ""} ${row.account.username ?? ""}`.toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    const matchesStatus = statusFilter === "ALL" || row.account.status === statusFilter;
    const profileState = row.profile?.profileCompleted ? "COMPLETE" : "INCOMPLETE";
    return matchesSearch && matchesStatus && (profileFilter === "ALL" || profileState === profileFilter);
  }), [customerRows, profileFilter, search, statusFilter]);

  const filteredStaff = useMemo(() => staffRows.filter((row) => {
    const text = `${row.profile?.fullName ?? ""} ${row.account.email ?? ""} ${row.employee?.employeeCode ?? ""}`.toLowerCase();
    return text.includes(search.trim().toLowerCase())
      && (statusFilter === "ALL" || row.account.status === statusFilter)
      && (branchFilter === "ALL" || row.employee?.cinemaId === branchFilter)
      && (departmentFilter === "ALL" || row.employee?.department === departmentFilter)
      && (positionFilter === "ALL" || row.employee?.position === positionFilter)
      && (employmentFilter === "ALL" || row.employee?.employmentType === employmentFilter);
  }), [branchFilter, departmentFilter, employmentFilter, positionFilter, search, staffRows, statusFilter]);

  const filteredInvitations = useMemo(() => pendingRows.filter((row) => {
    const text = `${row.profile?.fullName ?? ""} ${row.account.email ?? ""} ${row.employee?.employeeCode ?? ""}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (branchFilter === "ALL" || row.employee?.cinemaId === branchFilter);
  }), [branchFilter, pendingRows, search]);

  const setTab = (next: WorkspaceTab) => setSearchParams({ tab: next });
  const setInviteOpen = (open: boolean) => setSearchParams(open ? { tab: "staff", invite: "1" } : { tab: tab === "invitations" ? "invitations" : "staff" });

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      await confirmAction.run();
      setToast({ type: "success", message: confirmAction.successMessage ?? `${confirmAction.label} completed.` });
      setConfirmAction(null);
      await load();
    } catch (actionError: any) {
      setToast({ type: "error", message: actionError?.response?.data?.message || "Action failed." });
    } finally {
      setActionLoading(false);
    }
  };

  const changeAccountStatus = (row: CustomerRow | StaffRow, nextStatus: "ACTIVE" | "INACTIVE") => {
    const name = row.profile?.fullName || row.account.email || "this account";
    setConfirmAction({
      title: nextStatus === "INACTIVE" ? "Suspend account?" : "Reactivate account?",
      description: nextStatus === "INACTIVE" ? `${name} will be signed out and unable to access CinePrime.` : `${name} will regain access to CinePrime.`,
      label: nextStatus === "INACTIVE" ? "Suspend" : "Reactivate",
      destructive: nextStatus === "INACTIVE",
      run: async () => { await authApi.updateAccount(row.account.accountId, { status: nextStatus }); },
    });
  };

  const changeEmployeeStatus = (row: StaffRow, reactivate: boolean) => {
    if (!row.employee) return;
    const name = row.profile?.fullName || row.account.email || "this employee";
    setConfirmAction({
      title: reactivate ? "Reactivate staff member?" : "Suspend staff member?",
      description: reactivate ? `${name} will regain access for their assigned branch.` : `${name} will lose access and all active sessions will be revoked.`,
      label: reactivate ? "Reactivate" : "Suspend",
      destructive: !reactivate,
      run: async () => { reactivate ? await employeeApi.reactivate(row.employee!.employeeId) : await employeeApi.disable(row.employee!.employeeId); },
    });
  };

  const resendInvitation = async (accountId: string) => {
    try {
      await authApi.resendActivation(accountId);
      setToast({ type: "success", message: "Activation invitation resent." });
    } catch (actionError: any) {
      setToast({ type: "error", message: actionError?.response?.data?.message || "Unable to resend invitation." });
    }
  };

  const revokeSessions = (row: CustomerRow | StaffRow) => {
    const name = row.profile?.fullName || row.account.email || "This account";
    setConfirmAction({
      title: "Sign out on all devices?",
      description: `${name} will need to sign in again. The account and staff assignment will remain active.`,
      label: "Sign out devices",
      successMessage: `${name} was signed out on all devices.`,
      run: async () => { await authApi.revokeSessions(row.account.accountId); },
    });
  };

  const activeFilterCount = tab === "customers"
    ? [statusFilter, profileFilter].filter((value) => value !== "ALL").length
    : [statusFilter, branchFilter, departmentFilter, positionFilter, employmentFilter].filter((value) => value !== "ALL").length;

  const stats = tab === "customers" ? [
    { label: "Total members", value: customerRows.length, icon: UsersRound, tone: "blue" },
    { label: "Active accounts", value: customerRows.filter((row) => row.account.status === "ACTIVE").length, icon: UserCheck, tone: "emerald" },
    { label: "Details required", value: customerRows.filter((row) => !row.profile?.profileCompleted).length, icon: Clock3, tone: "amber" },
    { label: "Suspended accounts", value: customerRows.filter((row) => row.account.status === "INACTIVE").length, icon: UserRoundX, tone: "rose" },
  ] : [
    { label: "Active staff", value: staffRows.filter((row) => row.account.status === "ACTIVE" && row.employee?.status === "ACTIVE").length, icon: UserRoundCheck, tone: "emerald" },
    { label: "Pending invitations", value: pendingRows.length, icon: MailPlus, tone: "blue" },
    { label: "Suspended", value: staffRows.filter((row) => row.account.status === "INACTIVE" || row.employee?.status === "DISABLED").length, icon: UserRoundX, tone: "rose" },
    { label: "Branches covered", value: new Set(staffRows.map((row) => row.employee?.cinemaId).filter(Boolean)).size, icon: Building2, tone: "violet" },
  ];

  return (
    <div className="w-full pb-10 text-left">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      {canInviteEmployee && <InviteEmployeeModal open={inviteOpen} clusters={clusters} onOpenChange={setInviteOpen} onInvited={() => { setToast({ type: "success", message: "Employee invitation sent." }); load(); }} />}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-500"><ShieldCheck size={14} /> People & Access</div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">{tabCopy[tab].title}</h1>
          <p className="mt-1 text-sm text-[var(--text-sub)]">{tabCopy[tab].description}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b border-[var(--border-color)]">
        {(["customers", "staff", "invitations"] as WorkspaceTab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`relative px-4 py-3 text-sm font-semibold capitalize transition-colors ${tab === item ? "text-blue-500" : "text-[var(--text-sub)] hover:text-[var(--text-main)]"}`}>
            {item}{item === "invitations" && pendingRows.length > 0 && <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-500">{pendingRows.length}</span>}
            {tab === item && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-t bg-blue-500" />}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => <StatCard key={label} label={label} value={value} icon={Icon} tone={tone} loading={loading} />)}
      </div>

      {error && <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-500"><span>{error}</span><button onClick={() => setError(null)}><X size={15} /></button></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" size={15} />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "customers" ? "Search customer name or email…" : "Search staff name, email or employee code…"} className="h-auto w-full rounded-xl border-[var(--border-color)] bg-[var(--bg-card)] py-2.5 pl-9 pr-9 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-blue-500/20" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--text-sub)] transition-colors hover:text-rose-500"><X size={14} /></button>}
        </div>
        <Button variant="outline" onClick={() => setShowFilters((visible) => !visible)} className={`h-10 rounded-xl border-[var(--border-color)] px-4 py-2.5 text-sm transition-all hover:opacity-80 ${showFilters || activeFilterCount > 0 ? "border-blue-500 text-blue-500" : "bg-[var(--bg-card)] text-[var(--text-main)]"}`}>
          <SlidersHorizontal size={15} /> Filter{activeFilterCount > 0 && <span className="rounded-full bg-blue-500 px-1.5 text-[10px] text-white">{activeFilterCount}</span>}
        </Button>
        <Button variant="outline" onClick={load} disabled={loading} className="h-10 rounded-xl border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-main)] transition-all hover:opacity-80"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> {loading ? "Loading..." : "Refresh"}</Button>
        {tab !== "customers" && canInviteEmployee && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="h-10 rounded-xl bg-blue-600 px-5 py-2.5 text-sm text-white shadow-sm hover:bg-blue-500"
          >
            <MailPlus size={16} /> Invite employee
          </Button>
        )}
      </div>

      {showFilters && <FilterPanel tab={tab} clusters={clusters} values={{ statusFilter, profileFilter, branchFilter, departmentFilter, positionFilter, employmentFilter }} setters={{ setStatusFilter, setProfileFilter, setBranchFilter, setDepartmentFilter, setPositionFilter, setEmploymentFilter }} />}

      <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
        {tab === "customers" && <CustomerTable rows={filteredCustomers} loading={loading} navigate={navigate} onStatus={changeAccountStatus} onResend={resendInvitation} onRevoke={revokeSessions} />}
        {tab === "staff" && <StaffTable rows={filteredStaff} loading={loading} navigate={navigate} onStatus={changeEmployeeStatus} onResend={resendInvitation} onRevoke={revokeSessions} />}
        {tab === "invitations" && <InvitationTable rows={filteredInvitations} loading={loading} onResend={resendInvitation} onCancel={(row: StaffRow) => changeAccountStatus(row, "INACTIVE")} />}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && !actionLoading && setConfirmAction(null)}>
        <AlertDialogContent className="w-[min(440px,calc(100vw-32px))] max-w-[440px] gap-0 overflow-hidden rounded-2xl border-[var(--border-color)] bg-[var(--bg-card)] p-0 text-[var(--text-main)] shadow-[0_24px_72px_rgba(0,0,0,0.24)]">
          <AlertDialogHeader className="px-6 pb-5 pt-6">
            <AlertDialogTitle className="text-lg">{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[var(--text-sub)]">{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-t border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-4">
            <AlertDialogCancel disabled={actionLoading} className="h-10 rounded-xl border-0 bg-transparent px-4 text-[var(--text-sub)] shadow-none hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); runConfirmedAction(); }} disabled={actionLoading} className={`h-10 rounded-xl px-4 shadow-sm ${confirmAction?.destructive ? "bg-red-600 text-white hover:bg-red-500" : "bg-blue-600 text-white hover:bg-blue-500"}`}>{actionLoading ? "Working…" : confirmAction?.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, loading }: { label: string; value: number; icon: React.ElementType; tone: string; loading: boolean }) {
  const colors: Record<string, string> = { blue: "text-blue-500 bg-blue-500/10", emerald: "text-emerald-500 bg-emerald-500/10", amber: "text-amber-500 bg-amber-500/10", rose: "text-rose-500 bg-rose-500/10", violet: "text-violet-500 bg-violet-500/10" };
  return <div className="flex min-h-28 items-center justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5"><div><p className="text-xs font-medium text-[var(--text-sub)]">{label}</p><p className="mt-2 text-3xl font-bold text-[var(--text-main)]">{loading ? "—" : value}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={20} /></div></div>;
}

function FilterPanel({ tab, clusters, values, setters }: any) {
  return <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 sm:grid-cols-2 xl:grid-cols-5">
    {tab !== "invitations" && <FilterSelect value={values.statusFilter} setValue={setters.setStatusFilter} placeholder="Account status" items={[{ value: "ALL", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "PENDING", label: "Pending" }, { value: "INACTIVE", label: "Suspended" }]} />}
    {tab === "customers" ? <FilterSelect value={values.profileFilter} setValue={setters.setProfileFilter} placeholder="Booking details" items={[{ value: "ALL", label: "All booking details" }, { value: "COMPLETE", label: "Ready" }, { value: "INCOMPLETE", label: "Details required" }]} /> : <>
      <FilterSelect value={values.branchFilter} setValue={setters.setBranchFilter} placeholder="Branch" items={[{ value: "ALL", label: "All branches" }, ...clusters.map((cluster: ClusterResponse) => ({ value: String(cluster.clusterId), label: cluster.clusterName }))]} />
      {tab === "staff" && <>
        <FilterSelect value={values.departmentFilter} setValue={setters.setDepartmentFilter} placeholder="Primary work area" items={["ALL", "GENERAL_OPERATIONS", "BOX_OFFICE", "FOOD_BEVERAGE", "FLOOR_GUEST_SERVICES", "PROJECTION_TECHNICAL", "FACILITIES_MAINTENANCE", "CONTENT_PROGRAMMING", "FINANCE", "COMMERCIAL", "INFORMATION_TECHNOLOGY", "RISK_COMPLIANCE"].map((value) => ({ value, label: value === "ALL" ? "All work areas" : formatEnum(value) }))} />
        <FilterSelect value={values.positionFilter} setValue={setters.setPositionFilter} placeholder="Position" items={["ALL", "TEAM_MEMBER", "SUPERVISOR", "ASSISTANT_MANAGER", "CINEMA_MANAGER", "PROGRAMMING_OPERATOR", "PROGRAMMING_APPROVER", "FINANCE_OFFICER", "FINANCE_APPROVER", "COMMERCIAL_MANAGER", "SYSTEM_ADMINISTRATOR", "SECURITY_AUDITOR"].map((value) => ({ value, label: value === "ALL" ? "All positions" : formatEnum(value) }))} />
        <FilterSelect value={values.employmentFilter} setValue={setters.setEmploymentFilter} placeholder="Employment" items={["ALL", "FULL_TIME", "PART_TIME", "FIXED_TERM", "SEASONAL"].map((value) => ({ value, label: value === "ALL" ? "All employment types" : formatEnum(value) }))} />
      </>}
    </>}
  </div>;
}

function FilterSelect({ value, setValue, items }: { value: string; setValue: (value: string) => void; placeholder: string; items: Array<{ value: string; label: string }> }) {
  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger
        className="h-10 rounded-xl border-[var(--border-color)] text-[var(--text-main)] shadow-none hover:border-blue-500/40 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15 [&_[data-slot=select-value]]:text-[var(--text-main)] [&_svg]:text-[var(--text-sub)]"
        style={{ backgroundColor: "var(--bg-main)", color: "var(--text-main)" }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[var(--bg-card)] text-[var(--text-main)]">
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="text-[var(--text-main)] focus:bg-blue-500/10 focus:text-blue-500"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Person({ name, email, avatar }: { name: string; email?: string; avatar?: string }) {
  return <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-500/10 text-xs font-bold text-blue-500">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials(name)}</div><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{name}</p><p className="truncate text-xs text-[var(--text-sub)]">{email || "—"}</p></div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = { ACTIVE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500", PENDING: "border-blue-500/20 bg-blue-500/10 text-blue-500", INACTIVE: "border-rose-500/20 bg-rose-500/10 text-rose-500", DISABLED: "border-rose-500/20 bg-rose-500/10 text-rose-500" };
  return <Badge variant="outline" className={styles[status] ?? "border-[var(--border-color)] text-[var(--text-sub)]"}>{formatEnum(status)}</Badge>;
}

const peopleTableHeadClass = "h-auto px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-sub)]";
const peopleTableCellClass = "px-5 py-3.5";
const peopleTableRowClass = "border-[var(--border-color)] transition-colors hover:bg-[rgba(128,128,128,0.04)]";

function CustomerTable({ rows, loading, navigate, onStatus, onResend, onRevoke }: any) {
  return (
    <Table>
      <TableHeader className="bg-[rgba(128,128,128,0.04)]">
        <TableRow className="border-[var(--border-color)] hover:bg-transparent">
          <TableHead className={peopleTableHeadClass}>Customer</TableHead>
          <TableHead className={peopleTableHeadClass}>Account status</TableHead>
          <TableHead className={peopleTableHeadClass}>Booking details</TableHead>
          <TableHead className={peopleTableHeadClass}>Member since</TableHead>
          <TableHead className={peopleTableHeadClass}>Last sign-in</TableHead>
          <TableHead className={`${peopleTableHeadClass} text-right`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? <LoadingRows columns={6} /> : rows.length === 0 ? <EmptyRow columns={6} message="No customers match these filters." /> : rows.map((row: CustomerRow) => (
          <TableRow key={row.account.accountId} className={peopleTableRowClass}>
            <TableCell className={peopleTableCellClass}><Person name={row.profile?.fullName || row.account.username || "Unnamed member"} email={row.account.email} avatar={row.profile?.avatarUrl} /></TableCell>
            <TableCell className={peopleTableCellClass}><StatusBadge status={row.account.status} /></TableCell>
            <TableCell className={peopleTableCellClass}>{row.profile?.profileCompleted ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500"><CheckCircle2 size={14} /> Ready</span> : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500"><Clock3 size={14} /> Details required</span>}</TableCell>
            <TableCell className={`${peopleTableCellClass} text-sm text-[var(--text-sub)]`}>{formatDate(row.account.createdAt || row.profile?.createdAt)}</TableCell>
            <TableCell className={`${peopleTableCellClass} text-sm text-[var(--text-sub)]`}>{formatDateTime(row.account.lastLoginAt)}</TableCell>
            <TableCell className={`${peopleTableCellClass} text-right`}>
              <div className="flex items-center justify-end gap-1.5">
                <CustomerPrimaryAction row={row} navigate={navigate} onStatus={onStatus} onResend={onResend} />
                <CustomerActions row={row} onStatus={onStatus} onRevoke={onRevoke} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StaffTable({ rows, loading, navigate, onStatus, onResend, onRevoke }: any) {
  return (
    <Table>
      <TableHeader className="bg-[rgba(128,128,128,0.04)]">
        <TableRow className="border-[var(--border-color)] hover:bg-transparent">
          <TableHead className={peopleTableHeadClass}>Employee</TableHead>
          <TableHead className={peopleTableHeadClass}>Branch</TableHead>
          <TableHead className={peopleTableHeadClass}>Position / work area</TableHead>
          <TableHead className={peopleTableHeadClass}>Account</TableHead>
          <TableHead className={peopleTableHeadClass}>Last login</TableHead>
          <TableHead className={`${peopleTableHeadClass} text-right`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? <LoadingRows columns={6} /> : rows.length === 0 ? <EmptyRow columns={6} message="No staff match these filters." /> : rows.map((row: StaffRow) => (
          <TableRow key={row.account.accountId} className={peopleTableRowClass}>
            <TableCell className={peopleTableCellClass}><Person name={row.profile?.fullName || row.account.username || "Unnamed employee"} email={row.employee?.employeeCode || row.account.email} avatar={row.profile?.avatarUrl} /></TableCell>
            <TableCell className={peopleTableCellClass}><p className="max-w-48 truncate text-sm font-medium text-[var(--text-main)]">{row.cluster?.clusterName || "Unassigned"}</p></TableCell>
            <TableCell className={peopleTableCellClass}><p className="text-sm font-medium text-[var(--text-main)]">{formatEnum(row.employee?.position)}</p><p className="text-xs text-[var(--text-sub)]">{formatEnum(row.employee?.department)}</p></TableCell>
            <TableCell className={peopleTableCellClass}><StatusBadge status={row.account.status === "ACTIVE" ? row.employee?.status || row.account.status : row.account.status} /></TableCell>
            <TableCell className={`${peopleTableCellClass} text-sm text-[var(--text-sub)]`}>{formatDateTime(row.account.lastLoginAt)}</TableCell>
            <TableCell className={`${peopleTableCellClass} text-right`}>
              <div className="flex items-center justify-end gap-1.5">
                <StaffPrimaryAction row={row} navigate={navigate} onStatus={onStatus} onResend={onResend} />
                <StaffActions row={row} onStatus={onStatus} onRevoke={onRevoke} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InvitationTable({ rows, loading, onResend, onCancel }: any) {
  return (
    <Table>
      <TableHeader className="bg-[rgba(128,128,128,0.04)]">
        <TableRow className="border-[var(--border-color)] hover:bg-transparent">
          <TableHead className={peopleTableHeadClass}>Invitee</TableHead>
          <TableHead className={peopleTableHeadClass}>Access role</TableHead>
          <TableHead className={peopleTableHeadClass}>Branch</TableHead>
          <TableHead className={peopleTableHeadClass}>Sent</TableHead>
          <TableHead className={peopleTableHeadClass}>Status</TableHead>
          <TableHead className={`${peopleTableHeadClass} text-right`}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? <LoadingRows columns={6} /> : rows.length === 0 ? <EmptyRow columns={6} message="No pending staff invitations." /> : rows.map((row: StaffRow) => (
          <TableRow key={row.account.accountId} className={peopleTableRowClass}>
            <TableCell className={peopleTableCellClass}><Person name={row.profile?.fullName || row.account.username || "Invited employee"} email={row.account.email} /></TableCell>
            <TableCell className={`${peopleTableCellClass} text-sm text-[var(--text-main)]`}>
              {formatEnum(roleNames(row.account).find((role) => role !== "MEMBER") ?? "EMPLOYEE")}
            </TableCell>
            <TableCell className={`${peopleTableCellClass} text-sm text-[var(--text-main)]`}>{row.cluster?.clusterName || "Unassigned"}</TableCell>
            <TableCell className={`${peopleTableCellClass} text-sm text-[var(--text-sub)]`}>{formatDate(row.account.createdAt)}</TableCell>
            <TableCell className={peopleTableCellClass}><StatusBadge status="PENDING" /></TableCell>
            <TableCell className={`${peopleTableCellClass} text-right`}>
              <div className="flex items-center justify-end gap-1.5">
                <Button size="sm" variant="ghost" className={primaryActionClass} onClick={() => onResend(row.account.accountId)}><MailPlus /> Resend</Button>
                <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8 rounded-lg text-[var(--text-sub)] hover:bg-black/5 hover:text-[var(--text-main)] dark:hover:bg-white/10" aria-label="Invitation actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onClick={() => onCancel(row)}><X /> Cancel invitation</DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const primaryActionClass = "h-8 rounded-lg border-0 bg-blue-500/10 px-3 text-blue-600 shadow-none hover:bg-blue-500/20 hover:text-blue-700 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:text-blue-400 dark:hover:text-blue-300 [&_svg]:size-3.5";

function CustomerPrimaryAction({ row, navigate, onStatus, onResend }: any) {
  if (row.account.status === "PENDING") return <Button size="sm" variant="ghost" className={primaryActionClass} onClick={() => onResend(row.account.accountId)}><MailPlus /> Resend</Button>;
  if (row.account.status === "INACTIVE") return <Button size="sm" variant="ghost" className={primaryActionClass} onClick={() => onStatus(row, "ACTIVE")}><RotateCcw /> Reactivate</Button>;
  return <Button size="sm" variant="ghost" className={primaryActionClass} onClick={() => navigate(`/admin/users/${row.account.accountId}`)}><Eye /> View</Button>;
}

function CustomerActions({ row, onStatus, onRevoke }: any) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8 rounded-lg text-[var(--text-sub)] hover:bg-black/5 hover:text-[var(--text-main)] dark:hover:bg-white/10" aria-label="More customer actions"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onRevoke(row)}><KeyRound /> Sign out all devices</DropdownMenuItem>{row.account.status !== "INACTIVE" && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => onStatus(row, "INACTIVE")}><UserRoundX /> Suspend</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>;
}

function StaffPrimaryAction({ row, navigate, onStatus, onResend }: any) {
  const disabled = row.account.status === "INACTIVE" || row.employee?.status === "DISABLED";
  if (row.account.status === "PENDING") return <Button size="sm" variant="ghost" className={primaryActionClass} onClick={() => onResend(row.account.accountId)}><MailPlus /> Resend</Button>;
  if (disabled) return <Button size="sm" variant="ghost" className={primaryActionClass} disabled={!row.employee} onClick={() => onStatus(row, true)}><RotateCcw /> Reactivate</Button>;
  return <Button size="sm" variant="ghost" className={primaryActionClass} disabled={!row.employee} onClick={() => row.employee && navigate(`/admin/employees/${row.employee.employeeId}`)}><Eye /> View</Button>;
}

function StaffActions({ row, onStatus, onRevoke }: any) {
  const disabled = row.account.status === "INACTIVE" || row.employee?.status === "DISABLED";
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8 rounded-lg text-[var(--text-sub)] hover:bg-black/5 hover:text-[var(--text-main)] dark:hover:bg-white/10" aria-label="More staff actions"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onRevoke(row)}><KeyRound /> Sign out all devices</DropdownMenuItem>{!disabled && <><DropdownMenuSeparator /><DropdownMenuItem disabled={!row.employee} variant="destructive" onClick={() => onStatus(row, false)}><UserRoundX /> Suspend</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>;
}

function LoadingRows({ columns }: { columns: number }) {
  return <>{Array.from({ length: 5 }, (_, index) => <TableRow key={index} className="border-[var(--border-color)]">{Array.from({ length: columns }, (__, cell) => <TableCell key={cell} className="px-5 py-4"><div className="h-4 animate-pulse rounded bg-[var(--border-color)]" /></TableCell>)}</TableRow>)}</>;
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return <TableRow><TableCell colSpan={columns} className="h-44 text-center"><UsersRound className="mx-auto mb-3 text-[var(--text-sub)]" size={26} /><p className="text-sm font-medium text-[var(--text-main)]">{message}</p><p className="mt-1 text-xs text-[var(--text-sub)]">Try changing the search or filter selection.</p></TableCell></TableRow>;
}
