import type { ComponentType } from 'react';

/** Contract every docs sample module must satisfy. */
export interface SampleMeta {
  /** URL-hash id, e.g. "basic". */
  id: string;
  /** Sidebar/title text. */
  title: string;
  /** One-line description shown under the title. */
  description: string;
  /** Grouping in the sidebar. */
  group: 'Getting started' | 'Features' | 'Data sources' | 'Frameworks' | 'Reference';
  /** Source snippet shown in the "Code" tab. */
  code: string;
}

export interface SampleModule {
  meta: SampleMeta;
  /** The live, interactive example component. */
  Component: ComponentType;
}
