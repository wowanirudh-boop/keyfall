export const SALAMANDER_ATTRIBUTION =
  "Salamander Grand Piano by Alexander Holm · CC BY 3.0";

export const SALAMANDER_SOURCE_URL =
  "https://github.com/sfzinstruments/SalamanderGrandPiano";
export const SALAMANDER_LICENSE_URL =
  "https://creativecommons.org/licenses/by/3.0/";

export const SALAMANDER_SAMPLE_BASE_URL = "/audio/salamander/";

export const SALAMANDER_SAMPLE_ROOTS = Object.freeze({
  21: "A0.mp3",
  27: "Ds1.mp3",
  33: "A1.mp3",
  39: "Ds2.mp3",
  45: "A2.mp3",
  51: "Ds3.mp3",
  57: "A3.mp3",
  63: "Ds4.mp3",
  69: "A4.mp3",
  75: "Ds5.mp3",
  81: "A5.mp3",
  87: "Ds6.mp3",
  93: "A6.mp3",
  99: "Ds7.mp3",
  108: "C8.mp3",
});

export const SALAMANDER_SAMPLE_BYTES = 1_036_423;
export const SALAMANDER_SAMPLE_BUDGET_BYTES = 8 * 1024 * 1024;

export const TONE_SAMPLER_OPTIONS = Object.freeze({
  urls: SALAMANDER_SAMPLE_ROOTS,
  baseUrl: SALAMANDER_SAMPLE_BASE_URL,
  release: 1,
});
