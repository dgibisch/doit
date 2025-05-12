import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date function
export function formatDate(date: Date | number | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  // Less than a minute ago
  if (diff < 60 * 1000) {
    return 'Just now';
  }
  
  // Less than an hour ago
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  
  // Less than a day ago
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Less than a week ago
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
  
  // Default to formatted date
  return d.toLocaleDateString();
}

// Convert meters to friendly distance format
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters.toFixed(0)} m away`;
  } else {
    const km = meters / 1000;
    return `${km.toFixed(1)} km away`;
  }
}

// Format price with currency
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

// Alias for formatPrice to match component usage
export const formatCurrency = formatPrice;

// Calculate time ago from timestamp
export function timeAgo(timestamp: any): string {
  if (!timestamp) return '';
  
  // Convert Firestore timestamp to Date if needed
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  
  return formatDate(date);
}

// Calculate progress percentage for user level
export function calculateLevelProgress(completedTasks: number, rating: number, currentLevel: any, nextLevel: any | null): number {
  if (!nextLevel) return 100; // Max level reached
  
  // Calculate task progress
  const taskRange = nextLevel.minTasks - currentLevel.minTasks;
  const userTaskProgress = completedTasks - currentLevel.minTasks;
  const taskPercentage = Math.min(100, (userTaskProgress / taskRange) * 100);
  
  // Calculate rating progress
  const ratingRange = nextLevel.minRating - currentLevel.minRating;
  const userRatingProgress = rating - currentLevel.minRating;
  const ratingPercentage = Math.min(100, (userRatingProgress / ratingRange) * 100);
  
  // Average of both progress types
  return Math.floor((taskPercentage + ratingPercentage) / 2);
}

// Get rating stars (full, half, empty)
export function getRatingStars(rating: number): { full: number, half: number, empty: number } {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return {
    full: fullStars,
    half: hasHalfStar ? 1 : 0,
    empty: emptyStars
  };
}
