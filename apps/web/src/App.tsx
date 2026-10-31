import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CircleCheck,
  Download,
  FileText,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  LoaderCircle,
  LogOut,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, initializeCsrf, type Application, type ApplicationList, type Dashboard, type GmailIntegrationStatus, type GmailSyncResult, type ImportedJobDetails, type InterviewPrep, type ResumeAtsAnalysis, type ResumeDocument, type Status, type ToolkitInsights, type User } from "./lib/api";

const statusNames: Record<Status, string> = {
  SAVED: "Saved",
  APPLIED: "Applied",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};
const statusOrder: Status[] = ["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const formatDate = (date: string | null) => date
  ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(date))
  : "—";
const formatRelative = (date: string) => {
  const days = Math.round((new Date(date).getTime() - Date.now()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "Yesterday";
  return `${Math.abs(days)} days ago`;
};

type Theme = "light" | "dark";

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

function LandingPage({ onSignIn, onCreateAccount, theme, onToggleTheme }: { onSignIn: () => void; onCreateAccount: () => void; theme: Theme; onToggleTheme: () => void }) {
  const steps = [
    {
      icon: LockKeyhole,
      number: "01",
      title: "Create your private workspace",
      description: "Create an account with your name, email, and a password of at least 10 characters. Your applications are tied to your account, so your job-search records stay separate from other users.",
    },
    {
      icon: BriefcaseBusiness,
      number: "02",
      title: "Connect your inbox or capture a portal page",
      description: "Connect Gmail with read-only access so ApplyPilot can detect application and status emails from supported portals. For pages that do not send useful emails, use the browser extension to capture the job page you are viewing.",
    },
    {
      icon: ListFilter,
      number: "03",
      title: "Keep each application up to date",
      description: "Application, assessment, interview, offer, and rejection emails can update matching jobs automatically. Scheduled inbox checks run in the background. Review uncertain matches and adjust statuses in your workspace.",
    },
    {
      icon: LayoutDashboard,
      number: "04",
      title: "Review your progress and decide what is next",
      description: "The dashboard summarizes your applications, current pipeline, interview and offer conversion, and recent activity. Search by company, role, or location, or filter the list by status to find a specific opportunity.",
    },
  ];

  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="ApplyPilot home">
          <span className="brand-mark"><Target size={18} /></span>
          <span>applypilot</span>
        </a>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">What you can do</a>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button type="button" className="text-button" onClick={onSignIn}>Sign in</button>
          <button type="button" className="primary-button" onClick={onCreateAccount}>Create account <ArrowRight size={15} /></button>
        </nav>
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-copy">
          <p className="eyebrow landing-eyebrow"><Sparkles size={14} /> YOUR JOB SEARCH, IN FOCUS</p>
          <h1>Make every application easier to <span>move forward.</span></h1>
          <p className="landing-lede">ApplyPilot is a personal job-search workspace that brings your applications, their progress, and your next career steps together in one clear view.</p>
          <div className="landing-hero-actions">
            <button type="button" className="primary-button" onClick={onCreateAccount}>Get started <ArrowRight size={17} /></button>
            <a className="landing-secondary-link" href="#how-it-works">Explore the steps <ArrowRight size={15} /></a>
          </div>
          <div className="landing-trust"><ShieldCheck size={16} /> Private, account-based tracking. Your application details are not public.</div>
        </div>
        <div className="landing-preview" aria-label="Illustration of the ApplyPilot job-search dashboard">
          <div className="preview-topbar">
            <div className="preview-brand-mark"><Target size={15} /></div>
            <div><strong>My job search</strong><span>Personal workspace</span></div>
            <span className="preview-live"><i /> IN FOCUS</span>
          </div>
          <div className="preview-stats">
            <div><span>Total applications</span><strong>12</strong><small>opportunities tracked</small></div>
            <div><span>In progress</span><strong>8</strong><small>active applications</small></div>
          </div>
          <div className="preview-section-title"><strong>Application pipeline</strong><span>View all <ArrowRight size={13} /></span></div>
          <div className="preview-pipeline">
            <div><span className="preview-dot saved-dot" />Saved<strong>3</strong></div>
            <div><span className="preview-dot applied-dot" />Applied<strong>4</strong></div>
            <div><span className="preview-dot interview-dot" />Interview<strong>1</strong></div>
          </div>
          <div className="preview-application">
            <div className="preview-company-icon">N</div>
            <div><strong>Northstar</strong><span>Product Designer</span></div>
            <span className="preview-status">Interview</span>
          </div>
          <p className="preview-caption">A sample view of the information you can organize in your workspace.</p>
        </div>
      </section>

      <section className="landing-section landing-how" id="how-it-works">
        <div className="landing-section-heading">
          <p className="eyebrow muted-eyebrow">A SIMPLE, REPEATABLE WORKFLOW</p>
          <h2>From the first save to the next step</h2>
          <p>Use ApplyPilot as a home base for the jobs you are exploring, applying to, and hearing back about.</p>
        </div>
        <div className="landing-steps">
          {steps.map(({ icon: Icon, number, title, description }) => (
            <article className="landing-step" key={number}>
              <div className="landing-step-top"><span className="landing-step-icon"><Icon size={18} /></span><span className="landing-step-number">{number}</span></div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-features" id="features">
        <div className="landing-section-heading">
          <p className="eyebrow muted-eyebrow">BUILT FOR THE WHOLE JOB SEARCH</p>
          <h2>One organized place to keep momentum</h2>
        </div>
        <div className="landing-feature-grid">
          <article className="landing-feature"><span><LayoutDashboard size={18} /></span><div><h3>A useful overview</h3><p>See totals, active applications, stage counts, conversion rates, and the latest status changes from one dashboard.</p></div></article>
          <article className="landing-feature"><span><Search size={18} /></span><div><h3>Find a record quickly</h3><p>Search your applications by company, role, or location, then narrow the list by its current status.</p></div></article>
          <article className="landing-feature"><span><Sparkles size={18} /></span><div><h3>Track through inbox and browser capture</h3><p>Connect Gmail using read-only OAuth to detect supported portal updates, or capture the open job page with the optional browser extension. You never give ApplyPilot your Naukri, LinkedIn, or Internshala password.</p></div></article>
          <article className="landing-feature"><span><Check size={18} /></span><div><h3>Your records stay under your account</h3><p>Sign in to access your workspace. Application records are scoped to your account, and status history helps you remember how each opportunity progressed.</p></div></article>
        </div>
      </section>

      <section className="landing-section landing-boundaries">
        <div>
          <p className="eyebrow muted-eyebrow">WHAT TO EXPECT</p>
          <h2>You stay in control of your applications.</h2>
          <p>ApplyPilot does not apply to jobs on your behalf or sign in to Naukri, Internshala, LinkedIn, or employer portals. Gmail sync reads supported job-notification emails only, and the extension captures a page only when you activate it. Portal emails and page layouts vary, so ambiguous matches are not guessed.</p>
        </div>
        <div className="landing-boundary-card">
          <strong>Set up automatic tracking</strong>
          <span><Check size={15} /> Connect Gmail with Google read-only consent</span>
          <span><Check size={15} /> Allow supported portal emails to be matched</span>
          <span><Check size={15} /> Install the extension for one-click page capture</span>
          <span><Check size={15} /> Review imported jobs and ambiguous matches</span>
        </div>
      </section>

      <section className="landing-cta">
        <div><p className="eyebrow">YOUR NEXT STEP STARTS HERE</p><h2>Bring your job search into focus.</h2><p>Create a workspace and start with the opportunities already on your mind.</p></div>
        <button type="button" className="primary-button" onClick={onCreateAccount}>Create your account <ArrowRight size={17} /></button>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top"><span className="brand-mark"><Target size={16} /></span><span>applypilot</span></a>
        <span>Made for the next step.</span>
        <button type="button" className="text-button" onClick={onSignIn}>Already have an account? Sign in</button>
      </footer>
    </main>
  );
}

function AuthScreen({ onAuthenticated, onHome, initialRegistering = false, theme, onToggleTheme }: { onAuthenticated: (user: User) => void; onHome: () => void; initialRegistering?: boolean; theme: Theme; onToggleTheme: () => void }) {
  const [registering, setRegistering] = useState(initialRegistering);
  const [errorMessage, setErrorMessage] = useState("");
  const schema = useMemo(() => z.object({
    name: registering ? z.string().trim().min(1, "Enter your name").max(80) : z.string().optional(),
    email: z.string().trim().email("Enter a valid email address"),
    password: registering
      ? z.string().min(10, "Use at least 10 characters").max(128)
      : z.string().min(1, "Enter your password"),
  }), [registering]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setErrorMessage("");
    try {
      const path = registering ? "/auth/register" : "/auth/login";
      const user = await api.post<{ user: User }>(path, values);
      onAuthenticated(user.user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in");
    }
  });

  return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="auth-brand"><span className="brand-mark"><Target size={19} /></span> applypilot</div>
        <div className="auth-visual-copy">
          <div className="eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</div>
          <h1>A little more<br />focus. A lot more<br /><span>forward.</span></h1>
          <p>Bring every application, follow-up, and small win into one clear view.</p>
        </div>
        <div className="auth-footnote"><span className="online-dot" /> Your job search, moving forward.</div>
        <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
      </div>
      <section className="auth-panel">
        <div className="auth-panel-top"><button className="text-button" onClick={onHome}>← ApplyPilot home</button><div className="auth-mode-switch"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><span>{registering ? "Already have an account?" : "New to ApplyPilot?"}</span><button className="text-button" onClick={() => setRegistering((value) => !value)}>{registering ? "Sign in" : "Create account"}</button></div></div>
        <div className="auth-form-wrap">
          <div className="auth-icon"><BriefcaseBusiness size={21} /></div>
          <p className="eyebrow muted-eyebrow">{registering ? "GET STARTED" : "WELCOME BACK"}</p>
          <h2>{registering ? "Create your account" : "Good to see you."}</h2>
          <p className="auth-subtitle">{registering ? "A more organized job search starts with one small step." : "Pick up right where you left off."}</p>
          <form onSubmit={submit} className="auth-form">
            {registering && <label>Your name<input autoComplete="name" placeholder="Alex Morgan" {...register("name")} />{errors.name && <span className="field-error">{errors.name.message}</span>}</label>}
            <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
            <label>Password<input type="password" autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "At least 10 characters" : "Enter your password"} {...register("password")} />{errors.password && <span className="field-error">{errors.password.message}</span>}</label>
            {errorMessage && <div role="alert" className="form-error">{errorMessage}</div>}
            <button type="submit" className="primary-button auth-submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="spin" size={17} /> : null}
              {registering ? "Create account" : "Sign in"} <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-security"><span>🔒</span> Your information stays private and secure.</div>
        </div>
        <div className="auth-footer">© 2026 ApplyPilot <span>·</span> Built for the next step</div>
      </section>
    </main>
  );
}

function ApplicationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [errorMessage, setErrorMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const schema = z.object({
    companyName: z.string().trim().min(1, "Company is required").max(120),
    role: z.string().trim().min(1, "Role is required").max(160),
    location: z.string().trim().max(160),
    jobUrl: z.union([z.literal(""), z.string().url("Enter a valid URL")]),
    jobDescription: z.string().trim().max(20000),
    status: z.enum(["SAVED", "APPLIED"]),
  });
  const { register, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: "", role: "", location: "", jobUrl: "", jobDescription: "", status: "APPLIED" },
  });
  const importDetails = async () => {
    const url = getValues("jobUrl").trim();
    setImportMessage("");
    if (!url) {
      setImportMessage("Paste a job posting URL first.");
      return;
    }
    setImporting(true);
    try {
      const details = await api.post<ImportedJobDetails>("/applications/import", { url });
      if (details.companyName) setValue("companyName", details.companyName, { shouldValidate: true });
      if (details.role) setValue("role", details.role, { shouldValidate: true });
      if (details.location) setValue("location", details.location, { shouldValidate: true });
      if (details.jobDescription) setValue("jobDescription", details.jobDescription);
      setValue("jobUrl", details.jobUrl, { shouldValidate: true });
      setImportMessage("Job details fetched. Review them before adding the application.");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not fetch job details.");
    } finally {
      setImporting(false);
    }
  };
  const submit = handleSubmit(async (values) => {
    setErrorMessage("");
    try {
      await api.post("/applications", {
        ...values,
        location: values.location || null,
        jobUrl: values.jobUrl || null,
        jobDescription: values.jobDescription || null,
        appliedAt: values.status === "APPLIED" ? new Date().toISOString() : null,
      });
      onCreated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save this application");
    }
  });

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><p className="eyebrow muted-eyebrow">KEEP THE MOMENTUM</p><h2 id="modal-title">Add an application</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <p className="modal-description">Capture the details now. You can fill in the rest later.</p>
        <form className="application-form" onSubmit={submit}>
          <label>Company name<input autoFocus placeholder="e.g. Stripe" {...register("companyName")} />{errors.companyName && <span className="field-error">{errors.companyName.message}</span>}</label>
          <label>Role title<input placeholder="e.g. Software Engineer" {...register("role")} />{errors.role && <span className="field-error">{errors.role.message}</span>}</label>
          <div className="form-row">
            <label>Location<input placeholder="Remote, Bengaluru..." {...register("location")} /></label>
            <label>Starting status<select {...register("status")}><option value="APPLIED">Applied</option><option value="SAVED">Saved</option></select></label>
          </div>
          <label>Job posting URL <span className="optional-label">Optional</span><input placeholder="https://" {...register("jobUrl")} />{errors.jobUrl && <span className="field-error">{errors.jobUrl.message}</span>}</label>
          <div className="import-details-row">
            <button type="button" className="secondary-button" onClick={() => void importDetails()} disabled={importing}>
              {importing ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
              {importing ? "Fetching details..." : "Fetch job details"}
            </button>
            <span className="import-helper">Reads public job pages; some portals may block access.</span>
          </div>
          {importMessage && <div className={importMessage.startsWith("Job details fetched") ? "import-success" : "form-error"} role="status">{importMessage}</div>}
          <label>Job description <span className="optional-label">Optional</span><textarea rows={4} {...register("jobDescription")} /></label>
          {errorMessage && <div role="alert" className="form-error">{errorMessage}</div>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add application</button></div>
        </form>
      </section>
    </div>
  );
}

function AppRow({ application, onUpdated }: { application: Application; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = `application-description-${application.id}`;
  const updateStatus = async (status: Status) => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/applications/${application.id}/status`, { status });
      onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Remove the ${application.role} application at ${application.companyName}?`)) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/applications/${application.id}`);
      onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove application");
      setBusy(false);
    }
  };

  return (
    <div className="application-row">
      <div className="company-cell"><div className={`company-avatar avatar-${(application.companyName.charCodeAt(0) % 5)}`}>{application.companyName.slice(0, 1).toUpperCase()}</div><div className="company-meta"><strong>{application.companyName}</strong><span>{application.location || "Location not set"}{application.source === "GMAIL" ? " · Gmail" : application.source === "PORTAL_CAPTURE" ? " · Browser capture" : ""}</span></div></div>
      <div className="role-cell"><strong>{application.role}</strong><span>Added {formatDate(application.appliedAt ?? application.updatedAt)}</span></div>
      <div className="status-cell"><label className="sr-only" htmlFor={`status-${application.id}`}>Status for {application.role} at {application.companyName}</label><select id={`status-${application.id}`} className={`status-select status-${application.status.toLowerCase()}`} value={application.status} disabled={busy} onChange={(event) => void updateStatus(event.target.value as Status)}>{statusOrder.map((status) => <option value={status} key={status}>{statusNames[status]}</option>)}</select></div>
      <div className="application-row-actions">
        <button type="button" className={`row-details-toggle${detailsOpen ? " expanded" : ""}`} aria-label={`${detailsOpen ? "Hide" : "Show"} job description for ${application.role} at ${application.companyName}`} aria-expanded={detailsOpen} aria-controls={detailsId} onClick={() => setDetailsOpen((value) => !value)}><ChevronDown size={15} /></button>
        <button type="button" className="row-more" aria-label={`Delete ${application.role} at ${application.companyName}`} disabled={busy} onClick={() => void remove()}><X size={16} /></button>
      </div>
      {detailsOpen && <section className="application-description" id={detailsId} aria-label={`Job description for ${application.role} at ${application.companyName}`}>
        <h3>Job description</h3>
        {application.jobDescription ? <p>{application.jobDescription}</p> : <p className="application-description-empty">No job description was saved for this application.</p>}
        {application.jobUrl && <a href={application.jobUrl} target="_blank" rel="noopener noreferrer">Open original job posting <ArrowRight size={13} /></a>}
      </section>}
      {error && <span className="row-error" role="alert">{error}</span>}
    </div>
  );
}

function GmailSyncCard() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const statusQuery = useQuery({
    queryKey: ["gmail-integration"],
    queryFn: () => api.get<GmailIntegrationStatus>("/integrations/gmail/status"),
  });
  const connectMutation = useMutation({
    mutationFn: () => api.post<{ authorizationUrl: string }>("/integrations/gmail/connect"),
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => setNotice(error.message),
  });
  const syncMutation = useMutation({
    mutationFn: () => api.post<GmailSyncResult>("/integrations/gmail/sync"),
    onSuccess: (result) => {
      setNotice(`Checked ${result.processed} messages: ${result.created} new jobs, ${result.updated} status updates${result.needsReview ? `, ${result.needsReview} could not be matched automatically` : ""}.`);
      void queryClient.invalidateQueries({ queryKey: ["gmail-integration"] });
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => setNotice(error.message),
  });
  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/integrations/gmail"),
    onSuccess: () => {
      setNotice("Gmail disconnected. Previously imported applications are unchanged.");
      void queryClient.invalidateQueries({ queryKey: ["gmail-integration"] });
    },
    onError: (error) => setNotice(error.message),
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("gmail") === "connected") {
      setNotice("Gmail is connected. Run the first sync to import recent portal updates.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const integration = statusQuery.data?.integration;
  const busy = connectMutation.isPending || syncMutation.isPending || disconnectMutation.isPending;
  return (
    <section className="gmail-sync-card" aria-label="Automatic application tracking">
      <div className="gmail-sync-icon"><Mail size={18} /></div>
      <div className="gmail-sync-copy">
        <strong>{integration ? `Inbox sync connected · ${integration.email}` : "Automatically track portal email updates"}</strong>
        <span>{integration
          ? `Read-only Gmail sync checks supported job notifications every 10 minutes${integration.lastSyncedAt ? ` · Last checked ${formatDate(integration.lastSyncedAt)}` : ""}.`
          : "Connect Gmail with read-only access to detect applications, interviews, offers, and rejections from supported portals."}</span>
        <small>ApplyPilot never receives or stores your job-portal passwords.</small>
        {notice && <span className="gmail-sync-notice" role="status">{notice}</span>}
      </div>
      <div className="gmail-sync-actions">
        {integration
          ? <>
              <button type="button" className="secondary-button" onClick={() => syncMutation.mutate()} disabled={busy}><RefreshCw size={14} className={syncMutation.isPending ? "spin" : ""} /> Sync now</button>
              <button type="button" className="text-button" onClick={() => disconnectMutation.mutate()} disabled={busy}>Disconnect</button>
            </>
          : <button type="button" className="primary-button" onClick={() => connectMutation.mutate()} disabled={busy || statusQuery.isLoading}>
              {connectMutation.isPending ? <LoaderCircle size={15} className="spin" /> : <Mail size={15} />}
              Connect Gmail
            </button>}
      </div>
    </section>
  );
}

function ProfileMenu({
  user,
  onSignOut,
  isSigningOut,
  errorMessage,
}: {
  user: User;
  onSignOut: () => void;
  isSigningOut: boolean;
  errorMessage: string;
}) {
  return (
    <section className="profile-popover" aria-label="Account menu">
      <div className="profile-popover-identity">
        <div className="profile-avatar">{initials(user.name)}</div>
        <div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div>
      </div>
      <div className="profile-popover-detail"><UserRound size={15} /><span>Personal workspace</span></div>
      {errorMessage && <span className="sidebar-error" role="alert">{errorMessage}</span>}
      <button type="button" className="profile-signout" onClick={onSignOut} disabled={isSigningOut}>
        {isSigningOut ? <LoaderCircle className="spin" size={15} /> : <LogOut size={15} />}
        Sign out
      </button>
    </section>
  );
}

function PipelineCard({
  application,
  onUpdated,
  onSelect,
}: {
  application: Application;
  onUpdated: () => void;
  onSelect: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changeStatus = async (status: Status) => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/applications/${application.id}/status`, { status });
      onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="board-card">
      <div className={`board-company-mark avatar-${application.companyName.charCodeAt(0) % 5}`}>{application.companyName.slice(0, 1).toUpperCase()}</div>
      <div className="board-card-copy">
        <button type="button" className="board-company" onClick={onSelect}>{application.companyName}</button>
        <span>{application.role}</span>
        <small>{application.nextAction || `Updated ${formatRelative(application.updatedAt)}`}</small>
      </div>
      <label className="sr-only" htmlFor={`board-status-${application.id}`}>Update status for {application.role} at {application.companyName}</label>
      <select id={`board-status-${application.id}`} className={`board-status status-${application.status.toLowerCase()}`} value={application.status} disabled={busy} onChange={(event) => void changeStatus(event.target.value as Status)}>
        {statusOrder.map((status) => <option value={status} key={status}>{statusNames[status]}</option>)}
      </select>
      {error && <span className="board-card-error" role="alert">{error}</span>}
    </article>
  );
}

function ApplicationPipeline({
  applications,
  statuses,
  isLoading,
  onAdd,
  onUpdated,
  onStatusClick,
}: {
  applications: Application[];
  statuses: Dashboard["statuses"] | undefined;
  isLoading: boolean;
  onAdd: () => void;
  onUpdated: () => void;
  onStatusClick: (status: Status | "ALL") => void;
}) {
  const stages: Status[] = ["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER"];
  return (
    <section className="reference-panel pipeline-board-panel">
      <div className="reference-panel-heading">
        <div><h2>Application pipeline</h2><p>Track each opportunity as it moves forward.</p></div>
        <button type="button" className="subtle-link" onClick={() => onStatusClick("ALL")}>All applications <ChevronDown size={14} /></button>
        <button type="button" className="primary-button board-add-button" onClick={onAdd}><Plus size={15} /> Add application</button>
      </div>
      <div className="pipeline-board">
        {stages.map((status) => {
          const items = applications.filter((application) => application.status === status);
          const count = statuses?.find((entry) => entry.status === status)?.count ?? items.length;
          return <section className={`pipeline-column column-${status.toLowerCase()}`} key={status}>
            <button type="button" className="pipeline-column-heading" onClick={() => onStatusClick(status)}>
              <span className="column-status-dot" />
              <strong>{statusNames[status]}</strong>
              <span className="column-count">{count}</span>
            </button>
            <div className="pipeline-column-cards">
              {isLoading
                ? <div className="board-column-state"><LoaderCircle className="spin" size={16} /></div>
                : items.length
                  ? items.slice(0, 4).map((application) => <PipelineCard key={application.id} application={application} onUpdated={onUpdated} onSelect={() => onStatusClick(status)} />)
                  : <div className="board-column-empty">No {statusNames[status].toLowerCase()} jobs yet</div>}
            </div>
            <button type="button" className="board-add-job" onClick={onAdd}><Plus size={13} /> Add job</button>
          </section>;
        })}
      </div>
      <button type="button" className="board-view-all" onClick={() => onStatusClick("ALL")}>View all applications <ArrowRight size={14} /></button>
    </section>
  );
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ResumeLibraryPage() {
  const queryClient = useQueryClient();
  const resumesQuery = useQuery({
    queryKey: ["toolkit", "resumes"],
    queryFn: () => api.get<ResumeDocument[]>("/toolkit/resumes"),
  });
  const applicationsQuery = useQuery({
    queryKey: ["toolkit", "resume-application-options"],
    queryFn: () => api.get<ApplicationList>("/applications?page=1&pageSize=100&sort=updatedAt&order=desc"),
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [targetApplicationId, setTargetApplicationId] = useState("");
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [savingDescriptionId, setSavingDescriptionId] = useState<string | null>(null);
  const [analysisByResume, setAnalysisByResume] = useState<Record<string, ResumeAtsAnalysis>>({});
  const [analyzingResumeId, setAnalyzingResumeId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisErrorResumeId, setAnalysisErrorResumeId] = useState<string | null>(null);
  const uploadMutation = useMutation({
    mutationFn: ({ file, description }: { file: File; description: string }) =>
      api.upload<ResumeDocument>("/toolkit/resumes", file, description),
    onSuccess: () => {
      setUploadFile(null);
      setUploadDescription("");
      void queryClient.invalidateQueries({ queryKey: ["toolkit", "resumes"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/toolkit/resumes/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["toolkit", "resumes"] }),
  });
  const downloadMutation = useMutation({
    mutationFn: async (resume: ResumeDocument) => {
      const file = await api.download(`/toolkit/resumes/${resume.id}/download`);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resume.name;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });
  const saveDescription = async (resume: ResumeDocument) => {
    setSavingDescriptionId(resume.id);
    setDescriptionError("");
    try {
      await api.patch(`/toolkit/resumes/${resume.id}`, { description: descriptionDraft });
      setEditingResumeId(null);
      void queryClient.invalidateQueries({ queryKey: ["toolkit", "resumes"] });
    } catch (error) {
      setDescriptionError(error instanceof Error ? error.message : "Could not update resume description");
    } finally {
      setSavingDescriptionId(null);
    }
  };
  const analyzeResume = async (resume: ResumeDocument) => {
    setAnalyzingResumeId(resume.id);
    setAnalysisError("");
    setAnalysisErrorResumeId(null);
    try {
      const result = await api.post<ResumeAtsAnalysis>(`/toolkit/resumes/${resume.id}/ats-score`, {
        ...(targetApplicationId ? { applicationId: targetApplicationId } : {}),
      });
      setAnalysisByResume((current) => ({ ...current, [resume.id]: result }));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Could not analyze resume");
      setAnalysisErrorResumeId(resume.id);
    } finally {
      setAnalyzingResumeId(null);
    }
  };

  return (
    <section className="toolkit-page">
      <header className="toolkit-page-heading">
        <div><p className="eyebrow muted-eyebrow">YOUR TOOLKIT</p><h1>Resume library</h1><p>Keep the versions you tailor for different opportunities in one private place.</p></div>
        <label className="primary-button toolkit-upload-button"><Upload size={16} /> Choose resume<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => {
          setUploadFile(event.currentTarget.files?.[0] ?? null);
          event.currentTarget.value = "";
        }} /></label>
      </header>
      <p className="toolkit-helper">PDF or DOCX · 5 MB maximum · Files are private to your account. AI analysis sends resume text to your configured AI provider.</p>
      {(uploadMutation.isError || deleteMutation.isError || downloadMutation.isError || applicationsQuery.isError) && <div className="toolkit-alert" role="alert">{uploadMutation.error?.message ?? deleteMutation.error?.message ?? downloadMutation.error?.message ?? applicationsQuery.error?.message}</div>}
      {uploadFile && <form className="toolkit-card resume-upload-form" onSubmit={(event) => {
        event.preventDefault();
        uploadMutation.mutate({ file: uploadFile, description: uploadDescription.trim() });
      }}>
        <div><strong>{uploadFile.name}</strong><span>{formatFileSize(uploadFile.size)} · Add a label so you can identify this version later.</span></div>
        <label>Tailored for<input maxLength={500} placeholder="e.g. Senior product designer roles" value={uploadDescription} onChange={(event) => setUploadDescription(event.target.value)} /></label>
        <div className="toolkit-form-actions"><button type="button" className="secondary-button" onClick={() => { setUploadFile(null); setUploadDescription(""); }}>Cancel</button><button type="submit" className="primary-button" disabled={uploadMutation.isPending}>{uploadMutation.isPending ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} Save resume</button></div>
      </form>}
      <div className="toolkit-card">
        {resumesQuery.isPending
          ? <div className="toolkit-state"><LoaderCircle className="spin" /> Loading resumes…</div>
          : resumesQuery.isError
            ? <div className="toolkit-state toolkit-error" role="alert">{resumesQuery.error.message}</div>
            : resumesQuery.data.length
              ? <>
                <div className="resume-target-picker"><label>Score for a job application <span className="optional-label">Optional</span><select value={targetApplicationId} onChange={(event) => setTargetApplicationId(event.target.value)}><option value="">Use the resume's tailored-for description</option>{applicationsQuery.data?.items.map((application) => <option value={application.id} key={application.id}>{application.companyName} — {application.role}</option>)}</select></label></div>
                <div className="resume-list">{resumesQuery.data.map((resume) => <article className="resume-entry" key={resume.id}>
                  <div className="resume-row">
                    <span className="toolkit-item-icon"><FileText size={19} /></span>
                    <div className="toolkit-item-copy"><strong>{resume.name}</strong><span>{formatFileSize(resume.size)} · Added {formatDate(resume.createdAt)}</span><span className="resume-description">{resume.description || "No tailored-for description yet"}</span></div>
                    <div className="toolkit-item-actions">
                      <button type="button" className="toolkit-icon-button" aria-label={`Download ${resume.name}`} disabled={downloadMutation.isPending} onClick={() => downloadMutation.mutate(resume)}><Download size={16} /></button>
                      <button type="button" className="toolkit-icon-button danger" aria-label={`Delete ${resume.name}`} disabled={deleteMutation.isPending} onClick={() => {
                        if (window.confirm(`Delete ${resume.name}?`)) deleteMutation.mutate(resume.id);
                      }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="resume-entry-actions">
                    <button type="button" className="subtle-link" onClick={() => { setEditingResumeId(editingResumeId === resume.id ? null : resume.id); setDescriptionDraft(resume.description); setDescriptionError(""); }}>{editingResumeId === resume.id ? "Cancel edit" : "Edit description"}</button>
                    <button type="button" className="secondary-button resume-score-button" disabled={analyzingResumeId !== null} onClick={() => void analyzeResume(resume)}>{analyzingResumeId === resume.id ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}{analyzingResumeId === resume.id ? "Analyzing…" : "ATS score & insights"}</button>
                  </div>
                  {editingResumeId === resume.id && <form className="resume-description-form" onSubmit={(event) => { event.preventDefault(); void saveDescription(resume); }}>
                    <label>Tailored for<input maxLength={500} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} placeholder="e.g. Senior product designer roles" /></label>
                    <button type="submit" className="primary-button" disabled={savingDescriptionId === resume.id}>{savingDescriptionId === resume.id ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />} Save</button>
                  </form>}
                  {descriptionError && editingResumeId === resume.id && <p className="toolkit-error" role="alert">{descriptionError}</p>}
                  {analysisError && analyzingResumeId === null && analysisErrorResumeId === resume.id && <p className="toolkit-error" role="alert">{analysisError}</p>}
                  {analysisByResume[resume.id] && <section className="resume-analysis" aria-label={`ATS analysis for ${resume.name}`}>
                    <div className="resume-score"><strong>{analysisByResume[resume.id].score}</strong><span>AI ATS estimate / 100</span></div>
                    <p>{analysisByResume[resume.id].summary}</p>
                    <div className="resume-analysis-columns">
                      <div><strong>Strengths</strong><ul>{analysisByResume[resume.id].strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      <div><strong>Ways to improve</strong><ul>{analysisByResume[resume.id].improvements.map((item) => <li key={item}>{item}</li>)}</ul></div>
                    </div>
                    {analysisByResume[resume.id].missingKeywords.length > 0 && <p className="resume-keywords"><strong>Potential keywords to address:</strong> {analysisByResume[resume.id].missingKeywords.join(", ")}</p>}
                    <small>AI-generated estimate for guidance only; not a hiring prediction.</small>
                  </section>}
                </article>)}</div>
              </>
              : <div className="toolkit-state"><span className="toolkit-empty-icon"><FileText size={22} /></span><strong>No resumes yet</strong><span>Upload your first PDF or DOCX to get started.</span></div>}
      </div>
    </section>
  );
}

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type InterviewChatMessage = { role: "user" | "assistant"; content: string };

function InterviewPrepChat({ prep }: { prep: InterviewPrep }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<InterviewChatMessage[]>([]);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || isSending) return;
    const nextMessages = [...messages, { role: "user" as const, content: text }].slice(-10);
    setQuestion("");
    setError("");
    setIsSending(true);
    try {
      const response = await api.post<{ answer: string }>(`/toolkit/interview-preps/${prep.id}/chat`, { messages: nextMessages });
      setMessages([...nextMessages, { role: "assistant", content: response.answer }]);
    } catch (caught) {
      setQuestion(text);
      setError(caught instanceof Error ? caught.message : "Could not get an interview-coach response");
    } finally {
      setIsSending(false);
    }
  };
  const chatId = `prep-chat-${prep.id}`;
  return (
    <section className="prep-ai-chat">
      <button type="button" className="prep-ai-toggle" aria-expanded={open} aria-controls={chatId} onClick={() => setOpen((value) => !value)}>
        <span><Sparkles size={15} /> Ask AI interview coach</span><ChevronDown className={open ? "expanded" : ""} size={15} />
      </button>
      {open && <div className="prep-ai-body" id={chatId}>
        {messages.length
          ? <div className="prep-chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`prep-chat-message ${message.role}`} key={`${index}-${message.role}`}><strong>{message.role === "user" ? "You" : "AI coach"}</strong><p>{message.content}</p></div>)}</div>
          : <p className="prep-chat-empty">Ask about this interview, your notes, or how to prepare an answer.</p>}
        {error && <p className="toolkit-error" role="alert">{error}</p>}
        <form className="prep-chat-form" onSubmit={(event) => void sendQuestion(event)}>
          <label className="sr-only" htmlFor={`${chatId}-question`}>Ask the interview coach</label>
          <textarea id={`${chatId}-question`} rows={2} maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What would be a strong answer to…?" />
          <button type="submit" className="primary-button" disabled={isSending || !question.trim()}>{isSending ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}{isSending ? "Thinking…" : "Ask"}</button>
        </form>
        <small className="prep-chat-privacy">Your prep notes and linked job description are sent to the configured AI provider.</small>
      </div>}
    </section>
  );
}

function InterviewPrepPage() {
  const queryClient = useQueryClient();
  const prepsQuery = useQuery({
    queryKey: ["toolkit", "interview-preps"],
    queryFn: () => api.get<InterviewPrep[]>("/toolkit/interview-preps"),
  });
  const applicationsQuery = useQuery({
    queryKey: ["toolkit", "application-options"],
    queryFn: () => api.get<ApplicationList>("/applications?page=1&pageSize=100&sort=updatedAt&order=desc"),
  });
  const [editing, setEditing] = useState<InterviewPrep | null>(null);
  const [title, setTitle] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: (input: { title: string; applicationId: string | null; scheduledAt: string | null; notes: string }) =>
      editing
        ? api.patch<InterviewPrep>(`/toolkit/interview-preps/${editing.id}`, input)
        : api.post<InterviewPrep>("/toolkit/interview-preps", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["toolkit", "interview-preps"] });
      setEditing(null);
      setTitle("");
      setApplicationId("");
      setScheduledAt("");
      setNotes("");
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/toolkit/interview-preps/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["toolkit", "interview-preps"] }),
  });
  const beginEdit = (prep: InterviewPrep) => {
    setEditing(prep);
    setTitle(prep.title);
    setApplicationId(prep.applicationId ?? "");
    setScheduledAt(localDateTimeValue(prep.scheduledAt));
    setNotes(prep.notes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      title: title.trim(),
      applicationId: applicationId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      notes,
    });
  };

  return (
    <section className="toolkit-page">
      <header className="toolkit-page-heading"><div><p className="eyebrow muted-eyebrow">YOUR TOOLKIT</p><h1>Interview prep</h1><p>Plan your talking points and keep the details for each conversation together.</p></div></header>
      <div className="toolkit-interview-layout">
        <form className="toolkit-card toolkit-prep-form" onSubmit={submit}>
          <h2>{editing ? "Edit preparation" : "Plan an interview"}</h2>
          <label>Preparation title<input required maxLength={160} placeholder="e.g. Product design final round" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Related application <span className="optional-label">Optional</span><select value={applicationId} onChange={(event) => {
            const value = event.target.value;
            setApplicationId(value);
            const selected = applicationsQuery.data?.items.find((application) => application.id === value);
            if (selected && !title.trim()) setTitle(`${selected.companyName} — ${selected.role}`);
          }}><option value="">Not linked to an application</option>{applicationsQuery.data?.items.map((application) => <option value={application.id} key={application.id}>{application.companyName} — {application.role}</option>)}</select></label>
          <label>Interview date and time <span className="optional-label">Optional</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
          <label>Notes, questions, or talking points<textarea rows={6} maxLength={10000} placeholder="What should you research? Which examples do you want to share?" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {(mutation.isError || deleteMutation.isError || applicationsQuery.isError) && <div className="toolkit-alert" role="alert">{mutation.error?.message ?? deleteMutation.error?.message ?? applicationsQuery.error?.message}</div>}
          <div className="toolkit-form-actions">
            {editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setTitle(""); setApplicationId(""); setScheduledAt(""); setNotes(""); }}>Cancel edit</button>}
            <button type="submit" className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}{editing ? "Save changes" : "Save preparation"}</button>
          </div>
        </form>
        <div className="toolkit-prep-list">
          {prepsQuery.isPending
            ? <div className="toolkit-card toolkit-state"><LoaderCircle className="spin" /> Loading preparations…</div>
            : prepsQuery.isError
              ? <div className="toolkit-card toolkit-state toolkit-error" role="alert">{prepsQuery.error.message}</div>
              : prepsQuery.data.length
                ? prepsQuery.data.map((prep) => <article className="toolkit-card prep-card" key={prep.id}>
                  <div className="prep-card-heading"><span className="toolkit-item-icon"><CalendarDays size={18} /></span><div className="toolkit-item-copy"><strong>{prep.title}</strong><span>{prep.application ? `${prep.application.companyName} · ${prep.application.role}` : "Independent preparation"}</span></div>
                    <div className="toolkit-item-actions"><button type="button" className="toolkit-icon-button" aria-label={`Edit ${prep.title}`} onClick={() => beginEdit(prep)}><FileText size={15} /></button><button type="button" className="toolkit-icon-button danger" aria-label={`Delete ${prep.title}`} disabled={deleteMutation.isPending} onClick={() => {
                      if (window.confirm(`Delete ${prep.title}?`)) deleteMutation.mutate(prep.id);
                    }}><Trash2 size={15} /></button></div>
                  </div>
                  {prep.scheduledAt && <p className="prep-date">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(prep.scheduledAt))}</p>}
                  {prep.notes ? <p className="prep-notes">{prep.notes}</p> : <p className="prep-notes prep-muted">Add notes or talking points when you edit this preparation.</p>}
                  <InterviewPrepChat prep={prep} />
                </article>)
                : <div className="toolkit-card toolkit-state"><span className="toolkit-empty-icon"><CalendarDays size={22} /></span><strong>No interview prep saved</strong><span>Create a prep note with the form to keep your next conversation organized.</span></div>}
        </div>
      </div>
    </section>
  );
}

function InsightsPage() {
  const insightsQuery = useQuery({
    queryKey: ["toolkit", "insights"],
    queryFn: () => api.get<ToolkitInsights>("/toolkit/insights"),
  });
  const data = insightsQuery.data;
  const maxMonthly = Math.max(1, ...(data?.monthlyApplications.map((month) => month.count) ?? [1]));
  return (
    <section className="toolkit-page">
      <header className="toolkit-page-heading"><div><p className="eyebrow muted-eyebrow">YOUR TOOLKIT</p><h1>Insights</h1><p>A clear snapshot of your progress, based on the applications you track.</p></div></header>
      {insightsQuery.isError && <div className="toolkit-alert" role="alert">{insightsQuery.error.message}</div>}
      {insightsQuery.isPending
        ? <div className="toolkit-card toolkit-state"><LoaderCircle className="spin" /> Calculating your insights…</div>
        : data && <>
          <div className="insights-summary">
            <article className="toolkit-card insight-stat"><span>Total tracked</span><strong>{data.totals.total}</strong><small>{data.totals.active} active opportunities</small></article>
            <article className="toolkit-card insight-stat"><span>Reached interview</span><strong>{data.totals.interviewRate}%</strong><small>{data.totals.interviewed} opportunities</small></article>
            <article className="toolkit-card insight-stat"><span>Interview to offer</span><strong>{data.totals.offerRate}%</strong><small>{data.totals.offers} offers</small></article>
          </div>
          <div className="insights-grid">
            <article className="toolkit-card insight-panel"><h2>Application stages</h2><p>Where your opportunities are right now.</p>
              <div className="insight-stage-list">{data.statuses.map(({ status, count }) => <div className="insight-stage" key={status}><span>{statusNames[status]}</span><div className="insight-stage-track"><i className={`fill-${statusOrder.indexOf(status)}`} style={{ width: `${data.totals.total ? (count / data.totals.total) * 100 : 0}%` }} /></div><strong>{count}</strong></div>)}</div>
            </article>
            <article className="toolkit-card insight-panel"><h2>Applications over time</h2><p>New records created in the last six months.</p>
              <div className="insight-month-chart">{data.monthlyApplications.map((month) => <div className="insight-month" key={month.key}><strong>{month.count}</strong><div><i style={{ height: `${month.count ? Math.max(8, (month.count / maxMonthly) * 100) : 3}%` }} /></div><span>{month.label}</span></div>)}</div>
            </article>
          </div>
        </>}
    </section>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => window.localStorage.getItem("applypilot-theme") === "dark" ? "dark" : "light");
  const [user, setUser] = useState<User | null>(null);
  const [bootError, setBootError] = useState("");
  const [authMode, setAuthMode] = useState<"home" | "signin" | "register">("home");
  const [showAdd, setShowAdd] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "ALL">("ALL");
  const [openPopover, setOpenPopover] = useState<"notifications" | "header-profile" | "sidebar-profile" | null>(null);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#211f2b" : "#f2f0f8");
    window.localStorage.setItem("applypilot-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === "light" ? "dark" : "light");

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    const handleExtensionCapture = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.type !== "APPLYPILOT_EXTENSION_CAPTURE" ||
        typeof event.data.captureId !== "string"
      ) return;
      const captureId = event.data.captureId;
      if (!user) {
        window.postMessage({
          type: "APPLYPILOT_CAPTURE_RESULT",
          captureId,
          result: { success: false, message: "Sign in to ApplyPilot before capturing a job." },
        }, window.location.origin);
        return;
      }
      const captureSchema = z.object({
        companyName: z.string().trim().min(1).max(120),
        role: z.string().trim().min(1).max(160),
        jobUrl: z.string().url().max(2048),
        status: z.enum(["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]),
      });
      const parsed = captureSchema.safeParse(event.data.payload);
      if (!parsed.success) {
        window.postMessage({
          type: "APPLYPILOT_CAPTURE_RESULT",
          captureId,
          result: { success: false, message: "The captured company, role, or page URL is invalid." },
        }, window.location.origin);
        return;
      }
      void api.post<Application>("/applications/capture", parsed.data)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ["applications"] });
          void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          window.postMessage({
            type: "APPLYPILOT_CAPTURE_RESULT",
            captureId,
            result: { success: true, message: "Saved to ApplyPilot. Repeated captures update the existing job." },
          }, window.location.origin);
        })
        .catch((error: unknown) => {
          window.postMessage({
            type: "APPLYPILOT_CAPTURE_RESULT",
            captureId,
            result: { success: false, message: error instanceof Error ? error.message : "Could not capture this job." },
          }, window.location.origin);
        });
    };
    window.addEventListener("message", handleExtensionCapture);
    return () => window.removeEventListener("message", handleExtensionCapture);
  }, [user, queryClient]);

  useEffect(() => {
    void (async () => {
      try {
        await initializeCsrf();
        const result = await api.get<{ user: User }>("/auth/me");
        setUser(result.user);
      } catch (error) {
        if (error && typeof error === "object" && "status" in error && error.status === 401) return;
        setBootError(error instanceof Error ? error.message : "Unable to connect to ApplyPilot");
      }
    })();
  }, []);

  const params = new URLSearchParams({ page: "1", pageSize: "30", sort: "updatedAt", order: "desc" });
  if (search.trim()) params.set("q", search.trim());
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<Dashboard>("/dashboard"),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!openPopover) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPopover(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [openPopover]);
  const applicationsQuery = useQuery({
    queryKey: ["applications", search, statusFilter],
    queryFn: () => api.get<ApplicationList>(`/applications?${params.toString()}`),
    enabled: Boolean(user),
  });
  const dashboardInsightsQuery = useQuery({
    queryKey: ["toolkit", "insights"],
    queryFn: () => api.get<ToolkitInsights>("/toolkit/insights"),
    enabled: Boolean(user) && activeNav === "Overview",
  });
  const interviewPrepsQuery = useQuery({
    queryKey: ["toolkit", "interview-preps"],
    queryFn: () => api.get<InterviewPrep[]>("/toolkit/interview-preps"),
    enabled: Boolean(user) && activeNav === "Overview",
  });

  const refreshData = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const logoutMutation = useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      setUser(null);
      setOpenPopover(null);
      setReadNotificationIds([]);
    },
  });

  if (!user) {
    if (bootError) {
      return <main className="connection-error"><div className="auth-icon"><CircleHelp /></div><h1>We couldn't reach ApplyPilot</h1><p>{bootError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></main>;
    }
    if (authMode === "home") {
      return <LandingPage onSignIn={() => setAuthMode("signin")} onCreateAccount={() => setAuthMode("register")} theme={theme} onToggleTheme={toggleTheme} />;
    }
    return <AuthScreen
      initialRegistering={authMode === "register"}
      theme={theme}
      onToggleTheme={toggleTheme}
      onHome={() => setAuthMode("home")}
      onAuthenticated={(authenticatedUser) => { setBootError(""); setUser(authenticatedUser); }}
    />;
  }

  const dashboard = dashboardQuery.data;
  const applications = applicationsQuery.data?.items ?? [];
  const greetingName = user.name.split(" ")[0] || user.name;
  const isPipeline = activeNav === "Pipeline";
  const isToolkitPage = activeNav === "Resume library" || activeNav === "Interview prep" || activeNav === "Insights";
  const pageDate = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" })
    .format(new Date())
    .toUpperCase();
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const recentNotifications = dashboard?.recentActivity ?? [];
  const unreadNotificationCount = recentNotifications.filter((event) => !readNotificationIds.includes(event.id)).length;
  const openApplications = () => {
    setStatusFilter("ALL");
    setActiveNav("Applications");
  };
  const openPipelineStatus = (status: Status | "ALL") => {
    setStatusFilter(status);
    setActiveNav("Applications");
  };
  const upcomingItems = [
    ...(dashboard?.upcomingFollowUps ?? []).map((item) => ({
      id: `follow-up-${item.id}`,
      title: item.nextAction || "Application follow-up",
      company: item.companyName,
      role: item.role,
      date: item.followUpAt,
      kind: "follow-up" as const,
    })),
    ...(interviewPrepsQuery.data ?? [])
      .filter((prep) => prep.scheduledAt && new Date(prep.scheduledAt).getTime() >= Date.now())
      .map((prep) => ({
        id: `interview-${prep.id}`,
        title: prep.title,
        company: prep.application?.companyName ?? "Interview preparation",
        role: prep.application?.role ?? "",
        date: prep.scheduledAt,
        kind: "interview" as const,
      })),
  ].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()).slice(0, 4);
  const topCompanies = applications.reduce<{ name: string; count: number }[]>((companies, application) => {
    const company = companies.find((entry) => entry.name === application.companyName);
    if (company) company.count += 1;
    else companies.push({ name: application.companyName, count: 1 });
    return companies;
  }, []).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCompanyCount = Math.max(1, ...topCompanies.map((company) => company.count));
  const markNotificationsRead = () => {
    const nextReadIds = [...new Set([...readNotificationIds, ...recentNotifications.map((event) => event.id)])];
    setReadNotificationIds(nextReadIds);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="sidebar-brand" href="#" onClick={(event) => { event.preventDefault(); setActiveNav("Overview"); }}><span className="brand-mark"><Target size={18} /></span><span>applypilot</span></a>
        <div className="workspace-switch"><div className="workspace-icon">{initials(user.name)}</div><div className="workspace-name"><strong>{user.name}</strong><span>Personal workspace</span></div><ChevronDown size={15} /></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={`nav-item ${activeNav === "Overview" ? "selected" : ""}`} onClick={() => setActiveNav("Overview")}><LayoutDashboard size={17} /> Dashboard</button>
          <button className={`nav-item ${activeNav === "Applications" ? "selected" : ""}`} onClick={() => setActiveNav("Applications")}><BriefcaseBusiness size={17} /> Applications<span className="nav-count">{dashboard?.totals.total ?? 0}</span></button>
          <button className={`nav-item ${activeNav === "Pipeline" ? "selected" : ""}`} onClick={() => setActiveNav("Pipeline")}><ListFilter size={17} /> Pipeline</button>
        </nav>
        <p className="nav-caption tools-caption">YOUR TOOLKIT</p>
        <nav className="main-nav" aria-label="Job search tools">
          <button className={`nav-item ${activeNav === "Resume library" ? "selected" : ""}`} onClick={() => setActiveNav("Resume library")}><FileText size={17} /> Resume library</button>
          <button className={`nav-item ${activeNav === "Interview prep" ? "selected" : ""}`} onClick={() => setActiveNav("Interview prep")}><CalendarDays size={17} /> Interview prep</button>
          <button className={`nav-item ${activeNav === "Insights" ? "selected" : ""}`} onClick={() => setActiveNav("Insights")}><TrendingUp size={17} /> Insights</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="weekly-card"><div className="weekly-icon"><Target size={16} /></div><strong>Small steps add up.</strong><p>Every application is progress. Keep your momentum going.</p><div className="weekly-progress"><span /></div><small>{dashboard?.totals.total ?? 0} applications tracked</small></div>
          <button className="nav-item help-item" onClick={() => window.open("mailto:support@applypilot.local", "_blank")}><CircleHelp size={17} /> Help & feedback</button>
          <div className="sidebar-profile-anchor">
            <button
              className="profile-button"
              aria-expanded={openPopover === "sidebar-profile"}
              aria-haspopup="menu"
              onClick={() => setOpenPopover((current) => current === "sidebar-profile" ? null : "sidebar-profile")}
            >
              <div className="profile-avatar">{initials(user.name)}</div>
              <div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div>
              <ChevronDown size={16} />
            </button>
            {openPopover === "sidebar-profile" && <ProfileMenu
              user={user}
              onSignOut={() => void logoutMutation.mutate()}
              isSigningOut={logoutMutation.isPending}
              errorMessage={logoutMutation.error?.message ?? ""}
            />}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <label className="top-search">
            <Search size={16} />
            <input
              ref={searchInputRef}
              type="search"
              aria-label="Search applications, companies, and roles"
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                if (value.trim()) setActiveNav("Applications");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && search.trim()) setActiveNav("Applications");
              }}
              placeholder="Search applications, companies, roles..."
            />
            {search
              ? <button type="button" className="top-search-clear" aria-label="Clear search" onClick={() => { setSearch(""); searchInputRef.current?.focus(); }}><X size={14} /></button>
              : <kbd>Ctrl K</kbd>}
          </label>
          <div className="topbar-actions">
            <div className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className="topbar-popover-anchor">
              <button
                type="button"
                className="top-icon"
                aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ""}`}
                aria-expanded={openPopover === "notifications"}
                aria-controls="notifications-panel"
                onClick={() => setOpenPopover((current) => current === "notifications" ? null : "notifications")}
              >
                <Bell size={17} />
                {unreadNotificationCount > 0 && <span className="notification-count">{unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}</span>}
              </button>
              {openPopover === "notifications" && <section className="notifications-popover" id="notifications-panel" aria-label="Recent notifications">
                <div className="popover-heading">
                  <div><strong>Notifications</strong><span>{unreadNotificationCount ? `${unreadNotificationCount} unread updates` : "You're all caught up"}</span></div>
                  <button type="button" className="mark-read-button" onClick={markNotificationsRead} disabled={!unreadNotificationCount}><CircleCheck size={14} /> Mark all read</button>
                </div>
                {dashboardQuery.isPending
                  ? <div className="popover-empty"><LoaderCircle className="spin" size={18} /> Loading activity…</div>
                  : dashboardQuery.isError
                    ? <div className="popover-empty" role="alert">{dashboardQuery.error.message}</div>
                    : recentNotifications.length
                      ? <div className="notification-list">{recentNotifications.map((event) => {
                        const unread = !readNotificationIds.includes(event.id);
                        return <button
                          type="button"
                          className={`notification-item${unread ? " unread" : ""}`}
                          key={event.id}
                          onClick={() => {
                            setReadNotificationIds((current) => current.includes(event.id) ? current : [...current, event.id]);
                            setStatusFilter(event.toStatus);
                            setActiveNav("Applications");
                            setOpenPopover(null);
                          }}
                        >
                          <span className={`activity-icon activity-${event.toStatus.toLowerCase()}`}>{event.toStatus === "INTERVIEW" ? <CalendarDays size={15} /> : event.toStatus === "OFFER" ? <Sparkles size={15} /> : <BriefcaseBusiness size={15} />}</span>
                          <span className="notification-copy">
                            <strong>{event.toStatus === event.fromStatus || !event.fromStatus ? "Application added" : `Moved to ${statusNames[event.toStatus]}`}</strong>
                            <span>{event.application.companyName} · {event.application.role}</span>
                            <small>{formatRelative(event.createdAt)}</small>
                          </span>
                          {unread && <i className="notification-unread-dot" />}
                        </button>;
                      })}</div>
                      : <div className="popover-empty"><Bell size={19} /><strong>No activity yet</strong><span>Application updates will show up here.</span></div>}
              </section>}
            </div>
            <div className="topbar-popover-anchor">
              <button
                type="button"
                className="top-user-avatar"
                aria-label={`Open account menu for ${user.name}`}
                aria-expanded={openPopover === "header-profile"}
                aria-haspopup="menu"
                onClick={() => setOpenPopover((current) => current === "header-profile" ? null : "header-profile")}
              >{initials(user.name)}</button>
              {openPopover === "header-profile" && <ProfileMenu
                user={user}
                onSignOut={() => void logoutMutation.mutate()}
                isSigningOut={logoutMutation.isPending}
                errorMessage={logoutMutation.error?.message ?? ""}
              />}
            </div>
          </div>
        </header>
        <div className="page-content">
          <div className="dashboard-content" hidden={isToolkitPage}>
          {activeNav === "Overview" ? <section className="dashboard-hero">
            <div className="dashboard-hero-copy"><p>GOOD {greeting.slice(5).toUpperCase()},</p><h1>{greetingName}<span className="hero-wave">✳</span></h1><span>Stay consistent. Your next opportunity is closer than you think.</span></div>
            <div className="hero-lettering">New opportunities<br />ahead <ArrowRight size={19} /></div>
            <div className="hero-cityline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="hero-traveler" aria-hidden="true"><span /><i /></div>
            <div className="dashboard-hero-quote"><Sparkles size={16} /><strong>A little progress every day adds up to big results.</strong><TrendingUp size={22} /></div>
          </section> : <div className="welcome-row">
            <div><p className="eyebrow muted-eyebrow">{isPipeline ? "YOUR JOB SEARCH AT A GLANCE" : pageDate}</p><h1>{isPipeline ? "Your pipeline." : "Your applications."}</h1><p className="welcome-subtitle">{isPipeline ? "Every opportunity, one clear next step." : "The opportunities you're working toward."}</p></div>
            <button className="primary-button add-button" onClick={() => setShowAdd(true)}><Plus size={17} /> Add application</button>
          </div>}

          {(dashboardQuery.isError || applicationsQuery.isError) && <div className="error-banner" role="alert"><CircleHelp size={17} />{dashboardQuery.error?.message ?? applicationsQuery.error?.message ?? "Could not load your data."}<button onClick={() => refreshData()}>Retry</button></div>}

          <section className="stats-grid" aria-label="Application metrics">
            <button type="button" className="stat-card stat-card-button" onClick={openApplications}><div className="stat-card-top"><span>Total applications</span><span className="stat-icon icon-lilac"><FileText size={17} /></span></div><div className="stat-number">{dashboardQuery.isPending ? "—" : dashboard?.totals.total ?? 0}</div><div className="stat-foot"><span className="stat-positive"><TrendingUp size={12} /> {dashboard?.totals.active ?? 0} active</span></div><div className="stat-spark spark-purple"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><ArrowRight className="stat-arrow" size={14} /></button>
            <button type="button" className="stat-card stat-card-button" onClick={() => setActiveNav("Insights")}><div className="stat-card-top"><span>Interview rate</span><span className="stat-icon icon-blue"><Users size={17} /></span></div><div className="stat-number">{dashboardQuery.isPending ? "—" : `${dashboard?.totals.interviewConversionRate ?? 0}%`}</div><div className="stat-foot"><span className="stat-positive"><TrendingUp size={12} /> Reached interview</span></div><div className="stat-spark spark-blue"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><ArrowRight className="stat-arrow" size={14} /></button>
            <button type="button" className="stat-card stat-card-button" onClick={() => setActiveNav("Insights")}><div className="stat-card-top"><span>Offer rate</span><span className="stat-icon icon-peach"><Target size={17} /></span></div><div className="stat-number">{dashboardQuery.isPending ? "—" : `${dashboard?.totals.interviewToOfferRate ?? 0}%`}</div><div className="stat-foot"><span className="stat-neutral">Interview to offer</span></div><div className="stat-spark spark-orange"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><ArrowRight className="stat-arrow" size={14} /></button>
            <button type="button" className="stat-card stat-card-button" onClick={() => setStatusFilter("ALL")}><div className="stat-card-top"><span>Active applications</span><span className="stat-icon icon-mint"><Target size={17} /></span></div><div className="stat-number">{dashboardQuery.isPending ? "—" : dashboard?.totals.active ?? 0}</div><div className="stat-foot"><span className="stat-positive"><CalendarDays size={12} /> {dashboard?.totals.upcomingFollowUps ?? 0} upcoming follow-ups</span></div><div className="stat-spark spark-green"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><ArrowRight className="stat-arrow" size={14} /></button>
          </section>

          {activeNav === "Overview" && <section className="dashboard-main-grid">
            <div className="dashboard-primary-column">
              <ApplicationPipeline
                applications={applications}
                statuses={dashboard?.statuses}
                isLoading={applicationsQuery.isPending}
                onAdd={() => setShowAdd(true)}
                onUpdated={refreshData}
                onStatusClick={openPipelineStatus}
              />
              <section className="reference-panel dashboard-analytics">
                <div className="reference-panel-heading"><div><h2>Application analytics</h2><p>Visualize your job search progress over the last six months.</p></div><button type="button" className="subtle-link" onClick={() => setActiveNav("Insights")}>View analytics <ArrowRight size={14} /></button></div>
                {dashboardInsightsQuery.isPending
                  ? <div className="analytics-loading"><LoaderCircle className="spin" size={18} /> Calculating your analytics…</div>
                  : dashboardInsightsQuery.isError
                    ? <div className="analytics-loading" role="alert">{dashboardInsightsQuery.error.message}</div>
                    : <div className="analytics-months">{(dashboardInsightsQuery.data?.monthlyApplications ?? []).map((month) => {
                      const max = Math.max(1, ...(dashboardInsightsQuery.data?.monthlyApplications.map((entry) => entry.count) ?? [1]));
                      return <div className="analytics-month" key={month.key}><strong>{month.count}</strong><div><i style={{ height: `${month.count ? Math.max(10, (month.count / max) * 100) : 3}%` }} /></div><span>{month.label}</span></div>;
                    })}</div>}
              </section>
            </div>
            <aside className="dashboard-side-column">
              <section className="reference-panel upcoming-panel">
                <div className="reference-panel-heading"><div><h2>Upcoming</h2><p>Follow-ups and interview prep.</p></div><button type="button" className="subtle-link" onClick={() => setActiveNav("Interview prep")}>View all <ArrowRight size={14} /></button></div>
                {interviewPrepsQuery.isError && <p className="side-panel-error" role="alert">{interviewPrepsQuery.error.message}</p>}
                {dashboardQuery.isError && <p className="side-panel-error" role="alert">{dashboardQuery.error.message}</p>}
                {upcomingItems.length
                  ? <div className="upcoming-list">{upcomingItems.map((item) => <article className="upcoming-item" key={item.id}>
                    <span className={`upcoming-icon ${item.kind}`}><CalendarDays size={16} /></span>
                    <div><strong>{item.company}</strong><span>{item.title}{item.role ? ` · ${item.role}` : ""}</span><small>{item.date ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.date)) : "Date not set"}</small></div>
                  </article>)}</div>
                  : <div className="upcoming-empty"><CalendarDays size={19} /><strong>No upcoming items</strong><span>Add a follow-up or schedule interview prep to see it here.</span><button type="button" className="subtle-link" onClick={() => setActiveNav("Interview prep")}>Plan interview prep <ArrowRight size={13} /></button></div>}
              </section>
              <section className="reference-panel quick-actions-panel">
                <div className="reference-panel-heading"><div><h2>Quick actions</h2><p>Keep your momentum going.</p></div></div>
                <div className="quick-action-grid">
                  <button type="button" onClick={() => setShowAdd(true)}><span className="quick-action-icon lilac"><Plus size={16} /></span>Add application</button>
                  <button type="button" onClick={() => setActiveNav("Resume library")}><span className="quick-action-icon blue"><FileText size={16} /></span>Resume library</button>
                  <button type="button" onClick={() => setActiveNav("Interview prep")}><span className="quick-action-icon peach"><CalendarDays size={16} /></span>Interview prep</button>
                  <button type="button" onClick={() => setActiveNav("Insights")}><span className="quick-action-icon mint"><TrendingUp size={16} /></span>View insights</button>
                </div>
              </section>
              <section className="reference-panel recent-activity-panel">
                <div className="reference-panel-heading"><div><h2>Recent activity</h2><p>Your latest job-search moves.</p></div><span className="activity-live"><i /> LIVE</span></div>
                {dashboardQuery.isPending
                  ? <div className="analytics-loading"><LoaderCircle className="spin" size={17} /></div>
                  : dashboard?.recentActivity.length
                    ? <div className="activity-list">{dashboard.recentActivity.slice(0, 3).map((event) => <div className="activity-item" key={event.id}><span className={`activity-icon activity-${event.toStatus.toLowerCase()}`}>{event.toStatus === "INTERVIEW" ? <Users size={14} /> : <BriefcaseBusiness size={14} />}</span><div className="activity-copy"><strong>{event.toStatus === event.fromStatus || !event.fromStatus ? "Application added" : `Moved to ${statusNames[event.toStatus]}`}</strong><span>{event.application.companyName} · {event.application.role}</span></div><time>{formatRelative(event.createdAt)}</time></div>)}</div>
                    : <div className="recent-empty">Your application updates will appear here.</div>}
              </section>
            </aside>
            <section className="reference-panel top-companies-panel">
              <div className="reference-panel-heading"><div><h2>Top companies</h2><p>Companies with the most applications in your current results.</p></div><Building2 size={17} /></div>
              {topCompanies.length
                ? <div className="top-company-list">{topCompanies.map((company) => <div className="top-company-row" key={company.name}><span className="board-company-mark">{company.name.slice(0, 1).toUpperCase()}</span><strong>{company.name}</strong><div><i style={{ width: `${(company.count / maxCompanyCount) * 100}%` }} /></div><small>{company.count}</small></div>)}</div>
                : <div className="recent-empty">Company insights appear after you add applications.</div>}
            </section>
          </section>}

          {isPipeline && <ApplicationPipeline
            applications={applications}
            statuses={dashboard?.statuses}
            isLoading={applicationsQuery.isPending}
            onAdd={() => setShowAdd(true)}
            onUpdated={refreshData}
            onStatusClick={openPipelineStatus}
          />}

          {activeNav === "Overview" && <div className="dashboard-integrations"><GmailSyncCard /></div>}

          {activeNav === "Applications" && <section className="panel applications-panel">
            <div className="applications-heading"><div><div className="panel-heading-title"><h2>All applications</h2><span className="record-count">{applicationsQuery.data?.pagination.total ?? 0}</span></div><p>Search your opportunities and update their status.</p></div><div className="table-actions"><label className="filter-field"><ListFilter size={15} /><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | "ALL")}><option value="ALL">All statuses</option>{statusOrder.map((status) => <option key={status} value={status}>{statusNames[status]}</option>)}</select><ChevronDown size={13} /></label><button className="table-add" aria-label="Add application" onClick={() => setShowAdd(true)}><Plus size={17} /></button></div></div>
            {applicationsQuery.isPending ? <div className="table-loading"><LoaderCircle className="spin" size={21} /> Loading applications…</div> : applications.length ? <><div className="table-header"><span>COMPANY</span><span>ROLE</span><span>STATUS</span><span /></div><div className="application-list">{applications.map((application) => <AppRow key={application.id} application={application} onUpdated={refreshData} />)}</div>{applicationsQuery.data && applicationsQuery.data.pagination.total > 30 && <button className="view-all-button" onClick={() => setActiveNav("Pipeline")}>Open pipeline <ArrowRight size={15} /></button>}</> : <div className="applications-empty"><div className="empty-icon"><BriefcaseBusiness size={19} /></div><strong>{search || statusFilter !== "ALL" ? "No applications match that search" : "Your next opportunity is waiting"}</strong><span>{search || statusFilter !== "ALL" ? "Try a different search or filter." : "Add your first application and keep all the details in one place."}</span>{!search && statusFilter === "ALL" && <button className="secondary-button" onClick={() => setShowAdd(true)}><Plus size={15} /> Add your first application</button>}</div>}
          </section>}

          <footer className="page-footer"><span>Made for the next step <span className="footer-heart">✳</span></span><span>Keep going — you've got this.</span></footer>
          </div>
          {activeNav === "Resume library" && <ResumeLibraryPage />}
          {activeNav === "Interview prep" && <InterviewPrepPage />}
          {activeNav === "Insights" && <InsightsPage />}
        </div>
      </main>
      {showAdd && <ApplicationModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); refreshData(); }} />}
    </div>
  );
}

export default App;
