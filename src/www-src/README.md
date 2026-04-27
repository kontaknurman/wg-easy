# wg-easy frontend

Vue 3 + Vite + Tailwind 3 SPA. Uses shadcn-style components built on
[reka-ui](https://reka-ui.com/) and [HugeIcons](https://hugeicons.com/).

## Develop

```sh
npm install
npm run dev          # vite dev server with /api proxied to localhost:51821
```

## Build

```sh
npm run build        # outputs to ../www/ which Express serves
```

The committed bundle in `../www/` is what production runs; rebuild and commit
when you change anything in here.
