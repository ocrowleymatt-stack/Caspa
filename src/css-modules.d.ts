// Ambient types for CSS Module imports so `import styles from './x.module.css'`
// is type-checked instead of erroring under `tsc --noEmit`.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
