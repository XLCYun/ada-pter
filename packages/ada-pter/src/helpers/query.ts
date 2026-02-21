export const buildQuery = (input: Record<string, unknown>): string => {
  const query = new URLSearchParams();
  Object.entries(input)
    .filter(([_, v]) => Boolean(v))
    .forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((item) => {
          query.append(k, String(item));
        });
        return;
      }

      query.set(k, String(v));
    });

  const qs = query.toString();
  return qs ? `?${qs}` : "";
};
