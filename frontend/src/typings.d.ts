declare global {
  interface Window {
    __SWMS_CONFIG__?: {
      API_BASE_URL?: string;
    };
  }
}

export {};
