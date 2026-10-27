import type { Category, Product, Project, Room, RoomType } from '../data';

export type RuntimeSettings = {
  mode: 'mock' | 'http';
  baseUrl: string;
  delay: number;
  scenario: 'normal' | 'ml-error' | 'ml-empty';
};
export type Guide = { title: string; tag: string; time: string; text: string };
export type Workspace = { projects: Project[]; favorites: string[] };
export type Bootstrap = Workspace & {
  products: Product[];
  regions: string[];
  guides: Guide[];
  catalogTotal?: number;
};
export type CatalogPage = { products: Product[]; total: number; page: number; size: number };
export type Estimate = {
  warnings?: string[];
  items: { product: Product; quantity: number; cost: number; rooms: string[]; surface: number }[];
  materials: number;
  labor: number;
  total: number;
  totalArea: number;
  categories: { id: Category; name: string; color: string; total: number }[];
};
export type ProductCalculation = { quantity: number; unit: string; total: number };
export type MetricsReport = {
  generatedAt: string;
  period: { from: string; to: string };
  modelVersion: string;
  dataset: string;
  labeledProducts: number;
  // Every listed category belongs to the agreed MVP top categories.
  matching: { id: string; name: string; tp: number; fp: number; fn: number }[];
  consumption: { id: string; name: string; unit: string; samples: number; absoluteError: number }[];
  automation: { automatic: number; eligible: number };
  estimates: { completed: number; totalSeconds: number; p95Seconds: number | null };
  journey: { started: number; completed: number; totalClicks: number };
  requests: { total: number; failed: number };
};
export type Recommendation = {
  productId: string;
  score: number;
  reasons: string[];
  tradeoff: string;
  quantity: number;
  total: number;
  evidence: { title: string; excerpt: string; source: string }[];
};
export type RecommendationResult = {
  summary: string;
  groups: { category: 'floor' | 'walls'; candidates: Recommendation[] }[];
  excluded: { productId: string; reason: string }[];
};
export type RecommendationInput = {
  room: Room;
  reserve: number;
  priority: 'balanced' | 'budget' | 'durability';
};
export type ParsedRoom = {
  draft: {
    name: string;
    type: RoomType;
    length: number;
    width: number;
    height: number;
    windows: number;
    doors: number;
    wet: boolean;
    heavy: boolean;
  } | null;
  extracted: string[];
  assumptions: string[];
  clarification: string | null;
};
export type WorkType = 'flooring' | 'painting' | 'wallpaper' | 'tiling' | 'preparation' | 'electrical';
export type Assignment = {
  productId: string;
  works: WorkType[];
  rooms: RoomType[];
  score: number;
  explanation: string;
  status: 'pending' | 'approved' | 'rejected';
};
export const workTypes: { id: WorkType; name: string }[] = [
  { id: 'flooring', name: 'Укладка напольных покрытий' },
  { id: 'painting', name: 'Покраска стен' },
  { id: 'wallpaper', name: 'Поклейка обоев' },
  { id: 'tiling', name: 'Укладка плитки' },
  { id: 'preparation', name: 'Подготовка основания' },
  { id: 'electrical', name: 'Электромонтаж' },
];
export interface RepairApi {
  catalog(params: URLSearchParams, signal: AbortSignal): Promise<CatalogPage>;
  metrics(signal: AbortSignal): Promise<MetricsReport>;
  bootstrap(signal: AbortSignal): Promise<Bootstrap>;
  saveWorkspace(value: Workspace, signal: AbortSignal): Promise<Workspace>;
  estimate(project: Project, signal: AbortSignal): Promise<Estimate>;
  productCalculation(
    id: string,
    input: { surface: number; reserve: number },
    signal: AbortSignal,
  ): Promise<ProductCalculation>;
  recommendations(input: RecommendationInput, signal: AbortSignal): Promise<RecommendationResult>;
  parseRoom(text: string, signal: AbortSignal): Promise<ParsedRoom>;
  assignments(signal: AbortSignal): Promise<Assignment[]>;
  classify(productIds: string[], signal: AbortSignal): Promise<Assignment[]>;
  saveAssignment(value: Assignment, signal: AbortSignal): Promise<Assignment>;
}
export type RequestLog = {
  id: string;
  method: string;
  path: string;
  source: RuntimeSettings['mode'];
  status: 'pending' | 'ok' | 'error' | 'cancelled';
  time: string;
  duration?: number;
  message?: string;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public kind: 'network' | 'timeout' | 'http' | 'invalid' | 'mock' = 'http',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
