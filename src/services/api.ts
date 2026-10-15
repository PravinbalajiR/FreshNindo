// FreshRoute — fetch wrapper for the Express backend.
// Falls back to the backend port directly when the Vite dev proxy is unavailable.

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, options);
    // If dev server proxy returns 404 or isn't active, fallback to direct backend port 3001
    if (res.status === 404 && url.startsWith('/api')) {
      return await fetch(`http://localhost:3001${url}`, options);
    }
    return res;
  } catch (err) {
    if (url.startsWith('/api')) {
      return await fetch(`http://localhost:3001${url}`, options);
    }
    throw err;
  }
}
