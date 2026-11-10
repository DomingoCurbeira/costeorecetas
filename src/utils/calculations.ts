// src/utils/calculations.ts
import { IngredientItem, LaborItem, OverheadItem } from '../types/recipe';

/**
 * Calcula el costo real de un ingrediente en la receta.
 * Si la unidad es 'g' o 'ml', se asume que el baseUnitCost está expresado por 'kg' o 'lt' (dividiendo entre 1000),
 * que es el estándar en escandallos gastronómicos.
 */
export const calculateIngredientCost = (item: IngredientItem): number => {
  const conversionFactor = item.unit === 'g' || item.unit === 'ml' ? 0.001 : 1;
  const netCost = item.quantity * conversionFactor * item.baseUnitCost;
  // Aplicamos factor de rendimiento / merma si existe
  const yieldFactor = Math.max(0.01, (100 - (item.wastePercentage || 0)) / 100);
  return netCost / yieldFactor;
};

/**
 * Calcula el costo de mano de obra según los minutos empleados y la tarifa por hora.
 */
export const calculateLaborCost = (item: LaborItem): number => {
  return (item.minutes / 60) * item.hourlyRate;
};

/**
 * Calcula el costo de un gasto indirecto / empaque.
 */
export const calculateOverheadCost = (item: OverheadItem): number => {
  return item.quantity * item.unitCost;
};

/**
 * Etiqueta descriptiva de la unidad base de compra para guiar al usuario
 */
export const getBaseUnitLabel = (unit: IngredientItem['unit'], currency = '₡'): string => {
  if (unit === 'kg' || unit === 'g') return `${currency}/kg`;
  if (unit === 'lt' || unit === 'ml') return `${currency}/lt`;
  return `${currency}/und`;
};

/**
 * Formatea valores monetarios adaptándose a Colones Costarricenses (₡) u otras divisas
 */
export const formatCurrencyValue = (value: number, currency: string): string => {
  const safeValue = Number.isFinite(value) ? value : 0;
  // Si es Colón de Costa Rica y el monto es grande (>= 100), mostramos separador de miles limpio
  if (currency === '₡') {
    return `₡${safeValue.toLocaleString('es-CR', {
      minimumFractionDigits: safeValue % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${currency}${safeValue.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
