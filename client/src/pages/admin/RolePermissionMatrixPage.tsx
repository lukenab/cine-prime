import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { authApi, type PermissionRecord, type RoleRecord } from "../../api/authApi";

const protectedRoles = new Set(["SUPER_ADMIN", "ADMIN", "SYSTEM_ADMIN", "MEMBER"]);

export default function RolePermissionMatrixPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { (async () => {
    try {
      const [roleData, permissionData]: any[] = await Promise.all([authApi.getRoles(), authApi.getPermissions()]);
      const loadedRoles = roleData?.result ?? [];
      setRoles(loadedRoles); setPermissions(permissionData?.result ?? []);
      setSelectedRole(loadedRoles.find((role: RoleRecord) => !protectedRoles.has(role.roleName))?.roleName ?? loadedRoles[0]?.roleName ?? "");
    } finally { setLoading(false); }
  })(); }, []);

  const role = useMemo(() => roles.find(item => item.roleName === selectedRole), [roles, selectedRole]);
  useEffect(() => setSelected(new Set(role?.permissions?.map(item => item.permissionName) ?? [])), [role]);
  const locked = protectedRoles.has(selectedRole);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const response: any = await authApi.updateRolePermissions(selectedRole, [...selected].sort());
      const updated = response?.result as RoleRecord;
      setRoles(current => current.map(item => item.roleName === selectedRole ? updated : item));
      setMessage("Permission matrix saved and recorded in the audit trail.");
    } catch (error: any) { setMessage(error?.response?.data?.message ?? "Could not save permission matrix."); }
    finally { setSaving(false); }
  };

  return <main className="w-full pb-10 text-[var(--text-main)]">
    <AdminPageHeader eyebrow="Identity & access" title="Role–permission matrix" description="Assign business capabilities to staff roles. Protected platform roles are read-only." actions={<button disabled={locked || saving || !selectedRole} onClick={() => void save()} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? <LoaderCircle className="animate-spin" size={16}/> : <Save size={16}/>} Save changes</button>} />
    {message && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-500">{message}</div>}
    <div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-[var(--border-color)] p-3 lg:border-b-0 lg:border-r"><p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)]">Staff roles</p>{loading ? <LoaderCircle className="m-4 animate-spin"/> : roles.map(item => <button key={item.roleName} onClick={() => setSelectedRole(item.roleName)} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${selectedRole === item.roleName ? "bg-blue-500/10 text-blue-500" : "hover:bg-black/5"}`}><ShieldCheck size={17}/><span className="min-w-0 flex-1"><strong className="block truncate">{item.roleName.replaceAll("_", " ")}</strong><small className="text-[var(--text-sub)]">{item.permissions?.length ?? 0} permissions</small></span>{protectedRoles.has(item.roleName) && <LockKeyhole size={14}/>}</button>)}</aside>
      <section className="p-5"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{selectedRole.replaceAll("_", " ") || "Select a role"}</h2><p className="mt-1 text-sm text-[var(--text-sub)]">{role?.description}</p></div>{locked && <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500"><LockKeyhole size={13}/> Protected</span>}</div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{permissions.map(permission => { const name = permission.permissionName; const active = selected.has(name); return <button disabled={locked} key={name} onClick={() => setSelected(current => { const next = new Set(current); active ? next.delete(name) : next.add(name); return next; })} className={`flex min-h-20 items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-blue-500/40 bg-blue-500/5" : "border-[var(--border-color)]"} disabled:cursor-default`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${active ? "border-blue-500 bg-blue-600 text-white" : "border-[var(--border-color)]"}`}>{active && <Check size={13}/>}</span><span><strong className="block text-xs">{name}</strong><small className="mt-1 block leading-4 text-[var(--text-sub)]">{permission.description}</small></span></button>; })}</div></section>
    </div>
  </main>;
}
