import {useId, type ComponentPropsWithoutRef} from 'react';

export function CartoonExplosion(props: ComponentPropsWithoutRef<'svg'>) {
  return <svg {...props} viewBox="137 135 190 235" aria-hidden="true" focusable="false">
    <path d="M209 198 L238 175 L266 223 L290 215 L279 271 L307 282
      L280 306 L272 348 L263 360 L246 310 L191 349 L210 283
      L139 284 L194 244 L139 200 L208 200 Z"
      fill="#ffda00" stroke="#10151f" strokeWidth="2.4" strokeLinejoin="miter"/>
    <path d="M172 211 L221 244 L172 272 L216 272 L200 324
      L240 295 L252 301 L263 336 L266 292 L290 282 L268 271
      L276 237 L259 244 L235 200 L222 211 Z" fill="#ffa800"/>
  </svg>;
}

export function CartoonPaper(props: ComponentPropsWithoutRef<'svg'>) {
  const colour = useId(), grain = useId();
  return <svg {...props} viewBox="0 0 300 295" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={colour} cx="51%" cy="49%" r="64%">
        <stop offset="0" stopColor="#fff"/>
        <stop offset=".72" stopColor="#fff"/>
        <stop offset="1" stopColor="#fffbd6"/>
      </radialGradient>
      <pattern id={grain} width="11" height="13" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="2" r=".35" fill="#e9d773"/>
        <circle cx="8" cy="9" r=".3" fill="#e9d773"/>
        <path d="M4 5 h.5 M10 3 h.4 M2 11 h.6" stroke="#ecdd92" strokeWidth=".35"/>
      </pattern>
    </defs>
    <path d="M6 28 L58 18 L145 15 L218 7 L282 1 L280 16 L284 52
      L271 56 L284 59 L282 76 L279 129 L277 192 L289 243
      L280 257 L264 274 L231 278 L225 266 L218 276 L184 272
      L147 270 L117 269 L73 269 L45 273 L44 269 L41 274 L32 274
      L29 267 L29 275 L8 278 L7 255 L12 256 L9 250 L26 248
      L10 240 L9 237 L15 232 L9 235 L15 180 L15 161 L9 129
      L8 116 L18 103 L14 100 L14 82 L10 76 L7 49 Z"
      transform="translate(2 3)" fill="#080d29"/>
    <path d="M6 28 L58 18 L145 15 L218 7 L282 1 L280 16 L284 52
      L271 56 L284 59 L282 76 L279 129 L277 192 L289 243
      L280 257 L264 274 L231 278 L225 266 L218 276 L184 272
      L147 270 L117 269 L73 269 L45 273 L44 269 L41 274 L32 274
      L29 267 L29 275 L8 278 L7 255 L12 256 L9 250 L26 248
      L10 240 L9 237 L15 232 L9 235 L15 180 L15 161 L9 129
      L8 116 L18 103 L14 100 L14 82 L10 76 L7 49 Z"
      fill={`url(#${colour})`} stroke="#10151f" strokeWidth="1.5"/>
    <path d="M10 31 L280 7 L281 52 L273 56 L280 61 L274 192
      L285 242 L260 270 L233 274 L225 263 L216 272 L150 265
      L73 265 L45 269 L30 271 L11 274 L11 255 L28 249 L12 238
      L18 178 L12 130 L11 117 L21 103 L17 98 L17 81 L11 73 Z"
      fill={`url(#${grain})`} opacity=".45"/>
  </svg>;
}
