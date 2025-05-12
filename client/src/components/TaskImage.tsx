import { getCategoryImage } from '@/lib/categoryImages';

interface TaskImageProps {
  imageUrl?: string;
  category: string;
  title: string;
  className?: string;
  showCategoryOverlay?: boolean;
}

/**
 * A component that displays a task image with a fallback to category image
 */
const TaskImage: React.FC<TaskImageProps> = ({
  imageUrl,
  category,
  title,
  className = '',
  showCategoryOverlay = true
}) => {
  // Get default category image if no custom image is provided
  const displayImage = imageUrl || getCategoryImage(category);
  
  return (
    <div className={`relative ${className}`}>
      <img 
        src={displayImage} 
        alt={title || category} 
        className="w-full h-full object-cover" 
      />
      {!imageUrl && showCategoryOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
          <span className="text-white font-semibold text-lg">{category}</span>
        </div>
      )}
    </div>
  );
};

export default TaskImage;