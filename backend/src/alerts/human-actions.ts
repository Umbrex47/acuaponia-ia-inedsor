/**
 * Guía de Acciones Humanas Correctivas para Desbalances Acuapónicos.
 * Mapea cada parámetro y condición a los pasos operacionales inmediatos.
 */

export interface HumanActionProtocol {
  parameter: string;
  condition: string;
  risk: string;
  actions: string[];
}

export const HUMAN_ACTIONS_MAP: Record<string, { high?: HumanActionProtocol; low?: HumanActionProtocol }> = {
  ph: {
    low: {
      parameter: 'Potencial de Hidrógeno (pH)',
      condition: 'pH Ácido / Acidosis (< 6.4 pH)',
      risk: 'Inhibición de bacterias nitrificantes, parálisis del biofiltro y bloqueo de fósforo/calcio en raíces.',
      actions: [
        'Suspender temporalmente la alimentación para frenar la producción de amoníaco.',
        'Dosificar buffer alcalino suave: agregar bicarbonato de potasio (KHCO3) o carbonato de calcio (CaCO3) diluido en agua.',
        'Ajustar de forma gradual: máximo 0.2 a 0.3 unidades de pH por día para evitar shock osmótico en peces.',
        'Verificar dureza de carbonatos (KH) para asegurar capacidad tampón mínima de 4 dKH (70 ppm).',
      ],
    },
    high: {
      parameter: 'Potencial de Hidrógeno (pH)',
      condition: 'pH Alcalino / Alcalosis (> 7.6 pH)',
      risk: 'Precipitación de hierro (clorosis) e incremento de amoníaco no ionizado libre (NH3) altamente tóxico.',
      actions: [
        'Monitorear amoníaco libre (NH3); si está elevado, preparar recambio parcial con agua fresca desclorada.',
        'Dosificar ácido suave de grado alimentario: ácido fosfórico (H3PO4) diluido o ácido cítrico muy lentamente.',
        'Suplementar hierro quelado Fe-EDDHA (resistente a pH alto) o aplicar quelato Fe-DTPA de forma foliar en hojas.',
        'Revisar dureza del agua de reposición; usar agua de lluvia o filtrada por ósmosis si el agua de red es muy dura.',
      ],
    },
  },
  oxigeno: {
    low: {
      parameter: 'Oxígeno Disuelto (OD)',
      condition: 'Hipoxia Severa (< 5.0 mg/L)',
      risk: 'Asfixia inminente de peces (boqueo en superficie) y muerte de bacterias aeróbicas en el biofiltro.',
      actions: [
        'Activar compresor/soplador de respaldo y limpiar piedras difusoras obstruidas.',
        'Elevar el retorno de agua sobre la superficie para forzar cascada y efecto Venturi.',
        'Suspender al 100% la alimentación de los peces (la digestión triplica el consumo de oxígeno).',
        'Purgar lodos y materia orgánica acumulada en el decantador (reduce la Demanda Biológica de Oxígeno).',
      ],
    },
  },
  temperatura: {
    high: {
      parameter: 'Temperatura del Agua',
      condition: 'Hipertermia / Calor Extremo (> 28°C - 30°C)',
      risk: 'Caída drástica en solubilidad del O2, estrés metabólico y riesgo de patógenos bacterianos.',
      actions: [
        'Instalar malla sombra (malla raschel 50-70%) sobre tanques y camas hidropónicas.',
        'Mantener aireación mecánica al máximo rendimiento.',
        'Realizar recambio parcial (10-15%) con agua fresca desclorada a menor temperatura.',
        'Aislar térmicamente los depósitos expuestos a radiación solar directa.',
      ],
    },
    low: {
      parameter: 'Temperatura del Agua',
      condition: 'Hipotermia / Agua Fría (< 18°C)',
      risk: 'Letargo metabólico en peces, detención digestiva y caída del biofiltro a menos del 30% de eficiencia.',
      actions: [
        'Suspender o reducir drásticamente la alimentación (los peces no digieren en agua fría y el alimento se pudre).',
        'Conectar calentador de inmersión para acuicultura con termostato fijado a 22-24°C.',
        'Cubrir el tanque de peces con lona térmica o plástico de invernadero durante la noche.',
      ],
    },
  },
  nivelAgua: {
    low: {
      parameter: 'Nivel del Reservorio',
      condition: 'Nivel Crítico de Agua (< 25% o marcha en seco)',
      risk: 'Cavitación y daño irreparable de la bomba sumergible, detención del flujo a raíces y deshidratación.',
      actions: [
        'Inspeccionar inmediatamente tuberías, codos, uniones y sifones campana buscando fugas o desbordes.',
        'Apagar la bomba si el nivel no cubre el cuerpo del motor sumergible para evitar que se queme.',
        'Rellenar el reservorio con agua desclorada a temperatura similar al sistema.',
        'Desatascar la válvula de flotador de reposición automática de agua.',
      ],
    },
  },
  electroconductividad: {
    low: {
      parameter: 'Electroconductividad (EC)',
      condition: 'Agotamiento Nutricional (< 0.8 mS/cm)',
      risk: 'Inanición mineral en plantas (deficiencia de nitrógeno, potasio, calcio y magnesio).',
      actions: [
        'Evaluar la tasa de alimentación de los peces y aumentar gradualmente la ración si la biomasa lo permite.',
        'Suplementar sales compatibles con peces: sulfato de potasio (K2SO4), sulfato de magnesio (sal de Epsom) y quelato de hierro.',
        'Aplicar fertilizante foliar orgánico suave (extracto de algas) directamente sobre las hojas.',
      ],
    },
    high: {
      parameter: 'Electroconductividad (EC)',
      condition: 'Exceso de Sales / Salinidad (> 2.0 mS/cm)',
      risk: 'Estrés osmótico en peces y toxicidad radicular por acumulación de sales disueltas.',
      actions: [
        'Purgar entre 15% y 25% del agua del sistema y reponer con agua limpia desclorada o de ósmosis.',
        'Suspender toda adición de buffers, cal o suplementos minerales hasta normalizar.',
      ],
    },
  },
  turbiedad: {
    high: {
      parameter: 'Turbidez del Agua',
      condition: 'Sobrecarga de Sólidos Suspendidos (> 25 NTU)',
      risk: 'Colmatación de branquias en peces, reducción de fotosíntesis y proliferación de bacterias anaeróbicas.',
      actions: [
        'Purgar la válvula de fondo del decantador de remolino / clarificador de sólidos.',
        'Lavar los medios mecánicos (perlón, mallas, esponjas) usando agua del propio sistema.',
        'Reducir la alimentación en un 50% y retirar con red el alimento no consumido tras 10 minutos.',
        'Aspirar sedimentos acumulados en el fondo del tanque de peces.',
      ],
    },
  },
  nitratos: {
    high: {
      parameter: 'Concentración de Nitratos (NO3)',
      condition: 'Acumulación Excesiva de Nitratos (> 80-100 ppm)',
      risk: 'Estrés osmótico crónico en peces y desequilibrio vegetativo en plantas.',
      actions: [
        'Incorporar más plántulas de rápido crecimiento (lechuga, albahaca, menta) para aumentar la absorción de nitrógeno.',
        'Realizar un recambio parcial de agua del 20% con agua desclorada.',
        'Cosechar biomasa vegetal madura para estimular nuevo crecimiento y captación.',
      ],
    },
    low: {
      parameter: 'Concentración de Nitratos (NO3)',
      condition: 'Nitratos Insuficientes (< 10 ppm)',
      risk: 'Clorosis general en plantas y retraso severo del crecimiento foliar.',
      actions: [
        'Aumentar la ración de alimentación o incorporar más peces al estanque de forma gradual.',
        'Comprobar que el biofiltro esté activo midiendo amonio y nitritos.',
      ],
    },
  },
};

/**
 * Obtiene el protocolo de acciones humanas para un parámetro y nivel de riesgo dado.
 */
export function getHumanActions(sensorKey: string, level: 'high' | 'low' | 'stable'): HumanActionProtocol | null {
  if (level === 'stable') return null;
  const entry = HUMAN_ACTIONS_MAP[sensorKey];
  if (!entry) return null;
  return (level === 'high' ? entry.high : entry.low) || null;
}
