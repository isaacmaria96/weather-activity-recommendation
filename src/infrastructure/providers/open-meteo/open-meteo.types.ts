export type OpenMeteoGeocodingResponse = {
  results?: OpenMeteoGeocodingResult[];
};

export type OpenMeteoGeocodingResult = {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
};
