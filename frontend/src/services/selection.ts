import type { Product, Room } from '../data';
import { ApiError } from './contracts';

// Deterministic UI constraints, independent of either transport or ML implementation.
export function compatible(product: Product, room: Pick<Room, 'wet' | 'heavy'>) {
  return (!room.wet || product.wet) && (!room.heavy || product.heavy);
}
export function roomWithCatalog(room: Room, catalog: Product[]): Room {
  const select = (category: 'floor' | 'walls', previous: string) => {
    const available = catalog.filter(
      (product) => product.category === category && product.coverage > 0 && compatible(product, room),
    );
    if (!available.length)
      throw new ApiError(
        `В каталоге нет подходящего материала для ${category === 'floor' ? 'пола' : 'стен'} этой комнаты. Измените условия или дополните каталог.`,
        'invalid',
      );
    return available.find((product) => product.id === previous)?.id || available[0].id;
  };
  return { ...room, floor: select('floor', room.floor), wall: select('walls', room.wall) };
}
