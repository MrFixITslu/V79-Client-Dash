import React, { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, Clock3, GitBranch, History, Plus, RefreshCw, Send } from "lucide-react";
import { academyAdminApi } from "../lib/academyAdmin";

interface Course {
  id: string;
  title: string;
  status: string;
}

interface PublishingLog {
  id: string;
  courseId: string;
  courseTitle: string;
  event: string;
  fromStatus?: string;
  toStatus?: string;
  performedBy?: string;
  timestamp: string;
  details?: string;
}

interface CourseVersion {
  id: string;
  courseId: string;
  versionNumber: string;
  changelog?: string;
  createdAt?: string;
  exportedAt?: string;
  exportedBy?: string;
}

export function AcademyPublishing({ courses, onCoursesChanged }: { courses: Course[]; onCoursesChanged: () => Promise<void> }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [logs, setLogs] = useState<PublishingLog[]>([]);
  const [versions, setVersions] = useState<CourseVersion[]>([]);
  const [versionNumber, setVersionNumber] = useState("");
  const [changelog, setChangelog] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selected = useMemo(() => courses.find((course) => course.id === courseId), [courses, courseId]);

  useEffect(() => {
    if (!courseId && courses[0]) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const flash = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const refresh = async () => {
    if (!courseId) return;
    try {
      const [courseLogs, courseVersions] = await Promise.all([
        academyAdminApi<PublishingLog[]>(`/courses/${courseId}/publishing-logs`),
        academyAdminApi<CourseVersion[]>(`/courses/${courseId}/versions`),
      ]);
      setLogs(courseLogs);
      setVersions(courseVersions);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Publishing history could not be loaded.", "error");
    }
  };

  useEffect(() => {
    void refresh();
  }, [courseId]);

  const publish = async () => {
    if (!courseId) return;
    setBusy("publish");
    try {
      await academyAdminApi(`/courses/${courseId}/publish`, {
        method: "POST",
        body: JSON.stringify({ userRole: "Admin" }),
      });
      await Promise.all([refresh(), onCoursesChanged()]);
      flash("Course published and synchronized.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Publish failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const createVersion = async () => {
    if (!courseId || !versionNumber.trim()) return;
    setBusy("version");
    try {
      await academyAdminApi(`/courses/${courseId}/versions`, {
        method: "POST",
        body: JSON.stringify({
          versionNumber: versionNumber.trim(),
          changelog: changelog.trim(),
          exportedBy: "Hub Admin",
          userRole: "Admin",
        }),
      });
      setVersionNumber("");
      setChangelog("");
      await refresh();
      flash("Version snapshot created.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Version could not be created.", "error");
    } finally {
      setBusy("");
    }
  };

  const rollback = async (version: CourseVersion) => {
    if (!courseId || !window.confirm(`Roll back "${selected?.title}" to version ${version.versionNumber}? A new snapshot is recommended before rollback.`)) return;
    setBusy(version.id);
    try {
      await academyAdminApi(`/courses/${courseId}/versions/${version.id}/rollback`, {
        method: "POST",
        body: JSON.stringify({ userRole: "Admin" }),
      });
      await Promise.all([refresh(), onCoursesChanged()]);
      flash(`Rolled back to version ${version.versionNumber}.`);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Rollback failed.", "error");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
          <label className="space-y-1 flex-1 max-w-xl">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Course</span>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="admin-input">
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title} — {course.status}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button onClick={() => void refresh()} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
            <button disabled={!courseId || busy === "publish"} onClick={() => void publish()} className="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"><Send className="w-3.5 h-3.5" /> Publish live</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-600" />
            <div><h3 className="text-sm font-bold text-slate-900">Version snapshots</h3><p className="text-[10px] text-slate-500">Create restore points before major edits.</p></div>
          </div>
          <div className="p-4 border-b border-slate-100 space-y-2">
            <input value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} className="admin-input" placeholder="Version number, e.g. 1.1.0" />
            <textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} className="admin-input" rows={2} placeholder="What changed in this version?" />
            <button disabled={!versionNumber.trim() || busy === "version"} onClick={() => void createVersion()} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"><Plus className="w-3.5 h-3.5" /> Create snapshot</button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {versions.map((version) => (
              <div key={version.id} className="p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">v{version.versionNumber}</div>
                  <div className="text-xs text-slate-500 mt-1">{version.changelog || "No changelog supplied."}</div>
                  <div className="text-[10px] text-slate-400 mt-2">{version.createdAt || version.exportedAt ? new Date(version.createdAt || version.exportedAt || "").toLocaleString() : ""}</div>
                </div>
                <button disabled={busy === version.id} onClick={() => void rollback(version)} className="px-2.5 py-2 rounded-lg border border-amber-200 text-amber-700 text-[10px] font-semibold inline-flex items-center gap-1"><ArchiveRestore className="w-3.5 h-3.5" /> Roll back</button>
              </div>
            ))}
            {versions.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No version snapshots yet.</div>}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-600" />
            <div><h3 className="text-sm font-bold text-slate-900">Publishing history</h3><p className="text-[10px] text-slate-500">Audit trail for status, pricing, import, publish and rollback actions.</p></div>
          </div>
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xs font-bold text-slate-900">{log.event}</div>
                  <div className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString()}</div>
                </div>
                {(log.fromStatus || log.toStatus) && <div className="text-[10px] text-slate-500 mt-1">{log.fromStatus || "—"} → {log.toStatus || "—"}</div>}
                {log.details && <p className="text-xs text-slate-600 mt-2 leading-relaxed">{log.details}</p>}
                {log.performedBy && <div className="text-[10px] text-slate-400 mt-2">By {log.performedBy}</div>}
              </div>
            ))}
            {logs.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No publishing events recorded for this course.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
