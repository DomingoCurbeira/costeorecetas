// src/types/recipe.ts

export type UnitType = 'kg' | 'g' | 'lt' | 'ml' | 'und';

export type AllergenId =
  | 'gluten'
  | 'lacteos'
  | 'huevos'
  | 'frutos_secos'
  | 'mariscos'
  | 'soja'
  | 'pescado'
  | 'apio';

export interface AllergenOption {
  id: AllergenId;
  label: string;
  icon: string;
}

export interface IngredientItem {
  id: string;
  name: string;
  unit: UnitType;          // Unidad usada en la receta (ej. 'g')
  quantity: number;        // Cantidad empleada en la receta
  baseUnitCost: number;    // Costo por unidad de compra base (kg para 'kg'/'g', lt para 'lt'/'ml', und para 'und')
  wastePercentage: number; // % de merma opcional (0 a 95) - vital en hostelería
}

export interface LaborItem {
  id: string;
  role: string;            // Ej. Chef Pastelero, Cocinero A, Ayudante
  minutes: number;         // Minutos dedicados a la preparación
  hourlyRate: number;      // Costo por hora del trabajador
}

export interface OverheadItem {
  id: string;
  concept: string;         // Ej. Envase biodegradable, Gas/Electricidad, Alquiler proporcional
  quantity: number;        // Cantidad de unidades o factor
  unitCost: number;        // Costo unitario
}

export interface TechnicalSheet {
  recipeName: string;
  category: string;
  portions: number;
  prepTimeMinutes: number;
  imageUrl: string;
  steps: string;
  presentation: string;
  equipment: string;
  allergens: AllergenId[];
}

export interface RecipeDocument {
  id: string;
  updatedAt: string;
  sheet: TechnicalSheet;
  ingredients: IngredientItem[];
  laborItems: LaborItem[];
  overheads: OverheadItem[];
  targetMarginPercent: number;
  customSellingPrice: number | null;
}

export interface FinancialSummary {
  ingredientsTotal: number;
  laborTotal: number;
  overheadsTotal: number;
  totalRecipeCost: number;
  costPerPortion: number;
  ingredientsShare: number;       // % sobre el costo total
  laborShare: number;             // % sobre el costo total
  overheadsShare: number;         // % sobre el costo total
  suggestedPrice: number;         // Precio de venta neto (sin impuestos)
  finalPriceWithTax: number;      // Precio final al cliente (con IVA / Impuesto de servicio)
  profitPerPortion: number;       // Ganancia neta por porción en canal propio
  realMarginPercent: number;      // Margen real sobre el precio de venta
  foodCostPercent: number;        // Food Cost % (Costo materia prima / Precio venta)
  // Métricas para Apps de Delivery (Uber Eats, PedidosYa, Didi Food)
  deliveryAppPriceSuggested: number; // Precio sugerido en App para proteger el beneficio neto
  deliveryProfitSamePrice: number;   // Ganancia si se vende al mismo precio asumiendo comisión
  deliveryMarginSamePrice: number;   // Margen % si se asume la comisión sin subir precio
}
