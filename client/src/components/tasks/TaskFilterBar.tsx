import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Check, ChevronDown, Filter, MapPin, SortAsc, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type TaskFilters = {
  category?: string;
  query?: string;
  maxDistance?: number;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'date' | 'distance' | 'price' | 'newest';
  sortDirection?: 'asc' | 'desc';
};

interface TaskFilterBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  userLocation?: { lat: number; lng: number } | null;
}

export default function TaskFilterBar({
  filters,
  onFiltersChange,
  userLocation
}: TaskFilterBarProps) {
  const { t } = useTranslation();
  // Lokale Zustände für Filter-Popover
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState<TaskFilters>(filters);
  
  // Kategorien - memoized für bessere Performance
  const categories = useMemo(() => [
    { id: 'all', label: t('categories.all') },
    { id: 'cleaning', label: t('categories.cleaning') },
    { id: 'moving', label: t('categories.moving') },
    { id: 'delivery', label: t('categories.delivery') },
    { id: 'assembly', label: t('categories.assembly') },
    { id: 'gardening', label: t('categories.gardening') },
    { id: 'tutoring', label: t('categories.tutoring') },
    { id: 'other', label: t('categories.other') }
  ], [t]);
  
  // Sort-Optionen - memoized für bessere Performance
  const sortOptions = useMemo(() => [
    { value: 'date-desc', label: t('sort.newestFirst') },
    { value: 'date-asc', label: t('sort.oldestFirst') },
    { value: 'price-desc', label: t('sort.highestPrice') },
    { value: 'price-asc', label: t('sort.lowestPrice') },
    { value: 'distance-asc', label: t('sort.nearestFirst'), disabled: !userLocation }
  ], [t, userLocation]);
  
  // Aktualisiere die temporären Filter mit useCallback für bessere Performance
  const updateTempFilters = useCallback((key: string, value: any) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Filter anwenden mit useCallback für bessere Performance
  const applyFilters = useCallback(() => {
    onFiltersChange(tempFilters);
    setIsFilterOpen(false);
  }, [onFiltersChange, tempFilters]);
  
  // Filter zurücksetzen mit useCallback für bessere Performance
  const resetFilters = useCallback(() => {
    const newFilters: TaskFilters = { 
      query: '',
      category: 'all',
      maxDistance: 50,
      sortBy: 'date',
      sortDirection: 'desc'
    };
    setTempFilters(newFilters);
    onFiltersChange(newFilters);
    setIsFilterOpen(false);
  }, [onFiltersChange]);
  
  // Ausgewählte Sortieroption aus sortBy und sortDirection ermitteln - memoized
  const getCurrentSortOption = useMemo(() => {
    const { sortBy, sortDirection } = filters;
    return sortOptions.find(
      option => option.value === `${sortBy}-${sortDirection}`
    )?.label || sortOptions[0].label;
  }, [filters.sortBy, filters.sortDirection, sortOptions]);
  
  // Ausgewählte Kategorieoption ermitteln - memoized
  const getCurrentCategory = useMemo(() => {
    return categories.find(
      category => category.id === filters.category
    )?.label || categories[0].label;
  }, [categories, filters.category]);
  
  // Anzahl der aktiven Filter berechnen (ohne Sortierung und Standardwerte) - memoized
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category && filters.category !== 'all') count++;
    if (filters.query && filters.query.trim() !== '') count++;
    if (filters.maxDistance && filters.maxDistance !== 50) count++;
    return count;
  }, [filters.category, filters.query, filters.maxDistance]);
  
  return (
    <div className="w-full flex flex-col space-y-3 px-4 py-2">
      {/* Suchleiste */}
      <div className="flex space-x-2">
        <Input
          placeholder={t('search.tasks')}
          value={filters.query || ''}
          onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
          className="flex-1"
        />
        
        {/* Filter-Button */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              {t('filter.filters')}
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h3 className="font-medium">{t('filter.filters')}</h3>
              
              {/* Kategorie */}
              <div>
                <label className="text-sm font-medium">{t('filter.category')}</label>
                <Select 
                  value={tempFilters.category || 'all'} 
                  onValueChange={(value) => updateTempFilters('category', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('categories.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Maximale Entfernung (nur anzeigen wenn Benutzerstandort bekannt) */}
              {userLocation && (
                <div>
                  <label className="text-sm font-medium">
                    {t('filter.maxDistance')}: {tempFilters.maxDistance || 50}km
                  </label>
                  <Slider
                    defaultValue={[tempFilters.maxDistance || 50]}
                    max={100}
                    step={5}
                    onValueChange={(value) => updateTempFilters('maxDistance', value[0])}
                    className="mt-2"
                  />
                </div>
              )}
              
              {/* Buttons für Aktionen */}
              <div className="flex justify-between pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetFilters}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('filter.reset')}
                </Button>
                <Button 
                  size="sm"
                  onClick={applyFilters}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('filter.apply')}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Sortierungs-Dropdown */}
        <Select 
          value={`${filters.sortBy}-${filters.sortDirection}`}
          onValueChange={(value) => {
            const [sortBy, sortDirection] = value.split('-');
            onFiltersChange({
              ...filters,
              sortBy: sortBy as 'date' | 'distance' | 'price',
              sortDirection: sortDirection as 'asc' | 'desc'
            });
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SortAsc className="h-4 w-4 mr-2" />
            <SelectValue placeholder={t('sort.sortBy')} />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Aktive Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.category && filters.category !== 'all' && (
            <div className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs flex items-center">
              {getCurrentCategory || filters.category}
              <button 
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                onClick={() => onFiltersChange({ ...filters, category: 'all' })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          
          {filters.maxDistance && filters.maxDistance !== 50 && (
            <div className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs flex items-center">
              <MapPin className="h-3 w-3 mr-1" />
              {filters.maxDistance}km
              <button 
                className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                onClick={() => onFiltersChange({ ...filters, maxDistance: 50 })}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}