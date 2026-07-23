// path: src/components/settings/PeopleSection.tsx
import { useEffect, useMemo, useState } from "react";
import type { Workspace, WorkspaceRosterEntry } from "@/lib/workspaces";
import {
  fetchWorkspaceRoster, removeWorkspaceMember, revokeWorkspaceInvitation, inviteWorkspaceMember,
} from "@/services/workspaces";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InviteMembersDialog from "./InviteMembersDialog";
import {
  Crown, Download, Link2, MoreHorizontal, Search, UserPlus,
} from "lucide-react";

interface Props {
  workspace: Workspace;
  currentUserId?: string;
}

type TabId = "all" | "invitations" | "collaborators" | "requests";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const initials = (label: string) =>
  label.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export default function PeopleSection({ workspace, currentUserId }: Props) {
  const [roster, setRoster] = useState<WorkspaceRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "owner" | "editor">("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const isOwner = workspace.owner_id === currentUserId;
  const inviteLink = `${window.location.origin}/join/${workspace.invite_code}`;
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long" });

  const refresh = () => {
    setLoading(true);
    fetchWorkspaceRoster(workspace.id)
      .then(setRoster)
      .catch((err) => toast({ title: "Couldn't load people", description: err instanceof Error ? err.message : undefined, variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.id]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Couldn't copy link", description: inviteLink, variant: "destructive" });
    }
  };

  const handleRemove = async (entry: WorkspaceRosterEntry) => {
    if (!entry.user_id) return;
    setBusyId(entry.id);
    try {
      await removeWorkspaceMember(workspace.id, entry.user_id);
      toast({ title: entry.user_id === currentUserId ? "Left workspace" : "Member removed" });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't remove member", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (entry: WorkspaceRosterEntry) => {
    setBusyId(entry.id);
    try {
      await revokeWorkspaceInvitation(entry.id);
      toast({ title: "Invitation revoked" });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't revoke invitation", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleResend = async (entry: WorkspaceRosterEntry) => {
    if (!entry.email) return;
    setBusyId(entry.id);
    try {
      await inviteWorkspaceMember(workspace.id, entry.email);
      toast({ title: "Invitation resent" });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't resend invitation", description: err instanceof Error ? err.message : "Something went wrong.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    return roster.filter((entry) => {
      if (tab === "invitations" && entry.kind !== "invitation") return false;
      if (tab === "collaborators" && entry.kind !== "member") return false;
      if (tab === "all" && entry.kind === "invitation" && entry.status !== "pending") return false;
      if (roleFilter !== "all" && entry.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [entry.display_name, entry.username, entry.email].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [roster, tab, roleFilter, search]);

  const collaboratorCount = roster.filter((e) => e.kind === "member").length;

  const exportCsv = () => {
    const rows = [
      ["Name", "Email", "Role", "Status", "Joined/Invited", `${monthLabel} usage`, "Total usage", "Credit limit"],
      ...roster.map((e) => [
        e.display_name || e.username || "",
        e.email || "",
        e.role,
        e.status,
        formatDate(e.joined_at),
        e.kind === "member" ? String(e.usage_month) : "",
        e.kind === "member" ? String(e.usage_total) : "",
        e.credit_limit != null ? String(e.credit_limit) : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workspace.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-people.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Inviting people to "{workspace.name}" gives them access to shared projects and credits.
        You have {collaboratorCount} {collaboratorCount === 1 ? "collaborator" : "collaborators"} in this workspace.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyInvite} className="gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Invite link
          </Button>
          {isOwner && (
            <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700">
              <UserPlus className="h-3.5 w-3.5" /> Invite members
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-x-auto">
        {tab === "requests" ? (
          <p className="text-sm text-gray-400 text-center py-10">
            No join requests. People can only join via an invite link or an email invitation.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>{tab === "invitations" ? "Invited" : "Joined/Invited"}</TableHead>
                <TableHead>{monthLabel} usage</TableHead>
                <TableHead>Total usage</TableHead>
                <TableHead>Credit limit</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Loading...</TableCell></TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">No one here yet.</TableCell></TableRow>
              )}
              {!loading && filtered.map((entry) => {
                const isSelf = entry.user_id === currentUserId;
                const isInvitation = entry.kind === "invitation";
                const label = isInvitation
                  ? entry.email
                  : (entry.display_name || entry.username || "Member");
                const canRemove = !isInvitation && entry.user_id && ((isSelf && entry.role !== "owner") || (isOwner && !isSelf && entry.role !== "owner"));

                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        {!isInvitation && (
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={entry.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{initials(label || "?")}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {label}{isSelf ? " (you)" : ""}
                          </p>
                          {!isInvitation && entry.email && (
                            <p className="text-xs text-gray-400 truncate">{entry.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                        {entry.role === "owner" && <Crown className="h-3.5 w-3.5 text-blue-600" />}
                        {entry.role === "owner" ? "Owner" : "Editor"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDate(entry.joined_at)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{isInvitation ? "—" : `${entry.usage_month} credits`}</TableCell>
                    <TableCell className="text-sm text-gray-500">{isInvitation ? "—" : `${entry.usage_total} credits`}</TableCell>
                    <TableCell className="text-sm text-gray-500">{entry.credit_limit != null ? entry.credit_limit : "—"}</TableCell>
                    <TableCell>
                      {(canRemove || (isInvitation && isOwner)) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busyId === entry.id}>
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isInvitation ? (
                              <>
                                <DropdownMenuItem onClick={() => handleResend(entry)}>Resend invite</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRevoke(entry)} className="text-red-600 focus:text-red-600">Revoke invite</DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => handleRemove(entry)} className="text-red-600 focus:text-red-600">
                                {isSelf ? "Leave workspace" : "Remove member"}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <InviteMembersDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        onInvited={refresh}
      />
    </div>
  );
}
