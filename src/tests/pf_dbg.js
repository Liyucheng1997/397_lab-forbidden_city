import { buildPlatform } from '../core/platform.js';
export default function build(ctx) {
  buildPlatform(ctx, { w: 10, d: 6, h: 2.2, style: 'xumizuo', railing: { style: 'marble_dragon', chishou: true } });
  return { cam: [3, 2.5, 9], tgt: [3, 2.0, 3] };
}
