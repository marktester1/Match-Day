// Usage: node tools/make_icons.mjs
// Draws the home-screen icon (a referee's whistle on a striped pitch) as icons/icon.svg,
// then renders the PNG sizes phones need. Needs the renderer once:
//   npm install --no-save @resvg/resvg-js
import {writeFileSync,mkdirSync} from 'node:fs';
import {Resvg} from '@resvg/resvg-js';

const S=512,INK='#1b211d';
// Everything stays inside the middle 80% that Android's icon masks keep.
const chamber={cx:212,cy:300,r:104};           // round body of the whistle
const tube={x:212,y:196,w:216,h:84,rx:16};     // mouthpiece, level with the top of the body
const ring={cx:128,cy:206,r:30};               // lanyard loop

const shapes=fill=>`
    <circle cx="${chamber.cx}" cy="${chamber.cy}" r="${chamber.r}" ${fill}/>
    <rect x="${tube.x}" y="${tube.y}" width="${tube.w}" height="${tube.h}" rx="${tube.rx}" ${fill}/>`;

const stripes=Array.from({length:8},(_,i)=>i%2?`<rect x="${i*64}" width="64" height="${S}" fill="#237a43"/>`:'').join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>
    <linearGradient id="metal" gradientUnits="userSpaceOnUse" x1="0" y1="${tube.y}" x2="0" y2="${chamber.cy+chamber.r}">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef2ef"/><stop offset="1" stop-color="#c9d3cc"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="#1e6a3a"/>${stripes}
  <ellipse cx="${S/2+10}" cy="${chamber.cy+chamber.r+14}" rx="170" ry="22" fill="#0b2a16" opacity=".35"/>
  <circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${INK}" stroke-width="22"/>
  <circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="url(#metal)" stroke-width="10"/>
  <g stroke="${INK}" stroke-width="22" stroke-linejoin="round">${shapes(`fill="${INK}"`)}</g>
  <g>${shapes('fill="url(#metal)"')}</g>
  <rect x="246" y="196" width="56" height="26" rx="5" fill="${INK}"/>
  <circle cx="${chamber.cx}" cy="${chamber.cy+4}" r="34" fill="none" stroke="#c9d3cc" stroke-width="8"/>
</svg>
`;

mkdirSync('icons',{recursive:true});
writeFileSync('icons/icon.svg',svg);
for(const [name,size] of [['icon-512.png',512],['icon-192.png',192],['apple-touch-icon.png',180]]){
  writeFileSync('icons/'+name,new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
  console.log('icons/'+name);
}
