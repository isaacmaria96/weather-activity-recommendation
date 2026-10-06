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

export type OpenMeteoWeatherForecastResponse = {
  daily?: {
    time?: string[];
    temperature_2m_min?: NullableNumberArray;
    temperature_2m_max?: NullableNumberArray;
    precipitation_probability_max?: NullableNumberArray;
    precipitation_sum?: NullableNumberArray;
    rain_sum?: NullableNumberArray;
    snowfall_sum?: NullableNumberArray;
    wind_speed_10m_max?: NullableNumberArray;
    weather_code?: Array<number | null>;
    sunshine_duration?: NullableNumberArray;
  };
};

export type OpenMeteoMarineForecastResponse = {
  daily?: {
    time?: string[];
    wave_height_max?: NullableNumberArray;
    wave_period_max?: NullableNumberArray;
    wind_wave_height_max?: NullableNumberArray;
    swell_wave_height_max?: NullableNumberArray;
    swell_wave_period_max?: NullableNumberArray;
  };
};

type NullableNumberArray = Array<number | null>;
