// src/App.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  IngredientItem,
  LaborItem,
  OverheadItem,
  TechnicalSheet,
  UnitType,
  AllergenOption,
  AllergenId,
  FinancialSummary,
  RecipeDocument,
} from './types/recipe';
import {
  calculateIngredientCost,
  calculateLaborCost,
  calculateOverheadCost,
  getBaseUnitLabel,
  formatCurrencyValue,
} from './utils/calculations';
import { DEFAULT_RECIPES } from './data/defaultRecipes';

const STORAGE_KEY_RECIPES = 'gastrocost_pro_recipes_v1';
const STORAGE_KEY_ACTIVE_ID = 'gastrocost_pro_active_id_v1';
const STORAGE_KEY_CURRENCY = 'gastrocost_pro_currency_v1';
const STORAGE_KEY_TAX = 'gastrocost_pro_tax_v1';
const STORAGE_KEY_DELIVERY_COMM = 'gastrocost_pro_delivery_comm_v1';

// Catálogo de alérgenos con iconos visuales
const ALLERGENS_CATALOG: AllergenOption[] = [
  { id: 'gluten', label: 'Gluten (Cereales)', icon: '🌾' },
  { id: 'lacteos', label: 'Lácteos', icon: '🥛' },
  { id: 'huevos', label: 'Huevos', icon: '🥚' },
  { id: 'frutos_secos', label: 'Frutos Secos', icon: '🥜' },
  { id: 'mariscos', label: 'Crustáceos / Mariscos', icon: '🦐' },
  { id: 'pescado', label: 'Pescado', icon: '🐟' },
  { id: 'soja', label: 'Soja', icon: '🫘' },
  { id: 'apio', label: 'Apio', icon: '🥬' },
];

export default function App() {
  // 1. Estado Persistente de Recetas en localStorage
  const [recipes, setRecipes] = useState<RecipeDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECIPES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error leyendo recetas de localStorage:', e);
    }
    return DEFAULT_RECIPES;
  });

  const [activeRecipeId, setActiveRecipeId] = useState<string>(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    return savedId || DEFAULT_RECIPES[0].id;
  });

  // Por defecto incluimos el Colón Costarricense (₡) como primera opción
  const [currency, setCurrency] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_CURRENCY) || '₡';
  });

  // Impuesto configurable (Ej. 13% IVA Costa Rica, 23% IVA+Servicio Salón CR, 10% España)
  const [taxRatePercent, setTaxRatePercent] = useState<number>(() => {
    const savedTax = localStorage.getItem(STORAGE_KEY_TAX);
    return savedTax !== null ? Number(savedTax) : 13;
  });

  // Comisión de Apps de Delivery (Uber Eats, PedidosYa, Didi Food - típico 25% en Costa Rica)
  const [deliveryCommissionPercent, setDeliveryCommissionPercent] = useState<number>(() => {
    const savedComm = localStorage.getItem(STORAGE_KEY_DELIVERY_COMM);
    return savedComm !== null ? Number(savedComm) : 25;
  });

  // Escalador de Orden de Producción para Cocina (Permite escalar ingredientes sin alterar la receta original)
  const [productionBatchPortions, setProductionBatchPortions] = useState<number | null>(null);

  // Navegación de pestañas y modo de impresión
  const [activeTab, setActiveTab] = useState<'costeo' | 'simulador' | 'ficha'>('costeo');
  const [printIncludeCosts, setPrintIncludeCosts] = useState<boolean>(true);
  const [saveBadge, setSaveBadge] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado del Simulador de Ventas
  const [simulatedPortionsSold, setSimulatedPortionsSold] = useState<number>(450);
  const [targetMonthlyProfit, setTargetMonthlyProfit] = useState<number>(3500);
  const [monthlyFixedCosts, setMonthlyFixedCosts] = useState<number>(1200);

  // Sincronización automática con localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RECIPES, JSON.stringify(recipes));
      setSaveBadge(true);
      const timer = setTimeout(() => setSaveBadge(false), 1200);
      return () => clearTimeout(timer);
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, activeRecipeId);
    setProductionBatchPortions(null); // Al cambiar de receta usa el rendimiento original
  }, [activeRecipeId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CURRENCY, currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TAX, String(taxRatePercent));
  }, [taxRatePercent]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DELIVERY_COMM, String(deliveryCommissionPercent));
  }, [deliveryCommissionPercent]);

  // Receta activa actual (con fallback seguro)
  const currentRecipe = useMemo(() => {
    return recipes.find((r) => r.id === activeRecipeId) || recipes[0];
  }, [recipes, activeRecipeId]);

  const {
    sheet,
    ingredients,
    laborItems,
    overheads,
    targetMarginPercent,
    customSellingPrice,
  } = currentRecipe;

  // Factor de escalado para Orden de Producción en Cocina
  const activeBatchPortions = productionBatchPortions ?? sheet.portions;
  const batchScaleFactor = activeBatchPortions / Math.max(1, sheet.portions);

  // Helper para actualizar únicamente la receta activa dentro del listado de recetas
  const updateCurrentRecipe = (updater: (rec: RecipeDocument) => RecipeDocument) => {
    setRecipes((prev) =>
      prev.map((rec) =>
        rec.id === currentRecipe.id
          ? { ...updater(rec), updatedAt: new Date().toISOString() }
          : rec
      )
    );
  };

  // ============================================================================
  // GESTIÓN DE MÚLTIPLES RECETAS Y BACKUP JSON
  // ============================================================================
  const createNewRecipe = () => {
    const newId = `rec-${Date.now()}`;
    const isCRC = currency === '₡';
    const newRecipe: RecipeDocument = {
      id: newId,
      updatedAt: new Date().toISOString(),
      targetMarginPercent: 65,
      customSellingPrice: null,
      sheet: {
        recipeName: 'Nueva Receta (Sin título)',
        category: 'General / Carta Principal',
        portions: 10,
        prepTimeMinutes: 30,
        imageUrl:
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
        steps: '1. Describir el paso a paso de la preparación.\n2. Indicar temperaturas y tiempos de cocción.',
        presentation: 'Indicar vajilla o empaque de delivery requerido.',
        equipment: 'Indicar utensilios y maquinaria necesaria.',
        allergens: [],
      },
      ingredients: [
        {
          id: `ing-${Date.now()}`,
          name: 'Ingrediente Principal',
          unit: 'g',
          quantity: 1000,
          baseUnitCost: isCRC ? 4500 : 8.0,
          wastePercentage: 0,
        },
      ],
      laborItems: [
        {
          id: `lab-${Date.now()}`,
          role: 'Cocinero',
          minutes: 20,
          hourlyRate: isCRC ? 2800 : 11.0,
        },
      ],
      overheads: [
        {
          id: `ovh-${Date.now()}`,
          concept: 'Empaque Biodegradable Delivery',
          quantity: 10,
          unitCost: isCRC ? 320 : 0.4,
        },
      ],
    };

    setRecipes((prev) => [newRecipe, ...prev]);
    setActiveRecipeId(newId);
  };

  const duplicateCurrentRecipe = () => {
    const copyId = `rec-${Date.now()}`;
    const duplicated: RecipeDocument = {
      ...structuredClone(currentRecipe),
      id: copyId,
      updatedAt: new Date().toISOString(),
      sheet: {
        ...currentRecipe.sheet,
        recipeName: `${currentRecipe.sheet.recipeName} (Copia)`,
      },
    };
    setRecipes((prev) => [duplicated, ...prev]);
    setActiveRecipeId(copyId);
  };

  const deleteCurrentRecipe = () => {
    if (recipes.length <= 1) {
      alert('Debes mantener al menos una receta activa en el recetario.');
      return;
    }
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la receta "${sheet.recipeName}"?`
    );
    if (!confirmed) return;

    const remaining = recipes.filter((r) => r.id !== currentRecipe.id);
    setRecipes(remaining);
    setActiveRecipeId(remaining[0].id);
  };

  // Conversor rápido de los montos de la receta actual (ej. de USD/EUR a Colones ₡ o viceversa)
  const convertCurrentRecipeToCRC = () => {
    const rateStr = window.prompt(
      'Convertir costos de esta receta multiplicando por tipo de cambio (Ej. 515 para pasar de USD a Colones ₡):',
      '515'
    );
    if (!rateStr) return;
    const rate = Number(rateStr);
    if (!Number.isFinite(rate) || rate <= 0) return;

    updateCurrentRecipe((rec) => ({
      ...rec,
      customSellingPrice:
        rec.customSellingPrice !== null
          ? Math.round(rec.customSellingPrice * rate)
          : null,
      ingredients: rec.ingredients.map((i) => ({
        ...i,
        baseUnitCost: Math.round(i.baseUnitCost * rate * 100) / 100,
      })),
      laborItems: rec.laborItems.map((l) => ({
        ...l,
        hourlyRate: Math.round(l.hourlyRate * rate * 100) / 100,
      })),
      overheads: rec.overheads.map((o) => ({
        ...o,
        unitCost: Math.round(o.unitCost * rate * 100) / 100,
      })),
    }));
    setCurrency('₡');
  };

  // Exportar respaldo en JSON
  const exportRecipesJson = () => {
    const dataStr = JSON.stringify(recipes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recetario-gastrocost-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importar respaldo en JSON
  const importRecipesJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result));
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sheet) {
          setRecipes(parsed);
          setActiveRecipeId(parsed[0].id);
        } else {
          alert('El archivo JSON no tiene el formato válido de GastroCost Pro.');
        }
      } catch {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePrintKitchenSheet = (withCosts: boolean) => {
    setPrintIncludeCosts(withCosts);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // ============================================================================
  // MOTOR DE CÁLCULO FINANCIERO EN TIEMPO REAL + APPS DELIVERY (useMemo)
  // ============================================================================
  const summary: FinancialSummary = useMemo(() => {
    const safePortions = Math.max(1, sheet.portions);

    const ingredientsTotal = ingredients.reduce(
      (acc, item) => acc + calculateIngredientCost(item),
      0
    );
    const laborTotal = laborItems.reduce(
      (acc, item) => acc + calculateLaborCost(item),
      0
    );
    const overheadsTotal = overheads.reduce(
      (acc, item) => acc + calculateOverheadCost(item),
      0
    );

    const totalRecipeCost = ingredientsTotal + laborTotal + overheadsTotal;
    const costPerPortion = totalRecipeCost / safePortions;

    // Porcentajes de distribución de costos
    const ingredientsShare = totalRecipeCost > 0 ? (ingredientsTotal / totalRecipeCost) * 100 : 0;
    const laborShare = totalRecipeCost > 0 ? (laborTotal / totalRecipeCost) * 100 : 0;
    const overheadsShare = totalRecipeCost > 0 ? (overheadsTotal / totalRecipeCost) * 100 : 0;

    // Precio sugerido basado en fórmula financiera: Precio = Costo / (1 - Margen%)
    const clampedMargin = Math.min(95, Math.max(1, targetMarginPercent));
    const formulaSuggestedPrice = costPerPortion / (1 - clampedMargin / 100);

    const activeSellingPrice =
      customSellingPrice !== null && customSellingPrice > 0
        ? customSellingPrice
        : formulaSuggestedPrice;

    const finalPriceWithTax = activeSellingPrice * (1 + taxRatePercent / 100);
    const profitPerPortion = activeSellingPrice - costPerPortion;
    const realMarginPercent =
      activeSellingPrice > 0 ? (profitPerPortion / activeSellingPrice) * 100 : 0;

    const ingredientCostPerPortion = ingredientsTotal / safePortions;
    const foodCostPercent =
      activeSellingPrice > 0 ? (ingredientCostPerPortion / activeSellingPrice) * 100 : 0;

    // Cálculos para Apps de Delivery (Uber Eats, PedidosYa, Didi Food)
    const commFactor = Math.min(0.8, Math.max(0, deliveryCommissionPercent / 100));
    // 1. Si vendemos al mismo precio en la App, la App retiene `activeSellingPrice * commFactor`
    const netRevenueFromAppSamePrice = activeSellingPrice * (1 - commFactor);
    const deliveryProfitSamePrice = netRevenueFromAppSamePrice - costPerPortion;
    const deliveryMarginSamePrice =
      activeSellingPrice > 0 ? (deliveryProfitSamePrice / activeSellingPrice) * 100 : 0;

    // 2. Precio sugerido en App para ganar exactamente los mismos colones/dólares que en canal propio:
    // PrecioApp * (1 - commFactor) = activeSellingPrice  => PrecioApp = activeSellingPrice / (1 - commFactor)
    const deliveryAppPriceSuggested =
      commFactor < 1 ? activeSellingPrice / (1 - commFactor) : activeSellingPrice;

    return {
      ingredientsTotal,
      laborTotal,
      overheadsTotal,
      totalRecipeCost,
      costPerPortion,
      ingredientsShare,
      laborShare,
      overheadsShare,
      suggestedPrice: activeSellingPrice,
      finalPriceWithTax,
      profitPerPortion,
      realMarginPercent,
      foodCostPercent,
      deliveryAppPriceSuggested,
      deliveryProfitSamePrice,
      deliveryMarginSamePrice,
    };
  }, [
    ingredients,
    laborItems,
    overheads,
    sheet.portions,
    targetMarginPercent,
    customSellingPrice,
    taxRatePercent,
    deliveryCommissionPercent,
  ]);

  // Cálculos del Simulador de Negocio
  const simulationResults = useMemo(() => {
    const grossRevenue = simulatedPortionsSold * summary.suggestedPrice;
    const variableProductionCost = simulatedPortionsSold * summary.costPerPortion;
    const grossProfit = grossRevenue - variableProductionCost;
    const netProfitAfterFixed = grossProfit - monthlyFixedCosts;

    const unitContribution = summary.profitPerPortion;
    const requiredPortionsForTarget =
      unitContribution > 0
        ? Math.ceil((targetMonthlyProfit + monthlyFixedCosts) / unitContribution)
        : 0;

    const breakEvenPortions =
      unitContribution > 0 ? Math.ceil(monthlyFixedCosts / unitContribution) : 0;

    return {
      grossRevenue,
      variableProductionCost,
      grossProfit,
      netProfitAfterFixed,
      requiredPortionsForTarget,
      breakEvenPortions,
    };
  }, [simulatedPortionsSold, summary, targetMonthlyProfit, monthlyFixedCosts]);

  // Formateador de moneda con soporte nativo para Colones (₡)
  const formatMoney = (value: number) => formatCurrencyValue(value, currency);

  // ============================================================================
  // HANDLERS DE INGREDIENTES, MANO DE OBRA, OVERHEADS Y FICHA
  // ============================================================================
  const updateSheet = (partial: Partial<TechnicalSheet>) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      sheet: { ...rec.sheet, ...partial },
    }));
  };

  const addIngredient = () => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      ingredients: [
        ...rec.ingredients,
        {
          id: `ing-${Date.now()}`,
          name: 'Nuevo Ingrediente',
          unit: 'g',
          quantity: 100,
          baseUnitCost: currency === '₡' ? 2500 : 5.0,
          wastePercentage: 0,
        },
      ],
    }));
  };

  const updateIngredient = <K extends keyof IngredientItem>(
    id: string,
    field: K,
    value: IngredientItem[K]
  ) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      ingredients: rec.ingredients.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeIngredient = (id: string) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      ingredients: rec.ingredients.filter((item) => item.id !== id),
    }));
  };

  const addLabor = () => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      laborItems: [
        ...rec.laborItems,
        {
          id: `lab-${Date.now()}`,
          role: 'Nuevo Puesto',
          minutes: 15,
          hourlyRate: currency === '₡' ? 2500 : 10.0,
        },
      ],
    }));
  };

  const updateLabor = <K extends keyof LaborItem>(
    id: string,
    field: K,
    value: LaborItem[K]
  ) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      laborItems: rec.laborItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeLabor = (id: string) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      laborItems: rec.laborItems.filter((item) => item.id !== id),
    }));
  };

  const addOverhead = () => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      overheads: [
        ...rec.overheads,
        {
          id: `ovh-${Date.now()}`,
          concept: 'Nuevo Gasto Indirecto',
          quantity: 1,
          unitCost: currency === '₡' ? 500 : 1.0,
        },
      ],
    }));
  };

  const updateOverhead = <K extends keyof OverheadItem>(
    id: string,
    field: K,
    value: OverheadItem[K]
  ) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      overheads: rec.overheads.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const removeOverhead = (id: string) => {
    updateCurrentRecipe((rec) => ({
      ...rec,
      overheads: rec.overheads.filter((item) => item.id !== id),
    }));
  };

  const toggleAllergen = (allergenId: AllergenId) => {
    const exists = sheet.allergens.includes(allergenId);
    updateSheet({
      allergens: exists
        ? sheet.allergens.filter((id) => id !== allergenId)
        : [...sheet.allergens, allergenId],
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16 print:bg-white print:pb-0">
      {/* Input oculto para importar JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={importRecipesJson}
        className="hidden"
      />

      {/* ==========================================================================
          BARRA SUPERIOR / HEADER EJECUTIVO (OCULTO EN IMPRESIÓN)
         ========================================================================== */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Branding y Estado de Auto-guardado */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-inner">
                GC
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold tracking-tight">GastroCost Pro</h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                    Costa Rica 🇨🇷 & Dark Kitchens
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full transition-opacity duration-300 ${
                      saveBadge
                        ? 'bg-slate-800 text-emerald-400 opacity-100'
                        : 'bg-slate-800/40 text-slate-400 opacity-75'
                    }`}
                  >
                    ✓ Guardado en navegador
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Escandallos, simulador de comisiones (UberEats/PedidosYa) y ficha técnica
                </p>
              </div>
            </div>
          </div>

          {/* Barra de Gestión de Múltiples Recetas y Divisa */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Receta Activa */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">📖 Receta ({recipes.length}):</span>
              <select
                value={currentRecipe.id}
                onChange={(e) => setActiveRecipeId(e.target.value)}
                className="bg-slate-900 text-emerald-300 text-xs font-bold rounded border border-slate-700 px-2.5 py-1 max-w-[210px] sm:max-w-[260px] truncate focus:outline-none focus:border-emerald-500"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.sheet.recipeName} ({r.sheet.portions} rac.)
                  </option>
                ))}
              </select>
            </div>

            {/* Acciones de Receta */}
            <button
              onClick={createNewRecipe}
              title="Crear nueva receta desde cero"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition cursor-pointer flex items-center gap-1"
            >
              <span>+</span> Nueva
            </button>
            <button
              onClick={duplicateCurrentRecipe}
              title="Duplicar receta actual"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-2.5 py-2 rounded-lg transition cursor-pointer"
            >
              📋 Duplicar
            </button>
            <button
              onClick={deleteCurrentRecipe}
              title="Eliminar receta actual"
              className="bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800 text-slate-400 border border-slate-700 text-xs font-semibold px-2.5 py-2 rounded-lg transition cursor-pointer"
            >
              🗑️
            </button>

            {/* Controles de Rendimiento y Moneda (Colón ₡ incluido) */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Raciones:</span>
              <input
                type="number"
                min={1}
                value={sheet.portions}
                onChange={(e) =>
                  updateSheet({ portions: Math.max(1, Number(e.target.value)) })
                }
                className="w-14 bg-slate-900 text-emerald-400 font-bold text-xs text-center rounded border border-slate-700 py-1 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-slate-900 text-white text-xs font-semibold rounded border border-slate-700 px-1.5 py-1 focus:outline-none focus:border-emerald-500"
              >
                <option value="₡">🇨🇷 CRC - Colón (₡)</option>
                <option value="$">🇺🇸 USD / MXN ($)</option>
                <option value="€">🇪🇺 EUR (€)</option>
                <option value="S/">🇵🇪 PEN (S/)</option>
              </select>
              <button
                onClick={convertCurrentRecipeToCRC}
                title="Convertir montos de la receta actual multiplicando por un tipo de cambio (ej. USD a Colones ₡)"
                className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold cursor-pointer"
              >
                ⇄ TC
              </button>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN DE SECCIONES + HERRAMIENTAS DE IMPRESIÓN Y BACKUP */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
          <div className="flex gap-1 sm:gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('costeo')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'costeo'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📊</span> 1. Escandallo y Costeo
            </button>
            <button
              onClick={() => setActiveTab('simulador')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'simulador'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🚀</span> 2. Simulador de Ventas & Apps
            </button>
            <button
              onClick={() => setActiveTab('ficha')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'ficha'
                  ? 'border-emerald-400 text-emerald-400 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>📋</span> 3. Ficha Técnica y Escalador Lotes
            </button>
          </div>

          {/* Botones de Impresión y Backup JSON */}
          <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
            <button
              onClick={() => handlePrintKitchenSheet(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
              title="Imprime la ficha técnica con gramajes y pasos para los cocineros (oculta precios)"
            >
              <span>🖨️</span> PDF Cocina
            </button>
            <button
              onClick={() => handlePrintKitchenSheet(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm"
              title="Imprime el reporte completo de Ficha Técnica + Escandallo Financiero"
            >
              <span>📄</span> PDF Gerencia
            </button>
            <button
              onClick={exportRecipesJson}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
              title="Descargar copia de seguridad de todas tus recetas en archivo .JSON"
            >
              ⬇ Exportar JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
              title="Cargar archivo .JSON de recetas guardado previamente"
            >
              ⬆ Importar
            </button>
          </div>
        </div>
      </header>

      {/* ==========================================================================
          VISTA DE PANTALLA INTERACTIVA (OCULTA AL IMPRIMIR)
         ========================================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 print:hidden">
        {/* TARJETAS KPI SUPERIORES (SIEMPRE VISIBLES) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Costo Total Lote ({sheet.portions} raciones)
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                Producción
              </span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">
              {formatMoney(summary.totalRecipeCost)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Materia prima: {formatMoney(summary.ingredientsTotal)} ({summary.ingredientsShare.toFixed(0)}%)
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Costo por Porción
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                Unitario
              </span>
            </div>
            <p className="text-2xl font-extrabold text-blue-600 mt-2">
              {formatMoney(summary.costPerPortion)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Food Cost sobre P.V.P:{' '}
              <strong
                className={
                  summary.foodCostPercent > 35 ? 'text-amber-600' : 'text-emerald-600'
                }
              >
                {summary.foodCostPercent.toFixed(1)}%
              </strong>{' '}
              (Ideal &lt; 33%)
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm ring-1 ring-emerald-500/10">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Precio Venta Recomendado
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                Sin Impuesto
              </span>
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 mt-2">
              {formatMoney(summary.suggestedPrice)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Precio Final (+{taxRatePercent}% Imp.):{' '}
              <strong className="text-slate-900">{formatMoney(summary.finalPriceWithTax)}</strong>
            </p>
          </div>

          <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Beneficio Neto / Ración
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                Margen {summary.realMarginPercent.toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-extrabold text-emerald-400 mt-2">
              +{formatMoney(summary.profitPerPortion)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              PVP sugerido en App ({deliveryCommissionPercent}% com.):{' '}
              <strong className="text-amber-300">
                {formatMoney(summary.deliveryAppPriceSuggested)}
              </strong>
            </p>
          </div>
        </section>

        {/* ==========================================================================
            PESTAÑA 1: COSTEO OPERATIVO + PANEL FINANCIERO LATERAL
           ========================================================================== */}
        {activeTab === 'costeo' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA (8 cols): Tablas de Ingredientes, Mano de Obra y Overheads */}
            <div className="lg:col-span-8 space-y-6">
              {/* Cabecera rápida del nombre de la receta activa */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    Editando Escandallo de:
                  </span>
                  <input
                    type="text"
                    value={sheet.recipeName}
                    onChange={(e) => updateSheet({ recipeName: e.target.value })}
                    className="w-full text-lg font-black text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-none py-0.5"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Categoría:</span>
                  <input
                    type="text"
                    value={sheet.category}
                    onChange={(e) => updateSheet({ category: e.target.value })}
                    className="bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 1. SECCIÓN DE INGREDIENTES */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>🥩</span> 1. Materia Prima e Ingredientes
                    </h2>
                    <p className="text-xs text-slate-500">
                      Si eliges <strong>g</strong> o <strong>ml</strong>, introduce el costo por{' '}
                      <strong>kg</strong> o <strong>litro</strong> y el sistema calcula la fracción automáticamente.
                    </p>
                  </div>
                  <button
                    onClick={addIngredient}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span> Añadir Ingrediente
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                        <th className="py-3 px-4">Ingrediente</th>
                        <th className="py-3 px-2 w-24">Unidad</th>
                        <th className="py-3 px-2 w-28 text-right">Cant. Usada</th>
                        <th className="py-3 px-2 w-36 text-right">Costo Base</th>
                        <th className="py-3 px-2 w-24 text-right">Merma %</th>
                        <th className="py-3 px-4 w-32 text-right">Subtotal</th>
                        <th className="py-3 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {ingredients.map((item) => {
                        const rowCost = calculateIngredientCost(item);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  updateIngredient(item.id, 'name', e.target.value)
                                }
                                className="w-full font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded px-2 py-1 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <select
                                value={item.unit}
                                onChange={(e) =>
                                  updateIngredient(
                                    item.id,
                                    'unit',
                                    e.target.value as UnitType
                                  )
                                }
                                className="w-full bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="g">g (gramos)</option>
                                <option value="kg">kg (kilos)</option>
                                <option value="ml">ml (mililitros)</option>
                                <option value="lt">lt (litros)</option>
                                <option value="und">und (unidad)</option>
                              </select>
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateIngredient(
                                    item.id,
                                    'quantity',
                                    Math.max(0, Number(e.target.value))
                                  )
                                }
                                className="w-full text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={item.baseUnitCost}
                                  onChange={(e) =>
                                    updateIngredient(
                                      item.id,
                                      'baseUnitCost',
                                      Math.max(0, Number(e.target.value))
                                    )
                                  }
                                  className="w-full text-right bg-slate-50 border border-slate-200 rounded pl-2 pr-11 py-1 font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                                />
                                <span className="absolute right-2 text-[10px] text-slate-400 font-semibold pointer-events-none">
                                  {getBaseUnitLabel(item.unit, currency)}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="number"
                                min={0}
                                max={95}
                                value={item.wastePercentage}
                                onChange={(e) =>
                                  updateIngredient(
                                    item.id,
                                    'wastePercentage',
                                    Math.min(95, Math.max(0, Number(e.target.value)))
                                  )
                                }
                                className="w-full text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                              {formatMoney(rowCost)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => removeIngredient(item.id)}
                                title="Eliminar ingrediente"
                                className="text-slate-300 hover:text-rose-500 transition font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                      <tr>
                        <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider">
                          Total Materia Prima ({sheet.portions} raciones) / Costo por ración:
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-700 text-sm">
                          {formatMoney(summary.ingredientsTotal)}{' '}
                          <span className="block text-[11px] font-normal text-slate-500">
                            ({formatMoney(summary.ingredientsTotal / Math.max(1, sheet.portions))} / ración)
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 2. SECCIÓN DE MANO DE OBRA DIRECTA */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>👨‍🍳</span> 2. Mano de Obra Directa
                    </h2>
                    <p className="text-xs text-slate-500">
                      Tiempo invertido por cada puesto de cocina para elaborar el lote completo.
                    </p>
                  </div>
                  <button
                    onClick={addLabor}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span> Añadir Puesto
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                        <th className="py-3 px-4">Puesto / Rol</th>
                        <th className="py-3 px-3 w-36 text-right">Minutos Dedicados</th>
                        <th className="py-3 px-3 w-36 text-right">Costo por Hora</th>
                        <th className="py-3 px-4 w-32 text-right">Costo Receta</th>
                        <th className="py-3 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {laborItems.map((item) => {
                        const rowCost = calculateLaborCost(item);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                value={item.role}
                                onChange={(e) =>
                                  updateLabor(item.id, 'role', e.target.value)
                                }
                                className="w-full font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.minutes}
                                  onChange={(e) =>
                                    updateLabor(
                                      item.id,
                                      'minutes',
                                      Math.max(0, Number(e.target.value))
                                    )
                                  }
                                  className="w-full text-right bg-slate-50 border border-slate-200 rounded pl-2 pr-9 py-1 font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                                <span className="absolute right-2.5 text-xs text-slate-400">
                                  min
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={item.hourlyRate}
                                  onChange={(e) =>
                                    updateLabor(
                                      item.id,
                                      'hourlyRate',
                                      Math.max(0, Number(e.target.value))
                                    )
                                  }
                                  className="w-full text-right bg-slate-50 border border-slate-200 rounded pl-2 pr-9 py-1 font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                                <span className="absolute right-2 text-xs text-slate-400">
                                  /hr
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                              {formatMoney(rowCost)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => removeLabor(item.id)}
                                className="text-slate-300 hover:text-rose-500 transition font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider">
                          Total Mano de Obra / Costo por ración:
                        </td>
                        <td className="py-3 px-4 text-right text-blue-700 text-sm">
                          {formatMoney(summary.laborTotal)}{' '}
                          <span className="block text-[11px] font-normal text-slate-500">
                            ({formatMoney(summary.laborTotal / Math.max(1, sheet.portions))} / ración)
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 3. SECCIÓN DE OTROS COSTOS (OVERHEADS / PACKAGING) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>📦</span> 3. Otros Costos (Gastos Generales, Energía y Packaging)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Empaques para delivery, servilletas, gas, electricidad o alquiler proporcional.
                    </p>
                  </div>
                  <button
                    onClick={addOverhead}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span> Añadir Gasto
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                        <th className="py-3 px-4">Concepto Indirecto / Empaque</th>
                        <th className="py-3 px-3 w-32 text-right">Cantidad</th>
                        <th className="py-3 px-3 w-36 text-right">Costo Unitario</th>
                        <th className="py-3 px-4 w-32 text-right">Subtotal</th>
                        <th className="py-3 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {overheads.map((item) => {
                        const rowCost = calculateOverheadCost(item);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                value={item.concept}
                                onChange={(e) =>
                                  updateOverhead(item.id, 'concept', e.target.value)
                                }
                                className="w-full font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-amber-500 focus:bg-white rounded px-2 py-1 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateOverhead(
                                    item.id,
                                    'quantity',
                                    Math.max(0, Number(e.target.value))
                                  )
                                }
                                className="w-full text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.unitCost}
                                onChange={(e) =>
                                  updateOverhead(
                                    item.id,
                                    'unitCost',
                                    Math.max(0, Number(e.target.value))
                                  )
                                }
                                className="w-full text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                              {formatMoney(rowCost)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => removeOverhead(item.id)}
                                className="text-slate-300 hover:text-rose-500 transition font-bold cursor-pointer"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider">
                          Total Otros Costos / Costo por ración:
                        </td>
                        <td className="py-3 px-4 text-right text-amber-600 text-sm">
                          {formatMoney(summary.overheadsTotal)}{' '}
                          <span className="block text-[11px] font-normal text-slate-500">
                            ({formatMoney(summary.overheadsTotal / Math.max(1, sheet.portions))} / ración)
                          </span>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA (4 cols): 4. PANEL DE RESUMEN FINANCIERO, IMPUESTOS CR Y APPS */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-28">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    4. Resumen Financiero y Distribución
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estructura porcentual del costo de producción
                  </p>
                </div>

                {/* Barra de progreso apilada multicolor */}
                <div>
                  <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${summary.ingredientsShare}%` }}
                      className="bg-emerald-500 transition-all duration-300"
                      title={`Ingredientes: ${summary.ingredientsShare.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${summary.laborShare}%` }}
                      className="bg-blue-500 transition-all duration-300"
                      title={`Mano de Obra: ${summary.laborShare.toFixed(1)}%`}
                    />
                    <div
                      style={{ width: `${summary.overheadsShare}%` }}
                      className="bg-amber-500 transition-all duration-300"
                      title={`Otros Costos: ${summary.overheadsShare.toFixed(1)}%`}
                    />
                  </div>

                  {/* Desglose individual con barras */}
                  <div className="mt-4 space-y-2.5 text-xs">
                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                          Ingredientes
                        </span>
                        <span className="text-slate-900">
                          {formatMoney(summary.ingredientsTotal)} ({summary.ingredientsShare.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                          Mano de Obra
                        </span>
                        <span className="text-slate-900">
                          {formatMoney(summary.laborTotal)} ({summary.laborShare.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                          Otros Costos (Overheads)
                        </span>
                        <span className="text-slate-900">
                          {formatMoney(summary.overheadsTotal)} ({summary.overheadsShare.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Controles de Fijación de Precios, Margen e Impuestos */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <label className="text-slate-700">Margen de Beneficio Deseado:</label>
                      <span className="text-emerald-600 font-extrabold">{targetMarginPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={15}
                      max={85}
                      value={targetMarginPercent}
                      onChange={(e) => {
                        updateCurrentRecipe((rec) => ({
                          ...rec,
                          targetMarginPercent: Number(e.target.value),
                          customSellingPrice: null,
                        }));
                      }}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Selector de Régimen de Impuestos (Especial Costa Rica y LatAm/España) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Régimen de Impuesto sobre Ventas:
                    </label>
                    <select
                      value={taxRatePercent}
                      onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value={13}>🇨🇷 Costa Rica: 13% IVA (Para llevar / Delivery)</option>
                      <option value={23}>🇨🇷 Costa Rica: 23% (13% IVA + 10% Servicio Salón)</option>
                      <option value={10}>🇪🇸 España: 10% IVA Hostelería</option>
                      <option value={16}>🇲🇽 México: 16% IVA</option>
                      <option value={0}>Exento / 0% Impuestos</option>
                    </select>
                  </div>

                  {/* Opción de fijar precio manual */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ¿Fijar Precio Neto de Carta Manualmente?
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        step="any"
                        placeholder={summary.suggestedPrice.toFixed(2)}
                        value={customSellingPrice ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCurrentRecipe((rec) => ({
                            ...rec,
                            customSellingPrice:
                              val === '' ? null : Math.max(0, Number(val)),
                          }));
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                      {customSellingPrice !== null && (
                        <button
                          onClick={() =>
                            updateCurrentRecipe((rec) => ({
                              ...rec,
                              customSellingPrice: null,
                            }))
                          }
                          className="text-xs text-slate-500 hover:text-slate-800 underline whitespace-nowrap cursor-pointer"
                        >
                          Sugerido
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bloque Especial: Impacto de Apps de Delivery (Uber Eats / PedidosYa / Didi) */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                      🛵 Comisión Apps Delivery:
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={deliveryCommissionPercent}
                        onChange={(e) =>
                          setDeliveryCommissionPercent(
                            Math.min(50, Math.max(0, Number(e.target.value)))
                          )
                        }
                        className="w-14 text-right bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-extrabold text-amber-900"
                      />
                      <span className="text-xs font-bold text-amber-900">%</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-amber-900/90 space-y-1">
                    <div className="flex justify-between">
                      <span>Si vendes al mismo precio en App, ganas:</span>
                      <strong
                        className={
                          summary.deliveryProfitSamePrice > 0
                            ? 'text-amber-950'
                            : 'text-rose-600'
                        }
                      >
                        {formatMoney(summary.deliveryProfitSamePrice)} (
                        {summary.deliveryMarginSamePrice.toFixed(0)}%)
                      </strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-amber-200/80">
                      <span>Precio sugerido en App (protegiendo margen):</span>
                      <strong className="text-emerald-700 font-black">
                        {formatMoney(summary.deliveryAppPriceSuggested)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Resumen Ejecutivo Final */}
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Costo Total por Ración:</span>
                    <span className="font-semibold text-white">
                      {formatMoney(summary.costPerPortion)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Precio Neto (Sin Impuestos):</span>
                    <span className="font-bold text-emerald-400">
                      {formatMoney(summary.suggestedPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Precio Menú c/ Impuestos ({taxRatePercent}%):</span>
                    <span className="font-black text-white text-sm">
                      {formatMoney(summary.finalPriceWithTax)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-300">
                      Ganancia Libre / Porción:
                    </span>
                    <span className="text-sm font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      +{formatMoney(summary.profitPerPortion)} ({summary.realMarginPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ==========================================================================
            PESTAÑA 2: SIMULADOR DE VENTAS Y PROYECCIÓN DE NEGOCIO
           ========================================================================== */}
        {activeTab === 'simulador' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SIMULADOR DIRECTO: Porciones Vendidas -> Utilidad */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Proyección Directa
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-2">
                  5.A. Simulador por Volumen de Ventas
                </h2>
                <p className="text-xs text-slate-500">
                  Calcula ingresos, costos variables y utilidad neta según las raciones estimadas al mes para{' '}
                  <strong>{sheet.recipeName}</strong>.
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-slate-700">
                      Porciones Vendidas Estimadas (Mes):
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={simulatedPortionsSold}
                      onChange={(e) =>
                        setSimulatedPortionsSold(Math.max(0, Number(e.target.value)))
                      }
                      className="w-28 text-right bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-extrabold text-emerald-700 text-sm"
                    />
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={2000}
                    step={10}
                    value={simulatedPortionsSold}
                    onChange={(e) => setSimulatedPortionsSold(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>10 raciones</span>
                    <span>Promedio: {(simulatedPortionsSold / 30).toFixed(1)} raciones / día</span>
                    <span>2,000 raciones</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Costos Fijos Mensuales del Local / Dark Kitchen ({currency}):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={monthlyFixedCosts}
                    onChange={(e) =>
                      setMonthlyFixedCosts(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Resultados proyectados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Ingresos Netos
                  </span>
                  <p className="text-lg font-extrabold text-slate-900 mt-1">
                    {formatMoney(simulationResults.grossRevenue)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200">
                  <span className="text-[11px] font-bold uppercase text-rose-500">
                    Costos Producción
                  </span>
                  <p className="text-lg font-extrabold text-rose-700 mt-1">
                    {formatMoney(simulationResults.variableProductionCost)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] font-bold uppercase text-emerald-700">
                    Margen Bruto Total
                  </span>
                  <p className="text-lg font-extrabold text-emerald-700 mt-1">
                    +{formatMoney(simulationResults.grossProfit)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-400">
                    Utilidad Libre (Descontando {formatMoney(monthlyFixedCosts)} de costos fijos)
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Punto de equilibrio: <strong>{simulationResults.breakEvenPortions} porciones</strong>
                  </p>
                </div>
                <p
                  className={`text-xl font-black ${
                    simulationResults.netProfitAfterFixed >= 0
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {formatMoney(simulationResults.netProfitAfterFixed)}
                </p>
              </div>
            </div>

            {/* SIMULADOR INVERSO: Meta de Ganancia -> Porciones necesarias */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6 flex flex-col justify-between">
              <div className="space-y-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    Ingeniería Inversa
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-2">
                    5.B. Calculadora de Meta de Beneficio Objetivo
                  </h2>
                  <p className="text-xs text-slate-500">
                    Indica cuánto dinero libre deseas ganar al mes y descubre cuántas unidades necesitas vender.
                  </p>
                </div>

                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Beneficio Neto Objetivo que deseas lograr ({currency}):
                  </label>
                  <input
                    type="number"
                    min={100}
                    step="any"
                    value={targetMonthlyProfit}
                    onChange={(e) =>
                      setTargetMonthlyProfit(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full bg-white border border-blue-300 rounded-lg px-3.5 py-2.5 text-lg font-extrabold text-blue-700 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="bg-slate-900 text-white rounded-2xl p-6 text-center space-y-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                    Meta de Ventas Necesaria
                  </p>
                  <p className="text-4xl font-black text-emerald-400">
                    {simulationResults.requiredPortionsForTarget}{' '}
                    <span className="text-lg font-semibold text-white">porciones / mes</span>
                  </p>
                  <p className="text-xs text-slate-300">
                    Equivale a vender aproximadamente{' '}
                    <strong className="text-amber-300">
                      {Math.ceil(simulationResults.requiredPortionsForTarget / 30)} porciones por día
                    </strong>{' '}
                    (produciendo{' '}
                    {(simulationResults.requiredPortionsForTarget / Math.max(1, sheet.portions)).toFixed(1)}{' '}
                    lotes de esta receta).
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                💡 <strong>Tip Financiero:</strong> Cada porción vendida a{' '}
                <strong>{formatMoney(summary.suggestedPrice)}</strong> aporta{' '}
                <strong>{formatMoney(summary.profitPerPortion)}</strong> de margen de contribución para cubrir costos fijos y generar utilidad.
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================================
            PESTAÑA 3: FICHA TÉCNICA CULINARIA Y ESCALADOR DE PRODUCCIÓN
           ========================================================================== */}
        {activeTab === 'ficha' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Formulario de Edición de Ficha Técnica (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>📝</span> 6. Editor de Ficha Técnica Operativa
                  </h2>
                  <p className="text-xs text-slate-500">
                    Estandariza la preparación para garantizar calidad constante en cocina.
                  </p>
                </div>
                <button
                  onClick={() => handlePrintKitchenSheet(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <span>🖨️</span> Imprimir Ficha Cocina
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre Comercial del Plato
                  </label>
                  <input
                    type="text"
                    value={sheet.recipeName}
                    onChange={(e) => updateSheet({ recipeName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoría / Línea
                  </label>
                  <input
                    type="text"
                    value={sheet.category}
                    onChange={(e) => updateSheet({ category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL de Fotografía del Plato Terminado
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={sheet.imageUrl}
                    onChange={(e) => updateSheet({ imageUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tiempo Prep. (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={sheet.prepTimeMinutes}
                    onChange={(e) =>
                      updateSheet({ prepTimeMinutes: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pasos de Elaboración Detallados (Procedimiento Estandarizado)
                </label>
                <textarea
                  rows={5}
                  value={sheet.steps}
                  onChange={(e) => updateSheet({ steps: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Emplatado / Empaque Delivery
                  </label>
                  <textarea
                    rows={3}
                    value={sheet.presentation}
                    onChange={(e) => updateSheet({ presentation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Equipo y Utensilios Necesarios
                  </label>
                  <textarea
                    rows={3}
                    value={sheet.equipment}
                    onChange={(e) => updateSheet({ equipment: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Selector Visual de Alérgenos */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Declaración de Alérgenos Presentes en la Receta (Haz clic para activar/desactivar)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {ALLERGENS_CATALOG.map((allergen) => {
                    const active = sheet.allergens.includes(allergen.id);
                    return (
                      <button
                        key={allergen.id}
                        type="button"
                        onClick={() => toggleAllergen(allergen.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-sm ring-1 ring-amber-400'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-base">{allergen.icon}</span>
                        <span className="truncate">{allergen.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vista Previa de la Ficha Técnica + ESCALADOR DE LOTES (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="relative h-52 bg-slate-900 overflow-hidden">
                {sheet.imageUrl ? (
                  <img
                    src={sheet.imageUrl}
                    alt={sheet.recipeName}
                    className="w-full h-full object-cover opacity-90"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                    Sin imagen asignada
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/30 to-transparent flex flex-col justify-end p-5 text-white">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    {sheet.category}
                  </span>
                  <h3 className="text-xl font-black leading-tight mt-0.5">
                    {sheet.recipeName}
                  </h3>
                  <div className="flex gap-4 text-xs text-slate-300 mt-2">
                    <span>🍽️ Base: {sheet.portions} raciones</span>
                    <span>⏱️ Prep: {sheet.prepTimeMinutes} min</span>
                    <span>💰 Costo/Ud: {formatMoney(summary.costPerPortion)}</span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4 text-xs flex-1">
                {/* NUEVO: Escalador de Orden de Producción para Cocina */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold text-emerald-950">
                      ⚖️ Escalador de Producción (Cocina):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={activeBatchPortions}
                        onChange={(e) =>
                          setProductionBatchPortions(Math.max(1, Number(e.target.value)))
                        }
                        className="w-16 text-center bg-white border border-emerald-400 rounded px-2 py-0.5 font-black text-emerald-800"
                      />
                      <span className="text-emerald-800 font-semibold">raciones</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[sheet.portions, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setProductionBatchPortions(
                            preset === sheet.portions ? null : preset
                          )
                        }
                        className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition ${
                          activeBatchPortions === preset
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {preset === sheet.portions ? `Base (${preset})` : `${preset} rac.`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Gramaje Escalado ({activeBatchPortions} raciones • Factor {batchScaleFactor.toFixed(2)}x)
                  </h4>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {ingredients.map((ing) => (
                      <div key={ing.id} className="flex justify-between text-slate-700">
                        <span className="truncate pr-2">{ing.name}:</span>
                        <strong className="text-slate-900">
                          {Number((ing.quantity * batchScaleFactor).toFixed(1))} {ing.unit}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Método de Elaboración
                  </h4>
                  <p className="whitespace-pre-line text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {sheet.steps}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <h4 className="font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Presentación / Delivery
                    </h4>
                    <p className="text-slate-700 leading-relaxed">{sheet.presentation}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <h4 className="font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Equipamiento
                    </h4>
                    <p className="text-slate-700 leading-relaxed">{sheet.equipment}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Alérgenos Declarados
                  </h4>
                  {sheet.allergens.length === 0 ? (
                    <span className="text-slate-400 italic">
                      Ningún alérgeno seleccionado
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {sheet.allergens.map((id) => {
                        const found = ALLERGENS_CATALOG.find((a) => a.id === id);
                        if (!found) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]"
                          >
                            <span>{found.icon}</span> {found.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==========================================================================
          PLANTILLA EXCLUSIVA DE IMPRESIÓN A4 (COCINA Y/O ESCANDALLO GERENCIAL)
         ========================================================================== */}
      <section className="hidden print:block max-w-4xl mx-auto text-slate-900 text-xs space-y-5">
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {printIncludeCosts
                ? 'DOCUMENTO CONFIDENCIAL • ESCANDALLO Y FICHA TÉCNICA'
                : 'ORDEN DE PRODUCCIÓN Y FICHA TÉCNICA (USO EN COCINA)'}
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-0.5">
              {sheet.recipeName}
            </h1>
            <p className="text-xs text-slate-600 font-semibold">{sheet.category}</p>
          </div>
          <div className="text-right space-y-1 bg-slate-100 p-3 rounded-lg border border-slate-300">
            <div className="font-bold">
              Lote a Producir: <span className="text-sm">{activeBatchPortions} raciones</span>
            </div>
            <div>Tiempo Prep Base: {sheet.prepTimeMinutes} minutos</div>
            <div>Fecha impresión: {new Date().toLocaleDateString('es-CR')}</div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 items-start">
          {sheet.imageUrl && (
            <div className="col-span-4 rounded-xl overflow-hidden border border-slate-300 h-40">
              <img
                src={sheet.imageUrl}
                alt={sheet.recipeName}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className={sheet.imageUrl ? 'col-span-8 space-y-3' : 'col-span-12 space-y-3'}>
            {printIncludeCosts && (
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-300">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    Costo / Porción
                  </span>
                  <strong className="text-sm">{formatMoney(summary.costPerPortion)}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    PVP c/ Imp ({taxRatePercent}%)
                  </span>
                  <strong className="text-sm">{formatMoney(summary.finalPriceWithTax)}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    PVP Sugerido App
                  </span>
                  <strong className="text-sm">
                    {formatMoney(summary.deliveryAppPriceSuggested)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    Margen / FoodCost
                  </span>
                  <strong className="text-sm">
                    {summary.realMarginPercent.toFixed(1)}% / FC {summary.foodCostPercent.toFixed(1)}%
                  </strong>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl border border-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Alérgenos Declarados en esta Receta:
              </span>
              {sheet.allergens.length === 0 ? (
                <span>Sin alérgenos declarados</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sheet.allergens.map((id) => {
                    const found = ALLERGENS_CATALOG.find((a) => a.id === id);
                    return found ? (
                      <span
                        key={id}
                        className="px-2 py-0.5 rounded border border-slate-400 font-bold text-[11px]"
                      >
                        {found.icon} {found.label}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabla de Ingredientes y Gramajes para Cocina */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">
            1. Fórmula de Ingredientes (Escalada para {activeBatchPortions} raciones)
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-300 py-1.5 px-2.5">Ingrediente</th>
                <th className="border border-slate-300 py-1.5 px-2.5 text-right">
                  Cantidad ({activeBatchPortions} rac.)
                </th>
                <th className="border border-slate-300 py-1.5 px-2.5 text-right">Cant. por Porción</th>
                <th className="border border-slate-300 py-1.5 px-2.5 text-right">Merma %</th>
                {printIncludeCosts && (
                  <>
                    <th className="border border-slate-300 py-1.5 px-2.5 text-right">Costo Base</th>
                    <th className="border border-slate-300 py-1.5 px-2.5 text-right">
                      Subtotal ({activeBatchPortions} rac.)
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {ingredients.map((item) => (
                <tr key={item.id}>
                  <td className="border border-slate-300 py-1 px-2.5 font-semibold">{item.name}</td>
                  <td className="border border-slate-300 py-1 px-2.5 text-right font-bold">
                    {Number((item.quantity * batchScaleFactor).toFixed(1))} {item.unit}
                  </td>
                  <td className="border border-slate-300 py-1 px-2.5 text-right">
                    {(item.quantity / Math.max(1, sheet.portions)).toFixed(1)} {item.unit}
                  </td>
                  <td className="border border-slate-300 py-1 px-2.5 text-right">
                    {item.wastePercentage}%
                  </td>
                  {printIncludeCosts && (
                    <>
                      <td className="border border-slate-300 py-1 px-2.5 text-right">
                        {formatMoney(item.baseUnitCost)} ({getBaseUnitLabel(item.unit, currency)})
                      </td>
                      <td className="border border-slate-300 py-1 px-2.5 text-right font-bold">
                        {formatMoney(calculateIngredientCost(item) * batchScaleFactor)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pasos de Elaboración, Emplatado y Equipamiento */}
        <div className="grid grid-cols-1 gap-4">
          <div className="border border-slate-300 rounded-xl p-3">
            <h2 className="text-xs font-black uppercase tracking-wider mb-1.5">
              2. Procedimiento Paso a Paso en Cocina
            </h2>
            <p className="whitespace-pre-line leading-relaxed">{sheet.steps}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="border border-slate-300 rounded-xl p-3">
              <h2 className="text-xs font-black uppercase tracking-wider mb-1">
                3. Estándar de Emplatado / Packaging Delivery
              </h2>
              <p className="whitespace-pre-line leading-relaxed">{sheet.presentation}</p>
            </div>
            <div className="border border-slate-300 rounded-xl p-3">
              <h2 className="text-xs font-black uppercase tracking-wider mb-1">
                4. Equipos y Utensilios Requeridos
              </h2>
              <p className="whitespace-pre-line leading-relaxed">{sheet.equipment}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
