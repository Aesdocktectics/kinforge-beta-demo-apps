import {
  Archive,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Database,
  Dna,
  Download,
  FileText,
  Filter,
  FolderTree,
  Globe2,
  History,
  Image,
  Keyboard,
  Lightbulb,
  Languages,
  Menu,
  Mic,
  Eye,
  LayoutDashboard,
  Link2,
  Map,
  Network,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Type,
  Upload,
  Users,
  Wand2,
  XCircle,
  X,
  LogOut,
  Undo2,
  Redo2
} from "lucide-react";
import { Link } from "react-router-dom";
import { ChangeEvent, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BURIAL_TYPE_OPTIONS,
  CHART_TYPES,
  ChartConfig,
  CustomFactTermCategory,
  createEmptyPerson,
  createSeedState,
  DnaMatch,
  emptyCharacterProfile,
  emptyDeathDetails,
  emptyIdentityDetails,
  emptyMedicalRecord,
  EVENT_TYPES,
  FAMILY_TYPE_OPTIONS,
  FACT_TYPES,
  characterSpeciesLine,
  fullName,
  LANGUAGES,
  languageLabel,
  makeId,
  MediaItem,
  MedicalRecord,
  nowIso,
  Person,
  PersonEvent,
  PRIVACY_FIELDS,
  RECORD_COLLECTIONS,
  RELATIONSHIP_SUBTYPE_OPTIONS,
  Source
} from "./domain";
import {
  buildAutoClusters,
  buildChromosomeRows,
  buildEvidenceDashboard,
  buildResearchQuestions,
  EvidenceScore,
  buildSmartFilters,
  findDuplicateCandidates,
  getChildren,
  getParents,
  getPartners,
  hasAncestryCycle,
  peopleInTree,
  runPlausibilityChecks,
  timelineItems
} from "./analysis";
import { exportGedcom, mergeImportedPeople, parseGedcom } from "./gedcom";
import { buildBackup, buildWebsiteExport, downloadBlob, exportText } from "./exporters";
import { PUBLIC_EXPORT_COPYRIGHT, PUBLIC_EXPORT_CREDIT, PUBLIC_EXPORT_PERMISSION, recordPublicExportAgreement } from "./exportAttribution";
import { LEGAL_EFFECTIVE_DATE, PRIVACY_POLICY_SECTIONS, TERMS_CONDITIONS_SECTIONS, recordAppLegalAgreement } from "./legalPolicies";
import { COMPETITIVE_UPGRADES, COMPETITOR_SWOT, FEATURE_MATRIX, featureSummary, FeatureStatus } from "./features";
import { activeUser, AuthState, createAccount, loadAuthState, login, resetPassword, saveAuthState } from "./auth";
import { ViewKey, useWorkspaceNavigation, workspacePath } from "./workspace";
import { TreeWorkspace } from "./TreeWorkspace";
import { FamiliesWorkspace, PeopleWorkspace } from "./PeopleWorkspace";
import { linkPeople, syncFamilyMembership } from "./treeGraph";
import { EventGlyph, Glyph, SymbolLegend } from "./Glyph";
import { GLYPHS, glyphMatchesQuery, type GlyphGroup } from "./glyphs";
import { ArchiveKind, linkLocalRecord, searchLocalArchive } from "./localResearch";
import { RequirementsRegister } from "./RequirementsRegister";
import { MAINTENANCE_ACTIONS, MaintenanceAction, MaintenancePlan, planMaintenance } from "./maintenance";
import { ReportWorkspace } from "./ReportWorkspace";
import { applyDeletion, DeleteKind, DeleteTarget, planDeletion } from "./deletion";
import { DeleteItemDialog, ItemActions, SavedItemsDialog } from "./ItemActions";
import { ProtectionPanel } from "./ProtectionPanel";
import { defaultEventPrivacy, defaultSensitiveVisibility, SENSITIVE_VISIBILITY_LABELS } from "./protection";
import { TermMeaning, TermsDialog } from "./TermsDialog";
import { ReligiousTermsDialog } from "./ReligiousTermsDialog";
import { meaningFor, searchTerms } from "./terms";
import { buildItemDownload } from "./itemDownloads";
import {
  ACCESSIBILITY_AID_OPTIONS,
  catalogCriteria,
  catalogForFactType,
  DEGENERATIVE_CONDITION_OPTIONS,
  DISABILITY_CONDITION_OPTIONS,
  IDENTITY_OPTIONS,
  MEDICAL_RECORD_TYPE_OPTIONS,
  MENTAL_HEALTH_OPTIONS,
  MENTAL_HEALTH_SUPPORT_OPTIONS,
  OTHER_OPTION,
  PHYSICAL_CONDITION_OPTIONS,
  isSensitiveFactType
} from "./personFactCatalog";
import { hydrateLibrary } from "./libraryState";
import { addLibraryCollection, collectionDescendants, collectionHierarchy, collectionOptions, ensureTreeSubcollection, moveLibraryCollection, subcollectionOptions, type CollectionBranch } from "./libraryHierarchy";
import { recordUpdateAgentSignal } from "./updateAgent";
import { privateAccessStatus, readPrivateAccessSettings, savePrivateAccessSettings, type PrivateAccessMode } from "./privateAccess";

const STORAGE_KEY = "kinforge-genealogy-studio-v1";
const COPYRIGHT_NOTICE = "Copyright 2026 Dreams of Serene Landscapes. All rights reserved.";

const NAV: Array<{ id: ViewKey; label: string; icon: ReactNode }> = [
  { id: "tree", label: "Family Tree", icon: <Network size={18} /> },
  { id: "my-family-tree", label: "My Family Tree", icon: <Network size={18} /> },
  { id: "photos", label: "My Photos", icon: <Image size={18} /> },
  { id: "import-gedcom", label: "Import GEDCOM", icon: <Upload size={18} /> },
  { id: "manage-trees", label: "Manage Trees", icon: <FolderTree size={18} /> },
  { id: "print-books", label: "Print Charts & Books", icon: <Printer size={18} /> },
  { id: "infographics", label: "Family Infographics", icon: <ChartNoAxesCombined size={18} /> },
  { id: "consistency", label: "Consistency Checker", icon: <Shield size={18} /> },
  { id: "timeline", label: "Timeline", icon: <History size={18} /> },
  { id: "pedigree-map", label: "PedigreeMap\u2122", icon: <Map size={18} /> },
  { id: "relationship-report", label: "Relationship Report", icon: <FileText size={18} /> },
  { id: "sources", label: "Sources", icon: <Archive size={18} /> },
  { id: "backup", label: "Backup", icon: <Download size={18} /> },
  { id: "people", label: "People", icon: <Users size={18} /> },
  { id: "families", label: "Families", icon: <Link2 size={18} /> },
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "library", label: "Library", icon: <FolderTree size={18} /> },
  { id: "places", label: "Places & Sources", icon: <Map size={18} /> },
  { id: "research", label: "Research", icon: <Search size={18} /> },
  { id: "kinforge-ai", label: "KinForge AI", icon: <Sparkles size={18} /> },
  { id: "ai", label: "AI Studio", icon: <Wand2 size={18} /> },
  { id: "translator-ai", label: "Translator AI", icon: <Languages size={18} /> },
  { id: "helpdesk-ai", label: "Helpdesk AI", icon: <CircleHelp size={18} /> },
  { id: "contact", label: "Contact Us", icon: <Languages size={18} /> },
  { id: "support", label: "Support Form", icon: <ClipboardList size={18} /> },
  { id: "private-access", label: "Private Access", icon: <Globe2 size={18} /> },
  { id: "media", label: "Media", icon: <Image size={18} /> },
  { id: "ideas", label: "Ideas & Feedback", icon: <Lightbulb size={18} /> },
  { id: "glyphs", label: "Glyph Library", icon: <Sparkles size={18} /> },
  { id: "accessibility", label: "Accessibility", icon: <Eye size={18} /> },
  { id: "charts", label: "Charts", icon: <ChartNoAxesCombined size={18} /> },
  { id: "reports", label: "Reports", icon: <FileText size={18} /> },
  { id: "publish", label: "Publish & GEDCOM", icon: <Download size={18} /> },
  { id: "dna", label: "DNA", icon: <Dna size={18} /> },
  { id: "maintenance", label: "Maintenance", icon: <Database size={18} /> },
  { id: "strategy", label: "Competitive Edge", icon: <Trophy size={18} /> },
  { id: "coverage", label: "Feature Coverage", icon: <ClipboardList size={18} /> }
];

const RELATIONSHIP_LABELS = ["parent-child", "spouse", "partner", "guardian", "sibling", "relative"] as const;
const APP_TRANSLATIONS: Record<string, Record<string, string>> = {
  "zh": { "Family Tree": "家谱", "Manage Trees": "管理家谱", "Reports": "报告", "Charts": "图表", "Accessibility": "辅助功能", "Settings": "设置", "App language": "应用语言", "Translator AI": "翻译 AI" },
  "zh-Hans": { "Family Tree": "家谱", "Manage Trees": "管理家谱", "Reports": "报告", "Charts": "图表", "Accessibility": "辅助功能", "Settings": "设置", "App language": "应用语言", "Translator AI": "翻译 AI" },
  "zh-Hant": { "Family Tree": "家譜", "Manage Trees": "管理家譜", "Reports": "報告", "Charts": "圖表", "Accessibility": "輔助使用", "Settings": "設定", "App language": "應用語言", "Translator AI": "翻譯 AI" },
  "ja": { "Family Tree": "家系図", "Manage Trees": "家系図を管理", "Reports": "レポート", "Charts": "チャート", "Accessibility": "アクセシビリティ", "Settings": "設定", "App language": "アプリの言語", "Translator AI": "翻訳 AI" },
  "ko": { "Family Tree": "가계도", "Manage Trees": "가계도 관리", "Reports": "보고서", "Charts": "차트", "Accessibility": "접근성", "Settings": "설정", "App language": "앱 언어", "Translator AI": "번역 AI" },
  "ms": { "Family Tree": "Salasilah keluarga", "Manage Trees": "Urus salasilah", "Reports": "Laporan", "Charts": "Carta", "Accessibility": "Kebolehcapaian", "Settings": "Tetapan", "App language": "Bahasa aplikasi", "Translator AI": "AI Penterjemah" },
  "id": { "Family Tree": "Silsilah keluarga", "Manage Trees": "Kelola silsilah", "Reports": "Laporan", "Charts": "Bagan", "Accessibility": "Aksesibilitas", "Settings": "Pengaturan", "App language": "Bahasa aplikasi", "Translator AI": "AI Penerjemah" },
  "fr": { "Family Tree": "Arbre familial", "Manage Trees": "Gerer les arbres", "Reports": "Rapports", "Charts": "Graphiques", "Accessibility": "Accessibilite", "Settings": "Parametres", "App language": "Langue de l'app", "Translator AI": "IA de traduction" },
  "de": { "Family Tree": "Stammbaum", "Manage Trees": "Stammbaeume verwalten", "Reports": "Berichte", "Charts": "Diagramme", "Accessibility": "Barrierefreiheit", "Settings": "Einstellungen", "App language": "App-Sprache", "Translator AI": "Uebersetzer-KI" },
  "es": { "Family Tree": "Arbol familiar", "Manage Trees": "Gestionar arboles", "Reports": "Informes", "Charts": "Graficos", "Accessibility": "Accesibilidad", "Settings": "Ajustes", "App language": "Idioma de la app", "Translator AI": "IA traductora" }
};
const DATE_MODES = [
  ["full", "Full date"],
  ["month", "Month and year"],
  ["year", "Year only"],
  ["range", "Date range"],
  ["qualified", "Qualified date"]
] as const;
const DATE_QUALIFIERS = ["About", "Before", "After", "Estimated", "Calculated"] as const;
const BIRTH_METHODS = ["", "Natural birth", "C-section", "Surrogacy", "Assisted reproduction", "Unknown", "Other"] as const;
const CARE_STATUSES = ["", "None recorded", "Associated", "Active", "Former", "Unknown"] as const;
const GOVERNMENT_FILE_TYPES = [
  "Criminal Record",
  "Foster Record",
  "Custody Change Record",
  "Removal Record",
  "Protective Services Record",
  "Personal Protection Order Record",
  "Restraining Order Record",
  "House Arrest Record",
  "Arrest Record",
  "Government Facility Record",
  "Government Protection Record",
  "Social Worker Record",
  "Doctor or Care Record",
  "In-patient Record",
  "Daycare Record",
  "Other Government File"
] as const;
const MEDICAL_FILE_TYPES = [
  "Diagnosis",
  "Diagnostic Criteria",
  "Diagnosis File",
  "Medical File",
  "Prescription File",
  "Treatment File",
  "Treatment Plan",
  "Referral Letter",
  "Doctor's Letter",
  "Specialist Report",
  "Psychological Assessment",
  "Psychiatric Assessment",
  "Occupational Therapy Assessment",
  "Physiotherapy Assessment",
  "Speech-Language Assessment",
  "Hospital Visit",
  "Discharge Summary",
  "Care Plan",
  "Medication Record",
  "Surgery or Procedure Record",
  "Imaging or Lab Report",
  "Therapy Record",
  "Other Medical Record"
] as const;
const WORK_FILE_TYPES = [
  "Work Contract",
  "Employment Contract",
  "Company File",
  "Employee File",
  "Job Offer",
  "Job Description",
  "Role Assignment",
  "Workplace Accommodation File",
  "Leave or Absence File",
  "Performance Review",
  "Promotion Record",
  "Pay or Payroll File",
  "Tax or Benefits File",
  "Company ID or Badge",
  "Union or Guild Record",
  "Workplace Incident File",
  "Termination or Resignation File",
  "Freelance Contract",
  "Agency Contract",
  "Character Workplace File",
  "Other Work or Company File"
] as const;
type AiGeneratorMode = "research" | "image" | "image-to-video" | "prompt-to-video" | "movie-clip" | "medical" | "work" | "biography";
const AI_GENERATOR_MODES: readonly { id: AiGeneratorMode; label: string; detail: string }[] = [
  { id: "research", label: "Research assistant", detail: "Questions, source checklist, terms to define, and next steps" },
  { id: "image", label: "Character image generator", detail: "Engine-ready image prompt, realism level, art style, and negative prompt" },
  { id: "image-to-video", label: "Image-to-video generator", detail: "Animate a portrait or source image into a short clip brief" },
  { id: "prompt-to-video", label: "Prompt-to-video generator", detail: "Create a video prompt, camera plan, sound notes, and continuity checklist" },
  { id: "movie-clip", label: "AI movie clip generator", detail: "Storyboard a live-action-style character scene with shots and timing" },
  { id: "medical", label: "Medical file draft generator", detail: "Draft a source-backed medical summary template without diagnosing" },
  { id: "work", label: "Work and company file generator", detail: "Draft contracts, company files, and character job records" },
  { id: "biography", label: "Fandom profile generator", detail: "Long-form character profile, relationships, appearance, and lore" }
];
const AI_IMAGE_STYLES = [
  "Photorealistic portrait",
  "Hyper-realistic live-action film still",
  "Cinematic fantasy realism",
  "Cinematic superhero realism",
  "Prestige drama realism",
  "Historical live-action realism",
  "Animated feature style",
  "Anime-inspired illustration",
  "Painterly book cover",
  "Editorial character sheet",
  "Graphic novel",
  "Watercolor portrait",
  "3D character render"
] as const;
const AI_REALISM_LEVELS = ["Stylized", "Semi-realistic", "Realistic", "Photo-realistic", "Hyper-realistic", "Live-action production realism"] as const;
const AI_IMAGE_MODELS = [
  "KinForge Image Engine 2026.09",
  "KinForge Photoreal Engine 2026.09",
  "KinForge Character Consistency Engine 2026.09",
  "KinForge Concept Art Engine 2026.09",
  "Monthly new model slot"
] as const;
const AI_VIDEO_MODELS = [
  "KinForge Video Engine 2026.09",
  "KinForge Image-to-Video Engine 2026.09",
  "KinForge Movie Clip Engine 2026.09",
  "KinForge Storyboard Engine 2026.09",
  "Monthly new video model slot"
] as const;
const AI_VIDEO_DURATIONS = ["4 seconds", "8 seconds", "12 seconds", "30 seconds", "60 seconds", "3 minutes"] as const;
const AI_VIDEO_FORMATS = ["16:9 cinematic", "9:16 phone video", "1:1 square", "4:5 portrait", "2.39:1 widescreen"] as const;
const AI_MOTION_LEVELS = ["Still portrait with subtle movement", "Gentle camera push", "Walking/talking clip", "Action scene", "Dialogue scene", "Montage"] as const;
const AI_ASSISTANT_ENGINES = [
  "KinForge Omni AI 2026.09",
  "KinForge Research AI 2026.09",
  "KinForge Genealogy Reasoner 2026.09",
  "KinForge Creative Worldbuilder 2026.09",
  "KinForge App Builder AI 2026.09",
  "KinForge Citation & Term Explainer 2026.09",
  "Monthly new assistant engine slot"
] as const;
const AI_ANSWER_MODES = [
  "Fast answer",
  "Deep research brief",
  "Cited evidence plan",
  "SWOT and competitor analysis",
  "Genealogy relationship reasoning",
  "Plain-language definition",
  "Creative character/lore expansion",
  "App coding and QA plan"
] as const;
const HELPDESK_AREAS = [
  "Sign in and account security",
  "Cloud library sync",
  "Books, collections and trees",
  "Family tree chart layout",
  "People, facts and records",
  "Reports and exports",
  "AI Studio",
  "KinForge AI",
  "Accessibility",
  "Mac app packaging",
  "Windows app",
  "Website and web app",
  "Bug report",
  "Feature request"
] as const;
const HELPDESK_URGENCY = ["Low", "Normal", "High", "Blocking"] as const;
const HELPDESK_RESPONSE_TYPES = ["Step-by-step fix", "Bug report draft", "Feature request draft", "Troubleshooting checklist", "User guide answer", "Release QA checklist"] as const;
const TRANSLATOR_MODES = ["Plain translation", "Genealogy report translation", "Cultural name note", "Term glossary", "App interface wording", "Sensitive-record translation checklist"] as const;
const TRANSLATOR_TONES = ["Natural and clear", "Formal report style", "Simple beginner wording", "Respectful cultural wording", "Literal with notes"] as const;
const MEDICAL_CONDITION_CATEGORIES = [
  "Mental health condition",
  "Mental health support need",
  "Physical condition",
  "Degenerative condition",
  "Disability or access need",
  "Mobility or accessibility aid"
] as const;
const DIAGNOSTIC_STANDARDS = [
  "",
  "DSM-5 / DSM-5-TR",
  "ICD-10",
  "ICD-11",
  "Clinical assessment",
  "Psychological assessment",
  "Psychiatric assessment",
  "Occupational therapy functional assessment",
  "Physiotherapy assessment",
  "Speech-language assessment",
  "Educational assessment",
  "Genetic test",
  "Imaging or lab report",
  "Hospital discharge summary",
  "Other / self-described"
] as const;
const CONDITION_OR_DISORDER_TYPES = [
  "",
  "Physical condition",
  "Physical disorder",
  "Mental health condition",
  "Mental disorder",
  "Psychological condition",
  "Psychiatric disorder",
  "Trauma-related condition",
  "Neurodevelopmental disorder",
  "Learning disability",
  "Developmental disability",
  "Neurological condition",
  "Neurological disorder",
  "Degenerative condition",
  "Genetic condition",
  "Congenital condition",
  "Autoimmune condition",
  "Chronic condition",
  "Pain condition",
  "Sensory disability",
  "Mobility disability",
  "Communication disability",
  "Cognitive disability",
  "Respiratory condition",
  "Cardiac condition",
  "Endocrine or metabolic condition",
  "Gastrointestinal condition",
  "Reproductive or hormonal condition",
  "Skin condition",
  "Rare disease",
  "Functional limitation",
  "Accessibility or aid need",
  "Other / self-described"
] as const;
const BODY_SYSTEM_OPTIONS = [
  "",
  "Brain and nervous system",
  "Mental health and behaviour",
  "Development and learning",
  "Muscles, bones, joints, and connective tissue",
  "Mobility, balance, and coordination",
  "Vision",
  "Hearing",
  "Speech, language, and communication",
  "Respiratory system",
  "Heart and circulation",
  "Digestive system",
  "Kidney and urinary system",
  "Endocrine and metabolic system",
  "Immune system",
  "Skin",
  "Blood and clotting",
  "Reproductive and hormonal system",
  "Pain, fatigue, and stamina",
  "Multiple body systems",
  "Other / self-described"
] as const;
const CONDITION_COURSE_OPTIONS = ["", "Acute", "Chronic", "Episodic", "Relapsing-remitting", "Progressive", "Degenerative", "Stable", "Improving", "In remission", "Resolved", "Unknown", "Other / self-described"] as const;
const CARE_LEVEL_OPTIONS = ["", "Self-managed", "Primary care", "Specialist care", "Therapy or rehabilitation", "Hospital outpatient", "Emergency care", "Inpatient care", "Residential care", "Palliative care", "Unknown", "Other / self-described"] as const;
const IDEA_CATEGORIES = ["Character arc", "Relationship dynamic", "Worldbuilding", "Timeline idea", "Scene idea", "Fandom article", "Headcanon", "Research question", "Medical or diagnostic term", "Research", "Other"] as const;
const IDEA_STATUSES = ["idea", "drafting", "canon", "archive"] as const;
const FEEDBACK_TYPES = ["bug", "feature", "accessibility", "confusing", "performance", "other"] as const;
const FEEDBACK_STATUSES = ["new", "reviewing", "planned", "done", "archived"] as const;
const FEEDBACK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const FONT_OPTIONS = [
  ["system", "System font"],
  ["hyperlegible", "Hyperlegible"],
  ["dyslexia", "Dyslexia-friendly"],
  ["dysgraphia", "Dysgraphia-friendly"],
  ["serif", "Serif reading"],
  ["mono", "Monospace"]
] as const;
const TEXT_SCALE_OPTIONS = [
  ["normal", "Normal"],
  ["large", "Large"],
  ["extra-large", "Extra large"]
] as const;
const COLOR_VISION_OPTIONS = [
  ["standard", "Standard colors"],
  ["deuteranopia", "Green-red safe"],
  ["protanopia", "Red-safe"],
  ["tritanopia", "Blue-yellow safe"],
  ["monochrome", "Monochrome"],
  ["high-contrast", "High contrast"]
] as const;
const SYMBOL_MODE_OPTIONS = [
  ["standard", "Standard glyphs"],
  ["dyslexia", "Dyslexia-friendly labels"],
  ["dysgraphia", "Dysgraphia-friendly input"],
  ["low-vision", "Low-vision symbols"],
  ["text-first", "Text-first symbols"]
] as const;
const SYMBOL_SIZE_OPTIONS = [
  ["standard", "Standard"],
  ["large", "Large"],
  ["extra-large", "Extra large"]
] as const;
const GLYPH_GROUPS = Array.from(new Set(GLYPHS.map((glyph) => glyph.group))) as GlyphGroup[];

const mediaTypeForFile = (file: File): MediaItem["type"] => file.type.startsWith("image/")
  ? "picture"
  : file.type.startsWith("video/")
    ? "video"
    : file.type.startsWith("audio/")
      ? "audio"
      : file.type.includes("pdf")
        ? "pdf"
        : "document";

const medicalOptionsForCategory = (category: string) => category === "Mental health condition"
  ? MENTAL_HEALTH_OPTIONS
  : category === "Mental health support need"
    ? MENTAL_HEALTH_SUPPORT_OPTIONS
    : category === "Degenerative condition"
      ? [...DEGENERATIVE_CONDITION_OPTIONS, ...PHYSICAL_CONDITION_OPTIONS.filter(entry => ["Parkinson's disease", "Multiple sclerosis (MS)", "Muscular dystrophy", "Osteoarthritis"].includes(entry.label))]
      : category === "Disability or access need"
        ? DISABILITY_CONDITION_OPTIONS
        : category === "Mobility or accessibility aid"
          ? ACCESSIBILITY_AID_OPTIONS
          : [...PHYSICAL_CONDITION_OPTIONS, ...DEGENERATIVE_CONDITION_OPTIONS];

const factTypeForMedicalCategory = (category: string) => category === "Mental health condition"
  ? "Mental health condition"
  : category === "Mental health support need"
    ? "Mental health support need"
    : category === "Degenerative condition"
      ? "Degenerative condition"
      : category === "Disability or access need"
        ? "Disability or Access Need"
        : category === "Mobility or accessibility aid"
          ? "Mobility Aid"
          : "Physical condition";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return hydrateLibrary(JSON.parse(raw) as AppState);
  } catch {
    return createSeedState();
  }
  return createSeedState();
}

type CloudApp = { state: AppState; account: { id: string; name: string; email: string }; onChange: (state: AppState) => void; onSave: (state: AppState) => void | Promise<void>; toolbar: ReactNode; ownerMenu?: ReactNode; onSignOut: () => void; readOnly: boolean; saved: boolean; demo: boolean; canManagePrivacy: boolean };
function App({ cloud }: { cloud?: CloudApp }) {
  const [history, setHistory] = useState<{ present: AppState; past: AppState[]; future: AppState[] }>(() => ({ present: cloud ? cloud.state : loadState(), past: [], future: [] }));
  const lastIncoming = useRef(cloud?.state);
  const remotePending = useRef<AppState | null>(null);
  const state = history.present;
  const [storageError, setStorageError] = useState("");
  const setState = (updater: (previous: AppState) => AppState) => setHistory(previous => ({ present: updater(previous.present), past: [...previous.past, previous.present].slice(-50), future: [] }));
  const undo = () => setHistory(previous => previous.past.length ? { present: previous.past[previous.past.length - 1], past: previous.past.slice(0, -1), future: [previous.present, ...previous.future] } : previous);
  const redo = () => setHistory(previous => previous.future.length ? { present: previous.future[0], past: [...previous.past, previous.present], future: previous.future.slice(1) } : previous);
  const { route, go, setView, setSelectedTreeId, setSelectedPersonId, openPerson } = useWorkspaceNavigation(state);
  const view = route.view;
  const selectedTreeId = route.treeId;
  const selectedPersonId = route.personId;
  const [auth, setAuth] = useState<AuthState>(() => loadAuthState());
  const [authMode, setAuthMode] = useState<"login" | "create" | "forgot">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", recoveryHint: "", recoveryCode: "", newPassword: "", privacyAccepted: false, termsAccepted: false });
  const [authError, setAuthError] = useState("");
  const [guestMode, setGuestMode] = useState(() => sessionStorage.getItem("kinforge-guest") === "true");
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsedCollections, setCollapsedCollections] = useState<Set<string>>(() => new Set());
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedReportType, setSelectedReportType] = useState("Person Report");
  const [reportMode, setReportMode] = useState<"report" | "list">("report");
  const [chartUndo, setChartUndo] = useState<ChartConfig[]>([]);
  const [chartRedo, setChartRedo] = useState<ChartConfig[]>([]);
  const [gedcomText, setGedcomText] = useState("");
  const [gedcomPreview, setGedcomPreview] = useState<{ people: Person[]; relationships: ReturnType<typeof parseGedcom>["relationships"] } | null>(null);
  const [hideLiving, setHideLiving] = useState(true);
  const [hidePrivate, setHidePrivate] = useState(true);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [subsetPersonId, setSubsetPersonId] = useState("");
  const [searchReplace, setSearchReplace] = useState({ find: "", replace: "" });
  const [maintenanceAction, setMaintenanceAction] = useState<MaintenanceAction>("Search and replace");
  const [maintenancePreview, setMaintenancePreview] = useState<{ plan: MaintenancePlan; baseline: AppState; treeId: string } | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [dnaSideFilter, setDnaSideFilter] = useState("all");
  const [featureFilter, setFeatureFilter] = useState<"all" | FeatureStatus>("all");
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveKind, setArchiveKind] = useState<ArchiveKind | "all">("all");
  const [researchError, setResearchError] = useState("");
  const [newFact, setNewFact] = useState({ type: FACT_TYPES[0], value: "", customValue: "" });
  const [newEvent, setNewEvent] = useState({ type: EVENT_TYPES[0], date: "", description: "" });
  const [newRelationship, setNewRelationship] = useState({ type: "parent-child", targetId: "" });
  const [medicalFileKind, setMedicalFileKind] = useState<(typeof MEDICAL_FILE_TYPES)[number]>("Diagnosis");
  const [workFileKind, setWorkFileKind] = useState<(typeof WORK_FILE_TYPES)[number]>("Work Contract");
  const [medicalRecordDraft, setMedicalRecordDraft] = useState({
    type: "Diagnosis record",
    conditionCategory: "Mental health condition",
    conditionType: "",
    disorderType: "",
    bodySystem: "",
    diagnosisName: "",
    customDiagnosisName: "",
    diagnosisDate: "",
    onsetDate: "",
    reviewDate: "",
    diagnosticStandard: "",
    criteriaMet: "",
    symptomsOrTraits: "",
    functionalImpact: "",
    course: "",
    progression: "",
    triggers: "",
    riskFactors: "",
    differentialDiagnosis: "",
    comorbidities: "",
    complications: "",
    hereditaryOrFamilyHistory: "",
    prognosis: "",
    careLevel: "",
    emergencyPlan: "",
    hospitalOrClinic: "",
    diagnosingDoctor: "",
    psychologist: "",
    psychiatrist: "",
    occupationalTherapist: "",
    assistiveDevice: "",
    customAssistiveDevice: ""
  });
  const [selectedDictionaryText, setSelectedDictionaryText] = useState("");
  const [aiDraft, setAiDraft] = useState({
    mode: "research" as AiGeneratorMode,
    personId: "",
    prompt: "",
    output: "",
    imageStyle: "Hyper-realistic live-action film still",
    realism: "Hyper-realistic",
    imageModel: "KinForge Photoreal Engine 2026.09",
    videoModel: "KinForge Video Engine 2026.09",
    videoDuration: "8 seconds",
    videoFormat: "16:9 cinematic",
    motion: "Gentle camera push",
    negativePrompt: "blurry, distorted hands, wrong age, wrong species, missing accessibility aids, incorrect clothing, inaccurate family symbols, text artifacts, watermark"
  });
  const [kinforgeAi, setKinforgeAi] = useState({
    engine: "KinForge Omni AI 2026.09",
    answerMode: "Deep research brief",
    personId: "",
    prompt: "",
    output: ""
  });
  const [helpdeskAi, setHelpdeskAi] = useState({
    area: "Cloud library sync",
    urgency: "Normal",
    responseType: "Step-by-step fix",
    issue: "",
    stepsTried: "",
    output: ""
  });
  const [translatorAi, setTranslatorAi] = useState({
    sourceLanguage: "auto",
    targetLanguage: "en",
    mode: "Plain translation",
    tone: "Natural and clear",
    text: "",
    notes: "",
    output: ""
  });
  const [supportForm, setSupportForm] = useState({
    name: "",
    email: cloud?.account.email || "",
    type: "Support request",
    subject: "",
    message: "",
    device: "",
    proof: "",
    permissionToReply: true,
    includeDiagnostics: true
  });
  const [supportMessage, setSupportMessage] = useState("");
  const [privateAccess, setPrivateAccess] = useState(() => readPrivateAccessSettings());
  const [customTypeDraft, setCustomTypeDraft] = useState({ familyType: "", relationshipSubtype: "" });
  const [dateModes, setDateModes] = useState({ birth: "full", death: "full", burial: "full", event: "full" });
  const [governmentFileKind, setGovernmentFileKind] = useState<(typeof GOVERNMENT_FILE_TYPES)[number]>("Protective Services Record");
  const [ideaDraft, setIdeaDraft] = useState({ title: "", category: "Character arc", personId: "", tags: "", body: "" });
  const [feedbackDraft, setFeedbackDraft] = useState({ title: "", type: "feature", priority: "normal", personId: "", body: "" });
  const [glyphQuery, setGlyphQuery] = useState("");
  const [glyphGroup, setGlyphGroup] = useState<GlyphGroup | "All">("All");
  const [dictationScratch, setDictationScratch] = useState("");
  const [dictationMessage, setDictationMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [itemMessage, setItemMessage] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [religiousTermsOpen, setReligiousTermsOpen] = useState(false);
  const [customFactTermDraft, setCustomFactTermDraft] = useState<{ category: CustomFactTermCategory; term: string; meaning: string }>({ category: "Religion", term: "", meaning: "" });
  const canManagePrivacy = !cloud || cloud.demo || cloud.canManagePrivacy;
  const appLanguage = state.accessibility?.appLanguage || "en";
  const translate = (text: string) => APP_TRANSLATIONS[appLanguage]?.[text] || APP_TRANSLATIONS[appLanguage.split("-")[0]]?.[text] || text;

  useLayoutEffect(() => {
    if (cloud && cloud.state !== lastIncoming.current) {
      lastIncoming.current = cloud.state;
      if (cloud.state !== state) { remotePending.current = cloud.state; setHistory({ present: cloud.state, past: [], future: [] }); }
    }
  }, [cloud?.state]);

  useLayoutEffect(() => {
    if (cloud) {
      if (remotePending.current) { if (state === remotePending.current) remotePending.current = null; return; }
      try { if (state !== cloud.state) cloud.onChange(state); setStorageError(""); }
      catch { setStorageError("Changes are only in this open window: device storage is full or unavailable. Download a backup before closing or reloading."); }
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); setStorageError(""); }
    catch { setStorageError("Changes are only in this open window: device storage is full or unavailable. Download a backup before closing or reloading."); }
  }, [state]);

  useEffect(() => {
    saveAuthState(auth);
  }, [auth]);

  useEffect(() => {
    savePrivateAccessSettings(privateAccess);
  }, [privateAccess]);

  const saveNow = async () => {
    try {
      if (cloud) {
        await cloud.onSave(state);
        setItemMessage(cloud.demo ? "Demo saved on this device." : "Save requested. KinForge is syncing this library to your cloud account.");
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setStorageError("");
        setItemMessage("Saved on this device.");
      }
    } catch {
      setStorageError("Save could not finish. Download a backup before closing or reloading.");
    }
  };

  useEffect(() => {
    document.documentElement.lang = appLanguage || "en";
  }, [appLanguage]);

  useEffect(() => {
    const captureSelection = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      const value = window.getSelection()?.toString().replace(/\s+/g, " ").trim() || "";
      if (value && value.length <= 80) setSelectedDictionaryText(value);
    };
    document.addEventListener("selectionchange", captureSelection);
    document.addEventListener("mouseup", captureSelection);
    document.addEventListener("keyup", captureSelection);
    return () => {
      document.removeEventListener("selectionchange", captureSelection);
      document.removeEventListener("mouseup", captureSelection);
      document.removeEventListener("keyup", captureSelection);
    };
  }, []);

  const tree = state.trees.find((item) => item.id === selectedTreeId) ?? state.trees[0];
  const treeId = tree?.id ?? "";
  const people = useMemo(() => peopleInTree(state, treeId), [state, treeId]);
  const person = people.find((item) => item.id === selectedPersonId) ?? people[0];
  const treeRelationships = state.relationships.filter((relationship) => relationship.treeId === treeId);
  const factCatalog = catalogForFactType(newFact.type, state.customFactTerms);
  const customGlossaryEntries = state.customFactTerms.map(entry => ({ term: entry.term, meaning: entry.meaning, category: entry.category, aliases: [], sourceIds: [] }));
  const identityTermOptions = [...new Set([...IDENTITY_OPTIONS.map(entry => entry.label), ...state.customFactTerms.filter(entry => entry.category === "Identity, sexuality, or gender").map(entry => entry.term)])];
  const needsAnalysis = ["dashboard", "maintenance", "consistency"].includes(view);
  const issues = useMemo(() => needsAnalysis ? runPlausibilityChecks(state, treeId) : [], [state, treeId, needsAnalysis]);
  const duplicatePairs = useMemo(() => needsAnalysis ? findDuplicateCandidates(state, treeId) : [], [state, treeId, needsAnalysis]);
  const evidenceDashboard = useMemo(() => needsAnalysis ? buildEvidenceDashboard(state, treeId) : null, [state, treeId, needsAnalysis]);
  const filters = useMemo(() => view === "dashboard" ? buildSmartFilters(state, treeId) : [], [state, treeId, view]);
  const currentPlace = state.places.find((item) => item.treeId === treeId && item.id === selectedPlaceId) ?? state.places.find((item) => item.treeId === treeId);
  const currentSource = state.sources.find((item) => item.treeId === treeId && item.id === selectedSourceId) ?? state.sources.find((item) => item.treeId === treeId);
  const currentMedia = state.media.find((item) => item.treeId === treeId && item.id === selectedMediaId) ?? state.media.find((item) => item.treeId === treeId);
  const summary = featureSummary();
  const user = cloud?.account ?? activeUser(auth);
  const selectedTermEntry = selectedDictionaryText ? searchTerms(selectedDictionaryText, customGlossaryEntries)[0] : undefined;
  const selectedTermMeaning = selectedDictionaryText ? meaningFor(selectedDictionaryText) || selectedTermEntry?.meaning : undefined;

  useEffect(() => {
    if (!user && !guestMode) return;
    const chartType = view === "timeline" ? "Timeline" : view === "infographics" ? "Name Distribution" : "";
    if (chartType && state.chartConfig.type !== chartType) {
      setHistory(previous => previous.present.chartConfig.type === chartType ? previous : ({
        ...previous,
        present: { ...previous.present, chartConfig: { ...previous.present.chartConfig, type: chartType } }
      }));
    }
    if (view === "relationship-report" && (reportMode !== "report" || selectedReportType !== "Kinship Report")) {
      setReportMode("report");
      setSelectedReportType("Kinship Report");
    }
    if (view === "print-books" && (reportMode !== "report" || selectedReportType !== "Family Tree Book")) {
      setReportMode("report");
      setSelectedReportType("Family Tree Book");
    }
  }, [guestMode, reportMode, selectedReportType, user, view]);

  if (!user && !guestMode) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        form={authForm}
        setForm={setAuthForm}
        error={authError}
        onGuest={() => {
          if (!authForm.privacyAccepted || !authForm.termsAccepted) {
            setAuthError("Click both I accept checkboxes to follow the KinForge Privacy Policy and Terms & Conditions before using the app.");
            return;
          }
          recordAppLegalAgreement();
          recordPublicExportAgreement();
          sessionStorage.setItem("kinforge-guest", "true");
          setGuestMode(true);
        }}
        onSubmit={() => {
          if (!authForm.privacyAccepted || !authForm.termsAccepted) {
            setAuthError("Click both I accept checkboxes to follow the KinForge Privacy Policy and Terms & Conditions before using the app.");
            return;
          }
          const result = authMode === "create"
            ? createAccount(auth, authForm.name, authForm.email, authForm.password, authForm.recoveryHint)
            : authMode === "forgot"
              ? resetPassword(auth, authForm.email, authForm.newPassword, authForm.recoveryCode)
              : login(auth, authForm.email, authForm.password);
          setAuth(result.state);
          setAuthError(result.error);
          const recoveryCode = "recoveryCode" in result ? result.recoveryCode : undefined;
          if (!result.error) {
            recordAppLegalAgreement();
            recordPublicExportAgreement();
          }
          if (!result.error && recoveryCode) {
            setAuthError(`Save this new secret recovery key: ${recoveryCode}`);
          } else if (!result.error && authMode === "forgot") {
            setAuthMode("login");
            setAuthError("Password reset locally. You can sign in now.");
          }
        }}
      />
    );
  }

  const mutate = (label: string, updater: (draft: AppState) => void) => {
    if (cloud?.readOnly) return;
    setState((previous) => {
      const draft = structuredClone(previous) as AppState;
      updater(draft);
      draft.changes.unshift({ id: makeId("change"), at: nowIso(), treeId, label });
      return draft;
    });
  };
  const familyTypeOptions = [...new Set([...(state.customFamilyTypes || []), ...FAMILY_TYPE_OPTIONS])];
  const requestDelete = (target: DeleteTarget) => { if (!cloud?.readOnly) setDeleteTarget(target); };
  const downloadItem = async (target: DeleteTarget) => {
    try {
      const file = buildItemDownload(state, target);
      const result = await downloadBlob(file.name, file.content as BlobPart, file.type);
      setItemMessage(result.status === "native-saved"
        ? `Saved ${file.name}${result.path ? ` to ${result.path}` : ""}. Keep this private copy secure.`
        : `Download started for ${file.name}. Check your browser downloads and keep this private copy secure.`);
    } catch (error) { setItemMessage(error instanceof Error ? error.message : "The download could not be created. Please try again."); }
  };
  const itemActions = (target: DeleteTarget, title: string) => <ItemActions target={target} title={title} onDelete={requestDelete} onDownload={downloadItem} readOnly={cloud?.readOnly} />;
  const confirmDeletion = () => {
    if (!deleteTarget || cloud?.readOnly) return;
    const plan = planDeletion(state, deleteTarget);
    if (!plan.exists) { setDeleteTarget(null); return; }
    const nextTreeId = plan.removed.trees?.has(treeId) ? state.trees.find(item => !plan.removed.trees!.has(item.id))?.id || "" : "";
    setState(previous => {
      const next = applyDeletion(previous, deleteTarget);
      if (next === previous) return previous;
      next.changes.unshift({ id: makeId("change"), at: nowIso(), label: `Deleted ${plan.title}` });
      return next;
    });
    if (plan.removed.trees?.has(treeId)) setSelectedTreeId(nextTreeId);
    setDeleteTarget(null);
    setMaintenancePreview(null);
    setItemMessage(`Deleted ${plan.title}. Undo is available until another device updates this library or you close this session.`);
  };
  const itemKind: DeleteKind = ({ people: "people", families: "families", research: "records", places: "places", sources: "sources", "pedigree-map": "places", media: "media", photos: "media", reports: "reportDrafts", "relationship-report": "reportDrafts", "print-books": "reportDrafts", timeline: "events", dna: "dnaMatches", maintenance: "todos" } as Partial<Record<ViewKey, DeleteKind>>)[view] || "trees";
  const relationshipSubtypeOptions = [...new Set([...(state.customRelationshipSubtypes || []), ...RELATIONSHIP_SUBTYPE_OPTIONS])];
  const rememberRelationshipSubtype = (draft: AppState, value?: string) => {
    const subtype = value?.trim();
    if (!subtype || RELATIONSHIP_SUBTYPE_OPTIONS.includes(subtype) || draft.customRelationshipSubtypes?.includes(subtype)) return;
    draft.customRelationshipSubtypes = [...(draft.customRelationshipSubtypes || []), subtype];
  };
  const addCustomFamilyType = (input?: string) => {
    const value = input ?? prompt("New family type");
    if (value?.trim()) mutate("Added family type", draft => {
      const label = value.trim();
      if (!FAMILY_TYPE_OPTIONS.includes(label) && !draft.customFamilyTypes?.includes(label)) draft.customFamilyTypes = [...(draft.customFamilyTypes || []), label];
    });
    if (input !== undefined) setCustomTypeDraft(previous => ({ ...previous, familyType: "" }));
  };
  const addCustomRelationshipSubtype = (input?: string) => {
    const value = input ?? prompt("New relationship sub-type");
    if (value?.trim()) mutate("Added relationship subtype", draft => rememberRelationshipSubtype(draft, value));
    if (input !== undefined) setCustomTypeDraft(previous => ({ ...previous, relationshipSubtype: "" }));
  };
  const addCustomFactTerm = () => {
    const term = customFactTermDraft.term.trim();
    const meaning = customFactTermDraft.meaning.trim();
    if (!term || !meaning) return;
    mutate("Added custom religious or wellbeing term", draft => {
      const duplicate = (draft.customFactTerms || []).some(entry => entry.category === customFactTermDraft.category && entry.term.toLocaleLowerCase() === term.toLocaleLowerCase());
      if (!duplicate) draft.customFactTerms = [...(draft.customFactTerms || []), { id: makeId("term"), category: customFactTermDraft.category, term, meaning }];
    });
    setCustomFactTermDraft(previous => ({ ...previous, term: "", meaning: "" }));
  };

  const updatePerson = (personId: string, updater: (person: Person) => void, label = "Updated person") => {
    mutate(label, (draft) => {
      const target = draft.people.find((item) => item.id === personId);
      if (target) updater(target);
    });
  };

  const updateTree = (updater: NonNullable<typeof tree> extends infer T ? (tree: T & { id: string }) => void : never, label = "Updated tree") => {
    mutate(label, (draft) => {
      const target = draft.trees.find((item) => item.id === treeId);
      if (target) updater(target);
    });
  };

  const addPerson = (relationship?: "parent" | "child" | "partner") => {
    if (!treeId) return;
    const created = createEmptyPerson(treeId);
    created.givenName = relationship ? `New ${relationship}` : "New";
    created.familyName = person?.familyName || "Person";
    created.branchColor = person?.branchColor || "#b88f98";
    mutate("Added person", (draft) => {
      draft.people.push(created);
      if (relationship && person) {
        if (relationship === "parent") {
          draft.relationships.push({ id: makeId("rel"), treeId, type: "parent-child", fromId: created.id, toId: person.id, sourceIds: [] });
        }
        if (relationship === "child") {
          draft.relationships.push({ id: makeId("rel"), treeId, type: "parent-child", fromId: person.id, toId: created.id, sourceIds: [] });
        }
        if (relationship === "partner") {
          draft.relationships.push({ id: makeId("rel"), treeId, type: "spouse", fromId: person.id, toId: created.id, sourceIds: [] });
        }
      }
    });
    go({ treeId, view: relationship ? "tree" : "people", personId: created.id, tab: relationship ? undefined : "edit" });
  };

  const addRelationship = () => {
    if (!person || !newRelationship.targetId || newRelationship.targetId === person.id) return;
    const type = newRelationship.type as (typeof RELATIONSHIP_LABELS)[number];
    if (type === "parent-child" && hasAncestryCycle(state.relationships, person.id, newRelationship.targetId)) {
      alert("That parent-child link would create an ancestry cycle.");
      return;
    }
    mutate("Added relationship", (draft) => {
      draft.relationships.push({ id: makeId("rel"), treeId, type, fromId: person.id, toId: newRelationship.targetId, sourceIds: [] });
    });
  };

  const addFact = () => {
    const value = newFact.value === OTHER_OPTION ? newFact.customValue.trim() : newFact.value.trim();
    if (!person || !value) return;
    updatePerson(person.id, (target) => {
      target.facts.push({ id: makeId("fact"), type: newFact.type, value, sourceIds: [], private: isSensitiveFactType(newFact.type) && canManagePrivacy });
    }, "Added fact");
    setNewFact({ ...newFact, value: "", customValue: "" });
  };

  const addEvent = () => {
    if (!person || !newEvent.description.trim()) return;
    const event: PersonEvent = {
      id: makeId("event"),
      type: newEvent.type,
      date: newEvent.date,
      description: newEvent.description,
      private: defaultEventPrivacy(newEvent.type, canManagePrivacy),
      sourceIds: [],
      mediaIds: []
    };
    mutate("Added event", (draft) => {
      draft.events.push(event);
      const target = draft.people.find((item) => item.id === person.id);
      if (target) target.eventIds.push(event.id);
    });
    setNewEvent({ ...newEvent, date: "", description: "" });
  };

  const parseGedcomPreview = (text = gedcomText) => {
    const parsed = parseGedcom(text, treeId);
    setGedcomPreview(parsed);
  };

  const handleFileText = (event: ChangeEvent<HTMLInputElement>, callback: (text: string, file: File) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result ?? ""), file);
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleMediaUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: MediaItem = {
          id: makeId("media"),
          treeId,
          title: file.name,
          type: mediaTypeForFile(file),
          dataUrl: String(reader.result ?? ""),
          externalUrl: "",
          assignedTo: person ? [{ kind: "person", id: person.id }] : [],
          tags: [],
          rotation: 0,
          crop: "full image",
          colorized: false,
          enhanced: false,
          repaired: false,
          story: "",
          transcript: "",
          createdAt: nowIso()
        };
        mutate("Imported media", (draft) => {
          draft.media.push(item);
          if (person) {
            const target = draft.people.find((entry) => entry.id === person.id);
            if (target) target.mediaIds.push(item.id);
          }
        });
        setSelectedMediaId(item.id);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleGovernmentFileUpload = (target: Person, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: MediaItem = {
          id: makeId("media"),
          treeId,
          title: `${governmentFileKind}: ${file.name}`,
          type: mediaTypeForFile(file),
          dataUrl: String(reader.result ?? ""),
          externalUrl: "",
          assignedTo: [{ kind: "person", id: target.id }],
          tags: ["government-file", governmentFileKind],
          visibility: defaultSensitiveVisibility(canManagePrivacy),
          rotation: 0,
          crop: "full document",
          colorized: false,
          enhanced: false,
          repaired: false,
          story: `Sensitive file uploaded as ${governmentFileKind}.`,
          transcript: "",
          createdAt: nowIso()
        };
        mutate("Imported sensitive government file", (draft) => {
          draft.media.push(item);
          const personRecord = draft.people.find((entry) => entry.id === target.id);
          if (personRecord && !personRecord.mediaIds.includes(item.id)) personRecord.mediaIds.push(item.id);
        });
        setSelectedMediaId(item.id);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleMedicalFileUpload = (target: Person, recordId: string | undefined, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: MediaItem = {
          id: makeId("media"),
          treeId,
          title: `${medicalFileKind}: ${file.name}`,
          type: mediaTypeForFile(file),
          dataUrl: String(reader.result ?? ""),
          externalUrl: "",
          assignedTo: [{ kind: "person", id: target.id }],
          tags: ["medical-file", medicalFileKind],
          visibility: defaultSensitiveVisibility(canManagePrivacy),
          rotation: 0,
          crop: "full document",
          colorized: false,
          enhanced: false,
          repaired: false,
          story: `Sensitive medical file uploaded as ${medicalFileKind}.`,
          transcript: "",
          createdAt: nowIso()
        };
        mutate("Imported sensitive medical file", (draft) => {
          draft.media.push(item);
          const personRecord = draft.people.find((entry) => entry.id === target.id);
          if (personRecord && !personRecord.mediaIds.includes(item.id)) personRecord.mediaIds.push(item.id);
          const medicalRecord = recordId ? draft.medicalRecords?.find(record => record.id === recordId) : undefined;
          if (medicalRecord && !medicalRecord.mediaIds.includes(item.id)) {
            medicalRecord.mediaIds.push(item.id);
            medicalRecord.updatedAt = nowIso();
          }
        });
        setSelectedMediaId(item.id);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleWorkFileUpload = (target: Person, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: MediaItem = {
          id: makeId("media"),
          treeId,
          title: `${workFileKind}: ${file.name}`,
          type: mediaTypeForFile(file),
          dataUrl: String(reader.result ?? ""),
          externalUrl: "",
          assignedTo: [{ kind: "person", id: target.id }],
          tags: ["work-file", workFileKind],
          visibility: defaultSensitiveVisibility(canManagePrivacy),
          rotation: 0,
          crop: "full document",
          colorized: false,
          enhanced: false,
          repaired: false,
          story: `Work or company file uploaded as ${workFileKind}.`,
          transcript: "",
          createdAt: nowIso()
        };
        mutate("Imported work or company file", (draft) => {
          draft.media.push(item);
          const personRecord = draft.people.find((entry) => entry.id === target.id);
          if (personRecord && !personRecord.mediaIds.includes(item.id)) personRecord.mediaIds.push(item.id);
        });
        setSelectedMediaId(item.id);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const handleSharedLibraryUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item: MediaItem = {
          id: makeId("media"),
          treeId,
          title: file.name,
          type: mediaTypeForFile(file),
          dataUrl: String(reader.result ?? ""),
          externalUrl: "",
          assignedTo: [{ kind: "tree", id: treeId }],
          tags: ["shared-library"],
          rotation: 0,
          crop: "full file",
          colorized: false,
          enhanced: false,
          repaired: false,
          story: "Shared library file available to this family tree.",
          transcript: "",
          createdAt: nowIso()
        };
        mutate("Imported shared library file", (draft) => { draft.media.push(item); });
        setSelectedMediaId(item.id);
      };
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  };

  const previewMaintenance = () => {
    try {
      const plan = planMaintenance(state, treeId, maintenanceAction, searchReplace);
      setMaintenancePreview({ plan, baseline: state, treeId });
      setMaintenanceMessage(plan.changes.length ? `${plan.changes.length} proposed field or record changes.` : "No changes needed.");
    } catch (error) {
      setMaintenancePreview(null);
      setMaintenanceMessage(error instanceof Error ? error.message : "Unable to prepare maintenance.");
    }
  };

  const applyMaintenance = () => {
    if (!maintenancePreview) return;
    if (maintenancePreview.baseline !== state || maintenancePreview.treeId !== treeId) {
      setMaintenancePreview(null);
      setMaintenanceMessage("The tree changed. Preview the operation again before applying it.");
      return;
    }
    const { plan } = maintenancePreview;
    if (!plan.changes.length) return;
    setState(() => ({ ...plan.next, changes: [{ id: makeId("change"), at: nowIso(), treeId, label: `${maintenanceAction}: ${plan.changes.length} changes` }, ...plan.next.changes] }));
    setMaintenancePreview(null);
    setMaintenanceMessage(`Applied ${plan.changes.length} changes to ${tree?.title}.`);
  };

  const mergeFirstDuplicate = () => {
    const pair = duplicatePairs[0];
    if (!pair) return;
    mutate("Merged duplicate person", (draft) => {
      const keep = draft.people.find((entry) => entry.id === pair.a.id);
      const remove = draft.people.find((entry) => entry.id === pair.b.id);
      if (!keep || !remove) return;
      keep.aliases = Array.from(new Set([...keep.aliases, ...remove.aliases, fullName(remove)]));
      keep.facts = [...keep.facts, ...remove.facts.filter((fact) => !keep.facts.some((existing) => existing.type === fact.type && existing.value === fact.value))];
      if (remove.accessNeeds?.length) keep.accessNeeds = [...(keep.accessNeeds ?? []), ...remove.accessNeeds.map(need => ({ ...need, id: makeId("need") }))];
      keep.eventIds = Array.from(new Set([...keep.eventIds, ...remove.eventIds]));
      keep.sourceIds = Array.from(new Set([...keep.sourceIds, ...remove.sourceIds]));
      keep.mediaIds = Array.from(new Set([...keep.mediaIds, ...remove.mediaIds]));
      keep.notes = [keep.notes, remove.notes].filter(Boolean).join("\n");
      draft.relationships.forEach((rel) => {
        if (rel.fromId === remove.id) rel.fromId = keep.id;
        if (rel.toId === remove.id) rel.toId = keep.id;
      });
      draft.people = draft.people.filter((entry) => entry.id !== remove.id);
    });
  };

  const createEvidenceTodo = (entry: EvidenceScore, action: string) => {
    mutate("Created evidence review task", (draft) => draft.todos.push({
      id: makeId("todo"),
      treeId,
      personId: entry.person.id,
      title: `${fullName(entry.person)}: ${action}`,
      status: "open",
      priority: entry.score < 50 ? "high" : "normal",
      dueDate: ""
    }));
    setMaintenanceMessage(`Created a research task for ${fullName(entry.person)}.`);
  };

  const createTree = () => {
    const id = makeId("tree");
    mutate("Created family tree", (draft) => {
      if (!draft.books.length) draft.books.push({ id: makeId("book"), title: "My genealogy book", description: "" });
      const subcollection = ensureTreeSubcollection(draft, draft.books[0].id);
      draft.trees.push({
        id,
        bookId: subcollection?.bookId ?? draft.books[0].id,
        collectionId: subcollection?.id,
        title: "New family tree",
        author: "",
        authorContact: "",
        language: "en",
        citationStyle: "Evidence Explained",
        privacy: "private",
        createdAt: nowIso()
      });
    });
    setSelectedTreeId(id);
  };

  const createBook = () => {
    mutate("Created book", (draft) => {
      draft.books.push({ id: makeId("book"), title: "New genealogy book", description: "A book can hold multiple collections and family trees." });
    });
  };

  const createCollection = (bookId: string, parentId?: string) => {
    mutate(parentId ? "Created subcollection" : "Created collection", draft => { addLibraryCollection(draft, bookId, parentId); });
    if (parentId) setCollapsedCollections(previous => { const next = new Set(previous); next.delete(parentId); return next; });
  };

  const createPlace = () => {
    const id = makeId("place");
    mutate("Created place", (draft) => {
      draft.places.push({
        id,
        treeId,
        name: "New place",
        templateId: draft.placeTemplates[0]?.id ?? "",
        address: "",
        levels: {},
        latitude: "",
        longitude: "",
        pointsOfInterest: "",
        wikipediaTitle: "",
        mediaIds: [],
        sourceIds: [],
        notes: ""
      });
    });
    setSelectedPlaceId(id);
  };

  const createSource = () => {
    const id = makeId("source");
    mutate("Created source", (draft) => {
      draft.sources.push({
        id,
        treeId,
        title: "New source",
        templateId: draft.sourceTemplates[0]?.id ?? "",
        fields: {},
        citation: "",
        url: "",
        mediaIds: [],
        notes: ""
      });
    });
    setSelectedSourceId(id);
  };

  const createDnaMatch = () => {
    const id = makeId("dna");
    mutate("Added DNA match", (draft) => {
      draft.dnaMatches.push({
        id,
        treeId,
        personId: person?.id,
        matchName: "New DNA match",
        sharedCm: 0,
        predictedRelationship: "",
        surnames: [],
        locations: [],
        geneticGroups: [],
        ethnicity: "",
        side: "unknown",
        segments: [],
        notes: ""
      });
    });
  };

  const updateChartConfig = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    setChartUndo((items) => [state.chartConfig, ...items].slice(0, 100));
    setChartRedo([]);
    mutate("Updated chart configuration", (draft) => {
      draft.chartConfig[key] = value;
    });
  };

  const updateAccessibility = <K extends keyof AppState["accessibility"]>(key: K, value: AppState["accessibility"][K]) => {
    mutate("Updated accessibility settings", (draft) => {
      draft.accessibility = { ...state.accessibility, ...(draft.accessibility || {}), [key]: value };
    });
  };

  const openReportType = (type: string) => {
    setReportMode("report");
    setSelectedReportType(type);
    setView("reports");
  };

  const openChartType = (type: string) => {
    updateChartConfig("type", type);
    setView("charts");
  };

  const treeSources = state.sources.filter((source) => source.treeId === treeId);
  const treeRecords = state.records.filter((record) => record.treeId === treeId);
  const treeTodos = state.todos.filter((todo) => todo.treeId === treeId);
  const treeDnaMatches = state.dnaMatches.filter((match) => match.treeId === treeId);
  const treeMedia = state.media.filter((media) => media.treeId === treeId);
  const focusParents = person ? getParents(state, person.id) : [];
  const focusPartners = person ? getPartners(state, person.id) : [];
  const focusChildren = person ? getChildren(state, person.id) : [];
  const focusPortrait = person?.profileMediaId ? state.media.find((media) => media.id === person.profileMediaId) : undefined;
  const glyphGroups = GLYPH_GROUPS;
  const glyphLibraryPath = (group?: GlyphGroup) => `./glyphs/index.html${group ? `?group=${encodeURIComponent(group)}` : ""}`;
  const matchingGlyphs = GLYPHS.filter((glyph) => (glyphGroup === "All" || glyph.group === glyphGroup) && glyphMatchesQuery(glyph, glyphQuery));

  const interfaceActions = [
    { label: "Tree workspace", detail: "Branching chart, relatives, fan and genealogy views", icon: <Network size={18} />, badge: `${people.length} people`, action: () => setView("tree") },
    { label: "Person profile", detail: "Overview, timeline, access needs, media and edit panes", icon: <Users size={18} />, badge: person ? fullName(person) : "Select", action: () => person ? openPerson(person.id) : setView("people") },
    { label: "Research hints", detail: "Questions, archive search and record linking", icon: <Search size={18} />, badge: `${person ? buildResearchQuestions(state, person).length : 0} hints`, action: () => setView("research") },
    { label: "Sources and places", detail: "Citations, templates, coordinates and globe context", icon: <Map size={18} />, badge: `${treeSources.length} sources`, action: () => setView("places") },
    { label: "Fan and charts", detail: "Fan, hourglass, relationship, timeline and name charts", icon: <ChartNoAxesCombined size={18} />, badge: state.chartConfig.type, action: () => openChartType("Fan Chart") },
    { label: "Reports and books", detail: "Mac-style report drafts, kinship, lists and family books", icon: <FileText size={18} />, badge: "Editable", action: () => openReportType("Family Tree Book") },
    { label: "DNA clusters", detail: "Matches, AutoClusters, chromosome browser and sides", icon: <Dna size={18} />, badge: `${treeDnaMatches.length} matches`, action: () => setView("dna") },
    { label: "Publish package", detail: "Website, GEDCOM, privacy export, backup and installers", icon: <Download size={18} />, badge: tree?.privacy ?? "private", action: () => setView("publish") }
  ];

  const discoveryInbox = [
    { label: "Plausibility", detail: "Dates, ages and relationship contradictions", count: issues.length, icon: <Shield size={16} />, action: () => setView("maintenance") },
    { label: "Duplicates", detail: "Possible duplicate people to compare and merge", count: duplicatePairs.length, icon: <Users size={16} />, action: () => setView("maintenance") },
    { label: "Evidence review", detail: "People needing sources, media or privacy review", count: evidenceDashboard?.needsReview.length || 0, icon: <CheckCircle2 size={16} />, action: () => {
      const first = evidenceDashboard?.needsReview[0]?.person;
      if (first) go({ treeId, view: "maintenance", personId: first.id });
      else setView("maintenance");
    } },
    { label: "Records", detail: "Local historical records ready to link", count: treeRecords.length, icon: <Archive size={16} />, action: () => setView("research") },
    { label: "DNA leads", detail: "Matches and chromosome segments to place", count: treeDnaMatches.length, icon: <Dna size={16} />, action: () => setView("dna") },
    { label: "Open tasks", detail: "Research and cleanup work still active", count: treeTodos.filter((todo) => todo.status !== "done").length, icon: <ClipboardList size={16} />, action: () => setView("dashboard") }
  ];

  const interfaceLanes = [
    { label: "Explore", detail: "Tree, people, families and profile navigation", accent: "teal", icon: <Network size={18} />, action: () => setView("tree") },
    { label: "Discover", detail: "Hints, archive search, records and local research", accent: "blue", icon: <Search size={18} />, action: () => setView("research") },
    { label: "Prove", detail: "Sources, evidence score, plausibility and duplicates", accent: "gold", icon: <Shield size={18} />, action: () => setView("maintenance") },
    { label: "Visualize", detail: "Fan, genealogy, relationship and distribution charts", accent: "purple", icon: <ChartNoAxesCombined size={18} />, action: () => openChartType("Relationship Chart") },
    { label: "Present", detail: "Reports, family book, timelines and editable drafts", accent: "rust", icon: <FileText size={18} />, action: () => openReportType("Person Report") },
    { label: "Preserve", detail: "Privacy export, GEDCOM, backup and family website", accent: "green", icon: <Archive size={18} />, action: () => setView("publish") }
  ];

  const reportShortcuts = [
    { label: "Person report", detail: "Profile, facts, timeline, photos, sources and kinship notes", type: "Person Report" },
    { label: "Family report", detail: "Household, partners, children, events, sources and family notes", type: "Family Report" },
    { label: "Relationship report", detail: "Kinship paths, cousin removals, in-laws and relationship explanation", type: "Kinship Report" },
    { label: "Other reports", detail: "Lists, charts, books, plausibility, sources, places and history", type: "Family Tree Book" }
  ];

  const aiPerson = people.find(entry => entry.id === aiDraft.personId) || person;
  const aiPersonName = fullName(aiPerson);
  const aiPersonFacts = aiPerson?.facts.filter(fact => !fact.private || canManagePrivacy || aiPerson.sensitiveVisibility === "shared") || [];
  const aiCharacter = { ...emptyCharacterProfile(), ...(aiPerson?.characterProfile || {}) };
  const aiIdentity = { ...emptyIdentityDetails(), ...(aiPerson?.identity || {}) };
  const aiMedicalRecords = (state.medicalRecords || []).filter(record => record.treeId === treeId && record.personId === aiPerson?.id && (canManagePrivacy || record.visibility === "shared"));
  const aiLines = (items: (string | undefined)[]) => items.map(item => item?.trim()).filter(Boolean).join("\n");
  const aiBullet = (label: string, value?: string) => value?.trim() ? `- ${label}: ${value.trim()}` : "";
  const aiPromptSeed = aiDraft.prompt.trim();
  const buildAiDraft = (mode: AiGeneratorMode) => {
    const terms = searchTerms(aiPromptSeed || aiPersonName, customGlossaryEntries).slice(0, 6);
    const factsText = aiPersonFacts.map(fact => `${fact.type}: ${fact.value}${fact.date ? ` (${fact.date})` : ""}`).join("; ") || "No visible facts recorded.";
    const identityText = [aiIdentity.pronouns, aiIdentity.genderIdentity, aiIdentity.genderExpression, aiIdentity.sexualOrientation, aiIdentity.romanticOrientation, ...aiIdentity.identityLabels].filter(Boolean).join("; ") || "No visible identity notes recorded.";
    const medicalText = aiMedicalRecords.map(record => `${record.diagnosisName || record.type}: ${record.conditionType || record.conditionCategory || "type not recorded"}; diagnosed ${record.diagnosisDate || "date not recorded"}; criteria/source notes: ${record.criteriaMet || record.diagnosticCriteria || "not recorded"}`).join("\n") || "No visible medical records recorded.";
    const appearance = aiLines([
      aiBullet("Name", aiPersonName),
      aiBullet("Species", characterSpeciesLine(aiPerson) || aiCharacter.species || aiCharacter.speciesName),
      aiBullet("Hybrid lineage", aiCharacter.hybrid ? aiCharacter.hybridLineage || "Hybrid recorded" : ""),
      aiBullet("Appearance", aiCharacter.appearance),
      aiBullet("Personality", aiCharacter.personality),
      aiBullet("Personality style", aiCharacter.personalityStyle || aiCharacter.subcultureAesthetic),
      aiBullet("Aesthetic keywords", aiCharacter.aestheticKeywords),
      aiBullet("Abilities", aiCharacter.abilities),
      aiBullet("Culture or fandom source", aiCharacter.culture || aiCharacter.fandomSource),
      aiBullet("Identity notes", identityText),
      aiBullet("User prompt", aiPromptSeed)
    ]);
    if (mode === "image") return `KINFORGE CHARACTER IMAGE GENERATION SPEC

Generator model: ${aiDraft.imageModel}
Art style: ${aiDraft.imageStyle}
Realism level: ${aiDraft.realism}
Accuracy target: preserve recorded species, age clues, appearance, disability/accessibility aids, clothing/aesthetic, relationship glyphs, and family-tree continuity.

Prompt:
Create a ${aiDraft.realism.toLowerCase()} ${aiDraft.imageStyle.toLowerCase()} of ${aiPersonName}. Use the saved character data below as the canon source. Make the character look accurate to the family-tree profile, not generic.

${appearance || "- No character appearance details recorded yet."}

Composition:
- Framing: respectful character portrait or production still, eye-level, clear face, natural proportions.
- Lighting: cinematic soft key light with realistic skin, hair, fabric, and material detail.
- Continuity: keep age, species, profile facts, accessibility aids, and symbols consistent with KinForge records.
- Output goal: one accurate character image suitable for a profile picture, report portrait, or character sheet.

Negative prompt:
${aiDraft.negativePrompt}

Model update requirement:
- Every monthly KinForge app update should add a new image engine/model option, keep earlier model choices available in saved prompts, and note what changed in the update log.`;
    if (mode === "image-to-video") return `KINFORGE IMAGE-TO-VIDEO GENERATION SPEC

Generator model: ${aiDraft.videoModel}
Source image: use the selected/profile image for ${aiPersonName}, or attach a new image in Media first.
Clip length: ${aiDraft.videoDuration}
Format: ${aiDraft.videoFormat}
Motion: ${aiDraft.motion}
Visual style: ${aiDraft.imageStyle}
Realism level: ${aiDraft.realism}

Animation prompt:
Animate ${aiPersonName}'s source image into a short ${aiDraft.realism.toLowerCase()} scene. Preserve the face, species, body shape, profile picture identity, accessibility aids, clothing, and character markings. Add natural breathing, subtle expression change, realistic hair/fabric movement, and camera motion that does not distort the identity.

Canon data:
${appearance || "- No appearance details recorded yet."}

Continuity locks:
- Do not change species, age impression, gender expression, disability/accessibility aids, skin tone, scars, mobility aids, or symbolic markings.
- Do not add text, watermark, unrelated family symbols, or inaccurate medical details.

Negative prompt:
${aiDraft.negativePrompt}`;
    if (mode === "prompt-to-video") return `KINFORGE PROMPT-TO-VIDEO GENERATION SPEC

Generator model: ${aiDraft.videoModel}
Clip length: ${aiDraft.videoDuration}
Format: ${aiDraft.videoFormat}
Motion type: ${aiDraft.motion}
Style: ${aiDraft.imageStyle}
Realism: ${aiDraft.realism}

Video prompt:
Create a ${aiDraft.videoDuration} ${aiDraft.videoFormat} ${aiDraft.realism.toLowerCase()} video of ${aiPersonName}. Scene request: ${aiPromptSeed || "quiet character introduction scene"}. Keep the character consistent with the saved KinForge profile.

Character continuity:
${appearance || "- No appearance details recorded yet."}

Camera and sound:
- Camera: stable cinematic movement, no identity drift, no sudden face changes.
- Lighting: realistic, readable, not overly dark.
- Audio notes: optional ambient sound only unless dialogue is explicitly requested.
- Subtitles/captions: include if dialogue is generated, for accessibility.

Negative prompt:
${aiDraft.negativePrompt}`;
    if (mode === "movie-clip") return `KINFORGE AI MOVIE CLIP SPEC

Model: ${aiDraft.videoModel}
Style target: ${aiDraft.imageStyle}
Realism target: ${aiDraft.realism}
Clip: ${aiDraft.videoDuration}, ${aiDraft.videoFormat}

Scene logline:
${aiPromptSeed || `${aiPersonName} appears in a cinematic live-action character moment that introduces their role, personality, and world.`}

Shot plan:
1. Establishing shot: location and mood connected to ${aiPersonName}'s profile.
2. Medium shot: ${aiPersonName}'s appearance, clothing, species traits, and accessibility aids are clear.
3. Close-up: expression and personality beat, no identity drift.
4. Action/detail insert: object, glyph, relationship symbol, medical/access aid, or fandom-relevant item if recorded.
5. Closing shot: holds on the character for profile continuity.

Saved profile canon:
${appearance || "- No character profile details recorded yet."}

Production rules:
- Hyper-realistic/live-action means believable lighting, anatomy, camera, wardrobe, and practical effects style.
- Do not copy a copyrighted franchise character; use genre cues only.
- Maintain KinForge canon details and privacy settings.

Negative prompt:
${aiDraft.negativePrompt}`;
    if (mode === "medical") return `KINFORGE MEDICAL FILE DRAFT

Important: This is a draft template for organising records. It is not a diagnosis, treatment instruction, official certificate, prescription, or replacement for a clinician.

Person: ${aiPersonName}
Visible facts: ${factsText}

Existing diagnosis/condition records:
${medicalText}

Draft sections to complete from sources:
- Reason for file:
- Diagnosis or condition name exactly as written in the source:
- Condition/disorder type:
- Date of diagnosis:
- Diagnostic standard or criteria used:
- Criteria met, test results, or clinician wording:
- Symptoms, traits, or functional impact:
- Hospital/clinic:
- Diagnosing doctor:
- Psychologist:
- Psychiatrist:
- Occupational therapist:
- Other clinicians:
- Medications or prescriptions on file:
- Therapies or treatment files:
- Mobility/accessibility/disability aids:
- Accommodations:
- Emergency plan:
- Attachments to add: diagnosis file, prescription file, treatment file, assessment report, hospital letter, lab/imaging file.

Questions to verify with a clinician/source:
- Which criteria were actually recorded?
- Is the diagnosis current, historical, provisional, or ruled out?
- What should remain private versus visible to shared library members?`;
    if (mode === "work") return `KINFORGE WORK / COMPANY FILE DRAFT

Person or character: ${aiPersonName}
Prompt: ${aiPromptSeed || "Create a structured work/company file from the saved profile."}

Profile clues:
${appearance || "- No character workplace details recorded yet."}

Draft fields:
- File type: work contract / employment contract / company file / guild file / character workplace file
- Company, guild, agency, or employer:
- Role/title:
- Start date:
- End date:
- Duties:
- Pay/benefits/contract terms:
- Supervisor, manager, handler, or team:
- Workplace accommodations:
- Confidentiality or sensitive clauses:
- Linked sources/files:
- Story or genealogy notes:

Use this as a draft only; legal employment contracts need review by a qualified person.`;
    if (mode === "biography") return `KINFORGE FANDOM-STYLE PROFILE DRAFT

Name: ${aiPersonName}
Species line: ${characterSpeciesLine(aiPerson) || "Not recorded"}
Identity/pronouns: ${identityText}

Appearance:
${aiCharacter.appearance || "Not recorded."}

Personality and style:
${aiLines([aiCharacter.personality, aiCharacter.personalityStyle, aiCharacter.subcultureAesthetic, aiCharacter.aestheticKeywords]) || "Not recorded."}

Relationships:
${aiLines([aiCharacter.relationshipDynamics, aiCharacter.friendships, aiCharacter.rivals, aiCharacter.romanticOrShipNotes, aiCharacter.foundFamily]) || "Not recorded."}

Abilities, strengths, weaknesses:
${aiLines([aiCharacter.abilities, aiCharacter.strengths, aiCharacter.weaknesses]) || "Not recorded."}

Backstory and conflicts:
${aiLines([aiCharacter.backstory, aiCharacter.goals, aiCharacter.conflicts, aiCharacter.longFormProfile]) || "Not recorded."}

Fandom/canon notes:
${aiLines([aiCharacter.canonStatus, aiCharacter.fandomSource, aiCharacter.creatorNotes, aiCharacter.trivia, aiCharacter.quotes]) || "Not recorded."}

Expansion prompt:
${aiPromptSeed || "Expand this into a clear, readable character profile while preserving every recorded fact and flagging missing details instead of inventing them."}`;
    return `KINFORGE RESEARCH ASSISTANT DRAFT

Focus person: ${aiPersonName}
Prompt or highlighted term: ${aiPromptSeed || selectedDictionaryText || "General research planning"}

Visible facts:
${factsText}

Suggested research questions:
${aiPerson ? buildResearchQuestions(state, aiPerson).map(question => `- ${question}`).join("\n") : "- Add a person first."}

Terms to understand:
${terms.length ? terms.map(entry => `- ${entry.term}: ${entry.meaning}`).join("\n") : "- No matching glossary terms found yet."}

Source checklist:
- Search saved sources and historical records first.
- Attach citations before adding sensitive details.
- Keep medical, custody, government, identity, and protection details private unless explicitly shared.
- For medical topics, use clinician/source wording and official health references; KinForge does not diagnose.
- For relationship and identity terms, preserve the person's own wording.`;
  };
  const generateAiDraft = (mode = aiDraft.mode) => setAiDraft(current => ({ ...current, output: buildAiDraft(mode) }));
  const saveAiDraftAsIdea = () => {
    const body = aiDraft.output.trim();
    if (!body) return;
    const at = nowIso();
    mutate("Saved AI Studio draft", draft => {
      draft.ideasJournal.push({
        id: makeId("idea"),
        treeId,
        personId: aiPerson?.id,
        title: `AI ${AI_GENERATOR_MODES.find(mode => mode.id === aiDraft.mode)?.label || "draft"} - ${aiPersonName}`,
        category: aiDraft.mode.includes("video") || aiDraft.mode === "image" || aiDraft.mode === "movie-clip" ? "Character arc" : aiDraft.mode === "medical" ? "Medical or diagnostic term" : "Research",
        status: "drafting",
        tags: ["ai-studio", aiDraft.mode],
        body,
        createdAt: at,
        updatedAt: at
      });
    });
    setItemMessage("Saved the AI Studio draft into Ideas & Feedback.");
  };
  const downloadAiDraft = () => {
    const body = aiDraft.output.trim() || buildAiDraft(aiDraft.mode);
    void exportText(`KinForge-${aiDraft.mode}-${aiPersonName.replace(/\W+/g, "-") || "draft"}.txt`, body);
  };
  const kinforgeAiPerson = people.find(entry => entry.id === kinforgeAi.personId) || aiPerson || person || people[0];
  const kinforgeAiTerms = searchTerms(kinforgeAi.prompt || selectedDictionaryText, customGlossaryEntries).slice(0, 8);
  const buildKinforgeAiAnswer = () => {
    const targetName = kinforgeAiPerson ? fullName(kinforgeAiPerson) : "the selected library";
    const targetFacts = kinforgeAiPerson ? kinforgeAiPerson.facts.filter(fact => !fact.private || canManagePrivacy || kinforgeAiPerson.sensitiveVisibility === "shared").slice(0, 10) : [];
    const targetRelationships = kinforgeAiPerson ? treeRelationships.filter(link => link.fromId === kinforgeAiPerson.id || link.toId === kinforgeAiPerson.id).slice(0, 10) : [];
    const prompt = kinforgeAi.prompt.trim() || selectedDictionaryText || `Help me understand ${targetName}.`;
    const relationshipLines = targetRelationships.map(link => {
      const otherId = link.fromId === kinforgeAiPerson?.id ? link.toId : link.fromId;
      const other = people.find(entry => entry.id === otherId);
      return `- ${link.subtype || link.type || link.status}: ${other ? fullName(other) : otherId} (${link.status || "relationship recorded"})`;
    }).join("\n");
    const factLines = targetFacts.map(fact => `- ${fact.type}: ${fact.value}${fact.date ? ` (${fact.date})` : ""}${fact.private ? " [private]" : ""}`).join("\n");
    const termLines = kinforgeAiTerms.map(entry => `- ${entry.term}: ${entry.meaning}`).join("\n");
    const sourceLines = treeSources.slice(0, 8).map(source => `- ${source.title}${source.citation ? `, ${source.citation}` : ""}${source.url ? ` (${source.url})` : ""}`).join("\n");
    return `KINFORGE AI RESPONSE

Engine: ${kinforgeAi.engine}
Answer mode: ${kinforgeAi.answerMode}
Question: ${prompt}
Library scope: ${tree?.title || "Current tree"}
Focus: ${targetName}

Short answer:
${kinforgeAi.answerMode === "Plain-language definition"
  ? "Here is the easiest way to read the term or question: define the word first, then connect it to the person, source, relationship, or record where it appears."
  : kinforgeAi.answerMode === "SWOT and competitor analysis"
    ? "Use this as a product-improvement brief: keep KinForge's private, account-scoped library strong; improve weak or slow flows; add evidence-backed controls; and avoid claiming a feature is complete unless it works across web, desktop, reports, exports, and sync."
    : kinforgeAi.answerMode === "Genealogy relationship reasoning"
      ? "Read the relationship by finding the nearest shared ancestor, counting cousin degree from the closer generation, and using removed for the generation gap between the two people."
      : "KinForge AI uses the saved library context below to produce a structured answer, then lists what should be checked against sources before you trust or publish it."}

Relevant saved facts:
${factLines || "- No visible facts are recorded for this focus yet."}

Relevant relationships:
${relationshipLines || "- No direct relationships are recorded for this focus yet."}

Helpful definitions:
${termLines || "- No matching dictionary terms found. Add the term to the glossary or select text in the app to explain it."}

Suggested next actions:
- Attach or review source records before treating the answer as proven.
- Keep medical, custody, protection, government, identity, and private family details private unless explicitly shared with trusted library members.
- If this is a report question, generate a report draft and include the explanation section so readers understand the term.
- If this is a product/app question, turn the answer into a testable feature checklist before publishing.

Sources to check inside this library:
${sourceLines || "- No sources recorded yet. Add source citations before publishing conclusions."}

Limit:
This in-app assistant drafts and reasons from KinForge data. Live web browsing, paid external models, medical diagnosis, legal advice, and official records still require the appropriate connected service or qualified professional.`;
  };
  const generateKinforgeAiAnswer = () => setKinforgeAi(current => ({ ...current, output: buildKinforgeAiAnswer() }));
  const saveKinforgeAiAnswer = () => {
    const body = kinforgeAi.output.trim();
    if (!body) return;
    const at = nowIso();
    mutate("Saved KinForge AI answer", draft => {
      draft.ideasJournal.push({
        id: makeId("idea"),
        treeId,
        personId: kinforgeAiPerson?.id,
        title: `KinForge AI - ${kinforgeAi.answerMode}`,
        category: "Research",
        status: "drafting",
        tags: ["kinforge-ai", kinforgeAi.answerMode],
        body,
        createdAt: at,
        updatedAt: at
      });
    });
    setItemMessage("Saved the KinForge AI answer into Ideas & Feedback.");
  };
  const downloadKinforgeAiAnswer = () => {
    const body = kinforgeAi.output.trim() || buildKinforgeAiAnswer();
    void exportText(`KinForge-AI-${kinforgeAi.answerMode.replace(/\W+/g, "-")}.txt`, body);
  };
  const buildHelpdeskAiAnswer = () => {
    const issue = helpdeskAi.issue.trim() || "Describe what happened, what you expected, and what you clicked.";
    const steps = helpdeskAi.stepsTried.trim() || "No steps tried yet.";
    const syncState = cloud ? `Signed in as ${cloud.account.email}; cloud save state is ${cloud.saved ? "saved" : "has pending changes"}; editing is ${cloud.readOnly ? "read-only" : "enabled"}.` : "Local or demo mode; no cloud account context is attached to this window.";
    return `KINFORGE HELPDESK AI

Support area: ${helpdeskAi.area}
Urgency: ${helpdeskAi.urgency}
Response type: ${helpdeskAi.responseType}
Current tree: ${tree?.title || "No active tree"}
Account/library context: ${syncState}

Issue:
${issue}

Steps already tried:
${steps}

Recommended next steps:
1. Save or download a backup before making major changes.
2. Reproduce the issue once and write down the exact page, button, person, tree, collection, or report involved.
3. Check whether the issue happens in both the web app and desktop app, or only one surface.
4. If this involves sync, confirm that the same KinForge account is signed in on every device.
5. If this involves downloads or updates, open the Update Center and confirm whether the installed version is older than the latest version.
6. If this involves sensitive details, verify whether the record is private, shared with signed-in members, or visible in reports.

Likely causes to check:
- A stale app build or browser cache.
- A library lock or paused cloud sync.
- A tree, collection, or subcollection assigned to the wrong parent.
- A hidden field inside Show More, privacy, or access controls.
- A report/export generated before the newest data was saved.

Helpdesk draft:
Please investigate ${helpdeskAi.area}. The user reports: "${issue}". Urgency is ${helpdeskAi.urgency}. Steps tried: ${steps}. Expected result: the control should be usable, save correctly, sync across signed-in devices, and appear consistently in the web app, website, ChatGPT Site, Mac app, Windows app, reports, and downloads where applicable.

Privacy note:
Do not paste passwords, recovery codes, private medical records, government records, custody records, or identity details into a public support request. Use private/shared visibility controls and attach only the minimum needed evidence.`;
  };
  const generateHelpdeskAiAnswer = () => setHelpdeskAi(current => ({ ...current, output: buildHelpdeskAiAnswer() }));
  const saveHelpdeskAiAnswer = () => {
    const body = helpdeskAi.output.trim();
    if (!body) return;
    const at = nowIso();
    mutate("Saved Helpdesk AI answer", draft => {
      draft.ideasJournal.push({
        id: makeId("idea"),
        treeId,
        title: `Helpdesk AI - ${helpdeskAi.area}`,
        category: "User feedback",
        status: "drafting",
        tags: ["helpdesk-ai", helpdeskAi.area, helpdeskAi.urgency],
        body,
        createdAt: at,
        updatedAt: at
      });
    });
    setItemMessage("Saved the Helpdesk AI answer into Ideas & Feedback.");
  };
  const downloadHelpdeskAiAnswer = () => {
    const body = helpdeskAi.output.trim() || buildHelpdeskAiAnswer();
    void exportText(`KinForge-Helpdesk-AI-${helpdeskAi.area.replace(/\W+/g, "-")}.txt`, body);
  };
  const buildTranslatorAiAnswer = () => {
    const source = translatorAi.sourceLanguage === "auto" ? "auto-detect" : languageLabel(translatorAi.sourceLanguage);
    const target = languageLabel(translatorAi.targetLanguage);
    const text = translatorAi.text.trim() || "Paste a note, report paragraph, person biography, source citation, app label, or family record text to translate.";
    const notes = translatorAi.notes.trim() || "No extra glossary, culture, name, privacy, or tone notes supplied.";
    return `KINFORGE TRANSLATOR AI

Mode: ${translatorAi.mode}
Source language: ${source}
Target language: ${target}
Tone: ${translatorAi.tone}
Current tree: ${tree?.title || "No active tree"}

Source text:
${text}

Translation draft:
[Translate the source text into ${target}. Preserve names, dates, citations, record identifiers, government/medical/legal terms, kinship terms, privacy labels, and glyph meanings exactly unless a note says otherwise.]

Translator notes:
- Use ${translatorAi.tone.toLowerCase()} wording.
- Keep genealogy facts factual; do not invent relatives, events, diagnoses, places, or sources.
- For names, provide a cultural note if transliteration, romanisation, honorifics, surname order, or clan naming could matter.
- For reports, keep headings, dates, citation numbers, and file names stable.
- For sensitive records, flag words that should be reviewed by a fluent speaker before sharing.

Glossary and context:
${notes}

Quality checklist:
1. Meaning preserved.
2. Names, dates, places, and citations unchanged.
3. Kinship terms checked for cultural fit.
4. Sensitive, medical, legal, custody, protection, and government terms reviewed.
5. If the target language has multiple scripts or regional standards, record which one was used.`;
  };
  const generateTranslatorAiAnswer = () => setTranslatorAi(current => ({ ...current, output: buildTranslatorAiAnswer() }));
  const saveTranslatorAiAnswer = () => {
    const body = translatorAi.output.trim();
    if (!body) return;
    const at = nowIso();
    mutate("Saved Translator AI answer", draft => {
      draft.ideasJournal.push({
        id: makeId("idea"),
        treeId,
        title: `Translator AI - ${languageLabel(translatorAi.targetLanguage)}`,
        category: "Research",
        status: "drafting",
        tags: ["translator-ai", translatorAi.mode, translatorAi.targetLanguage],
        body,
        createdAt: at,
        updatedAt: at
      });
    });
    setItemMessage("Saved the Translator AI draft into Ideas & Feedback.");
  };
  const downloadTranslatorAiAnswer = () => {
    const body = translatorAi.output.trim() || buildTranslatorAiAnswer();
    void exportText(`KinForge-Translator-AI-${translatorAi.targetLanguage}.txt`, body);
  };
  const supportDiagnostics = () => [
    `App version: 1.3.8`,
    `Mode: ${cloud ? "cloud account" : guestMode ? "guest/demo" : "local account"}`,
    `Signed in: ${cloud?.account.email || user?.email || "not signed in"}`,
    `Tree: ${tree?.title || "none"}`,
    `View: ${view}`,
    `People: ${people.length}`,
    `Relationships: ${treeRelationships.length}`,
    `Sources: ${treeSources.length}`,
    `Reports: ${state.reportDrafts.filter(report => report.treeId === treeId).length}`,
    `Saved: ${cloud ? String(cloud.saved) : "local"}`
  ].join("\n");
  const supportTicketText = () => [
    "KINFORGE SUPPORT REQUEST",
    "",
    `Type: ${supportForm.type}`,
    `Subject: ${supportForm.subject || "KinForge support request"}`,
    `Name: ${supportForm.name || "Not provided"}`,
    `Email: ${supportForm.email || "Not provided"}`,
    `Permission to reply: ${supportForm.permissionToReply ? "yes" : "no"}`,
    `Device/app: ${supportForm.device || "Not provided"}`,
    supportForm.proof ? `Permission proof: ${supportForm.proof}` : "",
    "",
    "Message:",
    supportForm.message || "No message written yet.",
    "",
    supportForm.includeDiagnostics ? `Diagnostics:\n${supportDiagnostics()}` : "Diagnostics not included."
  ].join("\n");
  const downloadSupportTicket = () => void exportText(`KinForge-support-${(supportForm.subject || supportForm.type).replace(/\W+/g, "-") || "request"}.txt`, supportTicketText());
  const submitSupportForm = async () => {
    setSupportMessage("");
    if (!supportForm.message.trim()) { setSupportMessage("Write the support message before sending."); return; }
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-KinForge-Client": "1" },
        body: JSON.stringify({
          ...supportForm,
          treeTitle: tree?.title || "",
          diagnostics: supportForm.includeDiagnostics ? supportDiagnostics() : ""
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The support request could not be sent.");
      setSupportMessage(result.message || "Support request prepared.");
      if (result.delivery !== "sent-to-kinforge-support") downloadSupportTicket();
    } catch (error) {
      setSupportMessage(error instanceof Error ? `${error.message} Downloading the support request instead.` : "Support delivery failed. Downloading the support request instead.");
      downloadSupportTicket();
    }
  };

  const renderView = () => {
    if (view === "library" || view === "manage-trees") return renderLibrary();
    if (!tree) return <EmptyState icon={<FolderTree />} title="Create your first tree" action={<Button onClick={createTree} icon={<Plus size={16} />}>Create Tree</Button>} />;
    switch (view) {
      case "dashboard":
        return renderDashboard();
      case "tree":
      case "my-family-tree":
        return renderTree();
      case "people":
        return <PeopleWorkspace key={treeId} state={state} treeId={treeId} person={person} profileId={route.personId} tab={route.tab} editor={person ? renderPersonEditor(person) : null} canEditSensitive={canManagePrivacy || person?.sensitiveVisibility === "shared"} onAdd={() => addPerson()} onAddRelative={() => addPerson("child")} onNeedsChange={needs => { if (person && (canManagePrivacy || person.sensitiveVisibility === "shared")) updatePerson(person.id, entry => { entry.accessNeeds = needs; }, "Updated access annotations"); }} onPortrait={id => { if (person) updatePerson(person.id, entry => { entry.profileMediaId = id || undefined; }, "Changed profile picture"); }} />;
      case "families":
        return <div className="stack"><FamiliesWorkspace state={state} treeId={treeId} />{renderFamilyDetails()}</div>;
      case "places":
      case "pedigree-map":
      case "sources":
        return renderPlacesSources();
      case "research":
        return renderResearch();
      case "kinforge-ai":
        return renderKinforgeAi();
      case "ai":
        return renderAiStudio();
      case "translator-ai":
        return renderTranslatorAi();
      case "helpdesk-ai":
        return renderHelpdeskAi();
      case "contact":
        return renderContact();
      case "support":
        return renderSupportForm();
      case "private-access":
        return renderPrivateAccess();
      case "media":
      case "photos":
        return renderMedia();
      case "ideas":
        return renderIdeasFeedback();
      case "glyphs":
        return renderGlyphLibrary();
      case "accessibility":
        return renderAccessibility();
      case "charts":
      case "infographics":
      case "timeline":
        return renderCharts();
      case "reports":
      case "relationship-report":
        return renderReports();
      case "publish":
      case "import-gedcom":
      case "print-books":
      case "backup":
        return renderPublish();
      case "dna":
        return renderDna();
      case "maintenance":
      case "consistency":
        return renderMaintenance();
      case "strategy":
        return renderStrategy();
      case "coverage":
        return renderCoverage();
    }
  };

  const renderDashboard = () => (
    <div className="stack">
      <div className="hero-band">
        <div>
          <p className="eyebrow">Local-first genealogy workspace</p>
          <h1>KinForge Genealogy Studio</h1>
          <p>{tree.title} has {people.length} people, {state.sources.filter((source) => source.treeId === treeId).length} sources, and {issues.length} active plausibility notes.</p>
        </div>
        <div className="hero-actions">
          <Badge>{user ? `Signed in as ${user.name}` : "Guest demo"}</Badge>
          <Button onClick={() => addPerson()} icon={<Plus size={16} />}>Add Person</Button>
          <Button variant="secondary" onClick={() => setView("publish")} icon={<Download size={16} />}>Export</Button>
        </div>
      </div>
      <div className="interface-hub" aria-label="Unified genealogy command center">
        <div className="interface-panel interface-focus">
          <div className="interface-panel-head">
            <span className="panel-icon"><Users size={18} /></span>
            <span>Focus</span>
          </div>
          {person ? (
            <>
              <div className="focus-person">
                <span className="person-avatar large">
                  {focusPortrait?.dataUrl ? <img src={focusPortrait.dataUrl} alt="" /> : <Glyph id={`gender-${person.gender}`} size={26} decorative />}
                </span>
                <div>
                  <h2>{fullName(person)}</h2>
                  <p className="quiet">{person.birthDate || "Birth unknown"} · {person.living ? "Living" : person.deathDate || "Death unknown"}</p>
                </div>
              </div>
              <div className="focus-stats">
                <button onClick={() => setView("families")}><strong>{focusParents.length}</strong><span>Parents</span></button>
                <button onClick={() => setView("families")}><strong>{focusPartners.length}</strong><span>Partners</span></button>
                <button onClick={() => setView("families")}><strong>{focusChildren.length}</strong><span>Children</span></button>
              </div>
              <div className="focus-strip">
                <span>{person.labels[0] || "Family member"}</span>
                <span>{person.sourceIds.length} source links</span>
                <span>{treeMedia.filter((media) => media.assignedTo.some((assignment) => assignment.kind === "person" && assignment.id === person.id)).length} media</span>
              </div>
              <div className="button-row">
                <Button onClick={() => openPerson(person.id)} icon={<Users size={16} />}>Open profile</Button>
                <Button variant="secondary" onClick={() => setView("tree")} icon={<Network size={16} />}>Show tree</Button>
              </div>
            </>
          ) : (
            <EmptyState icon={<Users />} title="Add a person to start the unified workspace" action={<Button onClick={() => addPerson()} icon={<Plus size={16} />}>Add Person</Button>} />
          )}
        </div>
        <div className="interface-panel interface-actions-panel">
          <div className="interface-panel-head">
            <span className="panel-icon"><Sparkles size={18} /></span>
            <span>Unified Genealogy Command Center</span>
          </div>
          <div className="interface-action-grid">
            {interfaceActions.map((action) => (
              <button key={action.label} className="interface-action" onClick={action.action}>
                <span className="action-icon">{action.icon}</span>
                <span><strong>{action.label}</strong><small>{action.detail}</small></span>
                <Badge>{action.badge}</Badge>
              </button>
            ))}
          </div>
        </div>
        <div className="interface-panel interface-inbox">
          <div className="interface-panel-head">
            <span className="panel-icon"><ClipboardList size={18} /></span>
            <span>Discovery Inbox</span>
          </div>
          {discoveryInbox.map((item) => (
            <button key={item.label} className="discovery-row" onClick={item.action}>
              <span className="discovery-icon">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              <Badge>{item.count}</Badge>
            </button>
          ))}
        </div>
      </div>
      <div className="interface-lanes" aria-label="Best genealogy workflow lanes">
        {interfaceLanes.map((lane) => (
          <button key={lane.label} className={`interface-lane ${lane.accent}`} onClick={lane.action}>
            <span>{lane.icon}</span>
            <strong>{lane.label}</strong>
            <small>{lane.detail}</small>
          </button>
        ))}
      </div>
      <div className="report-shortcuts" aria-label="Report shortcuts">
        <div>
          <span className="panel-icon"><FileText size={18} /></span>
          <strong>Reports saved to the KinForge folder</strong>
          <small>Desktop exports go to Downloads/KinForge Genealogy Studio/Reports.</small>
        </div>
        {reportShortcuts.map((shortcut) => (
          <button key={shortcut.label} onClick={() => openReportType(shortcut.type)}>
            <strong>{shortcut.label}</strong>
            <small>{shortcut.detail}</small>
          </button>
        ))}
      </div>
      <div className="metric-grid">
        <Metric label="Trees" value={state.trees.length} icon={<FolderTree size={20} />} />
        <Metric label="People" value={people.length} icon={<Users size={20} />} />
        <Metric label="Records" value={state.records.filter((record) => record.treeId === treeId).length} icon={<Archive size={20} />} />
        <Metric label="DNA matches" value={state.dnaMatches.filter((match) => match.treeId === treeId).length} icon={<Dna size={20} />} />
        <Metric label="Feature paths" value={FEATURE_MATRIX.length} icon={<CheckCircle2 size={20} />} />
      </div>
      <div className="two-col">
        <Section title="Smart Filters" icon={<Filter size={18} />}>
          <div className="filter-list">
            {filters.map((filter) => (
              <button key={filter.id} className="filter-row" onClick={() => {
                if (filter.people[0]) setSelectedPersonId(filter.people[0].id);
                setView("library");
              }}>
                <span>{filter.label}</span>
                <strong>{filter.people.length}</strong>
              </button>
            ))}
          </div>
        </Section>
        <Section title="Plausibility Checks" icon={<Shield size={18} />}>
          {issues.length ? issues.slice(0, 5).map((issue) => (
            <button className="issue-row" key={`${issue.label}-${issue.detail}`} onClick={() => {
              if (issue.personId) setSelectedPersonId(issue.personId);
              setView("maintenance");
            }}>
              {issue.severity === "error" ? <XCircle size={16} /> : <CircleHelp size={16} />}
              <span><strong>{issue.label}</strong>{issue.detail}</span>
            </button>
          )) : <p className="quiet">No plausibility issues found for this tree.</p>}
        </Section>
      </div>
      <div className="three-col">
        <Section title="To-Dos" icon={<ClipboardList size={18} />}>
          {state.todos.filter((todo) => todo.treeId === treeId).map((todo) => (
            <div className="compact-row" key={todo.id}>
              <button className={`status-dot ${todo.status}`} onClick={() => mutate("Updated to-do", (draft) => {
                const target = draft.todos.find((entry) => entry.id === todo.id);
                if (target) target.status = target.status === "done" ? "open" : target.status === "open" ? "doing" : "done";
              })} aria-label="Toggle to-do status" />
              <span>{todo.title}</span>
              <Badge>{todo.priority}</Badge>
            </div>
          ))}
          <Button variant="secondary" icon={<Plus size={16} />} onClick={() => mutate("Added to-do", (draft) => draft.todos.push({ id: makeId("todo"), treeId, personId: person?.id, title: "New research task", status: "open", priority: "normal", dueDate: "" }))}>Add To-Do</Button>
        </Section>
        <Section title="Family Quiz" icon={<Brain size={18} />}>
          {person ? (
            <QuizCard person={person} answer={getParents(state, person.id).map(fullName).join(" and ") || "No parents recorded yet"} />
          ) : <p className="quiet">Add a person to start the family quiz.</p>}
        </Section>
        <Section title="Recent Changes" icon={<History size={18} />}>
          {state.changes.slice(0, 7).map((change) => (
            <div className="change-row" key={change.id}>
              <span>{change.label}</span>
              <time>{new Date(change.at).toLocaleTimeString()}</time>
            </div>
          ))}
        </Section>
      </div>
    </div>
  );

  const renderLibrary = () => {
    const sharedLibrary = state.media.filter(item => item.treeId === treeId && item.tags.includes("shared-library"));
    const collectionsForBook = (bookId: string) => collectionOptions(state.collections, bookId);
    const subcollectionsForBook = (bookId: string) => subcollectionOptions(state.collections, bookId);
    const updateTreePlacement = (treeIdToUpdate: string, bookId: string, collectionId: string) => mutate("Updated tree library placement", draft => {
      const target = draft.trees.find(item => item.id === treeIdToUpdate);
      const collection = draft.collections.find(item => item.id === collectionId && item.bookId === bookId);
      const subcollection = ensureTreeSubcollection(draft, bookId, collection?.parentId ? collection.parentId : collection?.id);
      if (target && subcollection) { target.bookId = subcollection.bookId; target.collectionId = collection?.parentId ? collection.id : subcollection.id; }
    });
    const updateCollectionPlacement = (collectionId: string, bookId: string, parentId: string) => mutate("Updated collection library placement", draft => {
      moveLibraryCollection(draft, collectionId, bookId, parentId || undefined);
    });
    const treesForLocation = (collectionId: string) => state.trees.filter(item => item.collectionId === collectionId);
    const renderTreeEntry = (entry: typeof state.trees[number]): ReactNode => (
      <div className="tree-library-entry" key={entry.id} data-tree-id={entry.id}>
        <Link to={workspacePath({ treeId: entry.id, view: "tree" })}>
          <Network size={22} />
          <span><strong>{entry.title}</strong><small>{state.people.filter(person => person.treeId === entry.id).length} people · {entry.privacy}</small></span>
          <ChevronRight size={18} />
        </Link>
        <div className="tree-placement">
          <label className="placement-field"><span>Book</span><select className="control" aria-label={`Book for tree ${entry.title}`} value={entry.bookId} onChange={event => updateTreePlacement(entry.id, event.target.value, entry.collectionId || "")}>
            {state.books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
          </select></label>
          <label className="placement-field"><span>Subcollection</span><select className="control" aria-label={`Subcollection for tree ${entry.title}`} value={entry.collectionId || ""} onChange={event => updateTreePlacement(entry.id, entry.bookId, event.target.value)}>
            {subcollectionsForBook(entry.bookId).map(collection => <option key={collection.id} value={collection.id}>{collection.label}</option>)}
          </select></label>
        </div>
        {itemActions({ kind: "trees", id: entry.id }, entry.title)}
      </div>
    );
    const renderCollection = ({ collection, children }: CollectionBranch): ReactNode => {
      const expanded = !collapsedCollections.has(collection.id);
      const descendants = collectionDescendants(state.collections, collection.id);
      const kind = collection.parentId ? "Subcollection" : "Collection";
      const collectionTrees = collection.parentId ? treesForLocation(collection.id) : [];
      return <div className="collection-branch" key={collection.id} data-collection-id={collection.id} role="group" aria-label={`${kind}: ${collection.name}`}>
        <div className="collection-heading">
          <button type="button" className="icon-button collection-toggle" aria-label={`${expanded ? "Collapse" : "Expand"} ${collection.name}`} title={`${expanded ? "Collapse" : "Expand"} ${kind.toLowerCase()}`} aria-expanded={expanded} aria-controls={`collection-contents-${collection.id}`} onClick={() => setCollapsedCollections(previous => {
            const next = new Set(previous); if (next.has(collection.id)) next.delete(collection.id); else next.add(collection.id); return next;
          })}>{expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
          <label className="field collection-name"><span>{kind} name</span><Input ariaLabel={`${kind} name for ${collection.name}`} value={collection.name} onChange={value => mutate(`Renamed ${kind.toLowerCase()}`, draft => {
            const target = draft.collections.find(item => item.id === collection.id); if (target) target.name = value;
          })} /></label>
          {itemActions({ kind: "collections", id: collection.id }, collection.name)}
        </div>
        <div id={`collection-contents-${collection.id}`} className="collection-contents" hidden={!expanded}>
          <div className="collection-placement">
            <label className="placement-field"><span>Book</span><select className="control" aria-label={`Book for ${collection.name}`} value={collection.bookId} onChange={event => updateCollectionPlacement(collection.id, event.target.value, "")}>
              {state.books.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
            </select></label>
            <label className="placement-field"><span>Parent collection</span><select className="control" aria-label={`Parent collection for ${collection.name}`} value={collection.parentId || ""} onChange={event => updateCollectionPlacement(collection.id, collection.bookId, event.target.value)}>
              <option value="">Directly in book</option>
              {collectionsForBook(collection.bookId).filter(option => option.id !== collection.id && !descendants.has(option.id)).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select></label>
          </div>
          {collection.parentId && <><div className="collection-toolbar library-subheading"><strong>Trees in this subcollection</strong><span className="quiet">{collectionTrees.length} {collectionTrees.length === 1 ? "tree" : "trees"}</span></div>
          {collectionTrees.length ? <div className="tree-library-list embedded-tree-list">{collectionTrees.map(renderTreeEntry)}</div> : <p className="quiet empty-library-note">No trees in this subcollection.</p>}</>}
          <div className="collection-toolbar"><span className="quiet">{children.length} {children.length === 1 ? "subcollection" : "subcollections"}</span><button type="button" className="button secondary" aria-label={`Add subcollection to ${collection.name}`} onClick={() => createCollection(collection.bookId, collection.id)}><Plus size={16} />Add subcollection</button></div>
          <div className="collection-children">{children.map(renderCollection)}</div>
        </div>
      </div>;
    };
    return (
    <div className="library-grid">
      <Section title="Manage Trees, Books, Collections" icon={<BookOpen size={18} />}>
        <div className="button-row">
          <Button onClick={createBook} icon={<Plus size={16} />}>Book</Button>
          <Button onClick={createTree} icon={<Plus size={16} />}>Tree</Button>
        </div>
        {state.books.map((book) => {
          const collections = collectionHierarchy(state.collections, book.id);
          return (
          <div key={book.id} className="book-block" data-book-id={book.id} role="group" aria-label={`Book: ${book.title}`}>
            <div className="saved-item-heading"><strong>Book</strong>{itemActions({ kind: "books", id: book.id }, book.title)}</div>
            <Input ariaLabel={`Book title for ${book.title}`} value={book.title} onChange={(value) => mutate("Updated book", (draft) => {
              const target = draft.books.find((item) => item.id === book.id);
              if (target) target.title = value;
            })} />
            <p className="quiet">{book.description}</p>
            <div className="collection-toolbar"><strong>Collections</strong><button type="button" className="button secondary" aria-label={`Add collection to ${book.title}`} onClick={() => createCollection(book.id)}><Plus size={16} />Add collection</button></div>
            <div className="book-collections">{collections.map(renderCollection)}</div>
          </div>
        );})}
        {tree && <div className="active-tree-panel">
        <div className="active-tree-heading"><label className="field"><span>Active Tree</span>
          <select className="control" value={treeId} onChange={(event) => setSelectedTreeId(event.target.value)}>
            {state.trees.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select></label>{itemActions({ kind: "trees", id: tree.id }, tree.title)}</div>
        <div className="settings-grid">
          <Field label="Tree title" value={tree.title} onChange={(value) => updateTree((target) => { target.title = value; })} />
          <label className="field"><span>Book</span>
          <select className="control" aria-label="Active tree book" value={tree.bookId} onChange={(event) => mutate("Updated tree book", draft => {
            const target = draft.trees.find(item => item.id === treeId);
            const subcollection = ensureTreeSubcollection(draft, event.target.value);
            if (target && subcollection) { target.bookId = subcollection.bookId; target.collectionId = subcollection.id; }
          })}>
            {state.books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
          </select></label>
          <label className="field"><span>Subcollection</span>
          <select className="control" aria-label="Active tree subcollection" value={tree.collectionId || ""} onChange={(event) => updateTree((target) => { target.collectionId = event.target.value; }, "Updated tree subcollection")}>
            {subcollectionsForBook(tree.bookId).map(collection => <option key={collection.id} value={collection.id}>{collection.label}</option>)}
          </select></label>
          <Field label="Author" value={tree.author} onChange={(value) => updateTree((target) => { target.author = value; }, "Updated author")} />
          <Field label="Author contact" value={tree.authorContact} onChange={(value) => updateTree((target) => { target.authorContact = value; }, "Updated author contact")} />
          <label className="field"><span>Language<Languages size={14} /></span>
          <select className="control" value={tree.language} onChange={(event) => updateTree((target) => { target.language = event.target.value; }, "Updated language")}>
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}
          </select></label>
          <label className="field"><span>{translate("App language")}<Globe2 size={14} /></span>
          <select className="control" aria-label="App language" value={appLanguage} onChange={(event) => updateAccessibility("appLanguage", event.target.value)}>
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}
          </select><small className="quiet">Changes the saved interface language setting and available localized shell labels. Untranslated genealogy terms fall back to English until a complete human translation is added.</small></label>
          <Field label="Citation style" value={tree.citationStyle} onChange={(value) => updateTree((target) => { target.citationStyle = value; }, "Updated citation style")} />
          <label className="field"><span>Privacy</span>
          <select className="control" value={tree.privacy} onChange={(event) => updateTree((target) => { target.privacy = event.target.value as typeof tree.privacy; }, "Updated privacy")}>
            <option value="private">Private</option>
            <option value="invited">Invited relatives</option>
            <option value="public-export">Public export</option>
          </select></label>
        </div>
        </div>}
        {!state.trees.length && <p className="quiet">No family trees yet. Create one from this library box.</p>}
      </Section>
      {tree && <Section title="Shared Library" icon={<Archive size={18} />}>
        <p className="quiet">Tree-wide PDFs, fan charts, source packets, government forms, report exports, and reference files can live here before you attach them to a person.</p>
        <div className="button-row">
          <label className="button primary"><Upload size={16} />Import PDF or file<input aria-label="Shared library upload" type="file" multiple hidden onChange={handleSharedLibraryUpload} /></label>
          <Button variant="secondary" onClick={() => exportText("KinForge-shared-library-index.txt", sharedLibrary.map(item => `${item.title}\t${item.type}\t${item.tags.join(", ")}\t${item.createdAt}`).join("\n") || "No shared library files yet.")}>Export index</Button>
          <Button variant="secondary" onClick={() => setView("reports")}>PDF reports</Button>
          <Button variant="secondary" onClick={() => setView("charts")}>Charts</Button>
        </div>
        <div className="shared-library-list">
          {sharedLibrary.map(item => <button key={item.id} onClick={() => { setSelectedMediaId(item.id); setView("media"); }}><FileText size={18} /><span><strong>{item.title}</strong><small>{item.type} · {item.tags.filter(tag => tag !== "shared-library").join(", ") || "tree library"}</small></span><ChevronRight size={16} /></button>)}
          {!sharedLibrary.length && <p className="quiet">No shared files imported yet.</p>}
        </div>
      </Section>}
    </div>
    );
  };

  const renderPersonEditor = (target: Person) => {
    const governmentFiles = state.media.filter(item => item.treeId === treeId && item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === target.id) && item.tags.includes("government-file"));
    const medicalFiles = state.media.filter(item => item.treeId === treeId && item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === target.id) && item.tags.includes("medical-file") && (canManagePrivacy || item.visibility !== "private"));
    const workFiles = state.media.filter(item => item.treeId === treeId && item.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === target.id) && item.tags.includes("work-file") && (canManagePrivacy || item.visibility !== "private"));
    const medicalRecords = (state.medicalRecords || []).filter(record => record.treeId === treeId && record.personId === target.id && (canManagePrivacy || record.visibility === "shared"));
    const medicalConditionOptions = medicalOptionsForCategory(medicalRecordDraft.conditionCategory);
    const selectedDiagnosisValue = medicalRecordDraft.diagnosisName === OTHER_OPTION ? medicalRecordDraft.customDiagnosisName.trim() : medicalRecordDraft.diagnosisName.trim();
    const selectedAidValue = medicalRecordDraft.assistiveDevice === OTHER_OPTION ? medicalRecordDraft.customAssistiveDevice.trim() : medicalRecordDraft.assistiveDevice.trim();
    const medicalCriteriaHint = selectedDiagnosisValue ? catalogCriteria(factTypeForMedicalCategory(medicalRecordDraft.conditionCategory), selectedDiagnosisValue, state.customFactTerms) : "";
    const addMedicalRecord = () => {
      if (!selectedDiagnosisValue && !selectedAidValue && !medicalRecordDraft.symptomsOrTraits.trim() && !medicalRecordDraft.hospitalOrClinic.trim()) return;
      const base = emptyMedicalRecord(treeId, target.id);
      const now = nowIso();
      const record: MedicalRecord = {
        ...base,
        type: medicalRecordDraft.type,
        diagnosisName: selectedDiagnosisValue || selectedAidValue || "Diagnosis not named",
        conditionCategory: medicalRecordDraft.conditionCategory,
        conditionType: medicalRecordDraft.conditionType || medicalRecordDraft.conditionCategory,
        disorderType: medicalRecordDraft.disorderType,
        bodySystem: medicalRecordDraft.bodySystem,
        diagnosisDate: medicalRecordDraft.diagnosisDate,
        onsetDate: medicalRecordDraft.onsetDate,
        reviewDate: medicalRecordDraft.reviewDate,
        diagnosticStandard: medicalRecordDraft.diagnosticStandard,
        diagnosticCriteria: medicalCriteriaHint || "",
        criteriaMet: medicalRecordDraft.criteriaMet,
        symptomsOrTraits: medicalRecordDraft.symptomsOrTraits,
        functionalImpact: medicalRecordDraft.functionalImpact,
        course: medicalRecordDraft.course,
        progression: medicalRecordDraft.progression,
        triggers: medicalRecordDraft.triggers,
        riskFactors: medicalRecordDraft.riskFactors,
        differentialDiagnosis: medicalRecordDraft.differentialDiagnosis,
        comorbidities: medicalRecordDraft.comorbidities,
        complications: medicalRecordDraft.complications,
        hereditaryOrFamilyHistory: medicalRecordDraft.hereditaryOrFamilyHistory,
        prognosis: medicalRecordDraft.prognosis,
        careLevel: medicalRecordDraft.careLevel,
        emergencyPlan: medicalRecordDraft.emergencyPlan,
        hospitalOrClinic: medicalRecordDraft.hospitalOrClinic,
        diagnosingDoctor: medicalRecordDraft.diagnosingDoctor,
        psychologist: medicalRecordDraft.psychologist,
        psychiatrist: medicalRecordDraft.psychiatrist,
        occupationalTherapist: medicalRecordDraft.occupationalTherapist,
        assistiveDevices: selectedAidValue,
        visibility: defaultSensitiveVisibility(canManagePrivacy),
        createdAt: now,
        updatedAt: now
      };
      mutate("Added medical diagnosis record", draft => { draft.medicalRecords = [...(draft.medicalRecords || []), record]; });
      setMedicalRecordDraft(previous => ({
        ...previous,
        diagnosisName: "",
        customDiagnosisName: "",
        diagnosisDate: "",
        onsetDate: "",
        reviewDate: "",
        criteriaMet: "",
        symptomsOrTraits: "",
        functionalImpact: "",
        progression: "",
        triggers: "",
        riskFactors: "",
        differentialDiagnosis: "",
        comorbidities: "",
        complications: "",
        hereditaryOrFamilyHistory: "",
        prognosis: "",
        emergencyPlan: "",
        hospitalOrClinic: "",
        diagnosingDoctor: "",
        psychologist: "",
        psychiatrist: "",
        occupationalTherapist: "",
        assistiveDevice: "",
        customAssistiveDevice: ""
      }));
    };
    const updateMedicalRecord = (recordId: string, updater: (record: MedicalRecord) => void, label = "Updated medical record") => mutate(label, draft => {
      const record = draft.medicalRecords?.find(record => record.id === recordId);
      if (record) {
        updater(record);
        record.updatedAt = nowIso();
      }
    });
    const deathDetails = { ...emptyDeathDetails(), ...(target.deathDetails || {}) };
    const characterProfile = { ...emptyCharacterProfile(), ...(target.characterProfile || {}) };
    const identity = { ...emptyIdentityDetails(), ...(target.identity || {}) };
    const updateDeathDetails = (updater: (details: typeof deathDetails) => void, label = "Updated death and burial details") => updatePerson(target.id, entry => {
      entry.deathDetails = { ...emptyDeathDetails(), ...(entry.deathDetails || {}) };
      updater(entry.deathDetails);
    }, label);
    const updateCharacterProfile = (updater: (profile: typeof characterProfile) => void, label = "Updated character profile") => updatePerson(target.id, entry => {
      entry.characterProfile = { ...emptyCharacterProfile(), ...(entry.characterProfile || {}) };
      updater(entry.characterProfile);
    }, label);
    const updateIdentityDetails = (updater: (details: typeof identity) => void, label = "Updated identity details") => updatePerson(target.id, entry => {
      entry.identity = { ...emptyIdentityDetails(), ...(entry.identity || {}) };
      updater(entry.identity);
    }, label);
    return (
    <div className="stack">
      {itemActions({ kind: "people", id: target.id }, fullName(target))}
      <div className="settings-grid">
        <Field label="Given name" value={target.givenName} onChange={(value) => updatePerson(target.id, (entry) => { entry.givenName = value; })} />
        <Field label="Family name" value={target.familyName} onChange={(value) => updatePerson(target.id, (entry) => { entry.familyName = value; })} />
        <Field label="Aliases" value={target.aliases.join(", ")} onChange={(value) => updatePerson(target.id, (entry) => { entry.aliases = value.split(",").map((item) => item.trim()).filter(Boolean); })} />
        <label className="field"><span>Gender</span>
        <select className="control" value={target.gender} onChange={(event) => updatePerson(target.id, (entry) => { entry.gender = event.target.value as Person["gender"]; }, "Updated gender")}>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="nonbinary">Nonbinary</option>
          <option value="unknown">Unknown</option>
        </select></label>
        <DateModeField label="Birth date" value={target.birthDate} mode={dateModes.birth} onModeChange={(mode) => setDateModes({ ...dateModes, birth: mode })} onChange={(value) => updatePerson(target.id, (entry) => { entry.birthDate = value; }, "Updated birth date")} />
        <DateModeField label="Death date" value={target.deathDate} mode={dateModes.death} onModeChange={(mode) => setDateModes({ ...dateModes, death: mode })} onChange={(value) => updatePerson(target.id, (entry) => { entry.deathDate = value; entry.living = !value; }, "Updated death date")} />
        <Field label="Branch color" value={target.branchColor} type="color" onChange={(value) => updatePerson(target.id, (entry) => { entry.branchColor = value; }, "Updated branch color")} />
        <div className="toggle-row">
          <label><input type="checkbox" checked={target.living} onChange={(event) => updatePerson(target.id, (entry) => { entry.living = event.target.checked; }, "Updated living status")} /> Living</label>
          <label><input type="checkbox" checked={target.private} onChange={(event) => updatePerson(target.id, (entry) => { entry.private = event.target.checked; }, "Updated privacy flag")} /> Private</label>
        </div>
      </div>
      <Section title="Identity, Sexuality, Gender, and Pronouns" icon={<Users size={18} />}>
        <p className="quiet">Record the person's own words or the wording used in a source. KinForge does not infer sexuality, romantic orientation, gender identity, pronouns, or relationship style from a gender marker, photo, name, or partner link.</p>
        <div className="settings-grid">
          <label className="field"><span>Pronouns</span><input className="control" list="identity-term-options" value={identity.pronouns} onChange={(event) => updateIdentityDetails(details => { details.pronouns = event.target.value; }, "Updated pronouns")} /></label>
          <label className="field"><span>Gender identity</span><input className="control" list="identity-term-options" value={identity.genderIdentity} onChange={(event) => updateIdentityDetails(details => { details.genderIdentity = event.target.value; }, "Updated gender identity")} /></label>
          <label className="field"><span>Gender expression</span><input className="control" list="identity-term-options" value={identity.genderExpression} onChange={(event) => updateIdentityDetails(details => { details.genderExpression = event.target.value; }, "Updated gender expression")} /></label>
          <label className="field"><span>Sexual orientation</span><input className="control" list="identity-term-options" value={identity.sexualOrientation} onChange={(event) => updateIdentityDetails(details => { details.sexualOrientation = event.target.value; }, "Updated sexual orientation")} /></label>
          <label className="field"><span>Romantic orientation</span><input className="control" list="identity-term-options" value={identity.romanticOrientation} onChange={(event) => updateIdentityDetails(details => { details.romanticOrientation = event.target.value; }, "Updated romantic orientation")} /></label>
          <label className="field"><span>Relationship orientation</span><input className="control" list="identity-term-options" value={identity.relationshipOrientation} onChange={(event) => updateIdentityDetails(details => { details.relationshipOrientation = event.target.value; }, "Updated relationship orientation")} /></label>
          <label className="field"><span>Identity labels</span><input className="control" list="identity-term-options" value={identity.identityLabels.join(", ")} onChange={(event) => updateIdentityDetails(details => { details.identityLabels = event.target.value.split(",").map(item => item.trim()).filter(Boolean); }, "Updated identity labels")} /></label>
          <label className="field"><span>Identity visibility</span><select className="control" aria-label="Identity visibility" disabled={!canManagePrivacy} value={identity.visibility} onChange={event => updateIdentityDetails(details => { details.visibility = event.target.value === "shared" ? "shared" : "private"; }, "Updated identity visibility")}>
            {Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <datalist id="identity-term-options">{identityTermOptions.map(option => <option key={option} value={option} />)}</datalist>
        <label className="field"><span>Identity notes</span><textarea className="control" rows={4} value={identity.identityNotes} onChange={(event) => updateIdentityDetails(details => { details.identityNotes = event.target.value; }, "Updated identity notes")} /></label>
        <div className="term-grid">
          {["Gender identity", identity.genderIdentity, "Gender expression", identity.genderExpression, "Sexual orientation", identity.sexualOrientation, "Romantic orientation", identity.romanticOrientation, "Relationship orientation", identity.relationshipOrientation].filter(Boolean).map(term => <TermMeaning key={String(term)} term={String(term)} customEntries={customGlossaryEntries} />)}
        </div>
      </Section>
      <label className="field-label">Biography / LifeStory</label>
      <textarea className="textarea" value={target.biography} onChange={(event) => updatePerson(target.id, (entry) => { entry.biography = event.target.value; }, "Updated biography")} />
      <label className="field-label">Notes</label>
      <textarea className="textarea compact" value={target.notes} onChange={(event) => updatePerson(target.id, (entry) => { entry.notes = event.target.value; }, "Updated notes")} />
      <Section title="Character, Species, and Fandom-Style Profile" icon={<Sparkles size={18} />}>
        <p className="quiet">Use this for fictional characters, fandom-style biographies, non-human species, hybrids, original characters, worldbuilding notes, or any profile that needs long-form encyclopedia fields.</p>
        <div className="settings-grid">
          <Field label="Species" value={characterProfile.species} onChange={(value) => updateCharacterProfile(profile => { profile.species = value; }, "Updated species")} />
          <Field label="Subspecies" value={characterProfile.subspecies} onChange={(value) => updateCharacterProfile(profile => { profile.subspecies = value; }, "Updated subspecies")} />
          <Field label="Species name / scientific name" value={characterProfile.speciesName} onChange={(value) => updateCharacterProfile(profile => { profile.speciesName = value; }, "Updated species name")} />
          <Field label="Titles / roles" value={characterProfile.titles} onChange={(value) => updateCharacterProfile(profile => { profile.titles = value; }, "Updated titles")} />
          <Field label="Affiliations / groups" value={characterProfile.affiliations} onChange={(value) => updateCharacterProfile(profile => { profile.affiliations = value; }, "Updated affiliations")} />
          <Field label="Canon status / continuity" value={characterProfile.canonStatus} onChange={(value) => updateCharacterProfile(profile => { profile.canonStatus = value; }, "Updated canon status")} />
          <Field label="Fandom, story, or universe source" value={characterProfile.fandomSource} onChange={(value) => updateCharacterProfile(profile => { profile.fandomSource = value; }, "Updated fandom source")} />
          <Field label="Culture / clan / nation" value={characterProfile.culture} onChange={(value) => updateCharacterProfile(profile => { profile.culture = value; }, "Updated culture")} />
          <div className="toggle-row">
            <label><input type="checkbox" checked={characterProfile.hybrid} onChange={(event) => updateCharacterProfile(profile => { profile.hybrid = event.target.checked; }, "Updated hybrid status")} /> Hybrid character</label>
          </div>
          <Field label="Hybrid lineage / ancestry mix" value={characterProfile.hybridLineage} onChange={(value) => updateCharacterProfile(profile => { profile.hybridLineage = value; }, "Updated hybrid lineage")} />
        </div>
        <div className="long-form-grid">
          <label className="field"><span>Appearance</span><textarea className="control" value={characterProfile.appearance} rows={4} onChange={(event) => updateCharacterProfile(profile => { profile.appearance = event.target.value; }, "Updated appearance")} /></label>
          <label className="field"><span>Personality</span><textarea className="control" value={characterProfile.personality} rows={4} onChange={(event) => updateCharacterProfile(profile => { profile.personality = event.target.value; }, "Updated personality")} /></label>
          <label className="field"><span>Abilities, powers, skills, or traits</span><textarea className="control" value={characterProfile.abilities} rows={4} onChange={(event) => updateCharacterProfile(profile => { profile.abilities = event.target.value; }, "Updated abilities")} /></label>
          <label className="field"><span>Long-form character article / fandom-style paragraphs</span><textarea className="control" value={characterProfile.longFormProfile} rows={7} onChange={(event) => updateCharacterProfile(profile => { profile.longFormProfile = event.target.value; }, "Updated character article")} /></label>
          <label className="field"><span>Creator notes / headcanon / continuity notes</span><textarea className="control" value={characterProfile.creatorNotes} rows={5} onChange={(event) => updateCharacterProfile(profile => { profile.creatorNotes = event.target.value; }, "Updated creator notes")} /></label>
        </div>
        <p className="quiet">{characterSpeciesLine({ ...target, characterProfile }) || "No species or character profile summary recorded yet."}</p>
      </Section>
      <Section title="Work, Company, and Character Career Files" icon={<Archive size={18} />}>
        <div className="settings-grid">
          <Field label="Current company / workplace" value={characterProfile.affiliations} onChange={(value) => updateCharacterProfile(profile => { profile.affiliations = value; }, "Updated workplace affiliations")} />
          <Field label="Job title, rank, role, or contract title" value={characterProfile.titles} onChange={(value) => updateCharacterProfile(profile => { profile.titles = value; }, "Updated work titles")} />
          <Field label="Work style, obligations, or contract notes" value={characterProfile.relationshipDynamics} onChange={(value) => updateCharacterProfile(profile => { profile.relationshipDynamics = value; }, "Updated work relationship dynamics")} />
          <label className="field">
            <span>Work or company file type</span>
            <select className="control" value={workFileKind} onChange={(event) => setWorkFileKind(event.target.value as typeof workFileKind)}>
              {WORK_FILE_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="button secondary"><Upload size={16} />Upload work/company file<input aria-label="Work or company file upload" type="file" multiple hidden onChange={(event) => handleWorkFileUpload(target, event)} /></label>
        </div>
        <div className="sensitive-file-list" aria-label="Work and company files">
          {workFiles.map(file => <button key={file.id} onClick={() => { setSelectedMediaId(file.id); setView("media"); }}><FileText size={17} /><span><strong>{file.title}</strong><small>{file.tags.filter(tag => tag !== "work-file").join(", ") || file.type}</small></span><ChevronRight size={15} /></button>)}
          {!workFiles.length && <p className="quiet">No work contracts, company files, or character career files uploaded for this person yet.</p>}
        </div>
      </Section>
      <Section title="Death, Burial, Cemetery, and Memorial Details" icon={<Map size={18} />}>
        <div className="settings-grid">
          <Field label="Place where person died" value={deathDetails.deathPlace} onChange={(value) => updateDeathDetails(details => { details.deathPlace = value; }, "Updated death place")} />
          <Field label="Hospital or facility where person died" value={deathDetails.deathHospital} onChange={(value) => updateDeathDetails(details => { details.deathHospital = value; }, "Updated death hospital")} />
          <Field label="Death location address" value={deathDetails.deathAddress} onChange={(value) => updateDeathDetails(details => { details.deathAddress = value; }, "Updated death address")} />
          <label className="field">
            <span>Burial or memorial type</span>
            <select className="control" aria-label="Burial or memorial type" value={deathDetails.burialType} onChange={(event) => updateDeathDetails(details => { details.burialType = event.target.value; }, "Updated burial type")}>
              {BURIAL_TYPE_OPTIONS.map(type => <option key={type} value={type}>{type || "Not recorded"}</option>)}
            </select>
          </label>
          <DateModeField label="Burial date" value={deathDetails.burialDate} mode={dateModes.burial} onModeChange={(mode) => setDateModes({ ...dateModes, burial: mode })} onChange={(value) => updateDeathDetails(details => { details.burialDate = value; }, "Updated burial date")} />
          <Field label="Burial site" value={deathDetails.burialSite} onChange={(value) => updateDeathDetails(details => { details.burialSite = value; }, "Updated burial site")} />
          <Field label="Cemetery site" value={deathDetails.cemeteryName} onChange={(value) => updateDeathDetails(details => { details.cemeteryName = value; }, "Updated cemetery site")} />
          <Field label="Cemetery location / address" value={deathDetails.cemeteryAddress} onChange={(value) => updateDeathDetails(details => { details.cemeteryAddress = value; }, "Updated cemetery address")} />
          <Field label="Cemetery plot / section" value={deathDetails.cemeteryPlot} onChange={(value) => updateDeathDetails(details => { details.cemeteryPlot = value; }, "Updated cemetery plot")} />
          <Field label="Grave number" value={deathDetails.graveNumber} onChange={(value) => updateDeathDetails(details => { details.graveNumber = value; }, "Updated grave number")} />
          <Field label="Cemetery latitude" value={deathDetails.latitude} onChange={(value) => updateDeathDetails(details => { details.latitude = value; }, "Updated cemetery latitude")} />
          <Field label="Cemetery longitude" value={deathDetails.longitude} onChange={(value) => updateDeathDetails(details => { details.longitude = value; }, "Updated cemetery longitude")} />
          <Field label="Funeral home" value={deathDetails.funeralHome} onChange={(value) => updateDeathDetails(details => { details.funeralHome = value; }, "Updated funeral home")} />
          <Field label="Memorial URL" value={deathDetails.memorialUrl} onChange={(value) => updateDeathDetails(details => { details.memorialUrl = value; }, "Updated memorial URL")} />
          <Field label="Gravestone inscription" value={deathDetails.gravestoneInscription} onChange={(value) => updateDeathDetails(details => { details.gravestoneInscription = value; }, "Updated gravestone inscription")} />
          <Field label="Death and burial notes" value={deathDetails.deathNotes} onChange={(value) => updateDeathDetails(details => { details.deathNotes = value; }, "Updated death notes")} />
          <div className="toggle-row">
            <label><input type="checkbox" checked={deathDetails.hasGravestone} onChange={(event) => updateDeathDetails(details => { details.hasGravestone = event.target.checked; }, "Updated gravestone status")} /> Has gravestone</label>
          </div>
        </div>
      </Section>
      <div>
        <label className="field-label">Labels</label>
        <div className="badge-wrap">
          {state.labels.map((label) => (
            <button key={label} className={`label-chip ${target.labels.includes(label) ? "selected" : ""}`} onClick={() => updatePerson(target.id, (entry) => {
              entry.labels = entry.labels.includes(label) ? entry.labels.filter((item) => item !== label) : [...entry.labels, label];
            }, "Updated labels")}>{label}</button>
          ))}
          <button className="label-chip add" onClick={() => {
            const label = prompt("New label name");
            if (label) mutate("Created label", (draft) => draft.labels.push(label));
          }}>+ label</button>
        </div>
      </div>
      <div className="two-col">
        <div>
          <h3>Facts</h3>
          {target.facts.map((fact) => (
            <div key={fact.id} className="compact-row">
              <Badge>{fact.type}</Badge>
              <span>{fact.value}</span>
              <TermMeaning term={fact.value || fact.type} customEntries={customGlossaryEntries} />
              {canManagePrivacy && <label className="field"><span>Fact visibility</span><select className="control" aria-label={`Visibility for fact ${fact.type}`} value={fact.private ? "private" : "shared"} onChange={event => mutate("Updated fact visibility", draft => { const record = draft.people.find(item => item.id === target.id)?.facts.find(item => item.id === fact.id); if (record) record.private = event.target.value === "private"; })}>{Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
              {itemActions({ kind: "facts", ownerId: target.id, id: fact.id }, `${fact.type}: ${fact.value}`)}
            </div>
          ))}
          <div className="inline-form">
            <select className="control" aria-label="Fact type" value={newFact.type} onChange={(event) => setNewFact({ type: event.target.value, value: "", customValue: "" })}>
              {[...FACT_TYPES, ...state.customFactTypes].map((type) => <option key={type}>{type}</option>)}
            </select>
            {factCatalog ? <>
              <select className="control" aria-label={`${newFact.type} option`} value={newFact.value} onChange={(event) => setNewFact({ ...newFact, value: event.target.value, customValue: event.target.value === OTHER_OPTION ? newFact.customValue : "" })}>
                <option value="">Choose {newFact.type.toLowerCase()}</option>
                {factCatalog.map(entry => <option key={entry.label} value={entry.label}>{entry.label}</option>)}
                <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
              </select>
              {newFact.value === OTHER_OPTION && <input className="control" aria-label={`Custom ${newFact.type}`} value={newFact.customValue} placeholder={`Describe ${newFact.type.toLowerCase()}`} onChange={(event) => setNewFact({ ...newFact, customValue: event.target.value })} />}
            </> : <input className="control" value={newFact.value} placeholder="Fact value" onChange={(event) => setNewFact({ ...newFact, value: event.target.value })} />}
            <Button onClick={addFact} ariaLabel="Add fact" icon={<Plus size={16} />}>Add</Button>
          </div>
          <TermMeaning term={newFact.value && newFact.value !== OTHER_OPTION ? newFact.value : newFact.type} customEntries={customGlossaryEntries} />
          {factCatalog && <p className="quiet">Choose a recorded term, or use “Other / self-described.” KinForge records the source wording and does not infer a person's religion, beliefs, diagnosis, or support needs.</p>}
          <details className="custom-term-details">
            <summary>Add a custom religion, belief, practice, or wellbeing term</summary>
            <div className="settings-grid">
              <label className="field"><span>Term category</span><select className="control" aria-label="Custom term category" value={customFactTermDraft.category} onChange={event => setCustomFactTermDraft({ ...customFactTermDraft, category: event.target.value as CustomFactTermCategory })}>
                {(["Religion", "Belief", "Religious practice", "Mental health condition", "Mental health support need", "Identity, sexuality, or gender", "Custom fact"] as CustomFactTermCategory[]).map(category => <option key={category} value={category}>{category}</option>)}
              </select></label>
              <label className="field"><span>Your term</span><input className="control" aria-label="Custom term name" value={customFactTermDraft.term} placeholder="e.g. fictional tradition" onChange={event => setCustomFactTermDraft({ ...customFactTermDraft, term: event.target.value })} /></label>
              <label className="field"><span>Plain-language meaning or practice rules</span><textarea className="control" aria-label="Custom term meaning" value={customFactTermDraft.meaning} placeholder="Explain what this term means and cite your source in the person's record." onChange={event => setCustomFactTermDraft({ ...customFactTermDraft, meaning: event.target.value })} /></label>
              <Button ariaLabel="Save custom term" variant="secondary" onClick={addCustomFactTerm} icon={<Plus size={16} />}>Save custom term</Button>
            </div>
            <p className="quiet">Custom terms are saved to this account's library and appear in the matching fact selector, the religious terms section, and searchable term meanings. They do not change the meaning of similarly named real-world traditions.</p>
            {!!state.customFactTerms.length && <div className="custom-term-list">{state.customFactTerms.map(entry => <div className="compact-row" key={entry.id}><Badge>{entry.category}</Badge><span><strong>{entry.term}</strong> - {entry.meaning}</span><button className="icon-button" aria-label={`Remove custom term ${entry.term}`} title={`Remove custom term ${entry.term}`} onClick={() => mutate("Removed custom term", draft => { draft.customFactTerms = (draft.customFactTerms || []).filter(item => item.id !== entry.id); })}><X size={16} /></button></div>)}</div>}
          </details>
        </div>
        <div>
          <div className="section-mini-heading"><h3>Events</h3><SymbolLegend /></div>
          {target.eventIds.map((eventId) => state.events.find((event) => event.id === eventId)).filter(Boolean).map((event) => (
            <div key={event!.id} className="compact-row">
              <Badge><EventGlyph type={event!.type} />{event!.type}</Badge>
              <span>{event!.date || "undated"} {event!.description}</span>
              <TermMeaning term={event!.type} />
              {canManagePrivacy && <label className="field"><span>Event visibility</span><select className="control" aria-label={`Visibility for ${event!.type}`} value={event!.private ? "private" : "shared"} onChange={e => mutate("Updated event visibility", draft => { const record = draft.events.find(item => item.id === event!.id); if (record) record.private = e.target.value === "private"; })}>{Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
              {itemActions({ kind: "events", id: event!.id }, `${event!.type}: ${event!.description}`)}
            </div>
          ))}
          <div className="inline-form">
            <select className="control" value={newEvent.type} onChange={(event) => setNewEvent({ ...newEvent, type: event.target.value })}>
              {[...EVENT_TYPES, ...state.customEventTypes].map((type) => <option key={type}>{type}</option>)}
            </select>
            <DateModeField compact label="Event date" value={newEvent.date} mode={dateModes.event} onModeChange={(mode) => setDateModes({ ...dateModes, event: mode })} onChange={(date) => setNewEvent({ ...newEvent, date })} />
            <input className="control" value={newEvent.description} placeholder="Event description" onChange={(event) => setNewEvent({ ...newEvent, description: event.target.value })} />
            <Button onClick={addEvent} icon={<Plus size={16} />}>Add</Button>
          </div>
          <TermMeaning term={newEvent.type} />
        </div>
      </div>
      <Section title="Sensitive detail visibility" icon={<Shield size={18} />}>
        <label className="field"><span>Personal and government details</span><select className="control" aria-label="Sensitive detail visibility" disabled={!canManagePrivacy} value={target.sensitiveVisibility || "private"} onChange={event => updatePerson(target.id, entry => { entry.sensitiveVisibility = event.target.value === "shared" ? "shared" : "private"; }, "Updated sensitive detail visibility")}>
          {Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <p className="quiet">Private details are for the library owner's account. Shared details are available to signed-in, invited library members, never guest visitors. Files, events and protection records have their own visibility settings.</p>
      </Section>
      {(canManagePrivacy || target.sensitiveVisibility === "shared") && <><Section title="Birth, Care Team, and Associated Services" icon={<Shield size={18} />}>
        <div className="settings-grid">
          <label className="field">
            <span>Birth method</span>
            <select className="control" value={target.government.birthMethod || ""} onChange={(event) => updatePerson(target.id, (entry) => { entry.government.birthMethod = event.target.value; }, "Updated birth method")}>
              {BIRTH_METHODS.map(method => <option key={method} value={method}>{method || "Not recorded"}</option>)}
            </select>
          </label>
          <Field label="Birth assistant / surrogate / notes" value={target.government.birthAssistant || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.birthAssistant = value; }, "Updated birth assistant")} />
          <Field label="Birth notes" value={target.government.birthNotes || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.birthNotes = value; }, "Updated birth notes")} />
          <Field label="Doctor" value={target.government.doctorName || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.doctorName = value; }, "Updated doctor")} />
          <Field label="Doctor practice / hospital" value={target.government.doctorPractice || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.doctorPractice = value; }, "Updated doctor practice")} />
          <label className="field">
            <span>In-patient status</span>
            <select className="control" value={target.government.inpatientStatus || ""} onChange={(event) => updatePerson(target.id, (entry) => { entry.government.inpatientStatus = event.target.value; }, "Updated in-patient status")}>
              {CARE_STATUSES.map(status => <option key={status} value={status}>{status || "Not recorded"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Daycare status</span>
            <select className="control" value={target.government.daycareStatus || ""} onChange={(event) => updatePerson(target.id, (entry) => { entry.government.daycareStatus = event.target.value; }, "Updated daycare status")}>
              {CARE_STATUSES.map(status => <option key={status} value={status}>{status || "Not recorded"}</option>)}
            </select>
          </label>
          <Field label="Care team notes" value={target.government.careTeamNotes || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.careTeamNotes = value; }, "Updated care team notes")} />
        </div>
      </Section>
      <Section title="Medical Files, Diagnoses, Conditions, and Accessibility Aids" icon={<Brain size={18} />}>
        <div className="settings-grid">
          <label className="field">
            <span>Record type</span>
            <select className="control" aria-label="Medical record type" value={medicalRecordDraft.type} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, type: event.target.value })}>
              {MEDICAL_RECORD_TYPE_OPTIONS.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Condition or support category</span>
            <select className="control" aria-label="Medical condition category" value={medicalRecordDraft.conditionCategory} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, conditionCategory: event.target.value, diagnosisName: "", customDiagnosisName: "", assistiveDevice: "", customAssistiveDevice: "" })}>
              {MEDICAL_CONDITION_CATEGORIES.map(category => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Condition or disorder type</span>
            <select className="control" aria-label="Condition or disorder type" value={medicalRecordDraft.conditionType} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, conditionType: event.target.value })}>
              {CONDITION_OR_DISORDER_TYPES.map(type => <option key={type} value={type}>{type || "Not recorded"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Specific subtype or disorder branch</span>
            <select className="control" aria-label="Specific subtype or disorder branch" value={medicalRecordDraft.disorderType} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, disorderType: event.target.value })}>
              {CONDITION_OR_DISORDER_TYPES.map(type => <option key={type} value={type}>{type || "Not recorded"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Body system / area affected</span>
            <select className="control" aria-label="Body system or area affected" value={medicalRecordDraft.bodySystem} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, bodySystem: event.target.value })}>
              {BODY_SYSTEM_OPTIONS.map(system => <option key={system} value={system}>{system || "Not recorded"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Diagnosis, condition, or need</span>
            <select className="control" aria-label="Diagnosis, condition, or need" value={medicalRecordDraft.diagnosisName} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, diagnosisName: event.target.value, customDiagnosisName: event.target.value === OTHER_OPTION ? medicalRecordDraft.customDiagnosisName : "" })}>
              <option value="">Choose from researched list</option>
              {medicalConditionOptions.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
              <option value={OTHER_OPTION}>{OTHER_OPTION}</option>
            </select>
          </label>
          {medicalRecordDraft.diagnosisName === OTHER_OPTION && <label className="field"><span>Other diagnosis, condition, or need</span><input className="control" value={medicalRecordDraft.customDiagnosisName} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, customDiagnosisName: event.target.value })} /></label>}
          <DateModeField label="Date of diagnosis or assessment" value={medicalRecordDraft.diagnosisDate} mode={dateModes.event} onModeChange={(mode) => setDateModes({ ...dateModes, event: mode })} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, diagnosisDate: value })} />
          <DateModeField label="Onset date" value={medicalRecordDraft.onsetDate} mode={dateModes.event} onModeChange={(mode) => setDateModes({ ...dateModes, event: mode })} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, onsetDate: value })} />
          <DateModeField label="Review date" value={medicalRecordDraft.reviewDate} mode={dateModes.event} onModeChange={(mode) => setDateModes({ ...dateModes, event: mode })} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, reviewDate: value })} />
          <label className="field">
            <span>Diagnostic standard / evidence type</span>
            <select className="control" aria-label="Diagnostic standard" value={medicalRecordDraft.diagnosticStandard} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, diagnosticStandard: event.target.value })}>
              {DIAGNOSTIC_STANDARDS.map(standard => <option key={standard} value={standard}>{standard || "Not recorded"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Course / pattern</span>
            <select className="control" aria-label="Condition course" value={medicalRecordDraft.course} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, course: event.target.value })}>
              {CONDITION_COURSE_OPTIONS.map(option => <option key={option} value={option}>{option || "Not recorded"}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Care level</span>
            <select className="control" aria-label="Care level" value={medicalRecordDraft.careLevel} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, careLevel: event.target.value })}>
              {CARE_LEVEL_OPTIONS.map(option => <option key={option} value={option}>{option || "Not recorded"}</option>)}
            </select>
          </label>
          <Field label="Hospital, clinic, or service" value={medicalRecordDraft.hospitalOrClinic} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, hospitalOrClinic: value })} />
          <Field label="Doctor who gave diagnosis" value={medicalRecordDraft.diagnosingDoctor} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, diagnosingDoctor: value })} />
          <Field label="Psychologist" value={medicalRecordDraft.psychologist} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, psychologist: value })} />
          <Field label="Psychiatrist" value={medicalRecordDraft.psychiatrist} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, psychiatrist: value })} />
          <Field label="Occupational therapist / OT" value={medicalRecordDraft.occupationalTherapist} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, occupationalTherapist: value })} />
          <label className="field">
            <span>Mobility, accessibility, or disability aid</span>
            <select className="control" aria-label="Mobility, accessibility, or disability aid" value={medicalRecordDraft.assistiveDevice} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, assistiveDevice: event.target.value, customAssistiveDevice: event.target.value === OTHER_OPTION ? medicalRecordDraft.customAssistiveDevice : "" })}>
              <option value="">No aid selected</option>
              {ACCESSIBILITY_AID_OPTIONS.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
            </select>
          </label>
          {medicalRecordDraft.assistiveDevice === OTHER_OPTION && <label className="field"><span>Other aid</span><input className="control" value={medicalRecordDraft.customAssistiveDevice} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, customAssistiveDevice: event.target.value })} /></label>}
          <label className="field"><span>Diagnostic criteria recorded in the file</span><textarea className="control" rows={4} value={medicalRecordDraft.criteriaMet} placeholder={medicalCriteriaHint || "Paste or summarise the clinician/source criteria here. KinForge records the source; it does not diagnose."} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, criteriaMet: event.target.value })} /></label>
          <label className="field"><span>Symptoms, traits, or functional impact</span><textarea className="control" rows={4} value={medicalRecordDraft.symptomsOrTraits} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, symptomsOrTraits: event.target.value })} /></label>
          <label className="field"><span>Functional impact / daily-life effect</span><textarea className="control" rows={4} value={medicalRecordDraft.functionalImpact} onChange={(event) => setMedicalRecordDraft({ ...medicalRecordDraft, functionalImpact: event.target.value })} /></label>
          <Field label="Progression notes" value={medicalRecordDraft.progression} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, progression: value })} />
          <Field label="Triggers or flare factors" value={medicalRecordDraft.triggers} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, triggers: value })} />
          <Field label="Risk factors" value={medicalRecordDraft.riskFactors} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, riskFactors: value })} />
          <Field label="Differential diagnosis / ruled-out conditions" value={medicalRecordDraft.differentialDiagnosis} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, differentialDiagnosis: value })} />
          <Field label="Comorbidities / related diagnoses" value={medicalRecordDraft.comorbidities} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, comorbidities: value })} />
          <Field label="Complications" value={medicalRecordDraft.complications} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, complications: value })} />
          <Field label="Hereditary or family-history notes" value={medicalRecordDraft.hereditaryOrFamilyHistory} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, hereditaryOrFamilyHistory: value })} />
          <Field label="Prognosis / expected course" value={medicalRecordDraft.prognosis} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, prognosis: value })} />
          <Field label="Emergency plan" value={medicalRecordDraft.emergencyPlan} onChange={(value) => setMedicalRecordDraft({ ...medicalRecordDraft, emergencyPlan: value })} />
          <Button ariaLabel="Add medical diagnosis record" onClick={addMedicalRecord} icon={<Plus size={16} />}>Add diagnosis</Button>
        </div>
        {medicalCriteriaHint && <p className="quiet"><strong>Criteria prompt:</strong> {medicalCriteriaHint}</p>}
        <div className="sensitive-upload-panel">
          <label className="field">
            <span>Medical file type</span>
            <select className="control" value={medicalFileKind} onChange={(event) => setMedicalFileKind(event.target.value as typeof medicalFileKind)}>
              {MEDICAL_FILE_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="button secondary"><Upload size={16} />Upload medical file<input aria-label="Medical file upload" type="file" multiple hidden onChange={(event) => handleMedicalFileUpload(target, undefined, event)} /></label>
        </div>
        <div className="stack">
          {medicalRecords.map(record => {
            const linkedFiles = medicalFiles.filter(file => record.mediaIds.includes(file.id));
            return <article className="record-card" key={record.id}>
              <div className="saved-item-heading"><strong>{record.diagnosisName || record.type}</strong>{itemActions({ kind: "medicalRecords", id: record.id }, `${record.type}: ${record.diagnosisName || "Diagnosis not named"}`)}</div>
              <div className="settings-grid">
                <label className="field"><span>Record type</span><select className="control" value={record.type} onChange={event => updateMedicalRecord(record.id, entry => { entry.type = event.target.value; })}>{MEDICAL_RECORD_TYPE_OPTIONS.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}</select></label>
                <Field label="Diagnosis / condition / need" value={record.diagnosisName} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.diagnosisName = value; })} />
                <Field label="Category" value={record.conditionCategory} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.conditionCategory = value; })} />
                <label className="field"><span>Condition or disorder type</span><select className="control" value={record.conditionType} onChange={event => updateMedicalRecord(record.id, entry => { entry.conditionType = event.target.value; })}>{CONDITION_OR_DISORDER_TYPES.map(type => <option key={type} value={type}>{type || "Not recorded"}</option>)}</select></label>
                <label className="field"><span>Specific subtype or disorder branch</span><select className="control" value={record.disorderType} onChange={event => updateMedicalRecord(record.id, entry => { entry.disorderType = event.target.value; })}>{CONDITION_OR_DISORDER_TYPES.map(type => <option key={type} value={type}>{type || "Not recorded"}</option>)}</select></label>
                <label className="field"><span>Body system / area affected</span><select className="control" value={record.bodySystem} onChange={event => updateMedicalRecord(record.id, entry => { entry.bodySystem = event.target.value; })}>{BODY_SYSTEM_OPTIONS.map(system => <option key={system} value={system}>{system || "Not recorded"}</option>)}</select></label>
                <Field label="Date of diagnosis" value={record.diagnosisDate} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.diagnosisDate = value; })} />
                <Field label="Onset date" value={record.onsetDate} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.onsetDate = value; })} />
                <Field label="Review date" value={record.reviewDate} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.reviewDate = value; })} />
                <label className="field"><span>Visibility</span><select className="control" value={record.visibility} disabled={!canManagePrivacy} onChange={event => updateMedicalRecord(record.id, entry => { entry.visibility = event.target.value === "shared" ? "shared" : "private"; })}>{Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <Field label="Diagnostic standard" value={record.diagnosticStandard} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.diagnosticStandard = value; })} />
                <label className="field"><span>Diagnostic criteria / standard wording</span><textarea className="control" rows={3} value={record.diagnosticCriteria} onChange={(event) => updateMedicalRecord(record.id, entry => { entry.diagnosticCriteria = event.target.value; })} /></label>
                <label className="field"><span>Criteria met / assessment findings</span><textarea className="control" rows={4} value={record.criteriaMet} onChange={(event) => updateMedicalRecord(record.id, entry => { entry.criteriaMet = event.target.value; })} /></label>
                <label className="field"><span>Symptoms, traits, or impact</span><textarea className="control" rows={4} value={record.symptomsOrTraits} onChange={(event) => updateMedicalRecord(record.id, entry => { entry.symptomsOrTraits = event.target.value; })} /></label>
                <label className="field"><span>Functional impact / daily-life effect</span><textarea className="control" rows={4} value={record.functionalImpact} onChange={(event) => updateMedicalRecord(record.id, entry => { entry.functionalImpact = event.target.value; })} /></label>
                <Field label="Severity" value={record.severity} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.severity = value; })} />
                <Field label="Status" value={record.status} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.status = value; })} />
                <label className="field"><span>Course / pattern</span><select className="control" value={record.course} onChange={event => updateMedicalRecord(record.id, entry => { entry.course = event.target.value; })}>{CONDITION_COURSE_OPTIONS.map(option => <option key={option} value={option}>{option || "Not recorded"}</option>)}</select></label>
                <Field label="Progression notes" value={record.progression} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.progression = value; })} />
                <Field label="Triggers or flare factors" value={record.triggers} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.triggers = value; })} />
                <Field label="Risk factors" value={record.riskFactors} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.riskFactors = value; })} />
                <Field label="Differential diagnosis / ruled-out conditions" value={record.differentialDiagnosis} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.differentialDiagnosis = value; })} />
                <Field label="Comorbidities / related diagnoses" value={record.comorbidities} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.comorbidities = value; })} />
                <Field label="Complications" value={record.complications} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.complications = value; })} />
                <Field label="Hereditary or family-history notes" value={record.hereditaryOrFamilyHistory} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.hereditaryOrFamilyHistory = value; })} />
                <Field label="Prognosis / expected course" value={record.prognosis} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.prognosis = value; })} />
                <label className="field"><span>Care level</span><select className="control" value={record.careLevel} onChange={event => updateMedicalRecord(record.id, entry => { entry.careLevel = event.target.value; })}>{CARE_LEVEL_OPTIONS.map(option => <option key={option} value={option}>{option || "Not recorded"}</option>)}</select></label>
                <Field label="Emergency plan" value={record.emergencyPlan} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.emergencyPlan = value; })} />
                <Field label="Hospital or clinic" value={record.hospitalOrClinic} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.hospitalOrClinic = value; })} />
                <Field label="Hospital address" value={record.hospitalAddress} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.hospitalAddress = value; })} />
                <Field label="Diagnosing doctor" value={record.diagnosingDoctor} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.diagnosingDoctor = value; })} />
                <Field label="Psychologist" value={record.psychologist} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.psychologist = value; })} />
                <Field label="Psychiatrist" value={record.psychiatrist} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.psychiatrist = value; })} />
                <Field label="Occupational therapist / OT" value={record.occupationalTherapist} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.occupationalTherapist = value; })} />
                <Field label="Physiotherapist" value={record.physiotherapist} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.physiotherapist = value; })} />
                <Field label="Speech therapist" value={record.speechTherapist} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.speechTherapist = value; })} />
                <Field label="Social worker" value={record.socialWorker} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.socialWorker = value; })} />
                <Field label="Other clinicians" value={record.otherClinicians} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.otherClinicians = value; })} />
                <Field label="Medications" value={record.medications} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.medications = value; })} />
                <Field label="Therapies" value={record.therapies} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.therapies = value; })} />
                <Field label="Accommodations" value={record.accommodations} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.accommodations = value; })} />
                <Field label="Mobility/accessibility/disability aids" value={record.assistiveDevices} onChange={(value) => updateMedicalRecord(record.id, entry => { entry.assistiveDevices = value; })} />
                <label className="field"><span>Notes</span><textarea className="control" rows={4} value={record.notes} onChange={(event) => updateMedicalRecord(record.id, entry => { entry.notes = event.target.value; })} /></label>
              </div>
              <TermMeaning term={record.diagnosisName || record.type} customEntries={customGlossaryEntries} />
              <div className="sensitive-upload-panel">
                <label className="button secondary"><Upload size={16} />Upload file to this diagnosis<input aria-label={`Upload medical file for ${record.diagnosisName || record.type}`} type="file" multiple hidden onChange={(event) => handleMedicalFileUpload(target, record.id, event)} /></label>
                <div className="button-row">
                  {medicalFiles.map(file => <label key={file.id} className="checkbox-pill"><input type="checkbox" checked={record.mediaIds.includes(file.id)} onChange={event => updateMedicalRecord(record.id, entry => { entry.mediaIds = event.target.checked ? [...new Set([...entry.mediaIds, file.id])] : entry.mediaIds.filter(id => id !== file.id); })} />{file.title}</label>)}
                </div>
                {!!linkedFiles.length && <p className="quiet">Attached files: {linkedFiles.map(file => file.title).join(", ")}</p>}
              </div>
            </article>;
          })}
          {!medicalRecords.length && <p className="quiet">No medical, diagnosis, condition, or accessibility-aid records saved for this person yet.</p>}
        </div>
        <div className="sensitive-file-list" aria-label="Medical files">
          {medicalFiles.map(file => <button key={file.id} onClick={() => { setSelectedMediaId(file.id); setView("media"); }}><FileText size={17} /><span><strong>{file.title}</strong><small>{file.tags.filter(tag => tag !== "medical-file").join(", ") || file.type}</small></span><ChevronRight size={15} /></button>)}
          {!medicalFiles.length && <p className="quiet">No medical files uploaded for this person yet.</p>}
        </div>
      </Section>
      <Section title="Government, Custody, and Sensitive Details" icon={<Shield size={18} />}>
        <div className="settings-grid">
          <Field label="Government events" value={target.government.governmentEvents} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.governmentEvents = value; }, "Updated government details")} />
          <Field label="Agency" value={target.government.agency} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.agency = value; }, "Updated agency")} />
          <Field label="Case number" value={target.government.caseNumber} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.caseNumber = value; }, "Updated case number")} />
          <Field label="Criminal record" value={target.government.criminalRecord} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.criminalRecord = value; }, "Updated criminal record")} />
          <Field label="Foster record" value={target.government.fosterRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.fosterRecord = value; }, "Updated foster record")} />
          <Field label="Custody change record" value={target.government.custodyChangeRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.custodyChangeRecord = value; }, "Updated custody change record")} />
          <Field label="Removal record" value={target.government.removalRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.removalRecord = value; }, "Updated removal record")} />
          <Field label="Protective Services Record" value={target.government.protectiveServicesRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.protectiveServicesRecord = value; }, "Updated protective-services record")} />
          <Field label="Personal Protection Order Record" value={target.government.personalProtectionOrderRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.personalProtectionOrderRecord = value; }, "Updated protection order record")} />
          <Field label="Restraining Order Record" value={target.government.restrainingOrderRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.restrainingOrderRecord = value; }, "Updated restraining order record")} />
          <Field label="House Arrest Record" value={target.government.houseArrestRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.houseArrestRecord = value; }, "Updated house arrest record")} />
          <Field label="Arrest Record" value={target.government.arrestRecord || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.arrestRecord = value; }, "Updated arrest record")} />
          <Field label="Government facility" value={target.government.governmentFacility || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.governmentFacility = value; }, "Updated government facility")} />
          <Field label="Government protection status" value={target.government.governmentProtectionStatus || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.governmentProtectionStatus = value; }, "Updated government protection")} />
          <Field label="Social worker" value={target.government.socialWorkerName || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.socialWorkerName = value; }, "Updated social worker")} />
          <Field label="Social worker agency" value={target.government.socialWorkerAgency || ""} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.socialWorkerAgency = value; }, "Updated social worker agency")} />
          <Field label="Custody notes" value={target.government.custodyNotes} onChange={(value) => updatePerson(target.id, (entry) => { entry.government.custodyNotes = value; }, "Updated custody notes")} />
          <div className="toggle-row">
            <label><input type="checkbox" checked={target.government.protectiveServices} onChange={(event) => updatePerson(target.id, (entry) => { entry.government.protectiveServices = event.target.checked; }, "Updated protective services")} /> Child in protective services</label>
            <label><input type="checkbox" checked={target.government.custodyRemoved} onChange={(event) => updatePerson(target.id, (entry) => { entry.government.custodyRemoved = event.target.checked; }, "Updated custody removal")} /> Custody removed from parents</label>
          </div>
        </div>
        <div className="sensitive-upload-panel">
          <label className="field">
            <span>Government file type</span>
            <select className="control" value={governmentFileKind} onChange={(event) => setGovernmentFileKind(event.target.value as typeof governmentFileKind)}>
              {GOVERNMENT_FILE_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="button secondary"><Upload size={16} />Upload government file<input aria-label="Government file upload" type="file" multiple hidden onChange={(event) => handleGovernmentFileUpload(target, event)} /></label>
          <div className="sensitive-file-list" aria-label="Government files">
            {governmentFiles.map(file => <button key={file.id} onClick={() => { setSelectedMediaId(file.id); setView("media"); }}><FileText size={17} /><span><strong>{file.title}</strong><small>{file.tags.filter(tag => tag !== "government-file").join(", ") || file.type}</small></span><ChevronRight size={15} /></button>)}
            {!governmentFiles.length && <p className="quiet">No sensitive government files uploaded for this person yet.</p>}
          </div>
        </div>
      </Section></>}
      {protectionPanel("person", target.id)}
    </div>
    );
  };

  const protectionPanel = (entityKind: "person" | "family" | "relationship", entityId: string) => <ProtectionPanel state={state} treeId={treeId} entityKind={entityKind} entityId={entityId} canManagePrivacy={canManagePrivacy} readOnly={cloud?.readOnly}
    onChange={records => mutate("Updated protection records", draft => { draft.protectionRecords = records; })}
    onDelete={id => requestDelete({ kind: "protectionRecords", id })}
    onDownload={id => downloadItem({ kind: "protectionRecords", id })} />;

  const renderTree = () => <TreeWorkspace key={treeId} state={state} treeId={treeId} person={person}
    canEditSensitive={canManagePrivacy || person?.sensitiveVisibility === "shared"}
    onSelect={setSelectedPersonId} onProfile={openPerson} onUpdate={updatePerson}
    onAdd={(created, type, fromId, toId, otherParentId, roles) => {
      mutate("Added family member", draft => {
        draft.people.push(created);
        rememberRelationshipSubtype(draft, roles?.relationshipSubtype);
        if (type && fromId && toId) linkPeople(draft, treeId, type, fromId, toId, roles?.parent, roles?.parentage, type === "sibling" ? roles?.siblingStatus : undefined, roles?.relationshipSubtype);
        if (type === "parent-child" && otherParentId && toId) linkPeople(draft, treeId, "parent-child", otherParentId, toId, roles?.otherParent, roles?.otherParentage, undefined, roles?.relationshipSubtype);
      });
      setSelectedPersonId(created.id);
    }}
    onLink={(type, fromId, toId, otherParentId, roles) => mutate("Linked family members", draft => {
      rememberRelationshipSubtype(draft, roles?.relationshipSubtype);
      linkPeople(draft, treeId, type, fromId, toId, roles?.parent, roles?.parentage, type === "sibling" ? roles?.siblingStatus : undefined, roles?.relationshipSubtype);
      if (type === "parent-child" && otherParentId) linkPeople(draft, treeId, "parent-child", otherParentId, toId, roles?.otherParent, roles?.otherParentage, undefined, roles?.relationshipSubtype);
    })}
    onParentRoleChange={(id, role) => mutate("Updated parent role", draft => {
      const relationship = draft.relationships.find(rel => rel.id === id && rel.treeId === treeId && rel.type === "parent-child");
      if (relationship) relationship.parentRole = role;
    })}
    onParentageChange={(id, parentage) => mutate("Updated parentage", draft => {
      const relationship = draft.relationships.find(rel => rel.id === id && rel.treeId === treeId && rel.type === "parent-child");
      if (relationship) relationship.parentage = parentage;
    })}
    onUnlink={id => mutate("Removed relationship", draft => { draft.relationships = draft.relationships.filter(rel => rel.id !== id); syncFamilyMembership(draft, treeId); })}
    itemActions={person ? itemActions({ kind: "people", id: person.id }, fullName(person)) : null}
    onUndo={undo} onRedo={redo} canUndo={history.past.length > 0} canRedo={history.future.length > 0} />;

  const renderFamilyDetails = () => {
    const parents = person ? getParents(state, person.id) : [];
    const partners = person ? getPartners(state, person.id) : [];
    const children = person ? getChildren(state, person.id) : [];
    return (
      <div className="stack">
        <div className="two-col">
          <Section title="Manage Families" icon={<Users size={18} />} action={<Button onClick={() => mutate("Created family", (draft) => draft.families.push({ id: makeId("family"), treeId, name: "New family", familyType: "Family type not recorded", partnerIds: person ? [person.id] : [], childIds: [], eventIds: [], sourceIds: [], notes: "" }))} icon={<Plus size={16} />}>Family</Button>}>
            {state.families.filter((family) => family.treeId === treeId).map((family) => (
              <div key={family.id} className="family-card">
                {itemActions({ kind: "families", id: family.id }, family.name)}
                <Input value={family.name} onChange={(value) => mutate("Updated family", (draft) => {
                  const target = draft.families.find((item) => item.id === family.id);
                  if (target) target.name = value;
                })} />
                <label className="field">
                  <span>Family type</span>
                  <select className="control" aria-label={`Family type for ${family.name}`} value={family.familyType || "Family type not recorded"} onChange={(event) => mutate("Updated family type", (draft) => {
                    const target = draft.families.find((item) => item.id === family.id);
                    if (target) target.familyType = event.target.value;
                  })}>
                    <option>Family type not recorded</option>
                    {familyTypeOptions.map(type => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <TermMeaning term={family.familyType || ""} />
                <p><strong>Partners:</strong> {family.partnerIds.map((id) => fullName(state.people.find((entry) => entry.id === id))).join(", ") || "None"}</p>
                <p><strong>Children:</strong> {family.childIds.map((id) => fullName(state.people.find((entry) => entry.id === id))).join(", ") || "None"}</p>
                <textarea className="textarea compact" value={family.notes} onChange={(event) => mutate("Updated family notes", (draft) => {
                  const target = draft.families.find((item) => item.id === family.id);
                  if (target) target.notes = event.target.value;
                })} />
                <details className="family-protection"><summary>Protection and government records</summary>{protectionPanel("family", family.id)}</details>
              </div>
            ))}
            <div className="inline-form relationship-type-form">
              <input className="control" aria-label="New family type" placeholder="New family type" value={customTypeDraft.familyType} onChange={(event) => setCustomTypeDraft({ ...customTypeDraft, familyType: event.target.value })} />
              <Button variant="secondary" onClick={() => addCustomFamilyType(customTypeDraft.familyType)} icon={<Plus size={16} />}>Add family type</Button>
              <input className="control" aria-label="New relationship sub-type" placeholder="New relationship sub-type" value={customTypeDraft.relationshipSubtype} onChange={(event) => setCustomTypeDraft({ ...customTypeDraft, relationshipSubtype: event.target.value })} />
              <Button variant="secondary" onClick={() => addCustomRelationshipSubtype(customTypeDraft.relationshipSubtype)} icon={<Plus size={16} />}>Add relationship sub-type</Button>
            </div>
            <div className="template-grid relationship-type-library" aria-label="Family and relationship type library">
              {familyTypeOptions.slice(0, 12).map(type => <div key={type} className="template-card"><strong>{type}</strong><small>Family type</small></div>)}
              {relationshipSubtypeOptions.filter(Boolean).slice(0, 12).map(type => <div key={type} className="template-card"><strong>{type}</strong><small>Relationship sub-type</small></div>)}
            </div>
          </Section>
          <Section title="Relationship Report" icon={<FileText size={18} />}>
            {person ? (
              <div className="stack tight">
                <p><strong>{fullName(person)}</strong></p>
                <p>Parents: {parents.map(fullName).join(", ") || "None recorded"}</p>
                <p>Partners: {partners.map(fullName).join(", ") || "None recorded"}</p>
                <p>Children: {children.map(fullName).join(", ") || "None recorded"}</p>
                <p className="quiet">Cycle checks run before parent-child links are created.</p>
                {state.relationships.filter(rel => rel.treeId === treeId && [rel.fromId, rel.toId].includes(person.id)).map(rel => <details className="relationship-record-details" key={rel.id}>
                  <summary>{fullName(state.people.find(entry => entry.id === rel.fromId))} / {fullName(state.people.find(entry => entry.id === rel.toId))}: {rel.type}</summary>
                  <TermMeaning term={rel.type} />
                  {itemActions({ kind: "relationships", id: rel.id }, `${rel.type} relationship`)}
                  {protectionPanel("relationship", rel.id)}
                </details>)}
              </div>
            ) : <p className="quiet">Select a person.</p>}
          </Section>
        </div>
      </div>
    );
  };

  const renderPlacesSources = () => (
    <div className="stack">
      <div className="two-col">
        <Section title="Places and Place Templates" icon={<Globe2 size={18} />} action={<Button onClick={createPlace} icon={<Plus size={16} />}>Place</Button>}>
          <div className="item-selector">
            {state.places.filter((place) => place.treeId === treeId).map((place) => (
              <button key={place.id} className={place.id === currentPlace?.id ? "selected" : ""} onClick={() => setSelectedPlaceId(place.id)}>{place.name}</button>
            ))}
          </div>
          {currentPlace && (
            <div className="settings-grid">
              {itemActions({ kind: "places", id: currentPlace.id }, currentPlace.name)}
              <Field label="Place name" value={currentPlace.name} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.name = value; })} />
              <Field label="Address" value={currentPlace.address} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.address = value; })} />
              <Field label="Latitude" value={currentPlace.latitude} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.latitude = value; })} />
              <Field label="Longitude" value={currentPlace.longitude} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.longitude = value; })} />
              <Field label="Points of interest" value={currentPlace.pointsOfInterest} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.pointsOfInterest = value; })} />
              <Field label="Reference article title" value={currentPlace.wikipediaTitle} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.wikipediaTitle = value; })} />
              <Field label="Place notes" value={currentPlace.notes} onChange={(value) => updatePlace(currentPlace.id, (place) => { place.notes = value; })} />
              <label className="field"><span>Template</span>
              <select className="control" value={currentPlace.templateId} onChange={(event) => updatePlace(currentPlace.id, (place) => { place.templateId = event.target.value; })}>
                {state.placeTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select></label>
            </div>
          )}
          <h3>Administrative Templates</h3>
          {state.placeTemplates.map((template) => (
            <div key={template.id} className="template-row">
              <strong>{template.name}</strong>
              <span>{template.levels.join(" / ")}</span>
            </div>
          ))}
        </Section>
        <Section title="Pedigree Map and Statistic Map" icon={<Map size={18} />}>
          <p className="quiet">Pedigree Map connects family events, burial places, source locations, and migration context without sending the tree to an external map service.</p>
          <div className="globe">
            {state.places.filter((place) => place.treeId === treeId && place.latitude && place.longitude).map((place) => (
              <button
                key={place.id}
                className="globe-pin"
                style={{ left: `${Math.min(92, Math.max(8, ((Number(place.longitude) + 180) / 360) * 100))}%`, top: `${Math.min(88, Math.max(12, ((90 - Number(place.latitude)) / 180) * 100))}%` }}
                title={place.name}
                onClick={() => setSelectedPlaceId(place.id)}
              />
            ))}
          </div>
          <div className="map-list" aria-label="Pedigree Map summary">
            {state.places.filter((place) => place.treeId === treeId).map((place) => {
              const eventCount = state.events.filter((event) => event.placeId === place.id).length;
              const sourceCount = place.sourceIds.length;
              return <p key={place.id}><strong>{place.name}</strong>: {place.latitude || "no latitude"}, {place.longitude || "no longitude"} · {eventCount} linked event{eventCount === 1 ? "" : "s"} · {sourceCount} source file{sourceCount === 1 ? "" : "s"}</p>;
            })}
          </div>
        </Section>
      </div>
      <div className="two-col">
        <Section title="Sources and Templates" icon={<Archive size={18} />} action={<Button onClick={createSource} icon={<Plus size={16} />}>Source</Button>}>
          <p className="quiet">{state.sourceTemplates.length} predefined source templates are loaded, with configurable fields.</p>
          <div className="item-selector">
            {state.sources.filter((source) => source.treeId === treeId).map((source) => <button key={source.id} className={source.id === currentSource?.id ? "selected" : ""} onClick={() => setSelectedSourceId(source.id)}>{source.title}</button>)}
          </div>
          {currentSource && (
            <div className="settings-grid">
              {itemActions({ kind: "sources", id: currentSource.id }, currentSource.title)}
              <Field label="Source title" value={currentSource.title} onChange={(value) => updateSource(currentSource.id, (source) => { source.title = value; })} />
              <Field label="Citation" value={currentSource.citation} onChange={(value) => updateSource(currentSource.id, (source) => { source.citation = value; })} />
              <Field label="URL" value={currentSource.url} onChange={(value) => updateSource(currentSource.id, (source) => { source.url = value; })} />
              <label className="field"><span>Template</span>
              <select className="control" value={currentSource.templateId} onChange={(event) => updateSource(currentSource.id, (source) => { source.templateId = event.target.value; })}>
                {state.sourceTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select></label>
            </div>
          )}
        </Section>
        <Section title="Source Template Fields" icon={<Settings size={18} />}>
          <div className="template-grid">
            {state.sourceTemplates.slice(0, 18).map((template) => (
              <div key={template.id} className="template-card">
                <strong>{template.name}</strong>
                <small>{template.category}</small>
                <span>{template.fields.join(", ")}</span>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => mutate("Added source template", (draft) => {
            draft.sourceTemplates.push({ id: makeId("st"), name: "Custom source template", category: "Custom", fields: ["Creator", "Title", "Repository", "Date"] });
          })} icon={<Plus size={16} />}>Custom Template</Button>
        </Section>
      </div>
    </div>
  );

  const updatePlace = (placeId: string, updater: (place: AppState["places"][number]) => void) => mutate("Updated place", (draft) => {
    const target = draft.places.find((place) => place.id === placeId);
    if (target) updater(target);
  });

  const updateSource = (sourceId: string, updater: (source: Source) => void) => mutate("Updated source", (draft) => {
    const target = draft.sources.find((source) => source.id === sourceId);
    if (target) updater(target);
  });

  const renderResearch = () => {
    const questions = person ? buildResearchQuestions(state, person) : [];
    const results = searchLocalArchive(state, treeId, archiveQuery, archiveKind);
    return (
      <div className="stack">
        <div className="two-col">
          <Section title="Research Assistant" icon={<Sparkles size={18} />}>
            {person ? <p className="quiet">Questions for {fullName(person)}</p> : null}
            {questions.map((question) => (
              <div className="question-row" key={question}>
                <CircleHelp size={16} />
                <span>{question}</span>
                <Button variant="ghost" onClick={() => mutate("Created research to-do", (draft) => draft.todos.push({ id: makeId("todo"), treeId, personId: person?.id, title: question, status: "open", priority: "normal", dueDate: "" }))}>To-Do</Button>
              </div>
            ))}
          </Section>
          <Section title="Archive Search" icon={<Search size={18} />}>
            <div className="archive-search-fields">
            <label className="field"><span>Search this tree</span><input className="control" type="search" value={archiveQuery} onChange={e => setArchiveQuery(e.target.value)} /></label>
            <label className="field"><span>Record kind</span><select className="control" value={archiveKind} onChange={e => setArchiveKind(e.target.value as ArchiveKind | "all")}>
              <option value="all">All records</option><option value="person">People</option><option value="record">Historical records</option><option value="source">Sources</option><option value="place">Places</option>
            </select></label>
            <label className="field"><span>Research person</span><select className="control" value={person?.id || ""} onChange={e => { setSelectedPersonId(e.target.value); setResearchError(""); }}>
              {people.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
            </select></label>
            </div>
            {researchError && <p role="alert">{researchError}</p>}
            <p role="status">{archiveQuery.trim() ? `${results.length} results` : "No search entered"}</p>
            <div className="archive-results">
              {results.map(result => <article className="archive-result" key={`${result.kind}-${result.id}`}>
                <small>{result.kind}</small><h3>{result.title}</h3><p>{result.detail}</p>
                {result.kind === "person" && <Button icon={<Users size={16} />} onClick={() => openPerson(result.id)}>Open person</Button>}
                {result.kind === "source" && <Button icon={<Archive size={16} />} onClick={() => { setSelectedSourceId(result.id); setView("places"); }}>Open source</Button>}
                {result.kind === "place" && <Button icon={<Map size={16} />} onClick={() => { setSelectedPlaceId(result.id); setView("places"); }}>Open place</Button>}
                {result.kind === "record" && (result.linkedPersonId ? <p>Linked to {fullName(people.find(p => p.id === result.linkedPersonId))}</p> : <Button disabled={!person} icon={<Link2 size={16} />} onClick={() => {
                  try {
                    const checked = structuredClone(state); linkLocalRecord(checked, treeId, result.id, person.id);
                    mutate("Linked local research record", draft => linkLocalRecord(draft, treeId, result.id, person.id)); setResearchError("");
                  } catch (error) { setResearchError(error instanceof Error ? error.message : "The record could not be linked."); }
                }}>Link to {fullName(person)}</Button>)}
              </article>)}
            </div>
          </Section>
        </div>
        <Section title="Historical Records" icon={<Archive size={18} />} action={<Button icon={<Plus size={16} />} onClick={() => mutate("Added historical record", (draft) => draft.records.push({ id: makeId("record"), treeId, personId: person?.id, collection: RECORD_COLLECTIONS[0], title: "New historical record", date: "", citation: "", transcription: "" }))}>Record</Button>}>
          <div className="record-grid">
            {state.records.filter((record) => record.treeId === treeId).map((record) => (
              <div className="record-card" key={record.id} role="group" aria-label={`Historical record: ${record.title}`}>
                {itemActions({ kind: "records", id: record.id }, record.title)}
                <label className="field"><span>Record collection</span><select aria-label="Record collection" className="control" value={record.collection} onChange={(event) => { const value = event.target.value; mutate("Updated record collection", (draft) => {
                  const target = draft.records.find((entry) => entry.id === record.id);
                  if (target) target.collection = value;
                }); }}>
                  {RECORD_COLLECTIONS.map((collection) => <option key={collection}>{collection}</option>)}
                  {!RECORD_COLLECTIONS.includes(record.collection) && <option>{record.collection}</option>}
                </select></label>
                <Field label="Record title" value={record.title} onChange={(value) => mutate("Updated record", (draft) => {
                  const target = draft.records.find((entry) => entry.id === record.id);
                  if (target) target.title = value;
                })} />
                <Field label="Record date" value={record.date} onChange={value => mutate("Updated historical record date", draft => {
                  const target = draft.records.find(entry => entry.id === record.id);
                  if (target) target.date = value;
                })} />
                <Field label="Record citation" value={record.citation} onChange={value => mutate("Updated historical record citation", draft => {
                  const target = draft.records.find(entry => entry.id === record.id);
                  if (target) target.citation = value;
                })} />
                <label className="field"><span>Record applies to</span><select aria-label="Record applies to" className="control" value={record.personId || ""} onChange={event => { const value = event.target.value; mutate("Updated historical record scope", draft => {
                  const target = draft.records.find(entry => entry.id === record.id);
                  if (target) target.personId = value || undefined;
                }); }}><option value="">Whole tree</option>{people.map(p => <option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></label>
                <label className="field"><span>Record place</span><select aria-label="Record place" className="control" value={record.placeId || ""} onChange={event => { const value = event.target.value; mutate("Updated historical record place", draft => {
                  const target = draft.records.find(entry => entry.id === record.id);
                  if (target) target.placeId = value || undefined;
                }); }}><option value="">Not recorded</option>{state.places.filter(p => p.treeId === treeId).map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
                <textarea aria-label="Record transcription" className="textarea compact" value={record.transcription} placeholder="Record transcription" onChange={(event) => { const value = event.target.value; mutate("Updated transcription", (draft) => {
                  const target = draft.records.find((entry) => entry.id === record.id);
                  if (target) target.transcription = value;
                }); }} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  };

  const renderAiStudio = () => {
    const currentMode = AI_GENERATOR_MODES.find(mode => mode.id === aiDraft.mode)!;
    return (
      <div className="stack ai-studio">
        <div className="hero-band">
          <div>
            <p className="eyebrow">Prompt, research, image, video, and record drafting</p>
            <h1>AI Studio</h1>
            <p>Generate research plans, character image prompts, image-to-video briefs, movie clips, fandom profiles, work files, and medical-file templates from saved KinForge data.</p>
          </div>
          <div className="hero-actions">
            <Badge>{AI_GENERATOR_MODES.length} generators</Badge>
            <Button icon={<Wand2 size={16} />} onClick={() => generateAiDraft()}>Generate</Button>
          </div>
        </div>
        <div className="two-col">
          <Section title="Generator Controls" icon={<Wand2 size={18} />}>
            <div className="ai-mode-grid">
              {AI_GENERATOR_MODES.map(mode => <button key={mode.id} className={aiDraft.mode === mode.id ? "selected" : ""} onClick={() => setAiDraft(current => ({ ...current, mode: mode.id, output: "" }))}>
                <strong>{mode.label}</strong><small>{mode.detail}</small>
              </button>)}
            </div>
            <div className="settings-grid">
              <label className="field"><span>Person or character</span><select className="control" value={aiDraft.personId || aiPerson?.id || ""} onChange={event => setAiDraft(current => ({ ...current, personId: event.target.value }))}>{people.map(entry => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}</select></label>
              <label className="field"><span>Generator mode</span><select className="control" value={aiDraft.mode} onChange={event => setAiDraft(current => ({ ...current, mode: event.target.value as AiGeneratorMode, output: "" }))}>{AI_GENERATOR_MODES.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>
              <label className="field"><span>Art style</span><select className="control" value={aiDraft.imageStyle} onChange={event => setAiDraft(current => ({ ...current, imageStyle: event.target.value }))}>{AI_IMAGE_STYLES.map(style => <option key={style}>{style}</option>)}</select></label>
              <label className="field"><span>Realism amount</span><select className="control" value={aiDraft.realism} onChange={event => setAiDraft(current => ({ ...current, realism: event.target.value }))}>{AI_REALISM_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
              <label className="field"><span>Image model</span><select className="control" value={aiDraft.imageModel} onChange={event => setAiDraft(current => ({ ...current, imageModel: event.target.value }))}>{AI_IMAGE_MODELS.map(model => <option key={model}>{model}</option>)}</select></label>
              <label className="field"><span>Video model</span><select className="control" value={aiDraft.videoModel} onChange={event => setAiDraft(current => ({ ...current, videoModel: event.target.value }))}>{AI_VIDEO_MODELS.map(model => <option key={model}>{model}</option>)}</select></label>
              <label className="field"><span>Video length</span><select className="control" value={aiDraft.videoDuration} onChange={event => setAiDraft(current => ({ ...current, videoDuration: event.target.value }))}>{AI_VIDEO_DURATIONS.map(duration => <option key={duration}>{duration}</option>)}</select></label>
              <label className="field"><span>Video format</span><select className="control" value={aiDraft.videoFormat} onChange={event => setAiDraft(current => ({ ...current, videoFormat: event.target.value }))}>{AI_VIDEO_FORMATS.map(format => <option key={format}>{format}</option>)}</select></label>
              <label className="field"><span>Motion</span><select className="control" value={aiDraft.motion} onChange={event => setAiDraft(current => ({ ...current, motion: event.target.value }))}>{AI_MOTION_LEVELS.map(motion => <option key={motion}>{motion}</option>)}</select></label>
            </div>
            <label className="field"><span>Request or prompt</span><textarea className="control" rows={4} value={aiDraft.prompt} placeholder="Example: make this look like a hyper-realistic live-action fantasy film still, accurate to the profile" onChange={event => setAiDraft(current => ({ ...current, prompt: event.target.value }))} /></label>
            <label className="field"><span>Negative prompt / avoid</span><textarea className="control" rows={3} value={aiDraft.negativePrompt} onChange={event => setAiDraft(current => ({ ...current, negativePrompt: event.target.value }))} /></label>
            <div className="button-row">
              <Button icon={<Wand2 size={16} />} onClick={() => generateAiDraft()}>Generate draft</Button>
              <Button variant="secondary" icon={<Lightbulb size={16} />} disabled={!aiDraft.output.trim()} onClick={saveAiDraftAsIdea}>Save to ideas</Button>
              <Button variant="secondary" icon={<Download size={16} />} onClick={downloadAiDraft}>Download</Button>
            </div>
          </Section>
          <Section title={currentMode.label} icon={<Sparkles size={18} />}>
            <p className="quiet">{currentMode.detail}</p>
            {aiPerson && <div className="ai-context-card">
              <strong>{fullName(aiPerson)}</strong>
              <span>{characterSpeciesLine(aiPerson) || aiPerson.biography || "No character summary recorded yet."}</span>
              <small>{aiPersonFacts.length} visible facts · {aiMedicalRecords.length} visible medical records · {treeMedia.filter(media => media.assignedTo.some(assignment => assignment.kind === "person" && assignment.id === aiPerson.id)).length} linked media files</small>
            </div>}
            <textarea className="textarea ai-output" aria-label="Generated AI Studio draft" value={aiDraft.output} placeholder="Choose a generator and click Generate draft." onChange={event => setAiDraft(current => ({ ...current, output: event.target.value }))} />
            <p className="quiet">Medical drafts are record templates only. Image/video generators produce engine-ready specs and prompts; connecting a live model requires a backend image/video provider and account-level privacy controls.</p>
          </Section>
        </div>
      </div>
    );
  };

  const renderKinforgeAi = () => (
    <div className="stack ai-studio">
      <div className="hero-band">
        <div>
          <p className="eyebrow">Research, reasoning, definitions, and app intelligence</p>
          <h1>KinForge AI</h1>
          <p>Ask questions across the current library, explain terms in plain language, reason through relationships, draft evidence plans, and turn product ideas into testable work.</p>
        </div>
        <div className="hero-actions">
          <Badge>{AI_ASSISTANT_ENGINES.length} engines</Badge>
          <Button icon={<Sparkles size={16} />} onClick={generateKinforgeAiAnswer}>Ask KinForge AI</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="Ask KinForge AI" icon={<Sparkles size={18} />}>
          <div className="settings-grid">
            <label className="field"><span>Assistant engine</span><select className="control" value={kinforgeAi.engine} onChange={event => setKinforgeAi(current => ({ ...current, engine: event.target.value }))}>{AI_ASSISTANT_ENGINES.map(engine => <option key={engine}>{engine}</option>)}</select></label>
            <label className="field"><span>Answer mode</span><select className="control" value={kinforgeAi.answerMode} onChange={event => setKinforgeAi(current => ({ ...current, answerMode: event.target.value }))}>{AI_ANSWER_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></label>
            <label className="field"><span>Focus person or character</span><select className="control" value={kinforgeAi.personId || kinforgeAiPerson?.id || ""} onChange={event => setKinforgeAi(current => ({ ...current, personId: event.target.value }))}>{people.map(entry => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}</select></label>
          </div>
          <label className="field"><span>Question</span><textarea className="control" rows={6} value={kinforgeAi.prompt} placeholder="Ask for a cited research brief, cousin explanation, term definition, SWOT analysis, app improvement plan, or character/lore reasoning." onChange={event => setKinforgeAi(current => ({ ...current, prompt: event.target.value }))} /></label>
          <div className="button-row">
            <Button icon={<Sparkles size={16} />} onClick={generateKinforgeAiAnswer}>Generate answer</Button>
            <Button variant="secondary" icon={<Lightbulb size={16} />} disabled={!kinforgeAi.output.trim()} onClick={saveKinforgeAiAnswer}>Save to ideas</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={downloadKinforgeAiAnswer}>Download</Button>
          </div>
        </Section>
        <Section title="KinForge AI Answer" icon={<Brain size={18} />}>
          <div className="ai-context-card">
            <strong>{kinforgeAi.engine}</strong>
            <span>{kinforgeAi.answerMode}</span>
            <small>{people.length} people · {treeSources.length} sources · {treeRelationships.length} relationships · {state.customFactTerms.length} custom terms</small>
          </div>
          <textarea className="textarea ai-output" aria-label="KinForge AI answer" value={kinforgeAi.output} placeholder="Ask KinForge AI a question, then edit the answer before saving or downloading." onChange={event => setKinforgeAi(current => ({ ...current, output: event.target.value }))} />
          <p className="quiet">KinForge AI is the app's library-aware assistant. It drafts explanations and evidence plans from saved data; official records, medical decisions, legal matters, and live web research still need proper sources or qualified review.</p>
        </Section>
      </div>
    </div>
  );

  const renderTranslatorAi = () => (
    <div className="stack ai-studio">
      <div className="hero-band">
        <div>
          <p className="eyebrow">World-language translation, glossary, and cultural review</p>
          <h1>Translator AI</h1>
          <p>Translate biographies, source notes, reports, app wording, and character records with a full 7,000+ language selector, glossary notes, and privacy-aware review prompts.</p>
        </div>
        <div className="hero-actions">
          <Badge>{LANGUAGES.length.toLocaleString()} languages</Badge>
          <Button icon={<Languages size={16} />} onClick={generateTranslatorAiAnswer}>Translate</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="Translation Request" icon={<Languages size={18} />}>
          <div className="settings-grid">
            <label className="field"><span>Source language</span><select className="control" value={translatorAi.sourceLanguage} onChange={event => setTranslatorAi(current => ({ ...current, sourceLanguage: event.target.value }))}>
              <option value="auto">Auto-detect</option>
              {LANGUAGES.map(language => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}
            </select></label>
            <label className="field"><span>Target language</span><select className="control" value={translatorAi.targetLanguage} onChange={event => setTranslatorAi(current => ({ ...current, targetLanguage: event.target.value }))}>
              {LANGUAGES.map(language => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}
            </select></label>
            <label className="field"><span>Mode</span><select className="control" value={translatorAi.mode} onChange={event => setTranslatorAi(current => ({ ...current, mode: event.target.value }))}>{TRANSLATOR_MODES.map(mode => <option key={mode}>{mode}</option>)}</select></label>
            <label className="field"><span>Tone</span><select className="control" value={translatorAi.tone} onChange={event => setTranslatorAi(current => ({ ...current, tone: event.target.value }))}>{TRANSLATOR_TONES.map(tone => <option key={tone}>{tone}</option>)}</select></label>
          </div>
          <label className="field"><span>Text to translate</span><textarea className="control" rows={7} value={translatorAi.text} placeholder="Paste a person biography, report section, source note, medical/government record summary, app text, or character profile." onChange={event => setTranslatorAi(current => ({ ...current, text: event.target.value }))} /></label>
          <label className="field"><span>Glossary, names, cultural notes, or privacy instructions</span><textarea className="control" rows={4} value={translatorAi.notes} placeholder="Example: keep surname first; do not translate character names; explain kinship words simply; mark legal or medical terms for review." onChange={event => setTranslatorAi(current => ({ ...current, notes: event.target.value }))} /></label>
          <div className="button-row">
            <Button icon={<Languages size={16} />} onClick={generateTranslatorAiAnswer}>Generate translation brief</Button>
            <Button variant="secondary" icon={<Lightbulb size={16} />} disabled={!translatorAi.output.trim()} onClick={saveTranslatorAiAnswer}>Save to ideas</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={downloadTranslatorAiAnswer}>Download</Button>
          </div>
        </Section>
        <Section title="Translator AI Output" icon={<Brain size={18} />}>
          <div className="ai-context-card">
            <strong>{languageLabel(translatorAi.sourceLanguage === "auto" ? appLanguage : translatorAi.sourceLanguage)} to {languageLabel(translatorAi.targetLanguage)}</strong>
            <span>{translatorAi.mode} · {translatorAi.tone}</span>
            <small>{LANGUAGES.length.toLocaleString()} selectable language entries · names, dates, citations, and privacy labels preserved</small>
          </div>
          <textarea className="textarea ai-output" aria-label="Translator AI output" value={translatorAi.output} placeholder="Choose languages, paste text, and click Generate translation brief." onChange={event => setTranslatorAi(current => ({ ...current, output: event.target.value }))} />
          <p className="quiet">Translator AI drafts and quality-checks translations from KinForge data. For legal, medical, custody, protection, immigration, or official records, ask a qualified translator or fluent reviewer before sharing.</p>
        </Section>
      </div>
    </div>
  );

  const renderHelpdeskAi = () => (
    <div className="stack ai-studio">
      <div className="hero-band">
        <div>
          <p className="eyebrow">Support, troubleshooting, onboarding, and bug reports</p>
          <h1>Helpdesk AI</h1>
          <p>Get step-by-step help for KinForge itself, prepare bug reports, write feature requests, check update/download behavior, and turn user feedback into actionable fixes.</p>
        </div>
        <div className="hero-actions">
          <Badge>{HELPDESK_AREAS.length} areas</Badge>
          <Button icon={<CircleHelp size={16} />} onClick={generateHelpdeskAiAnswer}>Ask Helpdesk AI</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="Support Request" icon={<CircleHelp size={18} />}>
          <div className="settings-grid">
            <label className="field"><span>Area</span><select className="control" value={helpdeskAi.area} onChange={event => setHelpdeskAi(current => ({ ...current, area: event.target.value }))}>{HELPDESK_AREAS.map(area => <option key={area}>{area}</option>)}</select></label>
            <label className="field"><span>Urgency</span><select className="control" value={helpdeskAi.urgency} onChange={event => setHelpdeskAi(current => ({ ...current, urgency: event.target.value }))}>{HELPDESK_URGENCY.map(level => <option key={level}>{level}</option>)}</select></label>
            <label className="field"><span>Response type</span><select className="control" value={helpdeskAi.responseType} onChange={event => setHelpdeskAi(current => ({ ...current, responseType: event.target.value }))}>{HELPDESK_RESPONSE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
          </div>
          <label className="field"><span>What is happening?</span><textarea className="control" rows={5} value={helpdeskAi.issue} placeholder="Example: the Mac app says it is up to date but still shows update download buttons." onChange={event => setHelpdeskAi(current => ({ ...current, issue: event.target.value }))} /></label>
          <label className="field"><span>Steps already tried</span><textarea className="control" rows={4} value={helpdeskAi.stepsTried} placeholder="List what you clicked, what device/app version you used, and what happened." onChange={event => setHelpdeskAi(current => ({ ...current, stepsTried: event.target.value }))} /></label>
          <div className="button-row">
            <Button icon={<CircleHelp size={16} />} onClick={generateHelpdeskAiAnswer}>Generate help</Button>
            <Button variant="secondary" icon={<Lightbulb size={16} />} disabled={!helpdeskAi.output.trim()} onClick={saveHelpdeskAiAnswer}>Save to feedback</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={downloadHelpdeskAiAnswer}>Download</Button>
          </div>
        </Section>
        <Section title="Helpdesk AI Answer" icon={<ClipboardList size={18} />}>
          <div className="ai-context-card">
            <strong>{helpdeskAi.area}</strong>
            <span>{helpdeskAi.responseType} · {helpdeskAi.urgency}</span>
            <small>{cloud ? "Cloud account attached" : "Local/demo context"} · version {import.meta.env.PACKAGE_VERSION || "1.3.8"}</small>
          </div>
          <textarea className="textarea ai-output" aria-label="Helpdesk AI answer" value={helpdeskAi.output} placeholder="Describe a KinForge issue and click Generate help." onChange={event => setHelpdeskAi(current => ({ ...current, output: event.target.value }))} />
          <p className="quiet">Helpdesk AI is for using and improving KinForge. It never needs passwords, recovery codes, private records, or sensitive files in the support text.</p>
        </Section>
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="stack">
      <div className="hero-band">
        <div>
          <p className="eyebrow">App-level support protocol</p>
          <h1>Contact Us</h1>
          <p>Contact and support are separate from the family tree. They help you get assistance, report problems, and protect the app from creating confusion or data loss.</p>
        </div>
        <div className="hero-actions">
          <Button icon={<ClipboardList size={16} />} onClick={() => setView("support")}>Open support form</Button>
          <Button variant="secondary" icon={<CircleHelp size={16} />} onClick={() => setView("helpdesk-ai")}>Ask Helpdesk AI</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="How Support Works" icon={<CircleHelp size={18} />}>
          <div className="coverage-table">
            <div className="coverage-row"><Badge>Support</Badge><strong>Support Form</strong><span>Creates a support ticket for KinForge Support and keeps an owner-dashboard copy for follow-up.</span><StatusBadge status="validated" /></div>
            <div className="coverage-row"><Badge>AI</Badge><strong>Helpdesk AI</strong><span>Explains what to try next, drafts bug reports, and turns feedback into QA steps without changing tree data.</span><StatusBadge status="validated" /></div>
            <div className="coverage-row"><Badge>Privacy</Badge><strong>Private details</strong><span>Do not paste passwords, recovery codes, medical files, government records, or private family records into public support text.</span><StatusBadge status="validated" /></div>
          </div>
        </Section>
        <Section title="Contact Details" icon={<Languages size={18} />}>
          <p><strong>Product:</strong> KinForge Genealogy Studio</p>
          <p><strong>Owner brand:</strong> Dreams of Serene Landscapes</p>
          <p><strong>Support destination:</strong> KinForge Support owner dashboard.</p>
          <p className="quiet">If automatic delivery is not configured, KinForge saves the ticket and downloads a support copy so nothing disappears.</p>
        </Section>
      </div>
    </div>
  );

  const renderSupportForm = () => (
    <div className="stack">
      <div className="hero-band">
        <div>
          <p className="eyebrow">Website-style support request</p>
          <h1>Support Form</h1>
          <p>Send a KinForge support request through the app support channel. This is app-level support, not a family-tree record.</p>
        </div>
        <div className="hero-actions">
          <Badge>KinForge Support</Badge>
          <Button icon={<Download size={16} />} onClick={downloadSupportTicket}>Download ticket</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="Request Details" icon={<ClipboardList size={18} />}>
          <div className="settings-grid">
            <label className="field"><span>Your name</span><input className="control" value={supportForm.name} onChange={event => setSupportForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label className="field"><span>Email for replies</span><input className="control" type="email" value={supportForm.email} onChange={event => setSupportForm(current => ({ ...current, email: event.target.value }))} /></label>
            <label className="field"><span>Request type</span><select className="control" value={supportForm.type} onChange={event => setSupportForm(current => ({ ...current, type: event.target.value }))}><option>Support request</option><option>App feedback</option><option>Customer review</option><option>Copyright-free permission request</option><option>Bug report</option><option>Feature request</option><option>Account or login help</option><option>Sync issue</option><option>Download question</option><option>Accessibility request</option></select></label>
            <label className="field"><span>Device/app version</span><input className="control" value={supportForm.device} placeholder="Example: Mac app 1.3.8 on Apple Silicon" onChange={event => setSupportForm(current => ({ ...current, device: event.target.value }))} /></label>
          </div>
          <label className="field"><span>Subject</span><input className="control" value={supportForm.subject} onChange={event => setSupportForm(current => ({ ...current, subject: event.target.value }))} /></label>
          <label className="field"><span>Proof for copyright-free permission</span><textarea className="control" rows={4} value={supportForm.proof} placeholder="Only for permission requests: describe or link real non-AI proof, such as photos together or digital/physical records showing you are close to Dreams of Serene Landscapes." onChange={event => setSupportForm(current => ({ ...current, proof: event.target.value }))} /></label>
          <label className="field"><span>Message</span><textarea className="control" rows={7} value={supportForm.message} placeholder="Tell support what happened, what you expected, and what you clicked." onChange={event => setSupportForm(current => ({ ...current, message: event.target.value }))} /></label>
          <label className="check-row"><input type="checkbox" checked={supportForm.permissionToReply} onChange={event => setSupportForm(current => ({ ...current, permissionToReply: event.target.checked }))} />Allow support to reply to this email</label>
          <label className="check-row"><input type="checkbox" checked={supportForm.includeDiagnostics} onChange={event => setSupportForm(current => ({ ...current, includeDiagnostics: event.target.checked }))} />Include non-sensitive app diagnostics</label>
          <div className="button-row">
            <Button icon={<Upload size={16} />} onClick={() => void submitSupportForm()}>Send to support</Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={downloadSupportTicket}>Download copy</Button>
          </div>
          {supportMessage && <p role="status" className="drive-message">{supportMessage}</p>}
        </Section>
        <Section title="Support Preview" icon={<FileText size={18} />}>
          <textarea className="textarea ai-output" readOnly aria-label="Support ticket preview" value={supportTicketText()} />
          <p className="quiet">The preview is the support packet KinForge saves for KinForge Support. Passwords, recovery codes, and private records should stay out of support messages.</p>
        </Section>
      </div>
    </div>
  );

  const renderPrivateAccess = () => {
    const accessState = privateAccessStatus(privateAccess);
    const routeSummary = [
      privateAccess.routeCloudSync ? "cloud sync" : "",
      privateAccess.routeResearch ? "research and AI calls" : ""
    ].filter(Boolean).join(", ") || "no routed services";
    const guide = `KinForge Private Access Configuration

Goal:
- Keep KinForge usable when normal network access is unreliable, blocked, censored, or slow.

Active in-app access modes:
- Direct connection: normal KinForge cloud/web traffic.
- System proxy: KinForge follows the operating system's proxy/VPN path.
- Custom HTTPS relay: KinForge routes its own cloud, sync, and research requests through a configured private relay URL.
- Offline only: KinForge opens the latest local/cached library without waiting for cloud.

Active resilience:
- Offline-first local library access.
- Manual backup/download controls.
- Cloud library sync designed to resume when network access returns.
- Private Access control panel and downloadable configuration.
- User-selectable routing for cloud sync and research requests.
- Kill-switch behaviour for KinForge network traffic: if private access is required and unavailable, stay offline instead of leaking requests.

Current state:
- Mode: ${privateAccess.mode}
- Provider: ${privateAccess.provider || "Not recorded"}
- Relay URL: ${privateAccess.relayUrl || "Not recorded"}
- Region: ${privateAccess.region}
- Routed services: ${routeSummary}
- Kill switch: ${privateAccess.killSwitch ? "On" : "Off"}
- Offline fallback: ${privateAccess.offlineFallback ? "On" : "Off"}

Important limitation:
- KinForge can route its own app traffic through system proxy or a configured private HTTPS relay. A whole-device VPN still requires OS-level VPN support or a trusted VPN provider.`;
    const applySettings = () => {
      const at = nowIso();
      const status = privateAccess.mode === "Custom HTTPS relay" && !privateAccess.relayUrl.trim() ? "reviewing" : "done";
      mutate("Applied private access settings", draft => {
        draft.userFeedback.push({ id: makeId("feedback"), treeId, type: "feature", status, priority: "high", title: "Private Access settings applied", body: guide, page: "Private Access", createdBy: user?.email || "Local user", createdAt: at, updatedAt: at });
      });
      recordUpdateAgentSignal("private-access-settings-applied", { mode: privateAccess.mode, routeCloudSync: privateAccess.routeCloudSync, routeResearch: privateAccess.routeResearch, killSwitch: privateAccess.killSwitch });
      setItemMessage(status === "done" ? "Applied Private Access settings for KinForge traffic." : "Saved Private Access settings. Add a relay URL to route through a custom relay.");
    };
    return (
      <div className="stack private-access">
        <div className="hero-band">
          <div>
            <p className="eyebrow">Network resilience and private access</p>
            <h1>Private Access</h1>
            <p>Route KinForge traffic through direct access, the system proxy/VPN, a custom HTTPS relay, or offline-only mode so the library remains usable when cloud access is unreliable.</p>
          </div>
          <div className="hero-actions">
            <Badge>{accessState}</Badge>
            <Button icon={<Download size={16} />} onClick={() => exportText("KinForge-private-access-config.txt", `${guide}\n\nCurrent settings:\n${JSON.stringify(privateAccess, null, 2)}`)}>Download config</Button>
          </div>
        </div>
        <div className="three-col">
          <Section title="Private Access Mode" icon={<Globe2 size={18} />}>
            <label className="field"><span>Mode</span><select className="control" value={privateAccess.mode} onChange={event => setPrivateAccess(current => ({ ...current, mode: event.target.value as PrivateAccessMode }))}>{["Direct", "System proxy / system VPN", "Custom HTTPS relay", "Offline only"].map(mode => <option key={mode}>{mode}</option>)}</select></label>
            <Field label="Relay/provider name" value={privateAccess.provider} onChange={value => setPrivateAccess(current => ({ ...current, provider: value }))} />
            <Field label="Relay URL" value={privateAccess.relayUrl} onChange={value => setPrivateAccess(current => ({ ...current, relayUrl: value }))} />
            <label className="field"><span>Region</span><select className="control" value={privateAccess.region} onChange={event => setPrivateAccess(current => ({ ...current, region: event.target.value }))}>{["Auto", "Singapore", "United States", "Europe", "Japan", "Australia", "Custom"].map(region => <option key={region}>{region}</option>)}</select></label>
          </Section>
          <Section title="Routing Controls" icon={<Shield size={18} />}>
            <label className="check-row"><input type="checkbox" checked={privateAccess.routeCloudSync} onChange={event => setPrivateAccess(current => ({ ...current, routeCloudSync: event.target.checked }))} />Route cloud sync through private access</label>
            <label className="check-row"><input type="checkbox" checked={privateAccess.routeResearch} onChange={event => setPrivateAccess(current => ({ ...current, routeResearch: event.target.checked }))} />Route research and AI provider calls through private access</label>
            <label className="check-row"><input type="checkbox" checked={privateAccess.killSwitch} onChange={event => setPrivateAccess(current => ({ ...current, killSwitch: event.target.checked }))} />KinForge kill switch: stay offline if private access is unavailable</label>
            <label className="check-row"><input type="checkbox" checked={privateAccess.offlineFallback} onChange={event => setPrivateAccess(current => ({ ...current, offlineFallback: event.target.checked }))} />Open cached library immediately when network is blocked</label>
            <p className="quiet">This controls KinForge app traffic. Whole-device VPN tunnelling is handled by the operating system or VPN provider.</p>
          </Section>
          <Section title="Access Actions" icon={<ClipboardList size={18} />}>
            <p className="quiet">Apply these as active KinForge traffic settings and download the configuration for backup or native-app setup.</p>
            <div className="button-row">
              <Button icon={<Plus size={16} />} onClick={applySettings}>Apply settings</Button>
              <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportText("KinForge-private-access-config.txt", `${guide}\n\nCurrent settings:\n${JSON.stringify(privateAccess, null, 2)}`)}>Download</Button>
            </div>
          </Section>
        </div>
      </div>
    );
  };

  const renderMedia = () => (
    <div className="stack">
      <Section title="My Photos, Media Gallery and Lab" icon={<Image size={18} />} action={<label className="button primary"><Upload size={16} />Upload<input type="file" multiple hidden onChange={handleMediaUpload} /></label>}>
        <div className="gallery-grid">
          {state.media.filter(item => item.treeId === treeId).map((item) => (
            <button key={item.id} className={`media-tile ${item.id === currentMedia?.id ? "selected" : ""}`} onClick={() => setSelectedMediaId(item.id)}>
              {item.type === "picture" && item.dataUrl ? <img src={item.dataUrl} alt={item.title} /> : <div className="file-preview">{item.type}</div>}
              <span>{item.title}</span>
            </button>
          ))}
        </div>
        {!state.media.length && <p className="quiet">Upload pictures, videos, audio, PDFs, documents, or save website media links.</p>}
      </Section>
      {currentMedia && (
        <div className="two-col">
          <Section title="Media Tools" icon={<Wand2 size={18} />}>
            {itemActions({ kind: "media", id: currentMedia.id }, currentMedia.title)}
            <label className="field"><span>File visibility</span><select className="control" aria-label="File visibility" disabled={!canManagePrivacy} value={currentMedia.visibility || (currentMedia.tags.includes("government-file") ? "private" : "shared")} onChange={event => updateMedia(currentMedia.id, media => { media.visibility = event.target.value === "private" ? "private" : "shared"; })}>
              {Object.entries(SENSITIVE_VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <div className="media-preview">
              {currentMedia.type === "picture" && currentMedia.dataUrl ? (
                <img
                  src={currentMedia.dataUrl}
                  alt={currentMedia.title}
                  style={{
                    rotate: `${currentMedia.rotation}deg`,
                    filter: `${currentMedia.colorized ? "sepia(.22) saturate(1.45)" : ""} ${currentMedia.enhanced ? "contrast(1.15) brightness(1.04)" : ""} ${currentMedia.repaired ? "drop-shadow(0 0 0 transparent)" : ""}`
                  }}
                />
              ) : <div className="file-preview large">{currentMedia.type}</div>}
            </div>
            <div className="button-row">
              <Button onClick={() => updateMedia(currentMedia.id, (media) => { media.rotation = (media.rotation + 90) % 360; })}>Rotate</Button>
              <Button onClick={() => updateMedia(currentMedia.id, (media) => { media.colorized = !media.colorized; })}>Warm tone</Button>
              <Button onClick={() => updateMedia(currentMedia.id, (media) => { media.enhanced = !media.enhanced; })}>Contrast</Button>
            </div>
          </Section>
          <Section title="Assignments, Story, Tags" icon={<Link2 size={18} />}>
            <Field label="Title" value={currentMedia.title} onChange={(value) => updateMedia(currentMedia.id, (media) => { media.title = value; })} />
            <Field label="Website URL" value={currentMedia.externalUrl} onChange={(value) => updateMedia(currentMedia.id, (media) => { media.externalUrl = value; })} />
            <Field label="Tags" value={currentMedia.tags.join(", ")} onChange={(value) => updateMedia(currentMedia.id, (media) => { media.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean); })} />
            <label className="field-label">Photo Storyteller / audio story text</label>
            <textarea className="textarea compact" value={currentMedia.story} onChange={(event) => updateMedia(currentMedia.id, (media) => { media.story = event.target.value; })} />
            <label className="field-label">Document transcription</label>
            <textarea className="textarea compact" value={currentMedia.transcript} onChange={(event) => updateMedia(currentMedia.id, (media) => { media.transcript = event.target.value; })} />
            <label className="field"><span>Assign to person</span>
            <select className="control" value={currentMedia.assignedTo.find((assignment) => assignment.kind === "person")?.id ?? ""} onChange={(event) => updateMedia(currentMedia.id, (media) => {
              media.assignedTo = media.assignedTo.filter((assignment) => assignment.kind !== "person");
              if (event.target.value) media.assignedTo.push({ kind: "person", id: event.target.value });
            })}>
              <option value="">No person</option>
              {people.map((entry) => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}
            </select></label>
          </Section>
        </div>
      )}
    </div>
  );

  const updateMedia = (mediaId: string, updater: (media: MediaItem) => void) => mutate("Updated media", (draft) => {
    const target = draft.media.find((media) => media.id === mediaId);
    if (target) updater(target);
  });

  const renderIdeasFeedback = () => {
    const ideas = (state.ideasJournal || []).filter(entry => entry.treeId === treeId);
    const feedback = (state.userFeedback || []).filter(entry => entry.treeId === treeId);
    const addIdea = () => {
      const title = ideaDraft.title.trim();
      const body = ideaDraft.body.trim();
      if (!title && !body) return;
      const at = nowIso();
      mutate("Added idea journal entry", draft => {
        draft.ideasJournal.push({
          id: makeId("idea"),
          treeId,
          personId: ideaDraft.personId || person?.id,
          title: title || "Untitled idea",
          category: ideaDraft.category,
          status: "idea",
          tags: ideaDraft.tags.split(",").map(tag => tag.trim()).filter(Boolean),
          body,
          createdAt: at,
          updatedAt: at
        });
      });
      setIdeaDraft({ title: "", category: "Character arc", personId: "", tags: "", body: "" });
    };
    const addFeedback = () => {
      const title = feedbackDraft.title.trim();
      const body = feedbackDraft.body.trim();
      if (!title && !body) return;
      const at = nowIso();
      mutate("Added user feedback", draft => {
        draft.userFeedback.push({
          id: makeId("feedback"),
          treeId,
          personId: feedbackDraft.personId || person?.id,
          type: feedbackDraft.type as (typeof FEEDBACK_TYPES)[number],
          status: "new",
          priority: feedbackDraft.priority as (typeof FEEDBACK_PRIORITIES)[number],
          title: title || "Untitled feedback",
          body,
          page: NAV.find(item => item.id === view)?.label || view,
          createdBy: user?.email || "Local user",
          createdAt: at,
          updatedAt: at
        });
      });
      recordUpdateAgentSignal("user-feedback-created", { type: feedbackDraft.type, priority: feedbackDraft.priority });
      setFeedbackDraft({ title: "", type: "feature", priority: "normal", personId: "", body: "" });
    };
    return <div className="stack">
      <div className="hero-band">
        <div>
          <p className="eyebrow">Planning and app-improvement inbox</p>
          <h1>Ideas & Feedback</h1>
          <p>Keep character ideas, fandom notes, app feedback, bugs, accessibility requests, and future release ideas in one searchable library area.</p>
        </div>
        <div className="hero-actions">
          <Badge>{ideas.length} ideas</Badge>
          <Badge>{feedback.length} feedback items</Badge>
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportText("KinForge-ideas-feedback.json", JSON.stringify({ app: "KinForge Genealogy Studio", copyright: COPYRIGHT_NOTICE, treeId, ideas, feedback, exportedAt: nowIso() }, null, 2))}>Download</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="Ideas Journal" icon={<Lightbulb size={18} />}>
          <div className="settings-grid">
            <Field label="Idea title" value={ideaDraft.title} onChange={(value) => setIdeaDraft({ ...ideaDraft, title: value })} />
            <label className="field"><span>Category</span><select className="control" value={ideaDraft.category} onChange={event => setIdeaDraft({ ...ideaDraft, category: event.target.value })}>{IDEA_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
            <label className="field"><span>Linked person</span><select className="control" value={ideaDraft.personId} onChange={event => setIdeaDraft({ ...ideaDraft, personId: event.target.value })}><option value="">Current or whole tree</option>{people.map(entry => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}</select></label>
            <Field label="Tags" value={ideaDraft.tags} onChange={(value) => setIdeaDraft({ ...ideaDraft, tags: value })} />
          </div>
          <label className="field"><span>Idea notes</span><textarea className="control" rows={5} value={ideaDraft.body} onChange={event => setIdeaDraft({ ...ideaDraft, body: event.target.value })} /></label>
          <div className="button-row">
            <Button icon={<Plus size={16} />} onClick={addIdea}>Add idea</Button>
            <DictationButton enabled={state.accessibility.speechToText} label="Dictate idea" onStatus={setDictationMessage} onText={text => setIdeaDraft(current => ({ ...current, body: [current.body, text].filter(Boolean).join(current.body ? "\n" : "") }))} />
          </div>
          {dictationMessage && <p role="status" className="quiet">{dictationMessage}</p>}
          <div className="journal-list">
            {ideas.map(entry => <article className="journal-card" key={entry.id}>
              <div className="saved-item-heading"><strong>{entry.title}</strong>{itemActions({ kind: "ideasJournal", id: entry.id }, entry.title)}</div>
              <div className="settings-grid">
                <label className="field"><span>Status</span><select className="control" value={entry.status} onChange={event => mutate("Updated idea status", draft => { const target = draft.ideasJournal.find(item => item.id === entry.id); if (target) { target.status = event.target.value as typeof IDEA_STATUSES[number]; target.updatedAt = nowIso(); } })}>{IDEA_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
                <label className="field"><span>Person</span><select className="control" value={entry.personId || ""} onChange={event => mutate("Updated idea link", draft => { const target = draft.ideasJournal.find(item => item.id === entry.id); if (target) { target.personId = event.target.value || undefined; target.updatedAt = nowIso(); } })}><option value="">Whole tree</option>{people.map(target => <option key={target.id} value={target.id}>{fullName(target)}</option>)}</select></label>
              </div>
              <p>{entry.body || "No notes recorded."}</p>
              <small>{entry.category} · {entry.tags.join(", ") || "no tags"}</small>
            </article>)}
            {!ideas.length && <p className="quiet">No ideas saved yet.</p>}
          </div>
        </Section>
        <Section title="User Feedback Inbox" icon={<ClipboardList size={18} />}>
          <div className="settings-grid">
            <Field label="Feedback title" value={feedbackDraft.title} onChange={(value) => setFeedbackDraft({ ...feedbackDraft, title: value })} />
            <label className="field"><span>Type</span><select className="control" value={feedbackDraft.type} onChange={event => setFeedbackDraft({ ...feedbackDraft, type: event.target.value })}>{FEEDBACK_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
            <label className="field"><span>Priority</span><select className="control" value={feedbackDraft.priority} onChange={event => setFeedbackDraft({ ...feedbackDraft, priority: event.target.value })}>{FEEDBACK_PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select></label>
            <label className="field"><span>Linked person</span><select className="control" value={feedbackDraft.personId} onChange={event => setFeedbackDraft({ ...feedbackDraft, personId: event.target.value })}><option value="">Current or whole tree</option>{people.map(entry => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}</select></label>
          </div>
          <label className="field"><span>Feedback details</span><textarea className="control" rows={5} value={feedbackDraft.body} onChange={event => setFeedbackDraft({ ...feedbackDraft, body: event.target.value })} /></label>
          <div className="button-row">
            <Button icon={<Plus size={16} />} onClick={addFeedback}>Add feedback</Button>
            <DictationButton enabled={state.accessibility.speechToText} label="Dictate feedback" onStatus={setDictationMessage} onText={text => setFeedbackDraft(current => ({ ...current, body: [current.body, text].filter(Boolean).join(current.body ? "\n" : "") }))} />
          </div>
          <p className="quiet">Feedback is stored in your KinForge library and can feed the internal monthly update planner. It is not a public support ticket.</p>
          <div className="journal-list">
            {feedback.map(entry => <article className="journal-card feedback" key={entry.id}>
              <div className="saved-item-heading"><strong>{entry.title}</strong>{itemActions({ kind: "userFeedback", id: entry.id }, entry.title)}</div>
              <div className="settings-grid">
                <label className="field"><span>Status</span><select className="control" value={entry.status} onChange={event => mutate("Updated feedback status", draft => { const target = draft.userFeedback.find(item => item.id === entry.id); if (target) { target.status = event.target.value as typeof entry.status; target.updatedAt = nowIso(); } })}>{FEEDBACK_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label>
                <label className="field"><span>Priority</span><select className="control" value={entry.priority} onChange={event => mutate("Updated feedback priority", draft => { const target = draft.userFeedback.find(item => item.id === entry.id); if (target) { target.priority = event.target.value as typeof entry.priority; target.updatedAt = nowIso(); } })}>{FEEDBACK_PRIORITIES.map(priority => <option key={priority}>{priority}</option>)}</select></label>
              </div>
              <p>{entry.body || "No feedback details recorded."}</p>
              <small>{entry.type} · {entry.page} · {entry.createdBy}</small>
            </article>)}
            {!feedback.length && <p className="quiet">No feedback recorded yet.</p>}
          </div>
        </Section>
      </div>
    </div>;
  };

  const renderGlyphLibrary = () => {
    const visibleGroups = glyphGroups
      .map((group) => ({ group, glyphs: matchingGlyphs.filter((glyph) => glyph.group === group) }))
      .filter(({ glyphs }) => glyphs.length);

    return (
      <div className="stack glyph-library" aria-label="Glyph Library">
        <div className="hero-band glyph-library-hero">
          <div>
            <p className="eyebrow">Searchable symbol system</p>
            <h1>Glyph Library</h1>
            <p>Every KinForge symbol is labelled with a plain-language meaning, its category, and a downloadable SVG so reports, charts, family cards, and kinship notes stay readable.</p>
          </div>
          <div className="hero-actions">
            <Badge>{GLYPHS.length} labelled glyphs</Badge>
            <a className="button secondary" href={glyphLibraryPath()} target="_blank" rel="noreferrer"><Sparkles size={16} />Open full glyph library</a>
            <a className="button secondary" href="./glyphs/manifest.json" download><Download size={16} />Manifest</a>
          </div>
        </div>
        <Section title="Find a symbol meaning" icon={<Search size={18} />}>
          <div className="glyph-library-toolbar">
            <label className="tree-search">
              <Search size={16} />
              <input aria-label="Search glyph meanings" value={glyphQuery} onChange={(event) => setGlyphQuery(event.target.value)} placeholder="Search labels, meanings, aliases" />
            </label>
            <select className="control" aria-label="Glyph category" value={glyphGroup} onChange={(event) => setGlyphGroup(event.target.value as GlyphGroup | "All")}>
              <option value="All">All glyph categories</option>
              {glyphGroups.map((group) => <option key={group}>{group}</option>)}
            </select>
            <Badge>{matchingGlyphs.length} result{matchingGlyphs.length === 1 ? "" : "s"}</Badge>
          </div>
          <div className="glyph-library-groups" aria-label="Glyph library category links">
            {glyphGroups.map((group) => {
              const count = GLYPHS.filter((glyph) => glyph.group === group).length;
              return (
                <a key={group} href={glyphLibraryPath(group)} target="_blank" rel="noreferrer" aria-label={`Open ${group} glyph library`}>
                  <strong>{group}</strong>
                  <small>{count} glyph{count === 1 ? "" : "s"} · standalone library</small>
                </a>
              );
            })}
          </div>
        </Section>
        <section className="glyph-results-section" aria-label="Glyph results">
          {visibleGroups.map(({ group, glyphs }) => (
            <div className="glyph-result-group" key={group}>
              <div className="glyph-result-heading">
                <h2>{group}</h2>
                <a href={glyphLibraryPath(group)} target="_blank" rel="noreferrer">Open {group} library</a>
              </div>
              <div className="glyph-result-grid">
                {glyphs.map((glyph) => (
                  <article className="glyph-result-card" key={glyph.id}>
                    <div className="glyph-result-icon"><Glyph id={glyph.id} size={30} decorative /></div>
                    <div>
                      <h3>{glyph.label}</h3>
                      <p>{glyph.meaning}</p>
                      {glyph.aliases?.length ? <small>Also searchable as {glyph.aliases.join(", ")}</small> : null}
                    </div>
                    <a className="button secondary glyph-svg-link" href={`./glyphs/${glyph.id}.svg`} download aria-label={`Download ${glyph.label} SVG`}>SVG</a>
                  </article>
                ))}
              </div>
            </div>
          ))}
          {!matchingGlyphs.length && <EmptyState icon={<Sparkles />} title="No matching glyphs" action={<Button variant="secondary" onClick={() => { setGlyphQuery(""); setGlyphGroup("All"); }}>Clear search</Button>} />}
        </section>
      </div>
    );
  };

  const renderAccessibility = () => {
    const accessibility = state.accessibility;
    const applyPreset = (preset: "dyslexia" | "dysgraphia" | "low-vision" | "color-safe") => {
      const values: Record<"dyslexia" | "dysgraphia" | "low-vision" | "color-safe", Partial<AppState["accessibility"]>> = {
        "dyslexia": { fontFamily: "dyslexia", textScale: "large", symbolMode: "dyslexia", symbolSize: "large", colorVision: "standard", speechToText: accessibility.speechToText },
        "dysgraphia": { fontFamily: "dysgraphia", textScale: "large", symbolMode: "dysgraphia", symbolSize: "large", colorVision: "standard", speechToText: true },
        "low-vision": { fontFamily: "hyperlegible", textScale: "extra-large", symbolMode: "low-vision", symbolSize: "extra-large", colorVision: "high-contrast", speechToText: accessibility.speechToText },
        "color-safe": { fontFamily: accessibility.fontFamily, textScale: accessibility.textScale, symbolMode: "text-first", symbolSize: "large", colorVision: "deuteranopia", speechToText: accessibility.speechToText }
      };
      mutate("Applied accessibility preset", draft => { draft.accessibility = { ...draft.accessibility, ...values[preset] }; });
      recordUpdateAgentSignal("accessibility-preset-applied", { preset });
    };
    const addAccessSymbol = (glyphId: string, label: string, detail: string) => {
      if (!person) return;
      updatePerson(person.id, entry => {
        entry.accessNeeds = [...(entry.accessNeeds || []), { id: makeId("need"), glyphId, label, detail, private: true }];
      }, `Added ${label} access symbol`);
    };
    const previewGlyphs = ["dyslexia", "dysgraphia", "low-vision-symbols", "color-vision-safe-symbols", "text-first-symbols", "large-print", "screen-reader", "relationship-cousin-in-law"];
    return <div className="stack accessibility-workspace">
      <div className="hero-band">
        <div>
          <p className="eyebrow">Readable by default</p>
          <h1>Accessibility Controls</h1>
          <p>Choose app-wide fonts, large text, color-vision palettes, symbol presentation, and speech-to-text support. These controls change the KinForge interface; they do not rewrite genealogy records.</p>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" icon={<Type size={16} />} onClick={() => applyPreset("dyslexia")}>Dyslexia preset</Button>
          <Button variant="secondary" icon={<Keyboard size={16} />} onClick={() => applyPreset("dysgraphia")}>Dysgraphia preset</Button>
          <Button variant="secondary" icon={<Eye size={16} />} onClick={() => applyPreset("low-vision")}>Low vision preset</Button>
        </div>
      </div>
      <div className="two-col">
        <Section title="Readable Interface" icon={<Type size={18} />}>
          <div className="settings-grid">
            <label className="field"><span>{translate("App language")}</span><select className="control" value={appLanguage} onChange={event => updateAccessibility("appLanguage", event.target.value)}>
              {LANGUAGES.map(language => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}
            </select></label>
            <label className="field"><span>App font</span><select className="control" value={accessibility.fontFamily} onChange={event => updateAccessibility("fontFamily", event.target.value as AppState["accessibility"]["fontFamily"])}>
              {FONT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="field"><span>Text size</span><select className="control" value={accessibility.textScale} onChange={event => updateAccessibility("textScale", event.target.value as AppState["accessibility"]["textScale"])}>
              {TEXT_SCALE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="field"><span>Colorblindness / contrast filter</span><select className="control" value={accessibility.colorVision} onChange={event => updateAccessibility("colorVision", event.target.value as AppState["accessibility"]["colorVision"])}>
              {COLOR_VISION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="field"><span>Symbol style</span><select className="control" value={accessibility.symbolMode} onChange={event => updateAccessibility("symbolMode", event.target.value as AppState["accessibility"]["symbolMode"])}>
              {SYMBOL_MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label className="field"><span>Symbol size</span><select className="control" value={accessibility.symbolSize} onChange={event => updateAccessibility("symbolSize", event.target.value as AppState["accessibility"]["symbolSize"])}>
              {SYMBOL_SIZE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <div className="toggle-row"><label><input type="checkbox" checked={accessibility.speechToText} onChange={event => updateAccessibility("speechToText", event.target.checked)} /> Enable speech-to-text buttons</label></div>
          </div>
          <div className="button-row">
            <Button variant="secondary" onClick={() => applyPreset("color-safe")} icon={<Eye size={16} />}>Color-vision safe preset</Button>
            <Button variant="secondary" onClick={() => mutate("Reset accessibility settings", draft => { draft.accessibility = createSeedState().accessibility; })}>Reset defaults</Button>
          </div>
          <p className="quiet">Dyslexia and dysgraphia modes increase label clarity, spacing, and input support. Low-vision mode increases contrast and symbol size. Color filters avoid relying on red/green/blue alone.</p>
        </Section>
        <Section title="Speech-to-Text" icon={<Mic size={18} />}>
          <p className="quiet">Dictation uses the device or browser speech recognition feature when it is available. KinForge does not provide a microphone service by itself.</p>
          <textarea className="textarea compact" value={dictationScratch} rows={8} placeholder="Use this scratch area to test dictation, then move the text into a biography, note, report, idea, or feedback entry." onChange={event => setDictationScratch(event.target.value)} />
          <div className="button-row">
            <DictationButton enabled={accessibility.speechToText} label="Start dictation" onStatus={setDictationMessage} onText={text => setDictationScratch(current => [current, text].filter(Boolean).join(current ? "\n" : ""))} />
            <Button variant="secondary" disabled={!person || !dictationScratch.trim()} onClick={() => person && updatePerson(person.id, entry => { entry.notes = [entry.notes, dictationScratch.trim()].filter(Boolean).join(entry.notes ? "\n" : ""); }, "Added dictated note")}>Add to current person notes</Button>
          </div>
          {dictationMessage && <p role="status" className="quiet">{dictationMessage}</p>}
        </Section>
      </div>
      <Section title="Dyslexia, Dysgraphia, and Low-Vision Symbol Controls" icon={<Sparkles size={18} />}>
        <div className="glyph-result-grid symbol-preview-grid">
          {previewGlyphs.map(id => {
            const glyph = GLYPHS.find(item => item.id === id);
            return glyph ? <article className="glyph-result-card" key={glyph.id}>
              <div className="glyph-result-icon"><Glyph id={glyph.id} size={accessibility.symbolSize === "extra-large" ? 38 : accessibility.symbolSize === "large" ? 34 : 30} decorative /></div>
              <div><h3>{glyph.label}</h3><p>{glyph.meaning}</p><small>{glyph.group}</small></div>
            </article> : null;
          })}
        </div>
        <div className="button-row">
          <Button variant="secondary" disabled={!person} onClick={() => addAccessSymbol("dyslexia-friendly-symbols", "Dyslexia-friendly symbols", "Use clearer captions, extra spacing, larger labels and avoid relying on similar-looking symbols only.")}>Add dyslexia symbol need</Button>
          <Button variant="secondary" disabled={!person} onClick={() => addAccessSymbol("dysgraphia-friendly-input", "Dysgraphia-friendly input", "Use dictation, larger form controls, slower editable steps and clear labels.")}>Add dysgraphia input need</Button>
          <Button variant="secondary" disabled={!person} onClick={() => addAccessSymbol("low-vision-symbols", "Low-vision symbols", "Use larger high-contrast symbols with text labels.")}>Add low-vision symbol need</Button>
          <Button variant="secondary" disabled={!person} onClick={() => addAccessSymbol("color-vision-safe-symbols", "Color-vision safe symbols", "Use line styles, labels and shapes in addition to color.")}>Add color-safe symbol need</Button>
        </div>
        <p className="quiet">{person ? `Access symbols will be added to ${fullName(person)} as private annotations.` : "Select a person first to add access-need symbols to their profile."}</p>
      </Section>
    </div>;
  };

  const renderCharts = () => {
    const surnameCounts = Object.entries(people.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.familyName || "Unknown"] = (acc[entry.familyName || "Unknown"] ?? 0) + 1;
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]);
    const datedTimeline = timelineItems(state, treeId).filter(item => item.date);
    const mappedPlaces = state.places.filter(place => place.treeId === treeId && place.latitude && place.longitude);
    return (
    <div className="chart-grid">
      <Section title="Family Infographics" icon={<ChartNoAxesCombined size={18} />}>
        <p className="quiet">Build family-wide visual summaries from the same live tree data used by reports and charts.</p>
        <div className="metric-grid compact" aria-label="Family infographic stats">
          <div className="metric"><ChartNoAxesCombined size={18} /><span>Top surname</span><strong>{surnameCounts[0]?.[0] || "None"}</strong></div>
          <div className="metric"><History size={18} /><span>Dated timeline items</span><strong>{datedTimeline.length}</strong></div>
          <div className="metric"><Map size={18} /><span>Mapped places</span><strong>{mappedPlaces.length}</strong></div>
        </div>
        <div className="button-row">
          <Button onClick={() => updateChartConfig("type", "Name Distribution")}>Surname infographic</Button>
          <Button variant="secondary" onClick={() => updateChartConfig("type", "Timeline")}>Timeline infographic</Button>
          <Button variant="secondary" onClick={() => updateChartConfig("type", "Statistics Chart")}>Statistics infographic</Button>
        </div>
      </Section>
      <Section title="Chart Editor" icon={<ChartNoAxesCombined size={18} />}>
        <div className="settings-grid">
          <label className="field"><span>Chart type</span>
          <select className="control" aria-label="Chart type" value={state.chartConfig.type} onChange={(event) => updateChartConfig("type", event.target.value)}>
            {CHART_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select></label>
          <label className="field"><span>Orientation</span>
          <select className="control" aria-label="Chart orientation" value={state.chartConfig.orientation} onChange={(event) => updateChartConfig("orientation", event.target.value as ChartConfig["orientation"])}>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
            <option value="radial">Radial</option>
          </select></label>
          <label className="field"><span>Style</span>
          <select className="control" aria-label="Chart style" value={state.chartConfig.style} onChange={(event) => updateChartConfig("style", event.target.value as ChartConfig["style"])}>
            <option value="classic">Classic</option>
            <option value="compact">Compact</option>
            <option value="documentary">Documentary</option>
            <option value="color-branches">Color branches</option>
          </select></label>
          <Field label="Font" value={state.chartConfig.font} onChange={(value) => updateChartConfig("font", value)} />
          <Field label="Color" type="color" value={state.chartConfig.color} onChange={(value) => updateChartConfig("color", value)} />
          <label className="field"><span>Page size</span>
          <select className="control" aria-label="Chart page size" value={state.chartConfig.pageSize} onChange={(event) => updateChartConfig("pageSize", event.target.value as ChartConfig["pageSize"])}>
            <option value="single">Single</option>
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
            <option value="poster">Poster / multipage</option>
          </select></label>
          <Field label="Rotation" type="number" value={String(state.chartConfig.rotation)} onChange={(value) => updateChartConfig("rotation", Number(value))} />
          <Field label="Additional text" value={state.chartConfig.extraText} onChange={(value) => updateChartConfig("extraText", value)} />
          <Field label="Additional line note" value={state.chartConfig.lineNote} onChange={(value) => updateChartConfig("lineNote", value)} />
          <div className="toggle-row">
            <label><input type="checkbox" checked={state.chartConfig.showLabels} onChange={(event) => updateChartConfig("showLabels", event.target.checked)} /> Labels</label>
            <label><input type="checkbox" checked={state.chartConfig.showShadows} onChange={(event) => updateChartConfig("showShadows", event.target.checked)} /> Shadows</label>
          </div>
        </div>
        <div className="button-row">
          <Button variant="secondary" disabled={!chartUndo.length} onClick={() => {
            const [previous, ...rest] = chartUndo;
            setChartRedo((items) => [state.chartConfig, ...items]);
            setChartUndo(rest);
            mutate("Undo chart edit", (draft) => { draft.chartConfig = previous; });
          }}>Undo</Button>
          <Button variant="secondary" disabled={!chartRedo.length} onClick={() => {
            const [next, ...rest] = chartRedo;
            setChartUndo((items) => [state.chartConfig, ...items]);
            setChartRedo(rest);
            mutate("Redo chart edit", (draft) => { draft.chartConfig = next; });
          }}>Redo</Button>
          <Button variant="secondary" onClick={() => exportText("KinForge-chart-export.json", JSON.stringify({ tree: tree.title, chart: state.chartConfig, selectedPerson: person ? fullName(person) : "", exportedAt: nowIso() }, null, 2))}>Export chart</Button>
          <Button variant="secondary" onClick={() => { setSelectedReportType(state.chartConfig.type); setReportMode("report"); setView("reports"); }}>PDF report</Button>
          <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={16} />}>Print</Button>
        </div>
      </Section>
      <Section title={state.chartConfig.type} icon={<Network size={18} />}>
        <ChartRenderer state={state} treeId={treeId} selectedPerson={person} />
      </Section>
    </div>
    );
  };

  const renderReports = () => <ReportWorkspace saved={!storageError && (!cloud || cloud.saved)} saveTarget={cloud && !cloud.demo ? "cloud" : "device"} readOnly={cloud?.readOnly} canManagePrivacy={canManagePrivacy} state={state} treeId={treeId} person={person} reportType={selectedReportType} setReportType={setSelectedReportType} mode={reportMode} setMode={setReportMode} onPerson={setSelectedPersonId} onDelete={id => requestDelete({ kind: "reportDrafts", id })} onSave={draft => {
    // Report text has its own editor history; autosaves should not fill the tree undo log.
    if (cloud?.readOnly) return;
    setHistory(previous => ({ ...previous, present: { ...previous.present, reportDrafts: [...(previous.present.reportDrafts || []).filter(item => item.id !== draft.id), draft] } }));
  }} />;

  const renderPublish = () => {
    const exportPeople = subsetPersonId ? people.filter((entry) => entry.id === subsetPersonId) : people;
    return (
      <div className="stack">
        <div className="two-col">
          <Section title="GEDCOM Import" icon={<Upload size={18} />}>
            <label className="button secondary"><Upload size={16} />Open GEDCOM File<input type="file" accept=".ged,.gedcom,.txt" hidden onChange={(event) => handleFileText(event, (text) => {
              setGedcomText(text);
              parseGedcomPreview(text);
            })} /></label>
            <textarea className="textarea compact" value={gedcomText} onChange={(event) => setGedcomText(event.target.value)} placeholder="Paste GEDCOM 5.5.1 or GEDCOM 7 text here." />
            <div className="button-row">
              <Button onClick={() => parseGedcomPreview()}>Preview</Button>
              <Button variant="secondary" disabled={!gedcomPreview} onClick={() => {
                if (!gedcomPreview) return;
                mutate("Appended GEDCOM", (draft) => {
                  const merged = mergeImportedPeople(draft, treeId, gedcomPreview.people, gedcomPreview.relationships);
                  Object.assign(draft, merged);
                });
              }}>Append and Merge</Button>
              <Button variant="secondary" disabled={!gedcomPreview} onClick={() => {
                if (!gedcomPreview) return;
                const newTreeId = makeId("tree");
                mutate("Created tree from GEDCOM", (draft) => {
                  draft.trees.push({ id: newTreeId, bookId: tree.bookId, collectionId: tree.collectionId, title: "Imported GEDCOM tree", author: tree.author, authorContact: tree.authorContact, language: tree.language, citationStyle: tree.citationStyle, privacy: "private", createdAt: nowIso() });
                  draft.people.push(...gedcomPreview.people.map((entry) => ({ ...entry, treeId: newTreeId })));
                  draft.relationships.push(...gedcomPreview.relationships.map((entry) => ({ ...entry, treeId: newTreeId })));
                });
                setSelectedTreeId(newTreeId);
              }}>New Tree</Button>
            </div>
            {gedcomPreview && <p className="quiet">Preview: {gedcomPreview.people.length} people and {gedcomPreview.relationships.length} relationships detected.</p>}
          </Section>
          <Section title="Privacy-Conscious Export" icon={<Shield size={18} />}>
            {PRIVACY_FIELDS.map((field) => <label className="check-row" key={field}><input type="checkbox" checked={field.includes("living") ? hideLiving : field.includes("private") ? hidePrivate : field.includes("media") ? !includeMedia : false} onChange={(event) => {
              if (field.includes("living")) setHideLiving(event.target.checked);
              if (field.includes("private")) setHidePrivate(event.target.checked);
              if (field.includes("media")) setIncludeMedia(!event.target.checked);
            }} />{field}</label>)}
            <label className="field"><span>Subset export</span>
            <select className="control" value={subsetPersonId} onChange={(event) => setSubsetPersonId(event.target.value)}>
              <option value="">Complete tree</option>
              {people.map((entry) => <option key={entry.id} value={entry.id}>{fullName(entry)}</option>)}
            </select></label>
            <div className="button-row">
              <Button onClick={() => exportText("KinForge-tree.ged", exportGedcom({ ...state, people: subsetPersonId ? exportPeople : state.people }, treeId, { hideLiving, hidePrivate, includeMedia }))}>GEDCOM</Button>
              <Button variant="secondary" onClick={() => downloadBlob("KinForge-backup.json", buildBackup(state), "application/json")}>Backup</Button>
              <Button variant="secondary" onClick={() => downloadBlob("KinForge-family-site.html", buildWebsiteExport(state, treeId), "text/html")}>Website</Button>
            </div>
          </Section>
        </div>
        <Section title="Print Charts, Books, Share, and Package" icon={<Download size={18} />}>
          <div className="publish-grid">
            <PublishCard title="Family Tree Book" detail="Generate the Family Tree Book report, edit it, then export PDF/RTF/text." action={() => { setReportMode("report"); setSelectedReportType("Family Tree Book"); setView("reports"); }} />
            <PublishCard title="Charts PDF" detail="Open the current fan, hourglass, relationship, or tree chart in the report editor for PDF/RTF/text export." action={() => { setReportMode("report"); setSelectedReportType(state.chartConfig.type); setView("reports"); }} />
            <PublishCard title="Static Website" detail="Exports private HTML you can upload to your own hosting or share locally." action={() => downloadBlob("KinForge-family-site.html", buildWebsiteExport(state, treeId), "text/html")} />
            <PublishCard title="Mac App" detail="Downloads a local release note for producing Apple Silicon and Intel DMG, PKG, and ZIP artifacts from this version." action={() => exportText("KinForge-mac-release-instructions.txt", [
              "KinForge Genealogy Studio Mac release",
              `Tree: ${tree.title}`,
              "Version: 1.2.0",
              "",
              "Build targets:",
              "- Apple Silicon DMG, PKG, and ZIP",
              "- Intel DMG, PKG, and ZIP",
              "",
              "Local packaging command:",
              "npm run build && npx electron-builder --mac dmg zip --arm64 --x64 --publish=never",
              "",
              "Acceptance checks:",
              "- Launch the packaged app and confirm the version.",
              "- Mount each DMG and confirm the app bundle is present.",
              "- Inspect architecture for arm64 and x86_64 deliverables.",
              "- Record signing/notarization status honestly.",
              "- Provide checksums for every shared artifact."
            ].join("\n"))} />
            <PublishCard title="Relative Invitation" detail={`Invite relatives to review ${tree.title}; export a public-safe website first if living/private data must stay hidden.`} action={() => exportText("KinForge-invitation.txt", `I am building our family tree in KinForge Genealogy Studio and would love your help reviewing names, dates, photos, and sources for ${tree.title}.`)} />
          </div>
        </Section>
      </div>
    );
  };

  const renderDna = () => {
    const matches = state.dnaMatches.filter((match) => match.treeId === treeId && (dnaSideFilter === "all" || match.side === dnaSideFilter));
    const clusters = buildAutoClusters(matches);
    const chromosomes = buildChromosomeRows(matches);
    return (
      <div className="stack">
        <Section title="DNA Matches and Genetic Groups" icon={<Dna size={18} />} action={<Button onClick={createDnaMatch} icon={<Plus size={16} />}>Match</Button>}>
          <div className="segmented">
            {["all", "maternal", "paternal", "unknown"].map((side) => <button key={side} className={dnaSideFilter === side ? "active" : ""} onClick={() => setDnaSideFilter(side)}>{side}</button>)}
          </div>
          <div className="dna-grid">
            {matches.map((match) => (
              <DnaMatchCard key={match.id} match={match} people={people} onUpdate={(updater) => mutate("Updated DNA match", (draft) => {
                const target = draft.dnaMatches.find((entry) => entry.id === match.id);
                if (target) updater(target);
              })} />
            ))}
          </div>
        </Section>
        <div className="two-col">
          <Section title="AutoClusters and Shared Matches" icon={<ChartNoAxesCombined size={18} />}>
            {clusters.map((cluster) => (
              <div key={cluster.label} className="cluster-row">
                <strong>{cluster.label}</strong>
                <span>{cluster.items.length} matches</span>
                <Badge>{cluster.totalCm} cM</Badge>
              </div>
            ))}
          </Section>
          <Section title="Chromosome Browser and Painter" icon={<Dna size={18} />}>
            <div className="chromosome-browser">
              {chromosomes.map((row) => (
                <div key={row.chromosome} className="chromosome-row">
                  <span>{row.chromosome}</span>
                  <div className="chromosome-bar">
                    {row.segments.map((segment, index) => (
                      <i
                        key={`${row.chromosome}-${index}`}
                        title={`${segment.matchName}: ${segment.start}-${segment.end}`}
                        className={segment.side}
                        style={{ left: `${Math.min(95, segment.start / 1000000)}%`, width: `${Math.max(4, Math.min(50, (segment.end - segment.start) / 1000000))}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    );
  };

  const renderMaintenance = () => evidenceDashboard && (
    <div className="stack">
      <Section title="Evidence Quality Studio" icon={<Shield size={18} />}>
        <div className="metric-grid compact">
          <Metric label="Evidence score" value={`${evidenceDashboard.averageScore}/100`} icon={<Shield size={20} />} />
          <Metric label="Profiles with sources" value={`${evidenceDashboard.sourceCoverage}%`} icon={<BookOpen size={20} />} />
          <Metric label="Sourced events" value={`${evidenceDashboard.sourcedEvents}/${evidenceDashboard.totalEvents}`} icon={<FileText size={20} />} />
          <Metric label="Open risks" value={evidenceDashboard.issueCount + evidenceDashboard.duplicateCount} icon={<CircleHelp size={20} />} />
        </div>
        <div className="evidence-grid">
          <div className="evidence-panel">
            <h3>Profiles needing review</h3>
            {evidenceDashboard.needsReview.length ? evidenceDashboard.needsReview.map((entry) => (
              <article className="evidence-card" key={entry.person.id}>
                <div className="evidence-card-head">
                  <button type="button" onClick={() => openPerson(entry.person.id)}><strong>{fullName(entry.person)}</strong></button>
                  <Badge>{entry.score}/100</Badge>
                </div>
                <div className="evidence-score-bar" aria-label={`${fullName(entry.person)} evidence score ${entry.score} out of 100`}><i style={{ width: `${entry.score}%` }} /></div>
                <ul>
                  {entry.weaknesses.slice(0, 3).map((weakness) => <li key={`${entry.person.id}-${weakness.kind}-${weakness.label}`}><span>{weakness.label}</span><button type="button" onClick={() => createEvidenceTodo(entry, weakness.action)}>Create task</button></li>)}
                </ul>
              </article>
            )) : <p className="quiet">Every profile has the current evidence checks covered.</p>}
          </div>
          <div className="evidence-panel">
            <h3>Best-supported profiles</h3>
            {evidenceDashboard.strongest.map((entry) => (
              <article className="evidence-card compact-card" key={entry.person.id}>
                <div className="evidence-card-head">
                  <button type="button" onClick={() => openPerson(entry.person.id)}><strong>{fullName(entry.person)}</strong></button>
                  <Badge>{entry.score}/100</Badge>
                </div>
                <p>{entry.strengths.slice(0, 3).join(" · ") || "Evidence profile recorded."}</p>
              </article>
            ))}
            <div className="evidence-summary-list">
              <p><strong>{evidenceDashboard.privateReviewCount}</strong> private or sensitive profiles need export review.</p>
              <p><strong>{evidenceDashboard.duplicateCount}</strong> possible duplicate pair{evidenceDashboard.duplicateCount === 1 ? "" : "s"} need comparison before merging.</p>
            </div>
          </div>
        </div>
      </Section>
      <div className="two-col">
        <Section title="Database Maintenance" icon={<Database size={18} />}>
          <label className="field"><span>Operation</span><select className="control" value={maintenanceAction} onChange={event => { setMaintenanceAction(event.target.value as MaintenanceAction); setMaintenancePreview(null); setMaintenanceMessage(""); }}>{MAINTENANCE_ACTIONS.map(action => <option key={action}>{action}</option>)}</select></label>
          {maintenanceAction === "Search and replace" && <div className="inline-form">
            <input className="control" aria-label="Find text" placeholder="Find text" value={searchReplace.find} onChange={(event) => { setSearchReplace({ ...searchReplace, find: event.target.value }); setMaintenancePreview(null); setMaintenanceMessage(""); }} />
            <input className="control" aria-label="Replace with" placeholder="Replace with" value={searchReplace.replace} onChange={(event) => { setSearchReplace({ ...searchReplace, replace: event.target.value }); setMaintenancePreview(null); setMaintenanceMessage(""); }} />
          </div>}
          <div className="button-row">
            <Button icon={<Search size={16} />} onClick={previewMaintenance}>Preview changes</Button>
            <button className="button secondary" title="Undo last change" aria-label="Undo last change" disabled={!history.past.length} onClick={() => { undo(); setMaintenancePreview(null); setMaintenanceMessage("Undid the last change."); }}><Undo2 size={16} /></button>
            <button className="button secondary" title="Redo last change" aria-label="Redo last change" disabled={!history.future.length} onClick={() => { redo(); setMaintenancePreview(null); setMaintenanceMessage("Redid the last change."); }}><Redo2 size={16} /></button>
          </div>
          <p role="status">{maintenanceMessage}</p>
          {maintenancePreview?.treeId === treeId && <div className="maintenance-preview">
            {maintenancePreview.plan.notices.map(notice => <p className="quiet" key={notice}>{notice}</p>)}
            {maintenancePreview.plan.changes.length > 0 && <>
              <div className="maintenance-table-scroll"><table><thead><tr><th>Record</th><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{maintenancePreview.plan.changes.map((change, index) => <tr key={index}><td>{change.record}</td><td>{change.field}</td><td>{change.before || "(empty)"}</td><td>{change.after || "(empty)"}</td></tr>)}</tbody></table></div>
              <div className="button-row"><Button icon={<CheckCircle2 size={16} />} onClick={applyMaintenance}>Apply changes</Button><Button variant="secondary" icon={<XCircle size={16} />} onClick={() => { setMaintenancePreview(null); setMaintenanceMessage("Cancelled. No changes applied."); }}>Cancel</Button></div>
            </>}
          </div>}
          <div className="button-row">
            <Button variant="secondary" disabled={!duplicatePairs.length} onClick={mergeFirstDuplicate}>Merge First Duplicate</Button>
          </div>
        </Section>
        <Section title="Duplicates" icon={<Users size={18} />}>
          {duplicatePairs.length ? duplicatePairs.map((pair) => (
            <div key={`${pair.a.id}-${pair.b.id}`} className="duplicate-row">
              <strong>{fullName(pair.a)}</strong>
              <span>matches</span>
              <strong>{fullName(pair.b)}</strong>
              <Badge>{pair.reason}</Badge>
            </div>
          )) : <p className="quiet">No duplicate candidates found.</p>}
        </Section>
      </div>
      <Section title="Consistency Checker" icon={<Shield size={18} />}>
        <p className="quiet">The consistency checker runs the same plausibility report logic used before publication, covering dates, relationship contradictions, duplicates, and evidence gaps.</p>
        {issues.length ? issues.map((issue) => (
          <div key={`${issue.label}-${issue.detail}`} className="issue-line">
            {issue.severity === "error" ? <XCircle size={16} /> : <CircleHelp size={16} />}
            <strong>{issue.label}</strong>
            <span>{issue.detail}</span>
          </div>
        )) : <p className="quiet">No plausibility issues found.</p>}
      </Section>
    </div>
  );

  const goToWorkspaceForTarget = (target: string) => {
    const targetView: ViewKey =
      target.includes("report") ? "reports" :
      target.includes("package") || target.includes("website") ? "publish" :
      target.includes("source") || target.includes("maintenance") ? "maintenance" :
      target.includes("research") ? "research" :
      target.includes("tree") || target.includes("chart") || target.includes("event") ? "tree" :
      "coverage";
    setView(targetView);
  };

  const renderStrategy = () => (
    <div className="stack">
      <Section title="Competitive SWOT" icon={<Trophy size={18} />}>
        <div className="metric-grid compact">
          <Metric label="Competitors analysed" value={COMPETITOR_SWOT.length} icon={<Search size={20} />} />
          <Metric label="Advantage upgrades" value={COMPETITIVE_UPGRADES.length} icon={<Sparkles size={20} />} />
          <Metric label="Validated capabilities" value={summary.validated} icon={<CheckCircle2 size={20} />} />
        </div>
        <div className="strategy-grid">
          {COMPETITOR_SWOT.map((entry) => (
            <article className="strategy-card" key={entry.brand}>
              <div className="strategy-card-head">
                <h3>{entry.brand}</h3>
                <Badge>SWOT</Badge>
              </div>
              <div className="swot-grid">
                <div><strong>Strengths</strong>{entry.strengths.map(item => <p key={item}>{item}</p>)}</div>
                <div><strong>Weaknesses</strong>{entry.weaknesses.map(item => <p key={item}>{item}</p>)}</div>
                <div><strong>Opportunities</strong>{entry.opportunities.map(item => <p key={item}>{item}</p>)}</div>
                <div><strong>Threats</strong>{entry.threats.map(item => <p key={item}>{item}</p>)}</div>
              </div>
              <div className="kinforge-move">
                <strong>KinForge move</strong>
                <p>{entry.kinforgeMove}</p>
              </div>
            </article>
          ))}
        </div>
      </Section>
      <Section title="Outcompete Roadmap Applied" icon={<Sparkles size={18} />}>
        <div className="upgrade-list">
          {COMPETITIVE_UPGRADES.map((upgrade) => (
            <article className="upgrade-card" key={upgrade.feature}>
              <div>
                <h3>{upgrade.feature}</h3>
                <p><strong>Beats:</strong> {upgrade.beats}</p>
                <p>{upgrade.deliveredAs}</p>
              </div>
              <button className="button secondary" type="button" onClick={() => goToWorkspaceForTarget(upgrade.testTarget)}>
                Open feature
                <ChevronRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );

  const renderCoverage = () => {
    const rows = FEATURE_MATRIX.filter((row) => featureFilter === "all" || row.status === featureFilter);
    return (
      <div className="stack">
        <RequirementsRegister />
        <Section title="Markdown Feature Coverage" icon={<ClipboardList size={18} />}>
          <div className="metric-grid compact">
            <Metric label="Validated completed capabilities" value={summary.validated} icon={<CheckCircle2 size={20} />} />
          </div>
          <div className="segmented">
            {(["all", "validated"] as const).map((status) => <button key={status} className={featureFilter === status ? "active" : ""} onClick={() => setFeatureFilter(status)}>{status}</button>)}
          </div>
          <div className="coverage-table">
            {rows.map((row) => (
              <div className="coverage-row" key={`${row.area}-${row.feature}`}>
                <Badge>{row.area}</Badge>
                <strong>{row.feature}</strong>
                <span>{row.appliedIn}</span>
                <StatusBadge status={row.status} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  };

  const accessibilityShellClass = [
    "app-shell",
    view === "tree" || view === "my-family-tree" ? "chart-shell" : "",
    `font-${state.accessibility.fontFamily}`,
    `text-${state.accessibility.textScale}`,
    `color-${state.accessibility.colorVision}`,
    `symbols-${state.accessibility.symbolMode}`,
    `symbol-size-${state.accessibility.symbolSize}`
  ].filter(Boolean).join(" ");

  return (
    <div className={accessibilityShellClass} lang={appLanguage} data-app-language={appLanguage} data-symbol-mode={state.accessibility.symbolMode} data-text-scale={state.accessibility.textScale}>
      <aside className={`sidebar ${menuOpen ? "menu-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><img src="./icon.svg" alt="" /></span>
          <div>
            <strong>KinForge</strong>
            <small>Genealogy Studio</small>
          </div>
        </div>
        <button className="mobile-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-controls="workspace-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <nav id="workspace-navigation" aria-label="Workspace" onKeyDown={event => { if (event.key === "Escape") { setMenuOpen(false); document.querySelector<HTMLButtonElement>(".mobile-menu-toggle")?.focus(); } }}>
          {NAV.map((item) => (
            <Link key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} to={workspacePath({ treeId, view: item.id, personId: item.id === "people" ? undefined : route.personId })} onClick={() => setMenuOpen(false)}>
              {item.icon}
              <span>{translate(item.label)}</span>
            </Link>
          ))}
          {cloud?.ownerMenu}
        </nav>
        <div className="product-line">Product of Dreams of Serene Landscapes<br /><span>{COPYRIGHT_NOTICE}</span></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">{tree?.title ?? "KinForge"} / {tree?.privacy ?? "private"}</p>
            <h2>{translate(NAV.find(item => item.id === view)?.label || "KinForge")}</h2>
          </div>
          <div className="topbar-controls">
            {cloud?.toolbar}
            <label className="topbar-language" title="Change app language">
              <span><Globe2 size={14} />{translate("App language")}</span>
              <select className="control" aria-label="App language" value={appLanguage} onChange={(event) => updateAccessibility("appLanguage", event.target.value)}>
                {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{languageLabel(language.code)}{language.region ? ` (${language.region})` : ""}</option>)}
              </select>
            </label>
            <select className="control" aria-label="Active relationship tree" value={treeId} onChange={(event) => setSelectedTreeId(event.target.value)}>
              {!state.trees.length && <option value="">No trees</option>}
              {state.trees.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <Button onClick={() => void saveNow()} icon={<Save size={16} />}>Save</Button>
            <Button onClick={() => downloadBlob("KinForge-backup.json", buildBackup(state), "application/json")} icon={<Download size={16} />}>Backup</Button>
            {tree && itemActions({ kind: "trees", id: treeId }, tree.title)}
            <Button variant="secondary" icon={<Archive size={16} />} onClick={() => setItemsOpen(true)}>Saved items</Button>
            <Button variant="secondary" icon={<BookOpen size={16} />} onClick={() => setTermsOpen(true)}>Terms and meanings</Button>
            <Button variant="secondary" icon={<BookOpen size={16} />} onClick={() => setReligiousTermsOpen(true)}>Religious terms</Button>
            <Button variant="ghost" icon={<LogOut size={16} />} onClick={() => {
              if (cloud) { cloud.onSignOut(); return; }
              setGuestMode(false);
              sessionStorage.removeItem("kinforge-guest");
              setAuth({ ...auth, activeUserId: null });
            }}>Logout</Button>
          </div>
        </header>
        {storageError && <p role="alert" className="report-error">{storageError}</p>}
        {itemMessage && <div className="item-feedback"><p role="status">{itemMessage}</p><button className="icon-button" title="Undo item change" aria-label="Undo item change" disabled={cloud?.readOnly || !history.past.length} onClick={() => { undo(); setItemMessage("Undid the last change."); }}><Undo2 size={17} /></button><button className="icon-button" title="Redo item change" aria-label="Redo item change" disabled={cloud?.readOnly || !history.future.length} onClick={() => { redo(); setItemMessage("Redid the last change."); }}><Redo2 size={17} /></button><button className="icon-button" aria-label="Dismiss item message" onClick={() => setItemMessage("")}><X size={17} /></button></div>}
        {cloud?.readOnly && <p className="cloud-readonly">Viewing only. Editing is paused for this library.</p>}
        <fieldset className="cloud-workspace-fields" disabled={cloud?.readOnly}>{renderView()}</fieldset>
      </main>
      {selectedDictionaryText && selectedTermMeaning && (
        <aside className="dictionary-popover" aria-live="polite" aria-label="Highlighted term meaning">
          <div>
            <strong>{selectedTermEntry?.term || selectedDictionaryText}</strong>
            <p>{selectedTermMeaning}</p>
          </div>
          <div className="button-row">
            <button type="button" className="button secondary" onClick={() => { setTermsOpen(true); }}>Dictionary</button>
            <button type="button" className="button ghost" onClick={() => { setAiDraft(current => ({ ...current, mode: "research", prompt: selectedDictionaryText })); setView("ai"); }}>Research</button>
            <button type="button" className="icon-button" aria-label="Close highlighted term meaning" onClick={() => setSelectedDictionaryText("")}><X size={16} /></button>
          </div>
        </aside>
      )}
      {itemsOpen && <SavedItemsDialog state={state} treeId={treeId} initialKind={itemKind} onClose={() => setItemsOpen(false)} onDelete={requestDelete} onDownload={downloadItem} readOnly={cloud?.readOnly} feedback={itemMessage} />}
      {deleteTarget && <DeleteItemDialog key={`${deleteTarget.kind}:${deleteTarget.ownerId || ""}:${deleteTarget.id}`} state={state} target={deleteTarget} readOnly={cloud?.readOnly} cloud={!!cloud && !cloud.demo} onClose={() => setDeleteTarget(null)} onConfirm={confirmDeletion} onDownload={downloadItem} feedback={itemMessage} />}
      {termsOpen && <TermsDialog customEntries={customGlossaryEntries} onClose={() => setTermsOpen(false)} />}
      {religiousTermsOpen && <ReligiousTermsDialog customTerms={state.customFactTerms} onClose={() => setReligiousTermsOpen(false)} />}
    </div>
  );
}

function LegalAgreementBox({ privacyAccepted, termsAccepted, onPrivacyAccepted, onTermsAccepted }: { privacyAccepted: boolean; termsAccepted: boolean; onPrivacyAccepted: (accepted: boolean) => void; onTermsAccepted: (accepted: boolean) => void }) {
  return <section className="legal-agreement" aria-labelledby="legal-agreement-title">
    <h2 id="legal-agreement-title">Privacy Policy and Terms & Conditions</h2>
    <p className="quiet">Effective {LEGAL_EFFECTIVE_DATE}. These rules apply before using the app, creating an account, signing in, recovering an account, checking updates, trying the separate demo, exporting, or downloading files.</p>
    <details open>
      <summary>Privacy Policy</summary>
      {PRIVACY_POLICY_SECTIONS.map(section => <article key={section.title}><h3>{section.title}</h3><p>{section.body}</p></article>)}
    </details>
    <details open>
      <summary>Terms & Conditions</summary>
      {TERMS_CONDITIONS_SECTIONS.map(section => <article key={section.title}><h3>{section.title}</h3><p>{section.body}</p></article>)}
    </details>
    <div className="legal-checks">
      <label className="check-row"><input type="checkbox" checked={privacyAccepted} onChange={event => onPrivacyAccepted(event.target.checked)} />I accept and agree to follow the KinForge Privacy Policy.</label>
      <label className="check-row"><input type="checkbox" checked={termsAccepted} onChange={event => onTermsAccepted(event.target.checked)} />I accept and agree to follow the KinForge Terms & Conditions, including the export and download copyright rules.</label>
    </div>
  </section>;
}

function AuthScreen({ mode, setMode, form, setForm, error, onSubmit, onGuest }: {
  mode: "login" | "create" | "forgot";
  setMode: (mode: "login" | "create" | "forgot") => void;
  form: { name: string; email: string; password: string; recoveryHint: string; recoveryCode: string; newPassword: string; privacyAccepted: boolean; termsAccepted: boolean };
  setForm: (form: { name: string; email: string; password: string; recoveryHint: string; recoveryCode: string; newPassword: string; privacyAccepted: boolean; termsAccepted: boolean }) => void;
  error: string;
  onSubmit: () => void;
  onGuest: () => void;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="brand auth-brand">
          <span className="brand-mark"><img src="./icon.svg" alt="" /></span>
          <div>
            <strong>KinForge</strong>
            <small>Product of Dreams of Serene Landscapes</small>
            <small>{COPYRIGHT_NOTICE}</small>
          </div>
        </div>
        <h1>{mode === "create" ? "Create account" : mode === "forgot" ? "Reset password" : "Sign in"}</h1>
        <p className="quiet">Sign in protects private trees, genograms, character networks, archives, reports, and government files on this device. KinForge is built for social workers, writers, genealogists, historians, roleplayers, RPG players and anyone mapping complex relationships. Guest mode opens only a demo workspace.</p>
        {mode === "create" && <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />}
        <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
        {mode !== "forgot" && <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />}
        {mode === "create" && <Field label="Recovery hint" value={form.recoveryHint} onChange={(value) => setForm({ ...form, recoveryHint: value })} />}
        {mode === "forgot" && <Field label="Secret recovery key" value={form.recoveryCode} onChange={(value) => setForm({ ...form, recoveryCode: value })} />}
        {mode === "forgot" && <Field label="New password" type="password" value={form.newPassword} onChange={(value) => setForm({ ...form, newPassword: value })} />}
        {mode === "forgot" && form.email && <p className="quiet">KinForge will only reset this device password when the secret recovery key matches this account.</p>}
        {error && <div className={`auth-message ${error.includes("reset") ? "ok" : "bad"}`}>{error}</div>}
        <Button onClick={onSubmit} icon={mode === "create" ? <Plus size={16} /> : <Shield size={16} />}>{mode === "create" ? "Create Account" : mode === "forgot" ? "Reset Password" : "Login"}</Button>
        <div className="auth-links">
          <button onClick={() => setMode("login")}>Login</button>
          <button onClick={() => setMode("create")}>Create account</button>
          <button onClick={() => setMode("forgot")}>Forgot password</button>
          <button aria-label="Continue as guest" onClick={onGuest}>Try a separate demo</button>
        </div>
        <LegalAgreementBox privacyAccepted={form.privacyAccepted} termsAccepted={form.termsAccepted} onPrivacyAccepted={accepted => setForm({ ...form, privacyAccepted: accepted })} onTermsAccepted={accepted => setForm({ ...form, termsAccepted: accepted })} />
      </div>
    </div>
  );
}

function Button({ children, onClick, icon, ariaLabel, variant = "primary", disabled = false }: { children: ReactNode; onClick: () => void; icon?: ReactNode; ariaLabel?: string; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean }) {
  return <button className={`button ${variant}`} aria-label={ariaLabel} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

function DictationButton({ enabled, label, onText, onStatus }: { enabled: boolean; label: string; onText: (text: string) => void; onStatus: (message: string) => void }) {
  const [listening, setListening] = useState(false);
  const start = () => {
    if (!enabled) { onStatus("Turn on speech-to-text in Accessibility first."); return; }
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition || (window as typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognition) { onStatus("Speech-to-text is not available in this browser yet. Try the desktop app or a browser with speech recognition."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => { setListening(true); onStatus("Listening..."); };
    recognition.onerror = () => { setListening(false); onStatus("Dictation stopped before text was captured."); };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = String(event.results?.[0]?.[0]?.transcript || "").trim();
      if (text) { onText(text); onStatus("Dictation added."); }
      else onStatus("No speech was captured.");
    };
    recognition.start();
  };
  return <button type="button" className="button secondary" onClick={start} disabled={listening}><Mic size={16} />{listening ? "Listening..." : label}</button>;
}

function Section({ title, icon, action, children }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{icon}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DateModeField({ label, value, onChange, mode, onModeChange, compact = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  compact?: boolean;
}) {
  const [rangeStart, rangeEnd] = value.includes("..") ? value.split("..") : value.includes(" to ") ? value.split(" to ") : ["", ""];
  const qualifier = DATE_QUALIFIERS.find(entry => value.startsWith(`${entry} `)) || "About";
  const qualifiedText = value.startsWith(`${qualifier} `) ? value.slice(qualifier.length + 1) : value;
  const strictDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  const strictMonth = /^\d{4}-\d{2}$/.test(value) ? value : "";
  return (
    <div className={`date-mode-field ${compact ? "compact" : ""}`}>
      <label className="field date-mode-select">
        <span>{label} mode</span>
        <select className="control" aria-label={`${label} mode`} value={mode} onChange={(event) => onModeChange(event.target.value)}>
          {DATE_MODES.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
        </select>
      </label>
      {mode === "full" && <label className="field"><span>{label}</span><input className="control" aria-label={label} type="date" value={strictDate} onChange={(event) => onChange(event.target.value)} /></label>}
      {mode === "month" && <label className="field"><span>{label}</span><input className="control" aria-label={label} type="month" value={strictMonth} onChange={(event) => onChange(event.target.value)} /></label>}
      {mode === "year" && <label className="field"><span>{label}</span><input className="control" aria-label={label} inputMode="numeric" pattern="[0-9]{4}" placeholder="YYYY" value={value} onChange={(event) => onChange(event.target.value)} /></label>}
      {mode === "range" && <div className="date-range-inputs">
        <label className="field"><span>{label} from</span><input className="control" aria-label={`${label} from`} placeholder="Start date" value={rangeStart} onChange={(event) => onChange(`${event.target.value}..${rangeEnd || ""}`)} /></label>
        <label className="field"><span>{label} to</span><input className="control" aria-label={`${label} to`} placeholder="End date" value={rangeEnd || ""} onChange={(event) => onChange(`${rangeStart || ""}..${event.target.value}`)} /></label>
      </div>}
      {mode === "qualified" && <div className="date-qualified-inputs">
        <label className="field"><span>Qualifier</span><select className="control" aria-label={`${label} qualifier`} value={qualifier} onChange={(event) => onChange(`${event.target.value} ${qualifiedText}`.trim())}>{DATE_QUALIFIERS.map(entry => <option key={entry}>{entry}</option>)}</select></label>
        <label className="field"><span>{label}</span><input className="control" aria-label={label} placeholder="Date or year" value={qualifiedText} onChange={(event) => onChange(`${qualifier} ${event.target.value}`.trim())} /></label>
      </div>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="control" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Input({ value, onChange, ariaLabel }: { value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  return <input className="control" aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

function StatusBadge({ status }: { status: FeatureStatus }) {
  return <span className={`status-badge ${status}`}>{status}</span>;
}

function Metric({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return <div className="empty-state">{icon}<strong>{title}</strong>{action}</div>;
}

function QuizCard({ person, answer }: { person: Person; answer: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="quiz-card">
      <p>Who are {fullName(person)}'s recorded parents?</p>
      {shown ? <strong>{answer}</strong> : <Button variant="secondary" onClick={() => setShown(true)}>Reveal</Button>}
    </div>
  );
}

function FamilyTreeSvg({ center, parents, partners, children, onSelect }: { center?: Person; parents: Person[]; partners: Person[]; children: Person[]; onSelect: (id: string) => void }) {
  const node = (person: Person, x: number, y: number, kind = "") => (
    <g key={`${kind}-${person.id}`} onClick={() => onSelect(person.id)} className="tree-node" transform={`translate(${x} ${y})`}>
      <rect x="-82" y="-28" width="164" height="56" rx="8" fill={person.branchColor} />
      <g transform="translate(-73 -19)" style={{ color: "white" }}><Glyph id={`gender-${person.gender}`} size={20} decorative /></g>
      <text x="-63" y="18" textAnchor="middle" style={{ fontSize: 8 }}>{person.gender === "unknown" ? "Unknown" : person.gender}</text>
      <text x="16" y="-4" textAnchor="middle" style={{ fontSize: Math.min(12, 108 / Math.max(1, fullName(person).length * .6)) }}>{fullName(person)}</text>
      <text x="16" y="17" textAnchor="middle" className="tiny">{person.birthDate || "birth unknown"}</text>
    </g>
  );
  if (!center) return <EmptyState icon={<Network />} title="Select a person" />;
  return (
    <svg viewBox="0 0 900 420" role="img" aria-label="Interactive family tree">
      <defs>
        <filter id="softShadow"><feDropShadow dx="0" dy="5" stdDeviation="5" floodOpacity=".2" /></filter>
      </defs>
      <line x1="450" y1="100" x2="450" y2="195" className="tree-link" />
      <line x1="250" y1="220" x2="650" y2="220" className="tree-link" />
      {parents.map((entry, index) => node(entry, 330 + index * 240, 80, "parent"))}
      {partners.map((entry, index) => node(entry, 255 + index * 390, 220, "partner"))}
      {node(center, 450, 220, "center")}
      {children.map((entry, index) => node(entry, 240 + index * 210, 350, "child"))}
      {children.map((entry, index) => <line key={`line-${entry.id}`} x1="450" y1="248" x2={240 + index * 210} y2="322" className="tree-link" />)}
    </svg>
  );
}

function ChartRenderer({ state, treeId, selectedPerson }: { state: AppState; treeId: string; selectedPerson?: Person }) {
  const config = state.chartConfig;
  const people = peopleInTree(state, treeId);
  const timeline = timelineItems(state, treeId);
  if (config.type === "Timeline") {
    return <div className="timeline-chart">{timeline.map((event) => <div key={event.id}><time>{event.date || "undated"}</time><strong>{event.type}</strong><span>{event.description}</span></div>)}</div>;
  }
  if (config.type === "Name Distribution") {
    const counts = people.reduce<Record<string, number>>((acc, person) => {
      acc[person.familyName || "Unknown"] = (acc[person.familyName || "Unknown"] ?? 0) + 1;
      return acc;
    }, {});
    return <div className="bar-chart">{Object.entries(counts).map(([name, count]) => <div key={name}><span>{name}</span><i style={{ width: `${Math.max(12, count * 20)}%`, background: config.color }} /><strong>{count}</strong></div>)}</div>;
  }
  const center = selectedPerson ?? people[0];
  const parents = center ? getParents(state, center.id) : [];
  const partners = center ? getPartners(state, center.id) : [];
  const children = center ? getChildren(state, center.id) : [];
  const radial = config.orientation === "radial" || config.type.includes("Fan") || config.type.includes("Circular");
  return (
    <div className={`chart-preview ${config.style}`} style={{ fontFamily: config.font, color: config.color }}>
      <div className="chart-title">{config.type}</div>
      {radial ? <RadialChart center={center} parents={parents} children={children} config={config} /> : <FamilyTreeSvg center={center} parents={parents} partners={partners} children={children} onSelect={() => undefined} />}
      <p>{config.extraText}</p>
      <small>{config.lineNote} · {config.pageSize} · {config.showLabels ? "labels on" : "labels off"} · {config.showShadows ? "shadows on" : "shadows off"}</small>
    </div>
  );
}

function RadialChart({ center, parents, children, config }: { center?: Person; parents: Person[]; children: Person[]; config: ChartConfig }) {
  const nodes = [center, ...parents, ...children].filter(Boolean) as Person[];
  return (
    <svg viewBox="0 0 520 520" className="radial-chart" style={{ transform: `rotate(${config.rotation}deg)` }}>
      <circle cx="260" cy="260" r="205" fill="none" stroke={config.color} strokeWidth="2" />
      <circle cx="260" cy="260" r="108" fill="none" stroke={config.color} strokeWidth="1" opacity=".45" />
      {nodes.map((person, index) => {
        const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
        const radius = index === 0 ? 0 : 165;
        const x = 260 + Math.cos(angle) * radius;
        const y = 260 + Math.sin(angle) * radius;
        return <g key={person.id}><line x1="260" y1="260" x2={x} y2={y} stroke={config.color} opacity=".4" /><circle cx={x} cy={y} r={index === 0 ? 54 : 40} fill={person.branchColor} /><text x={x} y={y + 4} textAnchor="middle">{fullName(person).split(" ")[0]}</text></g>;
      })}
    </svg>
  );
}

function DnaMatchCard({ match, people, onUpdate }: { match: DnaMatch; people: Person[]; onUpdate: (updater: (match: DnaMatch) => void) => void }) {
  return (
    <div className="dna-card">
      <Input value={match.matchName} onChange={(value) => onUpdate((target) => { target.matchName = value; })} />
      <div className="settings-grid">
        <Field label="Shared cM" type="number" value={String(match.sharedCm)} onChange={(value) => onUpdate((target) => { target.sharedCm = Number(value); })} />
        <Field label="Relationship" value={match.predictedRelationship} onChange={(value) => onUpdate((target) => { target.predictedRelationship = value; })} />
        <Field label="Ethnicity" value={match.ethnicity} onChange={(value) => onUpdate((target) => { target.ethnicity = value; })} />
        <Field label="Genetic groups" value={match.geneticGroups.join(", ")} onChange={(value) => onUpdate((target) => { target.geneticGroups = value.split(",").map((item) => item.trim()).filter(Boolean); })} />
        <Field label="Surnames" value={match.surnames.join(", ")} onChange={(value) => onUpdate((target) => { target.surnames = value.split(",").map((item) => item.trim()).filter(Boolean); })} />
        <Field label="Locations" value={match.locations.join(", ")} onChange={(value) => onUpdate((target) => { target.locations = value.split(",").map((item) => item.trim()).filter(Boolean); })} />
        <label className="field"><span>SideView</span>
        <select className="control" value={match.side} onChange={(event) => onUpdate((target) => { target.side = event.target.value as DnaMatch["side"]; })}>
          <option value="maternal">Maternal</option>
          <option value="paternal">Paternal</option>
          <option value="unknown">Unknown</option>
        </select></label>
        <label className="field"><span>Linked person</span>
        <select className="control" value={match.personId ?? ""} onChange={(event) => onUpdate((target) => { target.personId = event.target.value || undefined; })}>
          <option value="">No linked person</option>
          {people.map((person) => <option key={person.id} value={person.id}>{fullName(person)}</option>)}
        </select></label>
      </div>
      <textarea className="textarea compact" value={match.notes} placeholder="Common ancestors, shared matches, traits, migration journeys" onChange={(event) => onUpdate((target) => { target.notes = event.target.value; })} />
      <Button variant="secondary" onClick={() => onUpdate((target) => target.segments.push({ chromosome: "1", start: 1000000, end: 24000000, side: target.side }))}>Add Segment</Button>
    </div>
  );
}

function PublishCard({ title, detail, action }: { title: string; detail: string; action: () => void }) {
  return (
    <button className="publish-card" onClick={action}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}

function genderSymbol(person: Person) {
  if (person.gender === "female") return "♀";
  if (person.gender === "male") return "♂";
  if (person.gender === "nonbinary") return "⚥";
  return "◇";
}

export default App;
