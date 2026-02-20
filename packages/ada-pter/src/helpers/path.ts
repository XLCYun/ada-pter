export const joinPath = (base: string, path: string): string => {
	base = base.endsWith("/") ? base : base + "/";
	path = path.startsWith("/") ? path.slice(1) : path;
	return base + path;
};
