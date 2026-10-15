// Loads road directions for every route in view (cached per origin/destination pair).
import { useEffect, useState } from 'react';
import { ORIGIN_COORDINATES, type Destination, type Route } from '../../data/dataset';
import { getDirections, type Directions } from '../../services/directions';

export function useDirections(routes: { route: Route; destination: Destination }[]) {
  const [byRoute, setByRoute] = useState<Record<string, Directions>>({});
  const [loading, setLoading] = useState(true);
  const key = routes.map((r) => `${r.route.route_id}@${r.destination.coordinates.lat},${r.destination.coordinates.lng}`).join('|');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all(
      routes.map(async ({ route, destination }) => [route.route_id, await getDirections(ORIGIN_COORDINATES, destination.coordinates)] as const)
    ).then((pairs) => {
      if (!alive) return;
      setByRoute(Object.fromEntries(pairs));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const approximate = Object.values(byRoute).some((d) => d.approximate);
  return { byRoute, loading, approximate };
}
