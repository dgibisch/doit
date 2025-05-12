import { getCategoryColor } from '@/lib/categoryImages';

interface CategoryIconProps {
  category: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const CategoryIcon: React.FC<CategoryIconProps> = ({ 
  category, 
  size = 'md',
  showLabel = true 
}) => {
  // Map categories to icons
  const categoryToIcon: Record<string, string> = {
    'cleaning': 'fas fa-broom',
    'gardening': 'fas fa-seedling',
    'handyman': 'fas fa-hammer',
    'delivery': 'fas fa-truck',
    'tutoring': 'fas fa-book-open',
    'petcare': 'fas fa-paw',
    'other': 'fas fa-ellipsis-h'
  };

  // Normalize category name
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '');
  
  // Get icon and color
  const icon = categoryToIcon[normalizedCategory] || categoryToIcon['other'];
  const colorHex = getCategoryColor(category);
  const color = `bg-[${colorHex}]`;
  
  // Size mapping
  const sizeClass = {
    'sm': 'w-8 h-8',
    'md': 'w-12 h-12',
    'lg': 'w-16 h-16'
  };
  
  const containerClass = showLabel ? 'flex flex-col items-center space-y-1' : '';
  
  return (
    <div className={containerClass}>
      <div className={`${sizeClass[size]} rounded-full ${color} flex items-center justify-center`}>
        <i className={`${icon} text-white`}></i>
      </div>
      {showLabel && <span className="text-xs">{category}</span>}
    </div>
  );
};

export default CategoryIcon;
