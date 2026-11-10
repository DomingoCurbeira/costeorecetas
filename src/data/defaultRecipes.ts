// src/data/defaultRecipes.ts
import { RecipeDocument } from '../types/recipe';

export const DEFAULT_RECIPES: RecipeDocument[] = [
  {
    id: 'rec-burger-trufada',
    updatedAt: new Date().toISOString(),
    targetMarginPercent: 62,
    customSellingPrice: null,
    sheet: {
      recipeName: 'Burger Brioche Trufada (Dark Kitchen Edition)',
      category: 'Platos Principales / Delivery Premium',
      portions: 10,
      prepTimeMinutes: 45,
      imageUrl:
        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
      steps:
        '1. Porcionar el blend de carne madurada en bolas de 180g sin compactar en exceso.\n2. Tostar el pan brioche con mantequilla clarificada en plancha a 180°C.\n3. Sellar la carne a fuego alto (2.5 min por lado) aplicando costra Maillard y fundir el queso cheddar curado.\n4. Montar con mayonesa de trufa negra, cebolla caramelizada al oporto y rúcula fresca.',
      presentation:
        'Para Delivery: Envolver en papel antigrasa térmico aluminio-kraft, colocar en caja rígida ventilada con sello de seguridad.\nEn Salón: Plato de cerámica negra mate con papas rústicas en canasta lateral.',
      equipment:
        'Plancha de cromo duro, espátula de acero inoxidable, balanza digital de precisión, campana de fundido, termómetro de sonda.',
      allergens: ['gluten', 'lacteos', 'huevos'],
    },
    ingredients: [
      { id: 'ing-1', name: 'Carne Res Blend (80/20)', unit: 'g', quantity: 1800, baseUnitCost: 12.5, wastePercentage: 5 },
      { id: 'ing-2', name: 'Pan Brioche Artesanal', unit: 'und', quantity: 10, baseUnitCost: 0.65, wastePercentage: 0 },
      { id: 'ing-3', name: 'Queso Cheddar Madurado', unit: 'g', quantity: 400, baseUnitCost: 14.0, wastePercentage: 0 },
      { id: 'ing-4', name: 'Pasta / Aceite de Trufa Negra', unit: 'ml', quantity: 60, baseUnitCost: 48.0, wastePercentage: 0 },
      { id: 'ing-5', name: 'Cebolla Morada Caramelizada', unit: 'g', quantity: 500, baseUnitCost: 2.2, wastePercentage: 12 },
    ],
    laborItems: [
      { id: 'lab-1', role: 'Cocinero de Línea (Plancha)', minutes: 25, hourlyRate: 12.0 },
      { id: 'lab-2', role: 'Ayudante de Cocina (Mise en place)', minutes: 20, hourlyRate: 8.5 },
    ],
    overheads: [
      { id: 'ovh-1', concept: 'Packaging Térmico + Bolsa Delivery', quantity: 10, unitCost: 0.55 },
      { id: 'ovh-2', concept: 'Consumo energético y gas (lote)', quantity: 1, unitCost: 2.1 },
      { id: 'ovh-3', concept: 'Prorrateo Alquiler Dark Kitchen', quantity: 1, unitCost: 3.4 },
    ],
  },
  {
    id: 'rec-poke-nikkei',
    updatedAt: new Date().toISOString(),
    targetMarginPercent: 65,
    customSellingPrice: null,
    sheet: {
      recipeName: 'Poke Bowl Salmón Nikkei & Aguacate',
      category: 'Healthy / Ensaladas & Bowls',
      portions: 8,
      prepTimeMinutes: 35,
      imageUrl:
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
      steps:
        '1. Lavar el arroz de sushi 4 veces hasta que el agua salga clara. Cocinar y temperar con vinagre de arroz, azúcar y sal.\n2. Cortar el lomo de salmón fresco en cubos regulares de 1.5 cm y marinar al momento con salsa Nikkei (soja, sésamo, jengibre y lima).\n3. Laminar aguacate hass, pepino japonés y edamames pelados.\n4. Disponer base de arroz tibio, coronar con salmón, toppings y cebolla crispy.',
      presentation:
        'Bowl kraft biodegradable de 750ml con tapa PET cristalina. Salsero aparte de 1.5 oz para evitar humedecer el arroz en ruta.',
      equipment:
        'Arrocera industrial, cuchillo Yanagiba / Chef bien afilado, tabla de corte azul (pescados), bowls de acero inoxidable.',
      allergens: ['pescado', 'soja', 'gluten'],
    },
    ingredients: [
      { id: 'ing-p1', name: 'Salmón Noruego Fresco Limpio', unit: 'g', quantity: 960, baseUnitCost: 22.0, wastePercentage: 8 },
      { id: 'ing-p2', name: 'Arroz Sushi Grano Corto', unit: 'g', quantity: 800, baseUnitCost: 3.2, wastePercentage: 0 },
      { id: 'ing-p3', name: 'Aguacate Hass Maduro', unit: 'g', quantity: 600, baseUnitCost: 5.5, wastePercentage: 25 },
      { id: 'ing-p4', name: 'Edamame Pelado + Wakame', unit: 'g', quantity: 320, baseUnitCost: 8.5, wastePercentage: 0 },
      { id: 'ing-p5', name: 'Salsa Ponzu / Soja & Aceite Sésamo', unit: 'ml', quantity: 240, baseUnitCost: 9.0, wastePercentage: 0 },
    ],
    laborItems: [
      { id: 'lab-p1', role: 'Sushiman / Línea Fría', minutes: 30, hourlyRate: 13.5 },
    ],
    overheads: [
      { id: 'ovh-p1', concept: 'Bowl Kraft 750ml + Tapa + Palillos', quantity: 8, unitCost: 0.48 },
      { id: 'ovh-p2', concept: 'Energía y Refrigeración', quantity: 1, unitCost: 1.5 },
    ],
  },
  {
    id: 'rec-cheesecake-vasco',
    updatedAt: new Date().toISOString(),
    targetMarginPercent: 70,
    customSellingPrice: null,
    sheet: {
      recipeName: 'Tarta de Queso Vasca Cremosa (La Viña Style)',
      category: 'Postres de Autor / Pastelería',
      portions: 12,
      prepTimeMinutes: 50,
      imageUrl:
        'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80',
      steps:
        '1. Atemperar el queso crema y el queso azul suave durante 30 minutos.\n2. Batir con azúcar a velocidad baja sin incorporar aire excesivo.\n3. Añadir los huevos camperos uno a uno, seguido de la nata 38% MG y una pizca de harina tamizada.\n4. Hornear a 215°C con ventilador durante 28 minutos hasta lograr superficie tostada y centro fluido. Reposo mínimo 6 horas.',
      presentation:
        'Porción triangular envuelta en papel sulfurizado con tarro individual de tierra de Lotus o pistacho.',
      equipment:
        'Horno de convección con sonda, batidora planetaria con pala, molde desmontable 24cm, papel sulfurizado humedecido.',
      allergens: ['lacteos', 'huevos', 'gluten'],
    },
    ingredients: [
      { id: 'ing-c1', name: 'Queso Crema Profesional', unit: 'g', quantity: 1000, baseUnitCost: 6.8, wastePercentage: 0 },
      { id: 'ing-c2', name: 'Nata Fresca 38% M.G.', unit: 'ml', quantity: 500, baseUnitCost: 4.2, wastePercentage: 0 },
      { id: 'ing-c3', name: 'Huevos Camperos L', unit: 'und', quantity: 7, baseUnitCost: 0.28, wastePercentage: 0 },
      { id: 'ing-c4', name: 'Azúcar Blanca Refinada', unit: 'g', quantity: 350, baseUnitCost: 1.4, wastePercentage: 0 },
      { id: 'ing-c5', name: 'Queso Idiazábal / Azul Suave', unit: 'g', quantity: 80, baseUnitCost: 19.5, wastePercentage: 0 },
    ],
    laborItems: [
      { id: 'lab-c1', role: 'Chef Pastelero', minutes: 25, hourlyRate: 14.0 },
    ],
    overheads: [
      { id: 'ovh-c1', concept: 'Cajas Individuales Porción Pastel', quantity: 12, unitCost: 0.35 },
      { id: 'ovh-c2', concept: 'Horneado Alta Temperatura (40 min)', quantity: 1, unitCost: 1.8 },
    ],
  },
];
