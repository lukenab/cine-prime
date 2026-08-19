import { FormEvent, useEffect, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, Building2, Loader2, LogOut, Phone, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { userApi } from "../../api/userApi";
import { employeeApi, type EmployeeResponse } from "../../api/employeeApi";
import { movieApi } from "../../api/movieApi";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export default function StaffOnboardingGate() {
  const { user, logout, setNeedsProfileSetup } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(true);
  const [assignment, setAssignment] = useState({ branch: "Assigned cinema", workArea: "Operations", position: "Team member" });
  const [error, setError] = useState("");
  const isHeadOffice = !!user && !["ROLE_EMPLOYEE", "ROLE_BRANCH_MANAGER"].includes(user.role);

  useEffect(() => {
    if (!user?.accountId) return;
    let active = true;

    const toLabel = (value?: string | null) => value
      ? value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
      : "Not assigned";

    const loadProfileAndAssignment = async () => {
      try {
        const [profileResult, employeeResult] = await Promise.allSettled([
          userApi.getUserById(user.accountId),
          employeeApi.getMe(),
        ]);

        if (!active) return;
        if (profileResult.status === "fulfilled") {
          const response: any = profileResult.value;
          const profile = response?.result ?? response?.data?.result ?? response?.data ?? response;
          setFullName(profile?.fullName ?? "");
          setPhoneNumber(profile?.phoneNumber ?? "");
        }

        if (employeeResult.status === "fulfilled") {
          const response: any = employeeResult.value;
          const employee = (response?.result ?? response?.data?.result ?? response?.data ?? response) as EmployeeResponse;
          let branch = isHeadOffice ? "Head office · All cinema branches" : (employee?.cinemaId || "Not assigned");
          if (employee?.cinemaId && /^\d+$/.test(employee.cinemaId)) {
            try {
              const clusterResponse = await movieApi.getClusterById(Number(employee.cinemaId));
              if (active && clusterResponse.result?.clusterName) branch = clusterResponse.result.clusterName;
            } catch {
              // Keep the stable assignment identifier when cluster lookup is unavailable.
            }
          }
          if (active) setAssignment({ branch, workArea: toLabel(employee?.department), position: toLabel(employee?.position) });
        } else if (isHeadOffice) {
          setAssignment({ branch: "Head office · All cinema branches", workArea: "Head Office", position: toLabel(user.role.replace(/^ROLE_/, "")) });
        }
      } finally {
        if (active) setAssignmentLoading(false);
      }
    };

    void loadProfileAndAssignment();
    return () => { active = false; };
  }, [isHeadOffice, user?.accountId, user?.role]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = fullName.trim();
    const phone = phoneNumber.trim();
    if (!name) {
      setError("Enter your full name.");
      return;
    }
    if (!/^(0|\+84)[0-9]{9,10}$/.test(phone)) {
      setError("Enter a valid Vietnamese phone number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await userApi.completeStaffProfile(user.accountId, { fullName: name, phoneNumber: phone });
      setNeedsProfileSetup(false);
    } catch (requestError: any) {
      const code = requestError?.response?.data?.code;
      setError(code === 2001 ? "This phone number is already in use." : "Could not save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        aria-describedby="staff-onboarding-description"
        className="w-[min(640px,calc(100vw-32px))] max-w-[640px] gap-0 overflow-hidden rounded-3xl border-[var(--modal-border)] bg-[var(--modal-surface)] p-0 text-[var(--text-main)] shadow-2xl [&_[data-slot=dialog-close]]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-[var(--border-color)] px-7 py-6 text-left">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
            <BadgeCheck size={21} />
          </div>
          <DialogTitle className="text-2xl">Welcome to CinePrime</DialogTitle>
          <DialogDescription id="staff-onboarding-description" className="pt-1 leading-6 text-[var(--modal-text-sub)]">
            Confirm your contact details to enter the staff workspace. Your operational assignment is managed by CinePrime administration.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 px-7 py-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Operational assignment">
            {[
              { label: "Work location", value: assignment.branch, icon: Building2 },
              { label: "Work area", value: assignment.workArea, icon: BriefcaseBusiness },
              { label: "Position", value: assignment.position, icon: BadgeCheck },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="min-w-0 rounded-xl border border-[var(--modal-border)] bg-[var(--modal-option)] px-3.5 py-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--modal-text-sub)]"><Icon size={13} /> {label}</div>
                <div className="truncate text-sm font-semibold text-[var(--text-main)]" title={value}>{assignmentLoading ? "Loading…" : value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-name">Full name <span className="text-red-500">*</span></Label>
            <div className="relative">
              <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" size={17} />
              <Input id="onboarding-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} autoComplete="name" className="h-12 rounded-xl border-[var(--modal-border)] bg-[var(--modal-option)] pl-11 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-phone">Phone number <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" size={17} />
              <Input id="onboarding-phone" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="0901234567" className="h-12 rounded-xl border-[var(--modal-border)] bg-[var(--modal-option)] pl-11 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/15" />
            </div>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-500">{error}</div>}

          <div className="border-t border-[var(--border-color)] pt-5">
            <p className="mb-4 text-xs leading-5 text-[var(--modal-text-sub)]">
              CinePrime uses these contact details for staff operations. Ask an administrator to correct your work location, area or position.
            </p>
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={signOut} disabled={loading} className="h-11 rounded-xl px-4 text-[var(--text-muted)]">
                <LogOut size={16} /> Sign out
              </Button>
              <Button type="submit" disabled={loading || assignmentLoading} className="h-11 min-w-56 rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-500">
                {loading ? <><Loader2 className="animate-spin" size={16} /> Saving profile</> : "Complete profile & enter workspace"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
