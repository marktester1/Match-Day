// Usage: node tools/make_icons.mjs
// Draws the home-screen icon (a football on a striped pitch) as icons/icon.svg,
// then renders the PNG sizes phones need. Needs the renderer once:
//   npm install --no-save @resvg/resvg-js
import {writeFileSync,mkdirSync} from 'node:fs';
import {Resvg} from '@resvg/resvg-js';

const S=512,C=S/2,R=150; // ball radius: stays inside the middle 80% that Android's icon masks keep
const pt=(a,r,cx=C,cy=C)=>[cx+r*Math.cos(a*Math.PI/180),cy+r*Math.sin(a*Math.PI/180)];
const poly=ps=>ps.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' ');
const pent=(cx,cy,r,rot)=>[0,1,2,3,4].map(k=>pt(rot+72*k,r,cx,cy));

const INK='#1b211d';
const p=0.30*R;                       // centre pentagon
const d=0.97*R,q=0.31*R;              // outer pentagons: distance from centre, size
const centre=pent(C,C,p,-90);
const outer=[0,1,2,3,4].map(k=>{const a=-90+72*k,[cx,cy]=pt(a,d);return{a,ps:pent(cx,cy,q,a+180)}});

const seams=[];
outer.forEach((o,k)=>{
  seams.push([centre[k],o.ps[0]]);                 // centre pentagon corner -> outer pentagon's inner corner
  const next=outer[(k+1)%5];
  seams.push([o.ps[4],next.ps[1]]);                // short seam between neighbouring outer pentagons
});

const stripes=Array.from({length:8},(_,i)=>i%2?`<rect x="${i*64}" width="64" height="${S}" fill="#237a43"/>`:'').join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>
    <radialGradient id="shade" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".75" stop-color="#f1f4f2"/><stop offset="1" stop-color="#cfd8d2"/>
    </radialGradient>
    <clipPath id="ball"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>
  </defs>
  <rect width="${S}" height="${S}" fill="#1e6a3a"/>${stripes}
  <ellipse cx="${C+6}" cy="${C+R-4}" rx="${R*0.85}" ry="${R*0.16}" fill="#0b2a16" opacity=".35"/>
  <circle cx="${C}" cy="${C}" r="${R}" fill="url(#shade)"/>
  <g clip-path="url(#ball)" fill="${INK}" stroke="${INK}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <polygon points="${poly(centre)}"/>
    ${outer.map(o=>`<polygon points="${poly(o.ps)}"/>`).join('\n    ')}
    ${seams.map(([a,b])=>`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`).join('\n    ')}
  </g>
  <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${INK}" stroke-width="5"/>
</svg>
`;

mkdirSync('icons',{recursive:true});
writeFileSync('icons/icon.svg',svg);
for(const [name,size] of [['icon-512.png',512],['icon-192.png',192],['apple-touch-icon.png',180]]){
  writeFileSync('icons/'+name,new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng());
  console.log('icons/'+name);
}
