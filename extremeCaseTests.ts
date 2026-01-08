
export interface TestCase {
  id: string;
  category: 'unique_features' | 'extreme_transformation' | 'problematic_scenarios';
  name: string;
  description: string;
  imageRequirements: string[];
  strengthLevel: number;
  expectedMinScore: number;
  testInstructions: string;
}

export const extremeCaseTests: TestCase[] = [
  {
    id: 'test_glasses',
    category: 'unique_features',
    name: 'Sujeto con Gafas',
    description: 'Persona que usa gafas permanentemente',
    imageRequirements: ['Rostro frontal con gafas', 'Gafas claramente visibles'],
    strengthLevel: 0.8,
    expectedMinScore: 85,
    testInstructions: '1. Cargar imagen de persona con gafas. 2. Transformación dramática (80%). 3. Verificar que las gafas se mantengan.'
  },
  {
    id: 'test_day_to_night',
    category: 'extreme_transformation',
    name: 'Día a Noche',
    description: 'Transformación de luz diurna a iluminación nocturna',
    imageRequirements: ['Imagen original con luz natural', 'Fondo diurno'],
    strengthLevel: 0.9,
    expectedMinScore: 85,
    testInstructions: '1. Imagen original diurna. 2. Prompt de escena nocturna. 3. Strength 90%. 4. Verificar identidad intacta.'
  },
  {
    id: 'test_frontal_to_profile',
    category: 'extreme_transformation',
    name: 'Frontal a Perfil',
    description: 'Rotación de pose de frente a perfil lateral',
    imageRequirements: ['Imagen original frontal', 'Rostro simétrico'],
    strengthLevel: 0.75,
    expectedMinScore: 80,
    testInstructions: '1. Pose frontal directa. 2. Prompt perfil lateral. 3. Strength 75%. 4. Verificar rasgos laterales.'
  }
];
