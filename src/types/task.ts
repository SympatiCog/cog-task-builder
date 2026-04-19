// TypeScript types for cog-task-engine task JSON.
// Source of truth: docs/LLM_TASK_AUTHORING.md (schema 1.1.0).

export type SchemaVersion = "1.0.0" | "1.1.0";

export type TargetDevice = "desktop" | "tablet" | "phone";

export interface TextStyle {
  font_size_pct?: number;
  color?: string;
}

export interface Theme {
  background_color?: string;
  default_text_color?: string;
  default_text_size_pct?: number;
  text_styles?: Record<string, TextStyle>;
}

export interface Metadata {
  task_id: string;
  task_version: string;
  name?: string;
  author?: string;
  notes?: string;
  target_devices?: TargetDevice[];
  min_refresh_hz?: number;
  allowed_refresh_hz?: number[];
  log_frames?: boolean;
  theme?: Theme;
}

export type ImageAsset =
  | { source: "bundled"; path: string }
  | { source: "remote"; url: string; sha256: string };

export type AudioAsset = ImageAsset;

// Schema 1.1 reserves `"audio"` syntactically but the engine rejects it with
// `unsupported_pool_kind`. We model only the accepted kind so UI pickers stay
// honest. Imported tasks carrying `kind: "audio"` keep the value on disk and
// surface as a validator error.
export interface Pool {
  kind: "image";
  members: string[];
  share_across_types?: boolean;
}

export interface Assets {
  allowed_hosts?: string[];
  images?: Record<string, ImageAsset>;
  audio?: Record<string, AudioAsset>;
  pools?: Record<string, Pool>;
}

export type ButtonPosition =
  | "top_left" | "top_center" | "top_right"
  | "middle_left" | "middle_center" | "middle_right"
  | "bottom_left" | "bottom_center" | "bottom_right"
  | { x_pct: number; y_pct: number };

export interface TouchscreenButton {
  id: string;
  label: string;
  position: ButtonPosition;
  size_px?: number;
}

export interface Inputs {
  keyboard?: string[];
  touchscreen_buttons?: TouchscreenButton[];
}

export interface ResponseBinding {
  keyboard?: string[];
  touchscreen?: string[];
  mouse?: string[];
}

export type Responses = Record<string, ResponseBinding>;

// Per-item override dict inside a stimulus_type. Any field from a trial_template
// item may appear here — we keep it loose to tolerate unknown fields.
export type ItemOverrides = Record<string, unknown> & {
  asset?: string;
  extras?: Record<string, unknown>;
  duration_ms?: number;
};

export interface StimulusType {
  correct_response: string;
  items: Record<string, ItemOverrides>;
}

export type StimulusTypes = Record<string, StimulusType>;

export type ItemKind = "image" | "text" | "audio" | "feedback" | "blank";

export interface FeedbackCase {
  text?: string;
  style?: string;
  asset?: string;
}

export interface TrialItem {
  id: string;
  kind: ItemKind;
  asset?: string;
  onset_ms?: number;
  duration_ms?: number;
  jitter_ms?: number;
  anchor?: string;
  wait_for_response?: boolean;
  response_window_ms?: number;
  captures_response?: boolean;
  extras?: Record<string, unknown>;
  cases?: Partial<Record<"correct" | "incorrect" | "timeout", FeedbackCase>>;
}

export type TrialTemplate = TrialItem[];

export type TimingMode = "self_paced" | "fixed_schedule" | "csv_schedule";

export interface Timing {
  mode: TimingMode;
  iti_ms?: number;
  iti_jitter_ms?: number;
  allow_overlap?: boolean;
  soa_ms?: number;
}

export type OrderingMode = "factorial_random" | "fixed" | "inline" | "csv";

export interface Constraints {
  max_type_repeat?: number;
  balanced?: boolean;
}

export interface Instructions {
  text: string;
  duration_ms?: number;
  dismissable?: boolean;
}

export interface TrialListEntry {
  type: string;
  trial_onset_ms?: number;
}

export interface Block {
  id: string;
  n_trials?: number;
  types?: string[];
  ordering: OrderingMode;
  constraints?: Constraints;
  seed?: number;
  instructions?: Instructions;
  feedback_enabled?: boolean;
  trial_list?: TrialListEntry[];
  trial_list_url?: string;
}

export interface SessionEnd {
  text: string;
}

export interface TaskJson {
  schema_version: SchemaVersion;
  metadata: Metadata;
  assets: Assets;
  inputs: Inputs;
  responses: Responses;
  stimulus_types: StimulusTypes;
  trial_template: TrialTemplate;
  timing: Timing;
  blocks: Block[];
  session_end?: SessionEnd;
}
