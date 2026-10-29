import { buildHall } from '../core/building.js';
export default function build(ctx) {
  buildHall(ctx, { grade: 2, eaveW: 34, eaveD: 18, nBays: 5, nDepth: 3, roof: { type: 'xieshan' }, plaque: '乾清门', kind: 'gate' });
  buildHall(ctx.at(45, 0, 0), { grade: 2, eaveW: 40, eaveD: 24, nBays: 7, double: { inset: 4 }, roof: { type: 'wudian' }, plaque: '保和殿' });
  return { cam: [20, 9, 32], tgt: [10, 9, 0] };
}
