import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, ChevronLeft, MailPlus, ShieldCheck, UserRound } from "lucide-react";

import { employeeApi, type EmployeeDepartment, type EmployeeInvitationPayload, type EmployeePosition, type EmploymentType } from "../../api/employeeApi";
import type { ClusterResponse } from "../../api/movieApi";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const DEPARTMENTS: Array<{ value: EmployeeDepartment; label: string }> = [
  { value: "BOX_OFFICE", label: "Box office" },
  { value: "CONCESSION", label: "Concession" },
  { value: "FLOOR", label: "Floor operations" },
  { value: "PROJECTION", label: "Projection" },
  { value: "MANAGEMENT", label: "Management" },
  { value: "CUSTOMER_SERVICE", label: "Customer service" },
];

const POSITIONS: Array<{ value: EmployeePosition; label: string }> = [
  { value: "STAFF", label: "Staff" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "MANAGER", label: "Manager" },
];

const EMPLOYMENT_TYPES: Array<{ value: EmploymentType; label: string }> = [
  { value: "FULL_TIME", label: "Full time" },
  { value: "PART_TIME", label: "Part time" },
  { value: "PROBATION", label: "Probation" },
  { value: "INTERN", label: "Intern" },
  { value: "CONTRACT", label: "Contract" },
];

type InviteForm = EmployeeInvitationPayload;

const initialForm = (): InviteForm => ({
  fullName: "",
  email: "",
  phoneNumber: "",
  cinemaId: "",
  department: "CONCESSION",
  position: "STAFF",
  employmentType: "FULL_TIME",
  hireDate: new Date().toISOString().slice(0, 10),
  accessRole: "EMPLOYEE",
});

type Props = {
  open: boolean;
  clusters: ClusterResponse[];
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
};

export default function InviteEmployeeModal({ open, clusters, onOpenChange, onInvited }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<InviteForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const canInviteBranchManager = user?.role === "ROLE_ADMIN" || user?.role === "ROLE_SUPER_ADMIN";
  const activeClusters = useMemo(
    () => clusters.filter((cluster) => cluster.status === "ACTIVE"),
    [clusters],
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setForm(initialForm());
    setErrors({});
    setApiError(null);
  }, [open]);

  const setField = <K extends keyof InviteForm>(key: K, value: InviteForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const validateIdentity = () => {
    const next: Record<string, string> = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid work email.";
    if (form.phoneNumber && !/^(0|\+84)[0-9]{9,10}$/.test(form.phoneNumber)) {
      next.phoneNumber = "Enter a valid Vietnamese phone number.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateAssignment = () => {
    const next: Record<string, string> = {};
    if (!form.cinemaId) next.cinemaId = "Select the employee's branch.";
    if (!form.hireDate) next.hireDate = "Hire date is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const continueToAssignment = () => {
    if (validateIdentity()) setStep(2);
  };

  const submit = async () => {
    if (!validateAssignment()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      await employeeApi.invite({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber?.trim() || undefined,
      });
      onInvited();
      onOpenChange(false);
    } catch (error: any) {
      setApiError(error?.response?.data?.message || "Unable to send the invitation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-[720px] gap-0 overflow-hidden border-[var(--border-color)] bg-[var(--bg-card)] p-0 text-[var(--text-main)]">
        <DialogHeader className="border-b border-[var(--border-color)] px-7 py-5 pr-14">
          <DialogTitle className="text-xl">Invite employee</DialogTitle>
          <DialogDescription className="text-[var(--text-sub)]">
            Create a secure staff invitation and assign operational access.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-[var(--border-color)] px-7 py-4">
          <div className="flex items-center gap-3">
            {[
              { number: 1, label: "Identity", icon: UserRound },
              { number: 2, label: "Assignment & access", icon: BriefcaseBusiness },
            ].map(({ number, label, icon: Icon }, index) => {
              const active = step === number;
              const complete = step > number;
              return (
                <div key={label} className="flex flex-1 items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${active || complete ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-[var(--border-color)] text-[var(--text-sub)]"}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-sub)]">Step {number}</p>
                    <p className={`text-sm font-semibold ${active ? "text-[var(--text-main)]" : "text-[var(--text-sub)]"}`}>{label}</p>
                  </div>
                  {index === 0 && <div className="ml-auto h-px min-w-8 flex-1 bg-[var(--border-color)]" />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-h-[360px] overflow-y-auto px-7 py-6">
          {step === 1 ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex gap-3">
                  <MailPlus className="mt-0.5 shrink-0 text-blue-500" size={18} />
                  <div>
                    <p className="text-sm font-semibold">Password-free invitation</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-sub)]">The employee receives a secure email link and chooses their own password. Personal profile details can be completed after activation.</p>
                  </div>
                </div>
              </div>

              <Field label="Full name" required error={errors.fullName}>
                <Input value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} placeholder="Employee's legal or preferred name" className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]" />
              </Field>

              <Field label="Work email" required error={errors.email}>
                <Input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} placeholder="name@cineprime.vn" className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]" />
              </Field>

              <Field label="Phone" hint="Optional" error={errors.phoneNumber}>
                <Input value={form.phoneNumber} onChange={(event) => setField("phoneNumber", event.target.value)} placeholder="0901234567" className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]" />
              </Field>
            </div>
          ) : (
            <div className="space-y-5">
              <Field label="Branch" required error={errors.cinemaId}>
                <Select value={form.cinemaId} onValueChange={(value) => setField("cinemaId", value)}>
                  <SelectTrigger className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]"><SelectValue placeholder="Select an active cinema branch" /></SelectTrigger>
                  <SelectContent>
                    {activeClusters.map((cluster) => <SelectItem key={cluster.clusterId} value={String(cluster.clusterId)}>{cluster.clusterName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Department" required>
                  <Select value={form.department} onValueChange={(value) => setField("department", value as EmployeeDepartment)}>
                    <SelectTrigger className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]"><SelectValue /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Position" required>
                  <Select value={form.position} onValueChange={(value) => setField("position", value as EmployeePosition)}>
                    <SelectTrigger className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]"><SelectValue /></SelectTrigger>
                    <SelectContent>{POSITIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Employment type" required>
                  <Select value={form.employmentType} onValueChange={(value) => setField("employmentType", value as EmploymentType)}>
                    <SelectTrigger className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]"><SelectValue /></SelectTrigger>
                    <SelectContent>{EMPLOYMENT_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Hire date" required error={errors.hireDate}>
                  <Input type="date" max={new Date().toISOString().slice(0, 10)} value={form.hireDate} onChange={(event) => setField("hireDate", event.target.value)} className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]" />
                </Field>
              </div>

              <Field label="Access role" required>
                {canInviteBranchManager ? (
                  <Select value={form.accessRole} onValueChange={(value) => setField("accessRole", value as InviteForm["accessRole"])}>
                    <SelectTrigger className="h-11 border-[var(--border-color)] bg-[var(--bg-main)]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-11 items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-main)] px-3 text-sm">
                    <ShieldCheck size={16} className="text-blue-500" /> Employee
                  </div>
                )}
                <p className="mt-2 text-xs text-[var(--text-sub)]">Branch Manager can only be assigned by an administrator.</p>
              </Field>
            </div>
          )}

          {apiError && <div className="mt-5 rounded-lg border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-500">{apiError}</div>}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-[var(--border-color)] bg-[var(--bg-card)] px-7 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <div className="flex gap-2">
            {step === 2 && <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={submitting}><ChevronLeft size={16} /> Back</Button>}
            {step === 1 ? (
              <Button type="button" onClick={continueToAssignment} className="bg-blue-600 text-white hover:bg-blue-500">Continue</Button>
            ) : (
              <Button type="button" onClick={submit} disabled={submitting || activeClusters.length === 0} className="min-w-40 bg-blue-600 text-white hover:bg-blue-500">
                <MailPlus size={16} /> {submitting ? "Sending invitation…" : "Send invitation"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}{required && <span className="text-red-500">*</span>}</Label>
        {hint && <span className="text-xs text-[var(--text-sub)]">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
