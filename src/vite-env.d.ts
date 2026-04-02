/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SUPPORT_DATA_SOURCE?: string;
	readonly VITE_STREAMLINE_API_BASE_URL?: string;
	readonly VITE_STREAMLINE_API_TOKEN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
