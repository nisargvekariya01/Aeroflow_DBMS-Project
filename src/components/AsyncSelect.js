'use client';
import { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';

/**
 * AsyncSelect - A data-fetching wrapper for SearchableSelect
 * Automatically connects to backend routes and formats options.
 */
export default function AsyncSelect({
  fetchUrl,
  valueKey = 'id',
  labelKey = 'name',
  extraKey,
  transform, 
  queryParams,
  debounce = 0,
  searchParamName = 'search',
  ...restProps
}) {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  // Use debouncing for input to prevent heavy API calls
  useEffect(() => {
    if (debounce <= 0) return;
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), debounce);
    return () => clearTimeout(timer);
  }, [searchTerm, debounce]);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!fetchUrl) return;
      setIsLoading(true);
      setError(null);
      try {
        let url = fetchUrl;
        const params = new URLSearchParams(queryParams || {});
        
        // Only trigger server search if debounce > 0 and term exists
        if (debounce > 0 && debouncedTerm) {
           params.set(searchParamName, debouncedTerm);
        }
        
        const queryString = params.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fetch failed');
        
        if (isMounted) {
          if (transform) {
             setOptions(transform(data));
          } else {
             // Handle raw arrays or payload wrappers { rows: [] }
             const dataArray = Array.isArray(data) ? data : (data.rows || []);
             const formatted = dataArray.map(item => ({
               value: item[valueKey],
               // Default formatting logic: "Airport Name (IATA)" if extraKey exists
               label: `${item[labelKey]}${extraKey && item[extraKey] ? ` (${item[extraKey]})` : ''}`,
               // Retain underlying meta-information for the SearchableSelect's filters
               extra: extraKey ? { code: item[extraKey] } : undefined
             }));
             setOptions(formatted);
          }
        }
      } catch (err) {
        if(isMounted) {
            console.error('AsyncSelect fetch error:', err);
            setError(err.message);
        }
      } finally {
        if(isMounted) setIsLoading(false);
      }
    };
    
    loadData();
    return () => { isMounted = false; };
  }, [fetchUrl, JSON.stringify(queryParams), debouncedTerm]);

  const resolvedPlaceholder = error ? "Failed to load options" : restProps.placeholder;

  return (
    <SearchableSelect 
      options={options}
      isLoading={isLoading}
      onSearch={debounce > 0 ? setSearchTerm : undefined}
      {...restProps}
      placeholder={resolvedPlaceholder}
    />
  );
}
