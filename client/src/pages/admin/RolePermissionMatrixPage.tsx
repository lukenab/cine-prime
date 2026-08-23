import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, GitCompareArrows, LoaderCircle, LockKeyhole, Search, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { authApi, type PermissionRecord, type RoleRecord } from "../../api/authApi";
import {
  capabilityGroups, groupRoles, permissionGroup, permissionLabel, permissionRisk,
  protectedRoles, riskLabels, roleMeta, sameSet,
} from "./accessMatrixMetadata";

type Message = { tone: "success" | "warning" | "error"; text: string };

export default function RolePermissionMatrixPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [assignedOnly, setAssignedOnly] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => { void (async () => {
    try {
      const [roleData, permissionData]: any[] = await Promise.all([authApi.getRoles(), authApi.getPermissions()]);
      const loadedRoles: RoleRecord[] = roleData?.result ?? [];
      setRoles(loadedRoles);
      setPermissions(permissionData?.result ?? []);
      setSelectedRole(loadedRoles.find(item => roleMeta(item.roleName).category === "operational")?.roleName ?? loadedRoles[0]?.roleName ?? "");
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.response?.data?.message ?? "Could not load the access matrix." });
    } finally { setLoading(false); }
  })(); }, []);

  const role = useMemo(() => roles.find(item => item.roleName === selectedRole), [roles, selectedRole]);
  const baseline = useMemo(() => new Set(role?.permissions?.map(item => item.permissionName) ?? []), [role]);
  const groupedRoleList = useMemo(() => groupRoles(roles), [roles]);

  useEffect(() => {
    const rolePermissions = new Set(role?.permissions?.map(item => item.permissionName) ?? []);
    setSelected(rolePermissions);
    const firstAssignedGroup = capabilityGroups.find(group => [...rolePermissions].some(name => permissionGroup(name).id === group.id));
    setExpandedGroups(new Set(firstAssignedGroup ? [firstAssignedGroup.id] : []));
    setMessage(null);
    setQuery("");
    setGroupFilter("all");
    setAssignedOnly(true);
  }, [role]);

  const locked = protectedRoles.has(selectedRole);
  const dirty = !sameSet(selected, baseline);
  const added = useMemo(() => permissions.filter(item => selected.has(item.permissionName) && !baseline.has(item.permissionName)), [permissions, selected, baseline]);
  const removed = useMemo(() => permissions.filter(item => !selected.has(item.permissionName) && baseline.has(item.permissionName)), [permissions, selected, baseline]);
  const changedCount = added.length + removed.length;

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return capabilityGroups.map(group => {
      const allInGroup = permissions.filter(permission => permissionGroup(permission.permissionName).id === group.id);
      const visible = allInGroup.filter(permission => {
        if (groupFilter !== "all" && groupFilter !== group.id) return false;
        if (assignedOnly && !selected.has(permission.permissionName) && !baseline.has(permission.permissionName)) return false;
        return !normalizedQuery || permission.permissionName.toLowerCase().includes(normalizedQuery) || permissionLabel(permission).toLowerCase().includes(normalizedQuery);
      });
      return {
        ...group,
        permissions: visible,
        assignedCount: allInGroup.filter(item => selected.has(item.permissionName)).length,
        totalCount: allInGroup.length,
      };
    }).filter(group => group.permissions.length > 0);
  }, [permissions, query, groupFilter, assignedOnly, selected, baseline]);

  const selectRole = (name: string) => {
    if (name === selectedRole) return;
    if (dirty) {
      setMessage({ tone: "warning", text: "Review or discard the pending changes before switching roles." });
      return;
    }
    setSelectedRole(name);
  };

  const togglePermission = (name: string) => {
    if (locked) return;
    setSelected(current => {
      const next = new Set(current);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
    setMessage(null);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(current => {
      const next = new Set(current);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const discard = () => {
    setSelected(new Set(baseline));
    setReason("");
    setMessage(null);
  };

  const save = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const response: any = await authApi.updateRolePermissions(selectedRole, [...selected].sort(), reason.trim());
      const updated = response?.result as RoleRecord;
      setRoles(current => current.map(item => item.roleName === selectedRole ? updated : item));
      setReviewOpen(false);
      setReason("");
      setMessage({ tone: "success", text: `${roleMeta(selectedRole).label} access was updated and recorded in the audit trail.` });
    } catch (error: any) {
      setMessage({ tone: "error", text: error?.response?.data?.message ?? "Could not save the role permissions." });
      setReviewOpen(false);
    } finally { setSaving(false); }
  };

  const selectedMeta = roleMeta(selectedRole);

  return <main className="w-full text-[var(--text-main)]">
    <AdminPageHeader
      eyebrow="Identity & access"
      title="Access matrix"
      description="Review and assign business capabilities to operational roles."
      actions={<Link to="/admin/access-matrix/compare" className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 text-sm font-semibold hover:border-blue-500/35 hover:text-blue-600"><GitCompareArrows size={16}/> Compare roles</Link>}
    />

    {message && <MessageBanner message={message} onDismiss={() => setMessage(null)} />}

    <div className="grid min-h-[600px] overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] lg:h-[calc(100vh-190px)] lg:grid-cols-[270px_minmax(0,1fr)]">
      <aside className="max-h-80 overflow-y-auto border-b border-[var(--border-color)] bg-black/[0.012] px-3 py-4 lg:max-h-none lg:border-b-0 lg:border-r dark:bg-white/[0.012]">
        {loading ? <LoaderCircle className="m-4 animate-spin text-blue-600"/> : groupedRoleList.map(category => <section key={category.id} className="mb-5 last:mb-0">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--text-sub)]">{category.label}</h2>
            <span className="text-[10px] text-[var(--text-sub)]">{category.roles.length}</span>
          </div>
          <div className="space-y-1">{category.roles.map(item => {
            const active = item.roleName === selectedRole;
            const meta = roleMeta(item.roleName);
            return <button type="button" key={item.roleName} onClick={() => selectRole(item.roleName)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition ${active ? "bg-blue-500/10 text-blue-600" : "hover:bg-black/5 dark:hover:bg-white/5"}`}>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{meta.label}</strong><small className="mt-0.5 block text-[11px] text-[var(--text-sub)]">{item.permissions?.length ?? 0} capabilities</small></span>
              {protectedRoles.has(item.roleName) && <LockKeyhole size={13} className="shrink-0 text-[var(--text-sub)]" aria-label="Read-only role"/>}
            </button>;
          })}</div>
        </section>)}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="shrink-0 border-b border-[var(--border-color)] px-5 py-4 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold tracking-tight">{selectedRole ? selectedMeta.label : "Select a role"}</h2>{locked && <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600"><LockKeyhole size={11}/> Read-only</span>}</div>
              <p className="mt-1 max-w-3xl text-sm text-[var(--text-sub)]">{selectedMeta.purpose}</p>
            </div>
            <div className="shrink-0 sm:text-right"><strong className="block text-lg leading-5">{selected.size}</strong><span className="text-[11px] text-[var(--text-sub)]">capabilities assigned</span></div>
          </div>
        </header>

        <div className="shrink-0 border-b border-[var(--border-color)] px-5 py-3 lg:px-6">
          <div className="grid gap-2 xl:grid-cols-[auto_minmax(240px,1fr)_210px]">
            <div className="inline-flex h-10 rounded-xl bg-black/5 p-1 dark:bg-white/5" aria-label="Capability visibility">
              <button type="button" onClick={() => setAssignedOnly(true)} className={`rounded-lg px-3 text-xs font-semibold transition ${assignedOnly ? "bg-[var(--bg-card)] text-blue-600 shadow-sm" : "text-[var(--text-sub)]"}`}>Assigned only</button>
              <button type="button" onClick={() => setAssignedOnly(false)} className={`rounded-lg px-3 text-xs font-semibold transition ${!assignedOnly ? "bg-[var(--bg-card)] text-blue-600 shadow-sm" : "text-[var(--text-sub)]"}`}>All capabilities</button>
            </div>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/10"><Search size={16} className="text-[var(--text-sub)]"/><input aria-label="Search capabilities" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search capabilities..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-sub)]"/>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}</label>
            <select aria-label="Capability area" value={groupFilter} onChange={event => setGroupFilter(event.target.value)} className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm outline-none focus:border-blue-500/60"><option value="all">All capability areas</option>{capabilityGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-black/[0.012] p-4 lg:p-5 dark:bg-white/[0.012]">
          {locked && <div className="mb-3 flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-3"><LockKeyhole size={16} className="mt-0.5 shrink-0 text-amber-600"/><p className="text-xs leading-5 text-[var(--text-sub)]"><strong className="text-[var(--text-main)]">Protected role.</strong> Its access is system-managed to prevent lockout or privilege escalation.</p></div>}
          <div className="space-y-2.5">{visibleGroups.map(group => {
            const open = query.trim() ? true : expandedGroups.has(group.id);
            return <section key={group.id} className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
              <button type="button" aria-expanded={open} onClick={() => toggleGroup(group.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.025] dark:hover:bg-white/[0.025]">
                <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold">{group.label}</strong><span className="mt-0.5 block truncate text-xs text-[var(--text-sub)]">{group.description}</span></span>
                <span className="shrink-0 text-xs font-medium text-[var(--text-sub)]">{group.assignedCount}/{group.totalCount}</span>
                <ChevronDown size={16} className={`shrink-0 text-[var(--text-sub)] transition-transform ${open ? "rotate-180" : ""}`}/>
              </button>
              {open && <div className="border-t border-[var(--border-color)]">{group.permissions.map((permission, index) => {
                const name = permission.permissionName;
                const active = selected.has(name);
                const pendingAddition = active && !baseline.has(name);
                const pendingRemoval = !active && baseline.has(name);
                const risk = permissionRisk(name);
                return <button type="button" aria-pressed={active} disabled={locked} key={name} onClick={() => togglePermission(name)} className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition ${index > 0 ? "border-t border-[var(--border-color)]" : ""} ${active ? "bg-blue-500/[0.045]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"} ${pendingRemoval ? "bg-red-500/[0.035]" : ""} disabled:cursor-default`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-[var(--border-color)]"}`}>{active && <Check size={13} strokeWidth={3}/>}</span>
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><strong className="text-sm font-medium">{permissionLabel(permission)}</strong>{pendingAddition && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Added</span>}{pendingRemoval && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">Pending removal</span>}{risk !== "standard" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${risk === "destructive" ? "bg-red-500/10 text-red-500" : risk === "approval" ? "bg-amber-500/10 text-amber-600" : "bg-violet-500/10 text-violet-600"}`}>{riskLabels[risk]}</span>}</span><code className="mt-0.5 block font-sans text-[10px] text-[var(--text-sub)] opacity-70">{name}</code></span>
                </button>;
              })}</div>}
            </section>;
          })}</div>
          {!loading && visibleGroups.length === 0 && <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-12 text-center"><strong className="block text-sm">No capabilities in this view</strong><p className="mt-1 text-xs text-[var(--text-sub)]">Change the visibility, capability area or search query.</p></div>}
        </div>

        {dirty && !locked && <footer className="flex shrink-0 items-center gap-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 lg:px-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><AlertTriangle size={16}/></span><div className="min-w-0 flex-1"><strong className="block text-sm">{changedCount} unsaved {changedCount === 1 ? "change" : "changes"}</strong><span className="block truncate text-[11px] text-[var(--text-sub)]">Review the impact before updating this role.</span></div><button type="button" onClick={discard} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text-sub)] hover:bg-black/5 dark:hover:bg-white/5">Discard</button><button type="button" onClick={() => setReviewOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Review changes</button></footer>}
      </section>
    </div>

    <ReviewChangesDialog open={reviewOpen} saving={saving} roleName={selectedMeta.label} added={added} removed={removed} reason={reason} onReasonChange={setReason} onOpenChange={setReviewOpen} onSave={save}/>
  </main>;
}

function MessageBanner({ message, onDismiss }: { message: Message; onDismiss: () => void }) {
  return <div className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${message.tone === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600" : message.tone === "warning" ? "border-amber-500/25 bg-amber-500/10 text-amber-600" : "border-red-500/25 bg-red-500/10 text-red-500"}`}><span>{message.text}</span><button type="button" aria-label="Dismiss message" onClick={onDismiss}><X size={16}/></button></div>;
}

function ReviewChangesDialog({ open, saving, roleName, added, removed, reason, onReasonChange, onOpenChange, onSave }: { open: boolean; saving: boolean; roleName: string; added: PermissionRecord[]; removed: PermissionRecord[]; reason: string; onReasonChange: (value: string) => void; onOpenChange: (open: boolean) => void; onSave: () => Promise<void> }) {
  return <Dialog open={open} onOpenChange={next => !saving && onOpenChange(next)}><DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden gap-0 border-[var(--border-color)] bg-[var(--bg-card)] p-0 text-[var(--text-main)]">
    <DialogHeader className="border-b border-[var(--border-color)] px-6 py-5 pr-14"><DialogTitle>Review access changes</DialogTitle><DialogDescription className="text-[var(--text-sub)]">Confirm the capability changes for {roleName} before they take effect.</DialogDescription></DialogHeader>
    <div className="max-h-[56vh] space-y-5 overflow-y-auto px-6 py-5">
      <div className="grid grid-cols-2 gap-3"><Summary tone="added" label="Capabilities added" count={added.length}/><Summary tone="removed" label="Capabilities removed" count={removed.length}/></div>
      {added.length > 0 && <ChangeList title="Added" tone="added" permissions={added}/>} {removed.length > 0 && <ChangeList title="Removed" tone="removed" permissions={removed}/>}<label className="block"><span className="text-sm font-semibold">Reason for change <span className="text-red-500">*</span></span><span className="mt-0.5 block text-xs text-[var(--text-sub)]">This note will be stored with the audit event.</span><textarea value={reason} maxLength={500} onChange={event => onReasonChange(event.target.value)} placeholder="For example: Align approval access with the updated operating policy." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[var(--border-color)] bg-transparent px-3.5 py-3 text-sm outline-none placeholder:text-[var(--text-sub)] focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10"/><span className="mt-1 block text-right text-[10px] text-[var(--text-sub)]">{reason.length}/500</span></label>
    </div>
    <DialogFooter className="border-t border-[var(--border-color)] px-6 py-4"><button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--text-sub)] hover:bg-black/5 dark:hover:bg-white/5">Back</button><button type="button" disabled={saving || !reason.trim()} onClick={() => void onSave()} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">{saving ? <LoaderCircle size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} Apply changes</button></DialogFooter>
  </DialogContent></Dialog>;
}

function Summary({ tone, label, count }: { tone: "added" | "removed"; label: string; count: number }) {
  return <div className={`rounded-xl border px-4 py-3 ${tone === "added" ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-red-500/20 bg-red-500/[0.05]"}`}><span className="text-xs text-[var(--text-sub)]">{label}</span><strong className={`mt-1 block text-xl ${tone === "added" ? "text-emerald-600" : "text-red-500"}`}>{count}</strong></div>;
}

function ChangeList({ title, tone, permissions }: { title: string; tone: "added" | "removed"; permissions: PermissionRecord[] }) {
  return <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-sub)]">{title}</h3><div className="overflow-hidden rounded-xl border border-[var(--border-color)]">{permissions.map((permission, index) => <div key={permission.permissionName} className={`flex items-center gap-3 px-3.5 py-3 ${index > 0 ? "border-t border-[var(--border-color)]" : ""}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${tone === "added" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>{tone === "added" ? <Check size={13}/> : <X size={13}/>}</span><span className="min-w-0"><strong className="block text-sm font-medium">{permissionLabel(permission)}</strong><code className="block truncate font-sans text-[10px] text-[var(--text-sub)]">{permission.permissionName}</code></span></div>)}</div></section>;
}
