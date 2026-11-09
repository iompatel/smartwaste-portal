const runtime = (window as Window & { __SWMS_CONFIG__?: { API_BASE_URL?: string } }).__SWMS_CONFIG__;
export const API_BASE_URL = runtime?.API_BASE_URL ?? 'http://localhost:4000/api';
export const APP_TITLE = 'Smart Waste Management System';
export const SESSION_TOKEN_KEY = 'swms_token';
export const SESSION_USER_KEY = 'swms_user';
export const THEME_KEY = 'swms_theme';
