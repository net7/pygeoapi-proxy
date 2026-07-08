declare module 'geostyler-sld-parser' {
    export default class SLDParser {
        readStyle(input: string): Promise<{
            output?: unknown;
            errors?: unknown[];
        }>;
    }
}
