import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, Users, Wand2 } from "lucide-react";
import { academyAdminApi } from "../lib/academyAdmin";

interface Learner {
  id: string;
  name: string;
  email: string;
  enrolledCourseIds: string[];
}
interface Submission {
  id: string;
  missionNumber?: number;
  status: string;
  title?: string;
  reviews?: any[];
}
interface TeamMember { id: string; name: string; email?: string; }
interface Team {
  id: string;
  courseId: string;
  name: string;
  memberIds: string[];
  members?: TeamMember[];
  currentLeaderId: string;
  submissions?: Submission[];
}
interface ConflictReflection {
  id: string;
  teamId?: string;
  week?: number;
  happened?: string;
  feelings?: string;
  calmStep?: string;
  agreement?: string;
  nextTime?: string;
  createdAt: string;
}

export function AcademyJuniorAdmin({ courses }: { courses: { id: string; title: string }[] }) {
  const juniorCourses = useMemo(
    () => courses.filter((course) => /junior|youth|kids|children/i.test(course.title) || course.id.includes("junior")),
    [courses],
  );
  const [courseId, setCourseId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [conflicts, setConflicts] = useState<ConflictReflection[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamName, setTeamName] = useState("");
  const [leaderByTeam, setLeaderByTeam] = useState<Record<string, string>>({});
  const [weekByTeam, setWeekByTeam] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!courseId && juniorCourses[0]) setCourseId(juniorCourses[0].id);
  }, [juniorCourses, courseId]);

  const flash = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const refresh = async () => {
    if (!courseId) return;
    setBusy("refresh");
    try {
      const [teamData, learnerData, conflictData] = await Promise.all([
        academyAdminApi<{ teams: Team[] }>(`/junior-admin/${courseId}/teams`),
        academyAdminApi<Learner[]>("/learners"),
        academyAdminApi<{ conflictReflections: ConflictReflection[] }>(`/junior-admin/${courseId}/conflicts`),
      ]);
      setTeams(teamData.teams || []);
      setLearners(learnerData);
      setConflicts(conflictData.conflictReflections || []);
      const leaders: Record<string, string> = {};
      const weeks: Record<string, number> = {};
      (teamData.teams || []).forEach((team) => {
        leaders[team.id] = team.currentLeaderId;
        weeks[team.id] = 1;
      });
      setLeaderByTeam(leaders);
      setWeekByTeam(weeks);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Junior Academy administration could not be loaded.", "error");
    } finally {
      setBusy("");
    }
  };

  useEffect(() => {
    if (courseId) void refresh();
  }, [courseId]);

  const assigned = useMemo(() => new Set(teams.flatMap((team) => team.memberIds || [])), [teams]);
  const eligible = useMemo(
    () => learners.filter((learner) => learner.enrolledCourseIds.includes(courseId)),
    [learners, courseId],
  );
  const unassigned = eligible.filter((learner) => !assigned.has(learner.id));

  const autoForm = async () => {
    if (!courseId) return;
    setBusy("auto");
    try {
      const result = await academyAdminApi<{ created: number }>(`/junior-admin/${courseId}/auto-form`, { method: "POST" });
      await refresh();
      flash(`Created ${result.created} team(s).`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Teams could not be auto-formed.", "error");
    } finally {
      setBusy("");
    }
  };

  const createTeam = async () => {
    if (selectedMembers.length !== 3) return flash("Choose exactly three unassigned learners.", "error");
    setBusy("create");
    try {
      await academyAdminApi(`/junior-admin/${courseId}/teams`, {
        method: "POST",
        body: JSON.stringify({
          memberIds: selectedMembers,
          leaderId: selectedMembers[0],
          name: teamName.trim() || undefined,
        }),
      });
      setSelectedMembers([]);
      setTeamName("");
      await refresh();
      flash("Studio team created.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Team could not be created.", "error");
    } finally {
      setBusy("");
    }
  };

  const changeLeader = async (team: Team) => {
    const leaderId = leaderByTeam[team.id] || team.currentLeaderId;
    const startWeek = weekByTeam[team.id] || 1;
    setBusy(team.id);
    try {
      await academyAdminApi(`/junior-admin/teams/${team.id}/leader`, {
        method: "PUT",
        body: JSON.stringify({ leaderId, startWeek }),
      });
      await refresh();
      flash("Team leadership updated.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Leader could not be updated.", "error");
    } finally {
      setBusy("");
    }
  };

  const reviewSubmission = async (submission: Submission, status: "Under Review" | "Needs Changes" | "Approved") => {
    setBusy(submission.id);
    try {
      await academyAdminApi(`/junior-admin/submissions/${submission.id}/review`, {
        method: "PUT",
        body: JSON.stringify({
          status,
          reviewedBy: "Hub Admin",
          strong: status === "Approved" ? "Studio Check-In reviewed and approved." : "",
          improve: status === "Needs Changes" ? "Please address the requested changes and resubmit." : "",
          next: "Continue to the next agreed team step.",
        }),
      });
      await refresh();
      flash(`Submission marked ${status}.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Submission review failed.", "error");
    } finally {
      setBusy("");
    }
  };

  if (juniorCourses.length === 0) {
    return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-sm text-slate-500">No Junior Academy course is currently registered.</div>;
  }

  return (
    <div className="space-y-5">
      {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{message.text}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
        <label className="space-y-1 flex-1 max-w-xl">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Junior Academy course</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="admin-input">
            {juniorCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button onClick={() => void refresh()} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold inline-flex items-center gap-1"><RefreshCw className={`w-3.5 h-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} /> Refresh</button>
          <button disabled={busy === "auto"} onClick={() => void autoForm()} className="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40"><Wand2 className="w-3.5 h-3.5" /> Auto-form teams of 3</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Enrolled learners" value={eligible.length} />
        <Stat label="Studio teams" value={teams.length} />
        <Stat label="Unassigned" value={unassigned.length} />
      </div>

      {unassigned.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div><h3 className="text-sm font-bold text-amber-950">Create a team manually</h3><p className="text-xs text-amber-800 mt-1">Choose exactly three unassigned enrolled learners.</p></div>
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="admin-input max-w-md" placeholder="Optional team name" />
          <div className="flex flex-wrap gap-2">
            {unassigned.map((learner) => {
              const selected = selectedMembers.includes(learner.id);
              return (
                <button
                  key={learner.id}
                  onClick={() => setSelectedMembers((current) => selected ? current.filter((id) => id !== learner.id) : current.length < 3 ? [...current, learner.id] : current)}
                  className={`px-3 py-2 rounded-lg border text-xs ${selected ? "bg-amber-900 text-white border-amber-900" : "bg-white border-amber-200 text-amber-900"}`}
                >
                  {learner.name}
                </button>
              );
            })}
          </div>
          <button disabled={selectedMembers.length !== 3 || busy === "create"} onClick={() => void createTeam()} className="px-3 py-2 rounded-lg bg-amber-900 text-white text-xs font-semibold disabled:opacity-40">Create selected team</button>
        </section>
      )}

      <div className="space-y-4">
        {teams.map((team) => (
          <article key={team.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div><div className="text-sm font-bold text-slate-900">{team.name}</div><div className="text-xs text-slate-500 mt-1">{(team.members || []).map((member) => member.name).join(" · ")}</div></div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="space-y-1">
                  <span className="block text-[9px] font-bold uppercase text-slate-400">Leader</span>
                  <select value={leaderByTeam[team.id] || team.currentLeaderId} onChange={(e) => setLeaderByTeam({ ...leaderByTeam, [team.id]: e.target.value })} className="admin-input w-44">
                    {(team.members || []).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[9px] font-bold uppercase text-slate-400">Starts week</span>
                  <input type="number" min="1" max="16" value={weekByTeam[team.id] || 1} onChange={(e) => setWeekByTeam({ ...weekByTeam, [team.id]: Number(e.target.value) })} className="admin-input w-20" />
                </label>
                <button disabled={busy === team.id} onClick={() => void changeLeader(team)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold">Update leader</button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Weekly submissions</div>
              <div className="space-y-2">
                {(team.submissions || []).map((submission) => (
                  <div key={submission.id} className="border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div><div className="text-xs font-semibold text-slate-800">{submission.title || `Mission ${submission.missionNumber || "—"} Studio Check-In`}</div><div className="text-[10px] text-slate-500 mt-1">Status: {submission.status}</div></div>
                    <div className="flex gap-2">
                      <button disabled={busy === submission.id} onClick={() => void reviewSubmission(submission, "Under Review")} className="px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold">Under review</button>
                      <button disabled={busy === submission.id} onClick={() => void reviewSubmission(submission, "Needs Changes")} className="px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-[10px] font-semibold">Needs changes</button>
                      <button disabled={busy === submission.id} onClick={() => void reviewSubmission(submission, "Approved")} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-semibold">Approve</button>
                    </div>
                  </div>
                ))}
                {(team.submissions || []).length === 0 && <div className="text-xs text-slate-400">No Studio Check-Ins submitted yet.</div>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-cyan-600" /><div><h3 className="text-sm font-bold text-slate-900">Conflict reflections</h3><p className="text-[10px] text-slate-500">Instructor visibility into CALM conflict-resolution reflections.</p></div></div>
        <div className="divide-y divide-slate-100">
          {conflicts.slice(0, 30).map((conflict) => (
            <div key={conflict.id} className="p-4">
              <div className="text-[10px] text-slate-400">Week {conflict.week || "—"} · {new Date(conflict.createdAt).toLocaleString()}</div>
              {conflict.happened && <p className="text-xs text-slate-700 mt-2"><b>What happened:</b> {conflict.happened}</p>}
              {conflict.agreement && <p className="text-xs text-slate-600 mt-1"><b>Agreement:</b> {conflict.agreement}</p>}
              {conflict.nextTime && <p className="text-xs text-slate-600 mt-1"><b>Next time:</b> {conflict.nextTime}</p>}
            </div>
          ))}
          {conflicts.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No conflict reflections recorded.</div>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center"><Users className="w-4 h-4 text-cyan-400" /></div><div><div className="text-lg font-extrabold text-slate-900">{value}</div><div className="text-[10px] text-slate-500">{label}</div></div></div>;
}
