import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Copy,
  Ellipsis,
  IdCard,
  KeyRound,
  MailPlus,
  Pencil,
  RotateCcw,
  ShieldCheck,
  UserRound,
  UserRoundX,
} from "lucide-react";

import { authApi } from "../../api/authApi";
import { employeeApi, type EmployeeResponse } from "../../api/employeeApi";
import { movieApi, type ClusterResponse } from "../../api/movieApi";
import { Toast } from "../../components/shared/Toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

interface AccountInfo {
  accountId: string;
  username?: string;
  email?: string;
  status: string;
  createdAt?: string;
  lastLoginAt?: string | null;
  roles?: Array<{ roleName: string }>;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  GENERAL_OPERATIONS: "General operations",
  BOX_OFFICE: "Box office",
  FOOD_BEVERAGE: "Food & beverage",
  FLOOR_GUEST_SERVICES: "Floor & guest services",
  PROJECTION_TECHNICAL: "Projection & technical",
  FACILITIES_MAINTENANCE: "Facilities & maintenance",
  CONCESSION: "Concession",
  FLOOR: "Floor operations",
  PROJECTION: "Projection",
  MANAGEMENT: "Management",
  CUSTOMER_SERVICE: "Customer service",
};

const POSITION_LABELS: Record<string, string> = {
  TEAM_MEMBER: "Team member",
  STAFF: "Staff",
  SUPERVISOR: "Supervisor",
  ASSISTANT_MANAGER: "Assistant manager",
  CINEMA_MANAGER: "Cinema manager",
  MANAGER: "Manager",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  FIXED_TERM: "Fixed-term",
  SEASONAL: "Seasonal",
  PROBATION: "Probation",
  INTERN: "Intern",
  CONTRACT: "Contract",
};

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

const formatDateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "Never";

const titleCase = (value?: string | null) => value
  ? value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
  : "—";

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<EmployeeResponse | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [cluster, setCluster] = useState<ClusterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<"disable" | "reactivate" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const employeeResponse = await employeeApi.getById(id);
        const nextEmployee: EmployeeResponse = (employeeResponse as any)?.result;
        setEmployee(nextEmployee);

        const [accountResult, clusterResult] = await Promise.allSettled([
          authApi.getAccountById(nextEmployee.accountId),
          movieApi.getClusters(),
        ]);

        if (accountResult.status === "fulfilled") {
          setAccount((accountResult.value as any)?.result ?? null);
        }

        if (clusterResult.status === "fulfilled") {
          const clusters: ClusterResponse[] = (clusterResult.value as any)?.result ?? [];
          setCluster(clusters.find((item) =>
            String(item.clusterId) === String(nextEmployee.cinemaId)
            || item.clusterCode === nextEmployee.cinemaId,
          ) ?? null);
        }
      } catch (requestError: any) {
        setError(requestError?.response?.data?.message || "Unable to load employee details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const initials = useMemo(() => employee?.fullName
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?", [employee?.fullName]);

  const isDisabled = employee?.status === "DISABLED" || account?.status === "INACTIVE";
  const isPending = account?.status === "PENDING";
  const branchName = cluster?.clusterName || employee?.cinemaId || "Unassigned";

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setWorking(true);
    try {
      await action();
      setToast({ type: "success", message: successMessage });
    } catch (actionError: any) {
      setToast({ type: "error", message: actionError?.response?.data?.message || "Action failed. Please try again." });
      throw actionError;
    } finally {
      setWorking(false);
    }
  };

  const resendActivation = async () => {
    if (!account?.accountId) return;
    try {
      await runAction(() => authApi.resendActivation(account.accountId), `Activation email resent to ${account.email || "the employee"}.`);
    } catch {
      // Toast is handled by runAction.
    }
  };

  const revokeSessions = async () => {
    if (!account?.accountId) return;
    try {
      await runAction(() => authApi.revokeSessions(account.accountId), "All active sessions have been revoked.");
    } catch {
      // Toast is handled by runAction.
    }
  };

  const updateStatus = async () => {
    if (!employee || !confirmStatus) return;
    const action = confirmStatus;
    try {
      await runAction(
        () => action === "disable" ? employeeApi.disable(employee.employeeId) : employeeApi.reactivate(employee.employeeId),
        action === "disable" ? "Employee access suspended." : "Employee access reactivated.",
      );
      setEmployee((current) => current ? { ...current, status: action === "disable" ? "DISABLED" : "ACTIVE" } : current);
      setConfirmStatus(null);
    } catch {
      // Keep the dialog open so the user can retry or cancel.
    }
  };

  return (
    <div className="w-full pb-10 text-left text-[var(--text-main)]">
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <button
        type="button"
        onClick={() => navigate("/admin/people?tab=staff")}
        className="mb-5 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-[var(--text-sub)] transition-colors hover:text-blue-500"
      >
        <ArrowLeft size={16} /> Staff
      </button>

      {loading && <EmployeeDetailSkeleton />}

      {!loading && error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center">
          <p className="text-sm font-medium text-red-500">{error}</p>
          <Button variant="outline" onClick={() => navigate("/admin/people?tab=staff")} className="mt-5 rounded-xl border-[var(--border-color)] bg-[var(--bg-card)]">
            Return to staff
          </Button>
        </div>
      )}

      {!loading && !error && employee && (
        <>
          <section className="mb-5 flex flex-col gap-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-sm">
                {employee.avatarUrl ? <img src={employee.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-2xl font-bold tracking-tight">{employee.fullName || "Unnamed employee"}</h1>
                  <StatusBadge status={isPending ? "PENDING" : isDisabled ? "DISABLED" : "ACTIVE"} />
                </div>
                <p className="mt-1 text-sm text-[var(--text-sub)]">
                  {POSITION_LABELS[employee.position] ?? titleCase(employee.position)}
                  <span className="mx-2 text-[var(--border-color)]">•</span>
                  {branchName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-sub)]">
                  <span className="rounded-lg bg-blue-500/10 px-2 py-1 font-semibold text-blue-500">{employee.employeeCode || "Code pending"}</span>
                  {account?.username && <span>@{account.username}</span>}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
              {isPending && (
                <Button variant="outline" onClick={resendActivation} disabled={working} className="h-10 rounded-xl border-[var(--border-color)] bg-[var(--bg-main)] px-4">
                  <MailPlus size={16} /> Resend activation
                </Button>
              )}
              <Button onClick={() => navigate(`/admin/employees/edit/${employee.employeeId}`)} className="h-10 rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-500">
                <Pencil size={16} /> Edit employee
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="size-10 rounded-xl border-[var(--border-color)] bg-[var(--bg-main)]" aria-label="More employee actions">
                    <Ellipsis size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled={!account || working} onClick={revokeSessions}><KeyRound /> Sign out all devices</DropdownMenuItem>
                  {isPending && <DropdownMenuItem disabled={working} onClick={resendActivation}><MailPlus /> Resend activation</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  {isDisabled
                    ? <DropdownMenuItem disabled={working} onClick={() => setConfirmStatus("reactivate")}><RotateCcw /> Reactivate employee</DropdownMenuItem>
                    : <DropdownMenuItem disabled={working} variant="destructive" onClick={() => setConfirmStatus("disable")}><UserRoundX /> Suspend employee</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
            <div className="space-y-5">
              <DetailCard icon={BriefcaseBusiness} title="Assignment" description="Branch assignment and employment terms">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <DetailField label="Branch" value={branchName} supporting={cluster?.clusterCode} />
                  <DetailField label="Primary work area" value={employee.department ? DEPARTMENT_LABELS[employee.department] ?? titleCase(employee.department) : "—"} />
                  <DetailField label="Position" value={POSITION_LABELS[employee.position] ?? titleCase(employee.position)} />
                  <DetailField label="Employment type" value={employee.employmentType ? EMPLOYMENT_TYPE_LABELS[employee.employmentType] ?? titleCase(employee.employmentType) : "—"} />
                  <DetailField label="Hire date" value={formatDate(employee.hireDate)} />
                  <DetailField label="Employee status" value={<StatusBadge status={employee.status} />} />
                </div>
              </DetailCard>

              <DetailCard icon={UserRound} title="Contact & profile" description="Personal information supplied by the employee">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <DetailField label="Full name" value={employee.fullName || "—"} />
                  <DetailField label="Work email" value={account?.email || "—"} />
                  <DetailField label="Phone" value={employee.phoneNumber || "—"} />
                  <DetailField label="Date of birth" value={formatDate(employee.dateOfBirth)} />
                  <DetailField label="Gender" value={titleCase(employee.gender)} />
                  <DetailField label="Address" value={employee.address || "—"} />
                </div>
              </DetailCard>
            </div>

            <div className="space-y-5">
              <DetailCard icon={ShieldCheck} title="Account & access" description="Authentication and operational permissions">
                <div className="space-y-0">
                  <SideField label="Account status" value={<StatusBadge status={account?.status || "UNAVAILABLE"} />} />
                  <SideField label="Access role" value={
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {(account?.roles?.length ? account.roles : [{ roleName: "EMPLOYEE" }]).map((role) => (
                        <Badge key={role.roleName} variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-500">{titleCase(role.roleName.replace(/^ROLE_/, ""))}</Badge>
                      ))}
                    </div>
                  } />
                  <SideField label="Username" value={account?.username || "Not activated"} />
                  <SideField label="Email" value={account?.email || "—"} />
                  <SideField label="Last login" value={formatDateTime(account?.lastLoginAt)} last />
                </div>

                {isPending && (
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-sm font-semibold text-amber-500">Activation pending</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-sub)]">The employee must use the secure email link to create a password before signing in.</p>
                  </div>
                )}
              </DetailCard>

              <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                <button type="button" onClick={() => setTechnicalOpen((open) => !open)} className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" aria-expanded={technicalOpen}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-[var(--text-sub)]"><IdCard size={18} /></div>
                    <div>
                      <h2 className="text-sm font-semibold">Technical details</h2>
                      <p className="mt-0.5 text-xs text-[var(--text-sub)]">Internal identifiers and audit timestamps</p>
                    </div>
                  </div>
                  <ChevronDown size={17} className={`text-[var(--text-sub)] transition-transform ${technicalOpen ? "rotate-180" : ""}`} />
                </button>
                {technicalOpen && (
                  <div className="border-t border-[var(--border-color)] px-5 pb-2">
                    <CopyableField label="Employee ID" value={employee.employeeId} />
                    <CopyableField label="Account ID" value={account?.accountId || employee.accountId} />
                    <CopyableField label="Cinema reference" value={employee.cinemaId || "—"} />
                    <SideField label="Created" value={formatDateTime(employee.createdAt)} />
                    <SideField label="Updated" value={formatDateTime(employee.updatedAt)} last />
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!confirmStatus} onOpenChange={(open) => !open && !working && setConfirmStatus(null)}>
        <AlertDialogContent className="border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)]">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmStatus === "disable" ? "Suspend this employee?" : "Reactivate this employee?"}</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-sub)]">
              {confirmStatus === "disable"
                ? "The employee will lose operational access until an administrator reactivates the assignment."
                : "The employee will regain operational access for the assigned branch."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={working}
              onClick={(event) => { event.preventDefault(); updateStatus(); }}
              className={confirmStatus === "disable" ? "bg-red-600 text-white hover:bg-red-500" : "bg-blue-600 text-white hover:bg-blue-500"}
            >
              {working ? "Working…" : confirmStatus === "disable" ? "Suspend" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailCard({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <header className="flex items-center gap-3 border-b border-[var(--border-color)] px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Icon size={18} /></div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-sub)]">{description}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailField({ label, value, supporting }: { label: string; value: React.ReactNode; supporting?: string | null }) {
  return (
    <div className="min-h-20 border-b border-[var(--border-color)] py-3 pr-4 sm:odd:border-r sm:even:pl-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-sub)]">{label}</p>
      <div className="mt-2 text-sm font-semibold text-[var(--text-main)]">{value}</div>
      {supporting && <p className="mt-1 text-xs text-[var(--text-sub)]">{supporting}</p>}
    </div>
  );
}

function SideField({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex min-h-12 items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-color)]"}`}>
      <span className="text-xs font-medium text-[var(--text-sub)]">{label}</span>
      <div className="max-w-[65%] break-words text-right text-sm font-semibold text-[var(--text-main)]">{value}</div>
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--border-color)] py-3">
      <span className="text-xs font-medium text-[var(--text-sub)]">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <code className="max-w-52 truncate text-xs text-[var(--text-main)]">{value}</code>
        <button type="button" onClick={copy} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-sub)] transition-colors hover:bg-blue-500/10 hover:text-blue-500" aria-label={`Copy ${label}`}>
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-500",
    PENDING: "border-amber-500/20 bg-amber-500/10 text-amber-500",
    INACTIVE: "border-rose-500/20 bg-rose-500/10 text-rose-500",
    DISABLED: "border-rose-500/20 bg-rose-500/10 text-rose-500",
  };
  return <Badge variant="outline" className={classes[status] || "border-[var(--border-color)] text-[var(--text-sub)]"}>{titleCase(status)}</Badge>;
}

function EmployeeDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="h-96 animate-pulse rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]" />
        <div className="h-80 animate-pulse rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]" />
      </div>
    </div>
  );
}
