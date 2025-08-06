"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  BaseFieldProps,
  LocationConfig,
  LocationValue,
  LocationSearchResult,
} from "@/lib/formedible/types";
import { FieldWrapper } from "./base-field-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Built-in search providers
const builtInProviders = {
  // OpenStreetMap/Nominatim search
  nominatim: async (
    query: string,
    options: any = {}
  ): Promise<LocationSearchResult[]> => {
    const endpoint =
      options.endpoint || "https://nominatim.openstreetmap.org/search";
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: String(options.limit || 5),
      addressdetails: "1",
      ...options.searchOptions,
    });

    try {
      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json();

      return data.map((item: any, index: number) => ({
        id: item.place_id || index,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address: item.display_name,
        city: item.address?.city || item.address?.town || item.address?.village,
        state: item.address?.state,
        country: item.address?.country,
        postalCode: item.address?.postcode,
        relevance: parseFloat(item.importance || 0),
        bounds: item.boundingbox
          ? {
              northeast: {
                lat: parseFloat(item.boundingbox[1]),
                lng: parseFloat(item.boundingbox[3]),
              },
              southwest: {
                lat: parseFloat(item.boundingbox[0]),
                lng: parseFloat(item.boundingbox[2]),
              },
            }
          : undefined,
      }));
    } catch (error) {
      console.error("Nominatim search error:", error);
      return [];
    }
  },

  // OpenStreetMap reverse geocoding
  nominatimReverse: async (
    lat: number,
    lng: number,
    options: any = {}
  ): Promise<LocationValue> => {
    const endpoint =
      options.endpoint || "https://nominatim.openstreetmap.org/reverse";
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
      addressdetails: "1",
      ...options.searchOptions,
    });

    try {
      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json();

      return {
        lat,
        lng,
        address: data.display_name,
        city: data.address?.city || data.address?.town || data.address?.village,
        state: data.address?.state,
        country: data.address?.country,
        postalCode: data.address?.postcode,
      };
    } catch (error) {
      console.error("Nominatim reverse geocoding error:", error);
      return { lat, lng, address: `${lat}, ${lng}` };
    }
  },
};

// Proper map implementation using user-configurable tile providers
const defaultMapRenderer = (params: {
  location: LocationValue | null;
  onLocationSelect: (location: LocationValue) => void;
  mapContainer: HTMLDivElement;
  zoom: number;
  readonly: boolean;
  defaultLocation?: { lat: number; lng: number };
}) => {
  const {
    location,
    onLocationSelect,
    mapContainer,
    zoom,
    readonly,
    defaultLocation,
  } = params;

  // Initialize Leaflet map
  const leafletMap = (window as any).L.map(mapContainer, {
    center: [
      location?.lat || defaultLocation?.lat || 51.5074,
      location?.lng || defaultLocation?.lng || -0.1278,
    ],
    zoom: zoom || 10,
    zoomControl: true,
    dragging: !readonly,
    touchZoom: !readonly,
    scrollWheelZoom: !readonly,
    doubleClickZoom: !readonly,
    boxZoom: !readonly,
    keyboard: !readonly,
    tap: !readonly,
  });

  // Default tile layer - OpenStreetMap
  const osmTileLayer = (window as any).L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }
  );

  // Add default tile layer
  osmTileLayer.addTo(leafletMap);

  // Current marker
  let currentMarker: any = null;

  // Update marker position
  const updateMarker = (loc: LocationValue | null) => {
    if (currentMarker) {
      leafletMap.removeLayer(currentMarker);
      currentMarker = null;
    }

    if (loc) {
      const customIcon = (window as any).L.divIcon({
        className: "custom-div-icon",
        html: `
          <div style="
            background-color: #ef4444;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            white-space: nowrap;
            position: relative;
            margin-bottom: 8px;
          ">
            📍 ${loc.address || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`}
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid #ef4444;
            margin: 0 auto;
            margin-top: -4px;
          "></div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      currentMarker = (window as any).L.marker([loc.lat, loc.lng], {
        icon: customIcon,
      });
      currentMarker.addTo(leafletMap);

      // Center map on marker
      leafletMap.setView([loc.lat, loc.lng], leafletMap.getZoom());
    }
  };

  // Handle map clicks
  if (!readonly) {
    leafletMap.on("click", (e: any) => {
      const { lat, lng } = e.latlng;

      onLocationSelect({
        lat: lat,
        lng: lng,
        address: `Map Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      });
    });
  }

  // Initial marker update
  updateMarker(location);

  return {
    cleanup: () => {
      if (leafletMap) {
        leafletMap.remove();
      }
    },
    updateLocation: (newLocation: LocationValue) => {
      updateMarker(newLocation);
    },
    switchTileLayer: (tileConfig: {
      url: string;
      attribution: string;
      maxZoom?: number;
      apiKey?: string;
    }) => {
      // Remove current tile layer
      leafletMap.eachLayer((layer: any) => {
        if (layer instanceof (window as any).L.TileLayer) {
          leafletMap.removeLayer(layer);
        }
      });

      // Add new tile layer
      const newTileLayer = (window as any).L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom || 18,
      });

      newTileLayer.addTo(leafletMap);
    },
  };
};

// Utility to format coordinates
const formatCoordinates = (
  lat: number,
  lng: number,
  format: "decimal" | "dms" = "decimal"
) => {
  if (format === "decimal") {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } else {
    // Convert to degrees, minutes, seconds
    const latDeg = Math.floor(Math.abs(lat));
    const latMin = Math.floor((Math.abs(lat) - latDeg) * 60);
    const latSec = ((Math.abs(lat) - latDeg) * 60 - latMin) * 60;
    const latDir = lat >= 0 ? "N" : "S";

    const lngDeg = Math.floor(Math.abs(lng));
    const lngMin = Math.floor((Math.abs(lng) - lngDeg) * 60);
    const lngSec = ((Math.abs(lng) - lngDeg) * 60 - lngMin) * 60;
    const lngDir = lng >= 0 ? "E" : "W";

    return `${latDeg}°${latMin}'${latSec.toFixed(
      2
    )}"${latDir}, ${lngDeg}°${lngMin}'${lngSec.toFixed(2)}"${lngDir}`;
  }
};

// Built-in tile providers configuration
const TILE_PROVIDERS = {
  openstreetmap: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  cartodb: {
    url: "https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  stamen: {
    url: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.png",
    attribution:
      'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxZoom: 19,
  },
};

// Constants - prevent re-creation
const DEFAULT_LOCATION = { lat: 51.5074, lng: -0.1278 };

// Load Leaflet CSS and JS dynamically
const loadLeaflet = () => {
  if (typeof (window as any).L !== "undefined") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.head.appendChild(script);
  });
};

interface LocationPickerFieldProps extends BaseFieldProps {
  locationConfig?: LocationConfig;
}

export const LocationPickerField: React.FC<LocationPickerFieldProps> = ({
  fieldApi,
  label,
  description,
  placeholder,
  wrapperClassName,
  labelClassName,
  inputClassName,
  locationConfig,
}) => {
  // Extract config with defaults - NO objects created inline
  const config = locationConfig || {};
  const defaultLocation = config.defaultLocation || DEFAULT_LOCATION;
  const zoom = config.zoom || 10;
  const searchPlaceholder = config.searchPlaceholder || "🔍 Search for an address or place...";
  const enableSearch = config.enableSearch !== false;
  const enableGeolocation = config.enableGeolocation !== false;
  const enableManualEntry = config.enableManualEntry !== false;
  const showMap = config.showMap !== false;
  const mapProvider = config.mapProvider || "openstreetmap";
  const searchCallback = config.searchCallback;
  const reverseGeocodeCallback = config.reverseGeocodeCallback;
  const mapRenderCallback = config.mapRenderCallback;
  
  // Search options with defaults
  const searchOpts = config.searchOptions || {};
  const debounceMs = searchOpts.debounceMs || 300;
  const minQueryLength = searchOpts.minQueryLength || 2;
  const maxResults = searchOpts.maxResults || 5;
  
  // UI options with defaults
  const uiOpts = config.ui || {};
  const showCoordinates = uiOpts.showCoordinates !== false;
  const showAddress = uiOpts.showAddress !== false;
  const mapHeight = uiOpts.mapHeight || 400;
  const coordinatesFormat = uiOpts.coordinatesFormat || "decimal";

  // Simple state - no complex dependencies
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<LocationSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationValue | null>(fieldApi.state?.value || null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // Load Leaflet on mount only if map is enabled - simple
  useEffect(() => {
    if (!showMap) {
      setLeafletLoaded(false);
      return;
    }
    
    loadLeaflet()
      .then(() => setLeafletLoaded(true))
      .catch(() => setGeoError("Failed to load map library"));
  }, [showMap]);

  // Search function - simple, no complex dependencies
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < minQueryLength) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      let results: LocationSearchResult[];
      
      if (searchCallback) {
        results = await searchCallback(query, { limit: maxResults });
      } else {
        results = await builtInProviders.nominatim(query, { 
          limit: maxResults,
          ...config.openStreetMap 
        });
      }
      
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error("Location search error:", error);
      setSearchResults([]);
      setGeoError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [searchCallback, minQueryLength, maxResults, config.openStreetMap]);

  // Debounced search - simple
  useEffect(() => {
    if (!enableSearch) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, enableSearch, performSearch, debounceMs]);

  // Location selection - simple
  const handleLocationSelect = useCallback(async (location: LocationValue) => {
    // Add address if missing
    if (!location.address && location.lat && location.lng) {
      try {
        let geocodedLocation: LocationValue;
        
        if (reverseGeocodeCallback) {
          geocodedLocation = await reverseGeocodeCallback(location.lat, location.lng);
        } else {
          geocodedLocation = await builtInProviders.nominatimReverse(
            location.lat, 
            location.lng, 
            config.openStreetMap
          );
        }
        
        location = { ...location, ...geocodedLocation };
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        location.address = `${location.lat}, ${location.lng}`;
      }
    }

    setCurrentLocation(location);
    fieldApi.handleChange(location);
    setShowResults(false);
    setSearchQuery(location.address || `${location.lat}, ${location.lng}`);
    setGeoError(null);

    if (mapInstanceRef.current?.updateLocation) {
      mapInstanceRef.current.updateLocation(location);
    }
  }, [fieldApi, reverseGeocodeCallback, config.openStreetMap]);

  // Initialize map - simple
  useEffect(() => {
    if (!showMap || !mapRef.current || !leafletLoaded) return;

    const mapRenderer = mapRenderCallback || defaultMapRenderer;
    
    const mapInstance = mapRenderer({
      location: currentLocation,
      onLocationSelect: handleLocationSelect,
      mapContainer: mapRef.current,
      zoom,
      readonly: false,
      defaultLocation,
    });

    mapInstanceRef.current = mapInstance;

    // Apply tile provider if not default
    if (mapProvider !== "openstreetmap") {
      const tileConfig = TILE_PROVIDERS[mapProvider as keyof typeof TILE_PROVIDERS];
      if (tileConfig && 'switchTileLayer' in mapInstance) {
        (mapInstance as any).switchTileLayer(tileConfig);
      }
    }

    return () => {
      if (mapInstance.cleanup) {
        mapInstance.cleanup();
      }
    };
  }, [showMap, leafletLoaded, currentLocation, handleLocationSelect, mapRenderCallback, zoom, defaultLocation, mapProvider]);

  // Simple handlers - no complex state
  const handleGetCurrentLocation = () => {
    if (!enableGeolocation || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: LocationValue = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: "Current Location",
        };
        handleLocationSelect(location);
      },
      (error) => {
        const errorMessages: Record<number, string> = {
          1: "Location access denied. Please enable location permissions.",
          2: "Location unavailable. Please try again.",
          3: "Location request timed out. Please try again.",
        };
        setGeoError(errorMessages[error.code] || "Failed to get location");
      }
    );
  };

  const handleManualCoordinatesSubmit = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const location: LocationValue = {
        lat,
        lng,
        address: `${lat}, ${lng}`,
      };
      handleLocationSelect(location);
      setIsManualDialogOpen(false);
      setManualLat("");
      setManualLng("");
    } else {
      setGeoError("Invalid coordinates. Please enter valid numbers.");
    }
  };

  const handleClearLocation = () => {
    setCurrentLocation(null);
    fieldApi.handleChange(null);
    setSearchQuery("");
    setGeoError(null);

    if (mapInstanceRef.current?.updateLocation) {
      mapInstanceRef.current.updateLocation(null);
    }
  };

  return (
    <FieldWrapper
      fieldApi={fieldApi}
      label={label}
      description={description}
      inputClassName={inputClassName}
      labelClassName={labelClassName}
      wrapperClassName={wrapperClassName}
    >
      <div className="space-y-3">
        {/* Address Search Input */}
        {enableSearch && (
          <div className="relative">
            <div className="relative">
              <Input
                id={fieldApi.name}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder || searchPlaceholder}
                className={cn(
                  "pl-10 pr-4",
                  inputClassName,
                  uiOpts.searchInputClassName,
                  isSearching && "animate-pulse"
                )}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-sm">🔍</span>
                )}
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Enhanced Search Results */}
            {showResults && searchResults.length > 0 && (
              <Card className="absolute top-full left-0 right-0 z-[999] mt-1 max-h-60 overflow-y-auto shadow-lg border-2">
                <div className="p-1">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="w-full text-left p-3 hover:bg-muted/80 rounded-md text-sm transition-colors border-b border-border/50 last:border-b-0"
                      onClick={() => handleLocationSelect(result)}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg mt-0.5">📍</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {result.address}
                          </div>
                          {showCoordinates && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatCoordinates(
                                result.lat,
                                result.lng,
                                coordinatesFormat
                              )}
                            </div>
                          )}
                          {result.city && (
                            <div className="text-xs text-muted-foreground/80 mt-0.5">
                              {[result.city, result.state, result.country]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* No Results Message */}
            {showResults &&
              searchResults.length === 0 &&
              !isSearching &&
              searchQuery.length >= minQueryLength && (
                <Card className="absolute top-full left-0 right-0 z-[70] mt-1 shadow-lg">
                  <div className="p-4 text-center text-muted-foreground">
                    <div className="text-2xl mb-2">🗺️</div>
                    <div className="text-sm">
                      No locations found for "{searchQuery}"
                    </div>
                    <div className="text-xs mt-1">
                      Try a different search term or use coordinates
                    </div>
                  </div>
                </Card>
              )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {enableGeolocation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
            >
              📍 Current Location
            </Button>
          )}

          {enableManualEntry && (
            <Dialog
              open={isManualDialogOpen}
              onOpenChange={setIsManualDialogOpen}
            >
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  🎯 Enter Coordinates
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Enter Coordinates</DialogTitle>
                  <DialogDescription>
                    Enter the latitude and longitude coordinates.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="latitude" className="text-right">
                      Latitude
                    </Label>
                    <Input
                      id="latitude"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g., 40.7128"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="longitude" className="text-right">
                      Longitude
                    </Label>
                    <Input
                      id="longitude"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      className="col-span-3"
                      placeholder="e.g., -74.0060"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsManualDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleManualCoordinatesSubmit}>
                    Set Location
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {currentLocation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearLocation}
            >
              🗑️ Clear
            </Button>
          )}
        </div>

        {/* Map */}
        {showMap && (
          <div className="relative">
            {!leafletLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-md">
                <div className="text-muted-foreground">Loading map...</div>
              </div>
            )}
            <div
              ref={mapRef}
              className={cn("w-full border rounded-md", uiOpts.mapClassName)}
              style={{ height: `${mapHeight}px`, minHeight: "300px" }}
            />
          </div>
        )}

        {/* Location Display */}
        {currentLocation && (
          <div className="text-sm space-y-1">
            {showAddress && currentLocation.address && (
              <div className="font-medium">{currentLocation.address}</div>
            )}
            {showCoordinates && (
              <div className="text-muted-foreground">
                📍{" "}
                {formatCoordinates(
                  currentLocation.lat,
                  currentLocation.lng,
                  coordinatesFormat
                )}
              </div>
            )}
            {currentLocation.city && (
              <div className="text-muted-foreground text-xs">
                {[
                  currentLocation.city,
                  currentLocation.state,
                  currentLocation.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {geoError && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">
            {geoError}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
};