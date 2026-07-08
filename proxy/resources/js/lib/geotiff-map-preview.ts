import { fromArrayBuffer } from 'geotiff';
import SLDParser from 'geostyler-sld-parser';

export type Rgba = [number, number, number, number];

export type ColorStop = {
    quantity: number;
    color: Rgba;
};

export type GeoTiffMapPreview = {
    canvas: HTMLCanvasElement;
    coordinates: [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
    ];
    bounds: [number, number, number, number];
    styleWarning: string | null;
};

export async function buildGeoTiffMapPreview({
    geotiffBuffer,
    sldText,
    maxSize = 1024,
    signal,
}: {
    geotiffBuffer: ArrayBuffer;
    sldText: string;
    maxSize?: number;
    signal?: AbortSignal;
}): Promise<GeoTiffMapPreview> {
    const tiff = await fromArrayBuffer(geotiffBuffer, signal);
    const image = await tiff.getImage();
    const bounds = image.getBoundingBox();

    if (!isLngLatBoundingBox(bounds)) {
        throw new Error('unsupported-bounds');
    }

    const size = scaledRasterSize(image.getWidth(), image.getHeight(), maxSize);
    const raster = await image.readRasters({
        samples: [0],
        width: size.width,
        height: size.height,
        resampleMethod: 'bilinear',
        signal,
    });

    const band = Array.isArray(raster) ? raster[0] : raster;
    const values = Array.from(band as ArrayLike<number>);
    const [minimum, maximum] = valueRange(values);
    const styleResult = await readSldColorStops(sldText);
    const colorStops =
        styleResult.colorStops.length > 0
            ? styleResult.colorStops
            : [
                  { quantity: minimum, color: [35, 55, 72, 255] as Rgba },
                  { quantity: maximum, color: [238, 232, 178, 255] as Rgba },
              ];

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('canvas-context-unavailable');
    }

    const imageData = context.createImageData(size.width, size.height);

    for (let index = 0; index < values.length; index += 1) {
        const color = Number.isFinite(values[index])
            ? colorForValue(values[index], colorStops)
            : ([0, 0, 0, 0] as Rgba);
        const offset = index * 4;

        imageData.data[offset] = color[0];
        imageData.data[offset + 1] = color[1];
        imageData.data[offset + 2] = color[2];
        imageData.data[offset + 3] = color[3];
    }

    context.putImageData(imageData, 0, 0);

    const [west, south, east, north] = bounds;

    return {
        canvas,
        coordinates: [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
        ],
        bounds,
        styleWarning: styleResult.warning,
    };
}

export function isLngLatBoundingBox(
    bounds: number[],
): bounds is [number, number, number, number] {
    if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
        return false;
    }

    const [west, south, east, north] = bounds;

    return (
        west >= -180 &&
        east <= 180 &&
        south >= -90 &&
        north <= 90 &&
        west < east &&
        south < north
    );
}

export function scaledRasterSize(
    width: number,
    height: number,
    maxSize: number,
): { width: number; height: number } {
    const scale = Math.min(1, maxSize / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

export function colorStopsFromGeoStylerStyle(style: unknown): ColorStop[] {
    const rules = recordArray(propertyRecord(style, 'rules'));

    for (const rule of rules) {
        const symbolizers = recordArray(propertyRecord(rule, 'symbolizers'));

        for (const symbolizer of symbolizers) {
            if (symbolizer.kind !== 'Raster') {
                continue;
            }

            const colorMap = propertyRecord(symbolizer, 'colorMap');
            const entries = recordArray(
                propertyRecord(colorMap, 'colorMapEntries'),
            );
            const stops = entries
                .map((entry): ColorStop | null => {
                    const quantity = Number(entry.quantity);
                    const color = parseCssColor(String(entry.color ?? ''));

                    if (!Number.isFinite(quantity) || !color) {
                        return null;
                    }

                    return { quantity, color };
                })
                .filter((entry): entry is ColorStop => entry !== null)
                .sort((left, right) => left.quantity - right.quantity);

            if (stops.length > 0) {
                return stops;
            }
        }
    }

    return [];
}

export function colorForValue(value: number, stops: ColorStop[]): Rgba {
    if (stops.length === 0) {
        return [0, 0, 0, 0];
    }

    if (value <= stops[0].quantity) {
        return stops[0].color;
    }

    for (let index = 1; index < stops.length; index += 1) {
        const lower = stops[index - 1];
        const upper = stops[index];

        if (value <= upper.quantity) {
            const span = upper.quantity - lower.quantity || 1;
            const ratio = (value - lower.quantity) / span;

            return [
                interpolate(lower.color[0], upper.color[0], ratio),
                interpolate(lower.color[1], upper.color[1], ratio),
                interpolate(lower.color[2], upper.color[2], ratio),
                interpolate(lower.color[3], upper.color[3], ratio),
            ];
        }
    }

    return stops[stops.length - 1].color;
}

async function readSldColorStops(
    sldText: string,
): Promise<{ colorStops: ColorStop[]; warning: string | null }> {
    try {
        const parser = new SLDParser();
        const response = await parser.readStyle(sldText);
        const colorStops = colorStopsFromGeoStylerStyle(response.output);

        if ((response.errors?.length ?? 0) > 0 || colorStops.length === 0) {
            return {
                colorStops,
                warning: 'style-fallback',
            };
        }

        return { colorStops, warning: null };
    } catch {
        return { colorStops: [], warning: 'style-fallback' };
    }
}

function valueRange(values: number[]): [number, number] {
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;

    for (const value of values) {
        if (!Number.isFinite(value)) {
            continue;
        }

        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
    }

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
        return [0, 1];
    }

    return minimum === maximum ? [minimum, minimum + 1] : [minimum, maximum];
}

function propertyRecord(
    value: unknown,
    property: string,
): Record<string, unknown> | unknown[] | null {
    if (!isRecord(value)) {
        return null;
    }

    const propertyValue = value[property];

    if (isRecord(propertyValue) || Array.isArray(propertyValue)) {
        return propertyValue;
    }

    return null;
}

function recordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is Record<string, unknown> =>
              isRecord(entry),
          )
        : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseCssColor(color: string): Rgba | null {
    const hex = color.trim();

    if (/^#[0-9a-f]{3}$/i.test(hex)) {
        return [
            Number.parseInt(hex[1] + hex[1], 16),
            Number.parseInt(hex[2] + hex[2], 16),
            Number.parseInt(hex[3] + hex[3], 16),
            255,
        ];
    }

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
        return [
            Number.parseInt(hex.slice(1, 3), 16),
            Number.parseInt(hex.slice(3, 5), 16),
            Number.parseInt(hex.slice(5, 7), 16),
            255,
        ];
    }

    return null;
}

function interpolate(start: number, end: number, ratio: number): number {
    return Math.round(start + (end - start) * ratio);
}
