/**
 * @pvotly/angular — standalone Angular bindings for pvotly.
 *
 * Remember to import the stylesheet once in your app (e.g. in `angular.json`
 * `styles` or a global stylesheet):
 * ```ts
 * import '@pvotly/web/styles.css';
 * ```
 */
export { PivotTableComponent } from './pivot-table.component';

// Re-export the web + engine surface so consumers have one import for everything.
export * from '@pvotly/web';
