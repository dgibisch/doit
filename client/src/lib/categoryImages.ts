// Using real images from Unsplash for category fallbacks
// High quality, royalty-free photos

// Define category to image mapping with direct URLs to high-quality, real photos
const categoryImageMap: Record<string, string> = {
  'cleaning': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1000',
  'gardening': 'https://images.unsplash.com/photo-1599629954294-14df9f8291b9?q=80&w=1000',
  'handyman': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1000',
  'home repair': 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=1000',
  'homerepair': 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?q=80&w=1000',
  'delivery': 'https://images.unsplash.com/photo-1601158935942-52255782d322?q=80&w=1000',
  'tutoring': 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1000',
  'technology': 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1000',
  'errands': 'https://images.unsplash.com/photo-1601158935942-52255782d322?q=80&w=1000',
  'petcare': 'https://images.unsplash.com/photo-1444212477490-ca407925329e?q=80&w=1000',
  'pet care': 'https://images.unsplash.com/photo-1444212477490-ca407925329e?q=80&w=1000',
  'other': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000',
};

/**
 * Get default image URL for a task category
 * @param category The task category
 * @returns The URL of the default image for the category
 */
export function getCategoryImage(category: string): string {
  // Convert category to lowercase and remove any spaces
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '');
  
  // Return the corresponding image or default to 'other' if not found
  return categoryImageMap[normalizedCategory] || categoryImageMap['other'];
}

/**
 * Get category color for styling elements
 * @param category The task category
 * @returns A hex color code for the category
 */
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    'cleaning': '#6366f1',    // Indigo (primary)
    'gardening': '#a855f7',   // Purple (secondary)
    'handyman': '#6366f1',    // Indigo
    'delivery': '#a855f7',    // Purple
    'tutoring': '#6366f1',    // Indigo
    'petcare': '#a855f7',     // Purple
    'other': '#6b7280',       // Gray
  };

  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '');
  return colorMap[normalizedCategory] || colorMap['other'];
}