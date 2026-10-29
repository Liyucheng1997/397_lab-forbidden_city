import { buildTower } from '../core/building.js';
export default function build(ctx) {
  // 文渊阁式（两层，外观上下两层带腰檐）
  buildTower(ctx.at(-30, 0, 0), { grade: 3, eaveW: 34, eaveD: 18, nBays: 6, tile: 'black', roof: { type: 'xieshan', tile: 'black', ridgeColor: 'green' },
    stories: [{ colH: 5 }, { colH: 4, inset: 0.6, balcony: true }] });
  // 畅音阁式（三层）
  buildTower(ctx.at(25, 0, 0), { grade: 3, eaveW: 20, eaveD: 18, nBays: 3, nDepth: 3, roof: { type: 'xieshan' },
    stories: [{ colH: 6, front: 'open' }, { colH: 4.2, inset: 0.5, front: 'open' }, { colH: 3.6, inset: 0.6 }] });
  return { cam: [10, 26, 60], tgt: [0, 9, 0] };
}
