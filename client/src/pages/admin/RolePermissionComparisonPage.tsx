import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminPageHeader } from "../../components/admin/AdminPageHeader";
import { authApi, type PermissionRecord, type RoleRecord } from "../../api/authApi";
import { capabilityGroups, groupRoles, permissionGroup, permissionLabel, permissionRisk, riskLabels, roleMeta } from "./accessMatrixMetadata";

export default function RolePermissionComparisonPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [includeProtected, setIncludeProtected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { void (async () => {
    try {
      const [roleData, permissionData]: any[] = await Promise.all([authApi.getRoles(), authApi.getPermissions()]);
      setRoles(roleData?.result ?? []);
      setPermissions(permissionData?.result ?? []);
    } catch (reason: any) {
      setError(reason?.response?.data?.message ?? "Could not load the role comparison.");
    } finally { setLoading(false); }
  })(); }, []);

  const comparedRoles = useMemo(() => {
    const ordered = groupRoles(roles).flatMap(category => category.roles);
    return includeProtected ? ordered : ordered.filter(role => ["operational", "approval"].includes(roleMeta(role.roleName).category));
  }, [roles, includeProtected]);

  const groupedPermissions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return capabilityGroups.map(group => ({
      ...group,
      permissions: permissions.filter(permission => {
        if (permissionGroup(permission.permissionName).id !== group.id) return false;
        if (groupFilter !== "all" && groupFilter !== group.id) return false;
        return !normalized || permission.permissionName.toLowerCase().includes(normalized) || permissionLabel(permission).toLowerCase().includes(normalized);
      }),
    })).filter(group => group.permissions.length > 0);
  }, [permissions, query, groupFilter]);

  return <main className="w-full text-[var(--text-main)]">
    <AdminPageHeader
      eyebrow="Identity & access"
      title="Compare roles"
      description="Compare capability coverage across roles before changing an access policy."
      actions={<Link to="/admin/access-matrix" className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 text-sm font-semibold hover:border-blue-500/35 hover:text-blue-600"><ArrowLeft size={16}/> Edit roles</Link>}
    />

    {error && <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

    <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] lg:h-[calc(100vh-190px)]">
      <div className="grid gap-2 border-b border-[var(--border-color)] p-3 lg:grid-cols-[minmax(240px,1fr)_220px_auto]">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/10"><Search size={16} className="text-[var(--text-sub)]"/><input aria-label="Search capabilities" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search capabilities..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-sub)]"/>{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}</label>
        <select aria-label="Capability area" value={groupFilter} onChange={event => setGroupFilter(event.target.value)} className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm outline-none focus:border-blue-500/60"><option value="all">All capability areas</option>{capabilityGroups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 text-sm"><input type="checkbox" checked={includeProtected} onChange={event => setIncludeProtected(event.target.checked)} className="h-4 w-4 accent-blue-600"/><span>Include protected roles</span></label>
      </div>

      <div className="h-[calc(100%-65px)] overflow-auto">
        {loading ? <div className="flex h-full items-center justify-center"><LoaderCircle className="animate-spin text-blue-600"/></div> : <table className="w-full min-w-max border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-[var(--bg-card)] shadow-[0_1px_0_var(--border-color)]">
            <tr>
              <th className="sticky left-0 z-30 w-[320px] min-w-[320px] bg-[var(--bg-card)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-sub)]">Capability</th>
              {comparedRoles.map(role => <th key={role.roleName} className="w-[150px] min-w-[150px] border-l border-[var(--border-color)] px-3 py-3 align-bottom"><strong className="block max-w-[130px] text-xs font-semibold leading-4">{roleMeta(role.roleName).label}</strong><span className="mt-1 block text-[10px] font-normal text-[var(--text-sub)]">{role.permissions?.length ?? 0} assigned</span></th>)}
            </tr>
          </thead>
          <tbody>{groupedPermissions.map(group => <PermissionGroupRows key={group.id} group={group} roles={comparedRoles}/>)}</tbody>
        </table>}
        {!loading && groupedPermissions.length === 0 && <div className="px-6 py-16 text-center"><strong className="block text-sm">No capabilities match this view</strong><p className="mt-1 text-xs text-[var(--text-sub)]">Change the capability area or search query.</p></div>}
      </div>
    </section>
  </main>;
}

function PermissionGroupRows({ group, roles }: { group: { id: string; label: string; description: string; permissions: PermissionRecord[] }; roles: RoleRecord[] }) {
  return <>
    <tr className="border-t border-[var(--border-color)] bg-black/[0.025] dark:bg-white/[0.025]"><th colSpan={roles.length + 1} className="px-4 py-2.5"><strong className="text-xs font-bold">{group.label}</strong><span className="ml-2 text-[11px] font-normal text-[var(--text-sub)]">{group.description}</span></th></tr>
    {group.permissions.map(permission => {
      const risk = permissionRisk(permission.permissionName);
      return <tr key={permission.permissionName} className="border-t border-[var(--border-color)] hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
        <th className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-3"><span className="flex flex-wrap items-center gap-1.5"><strong className="text-sm font-medium">{permissionLabel(permission)}</strong>{risk !== "standard" && <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${risk === "destructive" ? "bg-red-500/10 text-red-500" : risk === "approval" ? "bg-amber-500/10 text-amber-600" : "bg-violet-500/10 text-violet-600"}`}>{riskLabels[risk]}</span>}</span><code className="mt-0.5 block font-sans text-[10px] font-normal text-[var(--text-sub)] opacity-70">{permission.permissionName}</code></th>
        {roles.map(role => {
          const assigned = role.permissions?.some(item => item.permissionName === permission.permissionName);
          return <td key={role.roleName} className={`border-l border-[var(--border-color)] px-3 py-3 text-center ${assigned ? "bg-blue-500/[0.035]" : ""}`}>{assigned ? <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600" aria-label="Assigned"><Check size={14} strokeWidth={3}/></span> : <span className="text-xs text-[var(--text-sub)] opacity-45">—</span>}</td>;
        })}
      </tr>;
    })}
  </>;
}
