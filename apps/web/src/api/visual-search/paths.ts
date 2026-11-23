const BASE = '/api/v1/visual-search';

export const visualSearchPaths = {
  search: BASE,
  status: `${BASE}/status`,
  input: `${BASE}/input`,
  inputById: (id: string) => `${BASE}/input/${encodeURIComponent(id)}`,
};
