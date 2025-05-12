/**
 * Shared categories list for the entire application
 * 
 * Important: Always use this list to maintain consistency between UI components
 */
export const TASK_CATEGORIES = [
  'Gardening',
  'Errands',
  'Technology',
  'Home Repair',
  'Pet Care',
  'Delivery',
  'Cleaning',
  'Other'
];

/**
 * Get the label for "All Tasks" category (used in filter views)
 */
export const ALL_TASKS_LABEL = 'All Tasks';

/**
 * Get all categories including "All Tasks" option for filter views
 */
export function getCategoriesWithAll(): string[] {
  return [ALL_TASKS_LABEL, ...TASK_CATEGORIES];
}

/**
 * Check if a category is valid
 */
export function isValidCategory(category: string): boolean {
  return TASK_CATEGORIES.includes(category);
}

/**
 * Get category color for styling elements
 * @param category The task category
 * @returns CSS class string for the category badge
 */
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    'Gardening': 'bg-indigo-100 text-indigo-800',
    'Errands': 'bg-purple-100 text-purple-800',
    'Technology': 'bg-indigo-100 text-indigo-800',
    'Home Repair': 'bg-purple-100 text-purple-800',
    'Pet Care': 'bg-indigo-100 text-indigo-800',
    'Delivery': 'bg-purple-100 text-purple-800',
    'Cleaning': 'bg-indigo-100 text-indigo-800',
    'Other': 'bg-gray-100 text-gray-800'
  };
  
  return colorMap[category] || 'bg-gray-100 text-gray-800';
}