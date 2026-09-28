import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileJson, FileText, History, Loader2, UploadCloud } from "lucide-react";
import { academyAdminApi } from "../lib/academyAdmin";

interface ParsedQuestion {
  questionText: string;
  questionType: "multiple_choice" | "true_false";
  options: string[];
  correctAnswer: string;
  explanation: string;
}
interface ParsedQuiz { title: string; passingScore?: number; questions: ParsedQuestion[]; }
interface ParsedAssignment { title: string; description: string; maxPoints: number; submissionType: "file" | "text" | "url" | "none"; }
interface ParsedLesson {
  title: string;
  description: string;
  estimatedTime?: string;
  learningObjectives: string[];
  videoUrl?: string;
  audioUrl?: string;
  pdfUrl?: string;
  downloads: { name: string; url: string; size: string; type: string }[];
  assignments: ParsedAssignment[];
  quizzes: ParsedQuiz[];
}
interface ParsedModule { title: string; description: string; lessons: ParsedLesson[]; }
interface ParsedCourse {
  title: string;
  shortDescription: string;
  fullDescription: string;
  estimatedDuration: string;
  learningObjectives: string[];
  prerequisites: string[];
  modules: ParsedModule[];
  validationErrors: { type: "warning" | "error"; path: string; message: string }[];
}
interface ImportHistoryRow {
  id: string;
  importedBy: string;
  sourceFileName: string;
  status: "Pending" | "Success" | "Failed";
  errorMessage?: string;
  importedCourseId?: string;
  importedAt: string;
}

export function AcademyImport({ onImported }: { onImported: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("curriculum-outline.md");
  const [parsed, setParsed] = useState<ParsedCourse | null>(null);
  const [packageJson, setPackageJson] = useState<any | null>(null);
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const flash = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 6000);
  };

  const loadHistory = async () => {
    try {
      setHistory(await academyAdminApi<ImportHistoryRow[]>("/import-histories"));
    } catch {
      // Import remains usable if history cannot be loaded.
    }
  };
  useEffect(() => { void loadHistory(); }, []);

  const readTextFile = async (file: File) => {
    const value = await file.text();
    setFileName(file.name);
    if (file.name.toLowerCase().endsWith(".json")) {
      try {
        const data = JSON.parse(value);
        if (!data?.course && !data?.["course.json"]) throw new Error("Course metadata is missing.");
        setPackageJson(data);
        setParsed(null);
        setText("");
        flash("Course package JSON loaded.");
      } catch (error) {
        flash(error instanceof Error ? error.message : "Invalid course package JSON.", "error");
      }
      return;
    }
    setPackageJson(null);
    setParsed(null);
    setText(value);
  };

  const analyze = async () => {
    if (!text.trim()) return flash("Paste or upload a curriculum outline first.", "error");
    setBusy("parse");
    try {
      const result = await academyAdminApi<ParsedCourse>("/courses/parse-curriculum", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setParsed(result);
      setPackageJson(null);
      flash("Curriculum analyzed.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Curriculum parsing failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const buildPackage = (course: ParsedCourse) => {
    const stamp = Date.now();
    const courseId = `course-import-${stamp}`;
    const quizzes: any[] = [];
    const assignments: any[] = [];
    const downloads: any[] = [];

    const modules = course.modules.map((module, moduleIndex) => {
      const moduleId = `mod-${stamp}-${moduleIndex}`;
      const lessons = module.lessons.map((lesson, lessonIndex) => {
        const lessonId = `les-${stamp}-${moduleIndex}-${lessonIndex}`;

        (lesson.quizzes || []).forEach((quiz, quizIndex) => {
          quizzes.push({
            id: `quiz-${stamp}-${moduleIndex}-${lessonIndex}-${quizIndex}`,
            lessonId,
            title: quiz.title || "Lesson Assessment",
            passingScore: quiz.passingScore || 80,
            questions: (quiz.questions || []).map((question, questionIndex) => ({
              id: `q-${stamp}-${moduleIndex}-${lessonIndex}-${quizIndex}-${questionIndex}`,
              ...question,
              orderNumber: questionIndex + 1,
            })),
          });
        });

        (lesson.assignments || []).forEach((assignment, assignmentIndex) => {
          assignments.push({
            id: `assign-${stamp}-${moduleIndex}-${lessonIndex}-${assignmentIndex}`,
            courseId,
            moduleId,
            lessonId,
            ...assignment,
          });
        });

        (lesson.downloads || []).forEach((download, downloadIndex) => {
          downloads.push({
            id: `dl-${stamp}-${moduleIndex}-${lessonIndex}-${downloadIndex}`,
            courseId,
            lessonId,
            name: download.name,
            fileType: download.type || "document",
            url: download.url,
            fileSize: download.size || "",
          });
        });

        return {
          id: lessonId,
          title: lesson.title,
          description: lesson.description || "",
          learningObjectives: lesson.learningObjectives || [],
          estimatedTime: lesson.estimatedTime || "20 mins",
          lessonContent: lesson.description || "",
          videoUrl: lesson.videoUrl || "",
          audioUrl: lesson.audioUrl || "",
          downloads: lesson.downloads || [],
          orderNumber: lessonIndex + 1,
        };
      });

      return {
        id: moduleId,
        title: module.title,
        description: module.description || "",
        orderNumber: moduleIndex + 1,
        lessons,
      };
    });

    return {
      course: {
        id: courseId,
        title: course.title || "Untitled Curriculum",
        shortDescription: course.shortDescription || "Imported curriculum outline.",
        fullDescription: course.fullDescription || course.shortDescription || "",
        estimatedDuration: course.estimatedDuration || "10 hours",
        learningObjectives: course.learningObjectives || [],
        prerequisites: course.prerequisites || [],
        status: "Imported",
        category: "General",
        difficultyLevel: "Beginner",
        instructor: "Hub Admin",
        price: 0,
        pricingType: "free",
        courseVersion: "1.0.0",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      modules,
      quizzes,
      assignments,
      downloads,
    };
  };

  const importPackage = async () => {
    const data = packageJson || (parsed ? buildPackage(parsed) : null);
    if (!data) return flash("Analyze a curriculum or load a JSON package first.", "error");
    setBusy("import");
    try {
      const result = await academyAdminApi<ImportHistoryRow>("/courses/import", {
        method: "POST",
        body: JSON.stringify({
          packageData: data,
          importedBy: "Hub Admin",
          sourceFileName: fileName || "hub-admin-import",
          userRole: "Admin",
        }),
      });
      if (result.status === "Failed") throw new Error(result.errorMessage || "Academy rejected the import.");
      await Promise.all([loadHistory(), onImported()]);
      setParsed(null);
      setPackageJson(null);
      setText("");
      flash("Course imported successfully.");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Course import failed.", "error");
    } finally {
      setBusy("");
    }
  };

  const counts = useMemo(() => {
    if (!parsed) return { modules: 0, lessons: 0, quizzes: 0, assignments: 0 };
    return parsed.modules.reduce((acc, module) => {
      acc.modules += 1;
      acc.lessons += module.lessons.length;
      for (const lesson of module.lessons) {
        acc.quizzes += lesson.quizzes?.length || 0;
        acc.assignments += lesson.assignments?.length || 0;
      }
      return acc;
    }, { modules: 0, lessons: 0, quizzes: 0, assignments: 0 });
  }, [parsed]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)] gap-5">
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        {message && <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{message.text}</div>}
        <div>
          <div className="flex items-center gap-2"><UploadCloud className="w-5 h-5 text-indigo-600" /><h2 className="font-bold text-slate-900">Curriculum import</h2></div>
          <p className="text-xs text-slate-500 mt-1">Paste curriculum text/Markdown for analysis, or load an existing V79 course-package JSON file.</p>
        </div>

        <label className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-cyan-300">
          <FileJson className="w-5 h-5 text-slate-400" />
          <div className="flex-1"><div className="text-xs font-semibold text-slate-700">Upload text, Markdown or course JSON</div><div className="text-[10px] text-slate-400 mt-0.5">.txt, .md, .json</div></div>
          <input type="file" accept=".txt,.md,.json,text/plain,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && void readTextFile(e.target.files[0])} />
        </label>

        {!packageJson && (
          <>
            <textarea rows={18} value={text} onChange={(e) => { setText(e.target.value); setParsed(null); }} className="admin-input font-mono text-[11px]" placeholder="# Course Title&#10;## Module 1: ...&#10;### Lesson 1.1: ..." />
            <button disabled={!text.trim() || busy === "parse"} onClick={() => void analyze()} className="px-4 py-2.5 rounded-lg bg-slate-950 text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-40">
              {busy === "parse" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Analyze curriculum
            </button>
          </>
        )}

        {(parsed || packageJson) && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-4 h-4" /><span className="text-xs font-bold">{packageJson ? "Course package ready" : "Parsed curriculum ready"}</span></div>
            {parsed && (
              <>
                <div className="text-lg font-bold text-slate-900">{parsed.title || "Untitled Curriculum"}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[["Modules", counts.modules], ["Lessons", counts.lessons], ["Quizzes", counts.quizzes], ["Assignments", counts.assignments]].map(([label, value]) => (
                    <div key={String(label)} className="bg-white border border-slate-200 rounded-lg p-2 text-center"><div className="font-bold text-slate-900">{value}</div><div className="text-[9px] text-slate-400">{label}</div></div>
                  ))}
                </div>
                {parsed.validationErrors?.length > 0 && (
                  <div className="space-y-1">
                    {parsed.validationErrors.slice(0, 8).map((item, index) => <div key={index} className={`text-[10px] ${item.type === "error" ? "text-rose-700" : "text-amber-700"}`}>{item.path}: {item.message}</div>)}
                  </div>
                )}
              </>
            )}
            <button disabled={busy === "import"} onClick={() => void importPackage()} className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40">
              {busy === "import" ? "Importing..." : "Create imported course"}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-2"><History className="w-4 h-4 text-cyan-600" /><div><h3 className="text-sm font-bold text-slate-900">Import history</h3><p className="text-[10px] text-slate-500">Recent curriculum-package imports.</p></div></div>
        <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          {history.map((row) => (
            <div key={row.id} className="p-4">
              <div className="flex items-center justify-between gap-2"><div className="text-xs font-semibold text-slate-800 truncate">{row.sourceFileName}</div><span className={`text-[9px] px-2 py-1 rounded-full ${row.status === "Success" ? "bg-emerald-50 text-emerald-700" : row.status === "Failed" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{row.status}</span></div>
              <div className="text-[10px] text-slate-400 mt-1">{new Date(row.importedAt).toLocaleString()} · {row.importedBy}</div>
              {row.errorMessage && <div className="text-[10px] text-rose-600 mt-2">{row.errorMessage}</div>}
            </div>
          ))}
          {history.length === 0 && <div className="p-8 text-center text-sm text-slate-400">No import history yet.</div>}
        </div>
      </section>
    </div>
  );
}
