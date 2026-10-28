/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '@hs/ui/styles/*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '@hs/ui/*.css' {
  const content: Record<string, string>;
  export default content;
}

